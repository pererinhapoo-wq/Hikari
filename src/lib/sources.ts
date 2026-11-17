import { getSql } from "@/lib/db";

export interface ResolvedEpisodeSource {
  directUrl: string | null;
  iframeUrl: string | null;
  provider?: string;
  unavailable?: boolean;
}

/**
 * Resolve a fonte do episódio (URL HLS direta via proxy / iframe fallback)
 * a partir da tabela episode_sources, executando a re-resolution por página se necessário.
 */
export async function resolveEpisode(
  episodeId: string,
  fallbackIframeUrl?: string | null,
): Promise<ResolvedEpisodeSource> {
  const iframeUrl = fallbackIframeUrl ?? null;
  const cleanEpId = episodeId?.trim();
  if (!cleanEpId) {
    return { directUrl: null, iframeUrl, unavailable: true };
  }

  try {
    const sql = await getSql();
    const rows = await sql.query<{
      id: string;
      episode_id: string;
      provider: string;
      page_url: string;
      direct_url: string | null;
      resolved_at: string | null;
      priority: number;
    }>(
      `SELECT "id", "episode_id", "provider", "page_url", "direct_url", "resolved_at", "priority"
       FROM "episode_sources"
       WHERE "episode_id" = $1
       ORDER BY "priority" ASC
       LIMIT 1;`,
      [cleanEpId],
    );

    const sourceRecord = rows[0];
    if (!sourceRecord || !sourceRecord.page_url) {
      return { directUrl: null, iframeUrl, unavailable: true };
    }

    const now = Date.now();
    const resolvedAtTime = sourceRecord.resolved_at ? new Date(sourceRecord.resolved_at).getTime() : 0;
    const tenMinutes = 10 * 60 * 1000;

    let directUrl = sourceRecord.direct_url;

    // Se directUrl não existir ou resolved_at > 10 min, re-resolver a partir de page_url
    if (!directUrl || (now - resolvedAtTime > tenMinutes)) {
      try {
        // Tenta resolver via worker / resolver interno
        const workerResolveUrl = `https://hikari-hls.workers.dev/resolve?page_url=${encodeURIComponent(sourceRecord.page_url)}`;
        const res = await fetch(workerResolveUrl, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const data = (await res.json()) as { directUrl?: string };
          if (data?.directUrl) {
            directUrl = data.directUrl;
            // Atualiza no banco (persistindo page_url, atualizando direct_url resolvido temporariamente)
            await sql.query(
              `UPDATE "episode_sources" SET "direct_url" = $1, "resolved_at" = NOW() WHERE "id" = $2;`,
              [directUrl, sourceRecord.id],
            );
          }
        }
      } catch {
        // Falha na re-resolução de rede
      }
    }

    if (!directUrl) {
      return { directUrl: null, iframeUrl, unavailable: true };
    }

    // Retorna com proxy HLS se directUrl não for absolute worker url
    const proxyDirectUrl = directUrl.startsWith("http")
      ? `/api/hls?u=${encodeURIComponent(directUrl)}`
      : directUrl;

    return {
      directUrl: proxyDirectUrl,
      iframeUrl,
      provider: sourceRecord.provider,
      unavailable: false,
    };
  } catch (err) {
    console.warn("[Hikari] Falha segura ao resolver fonte do episódio:", err);
    return { directUrl: null, iframeUrl, unavailable: true };
  }
}
