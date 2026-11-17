import { getSql } from "@/lib/db";

export interface ResolvedEpisodeSource {
  directUrl: string | null;
  iframeUrl: string | null;
  provider?: string;
}

/**
 * Resolve a fonte do episódio (URL HLS direta via proxy / iframe fallback)
 * a partir da tabela episode_sources, sem nunca lançar exceções.
 */
export async function resolveEpisode(
  episodeId: string,
  fallbackIframeUrl?: string | null,
): Promise<ResolvedEpisodeSource> {
  const iframeUrl = fallbackIframeUrl ?? null;
  const cleanEpId = episodeId?.trim();
  if (!cleanEpId) {
    return { directUrl: null, iframeUrl };
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
    if (!sourceRecord) {
      return { directUrl: null, iframeUrl };
    }

    let directUrl = sourceRecord.direct_url;
    const now = Date.now();
    const resolvedAtTime = sourceRecord.resolved_at ? new Date(sourceRecord.resolved_at).getTime() : 0;
    const tenMinutes = 10 * 60 * 1000;

    // Se directUrl for nulo ou resolved_at > 10 min, poderíamos re-resolver (simulado aqui de forma resiliente)
    if (!directUrl || (now - resolvedAtTime > tenMinutes)) {
      // Se houvesse um scraper/resolver de página (page_url), chamaria aqui.
      // Caso falhe ou não implementado em runtime puro, mantemos o direct_url existente ou null.
    }

    return {
      directUrl: directUrl || null,
      iframeUrl,
      provider: sourceRecord.provider,
    };
  } catch (err) {
    console.warn("[Hikari] Falha segura ao resolver fonte do episódio:", err);
    return { directUrl: null, iframeUrl };
  }
}
