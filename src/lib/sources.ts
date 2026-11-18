import { getSql } from "@/lib/db";
import {
  getRedisEpisodeSource,
  acquireEpisodeResolutionLock,
  releaseEpisodeResolutionLock,
  setRedisEpisodeSourceWithFence,
  invalidateRedisEpisodeSource,
} from "@/lib/redis";

export interface ResolvedEpisodeSource {
  directUrl: string | null;
  iframeUrl: string | null;
  provider?: string;
  unavailable?: boolean;
}

/**
 * Resolve a fonte do episódio (URL HLS direta via proxy / iframe fallback)
 * a partir do cache Redis ou da tabela episode_sources, com proteção contra concorrência e fencing.
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

  const now = Date.now();
  const tenMinutes = 10 * 60 * 1000;
  const safetyMarginMs = 30000; // 30s margin

  try {
    // 1. Tenta recuperar do cache Redis primeiro (Cache Hit)
    const cached = await getRedisEpisodeSource(cleanEpId);
    if (cached && cached.directUrl) {
      const cachedResolvedAtTime = cached.resolvedAt
        ? new Date(cached.resolvedAt).getTime()
        : 0;
      const remainingMs = tenMinutes - (now - cachedResolvedAtTime);
      if (
        remainingMs > safetyMarginMs &&
        now - cachedResolvedAtTime <= tenMinutes
      ) {
        const proxyDirectUrl = cached.directUrl.startsWith("http")
          ? `/api/hls?u=${encodeURIComponent(cached.directUrl)}`
          : cached.directUrl;
        return {
          directUrl: proxyDirectUrl,
          iframeUrl,
          provider: cached.provider,
          unavailable: false,
        };
      }
    }

    // 2. Proteção contra concorrência (Thundering Herd / Distributed Lock)
    const lockToken =
      Math.random().toString(36).substring(2) + Date.now().toString(36);
    const { acquired, generation } = await acquireEpisodeResolutionLock(
      cleanEpId,
      lockToken,
    );

    if (!acquired) {
      // Outro processo está resolvendo. Aguarda brevemente verificando se o Redis foi populado.
      for (let attempt = 0; attempt < 3; attempt++) {
        await new Promise((r) => setTimeout(r, 350));
        const retryCached = await getRedisEpisodeSource(cleanEpId);
        if (retryCached && retryCached.directUrl) {
          const retryTime = retryCached.resolvedAt
            ? new Date(retryCached.resolvedAt).getTime()
            : 0;
          if (tenMinutes - (Date.now() - retryTime) > safetyMarginMs) {
            const proxyDirectUrl = retryCached.directUrl.startsWith("http")
              ? `/api/hls?u=${encodeURIComponent(retryCached.directUrl)}`
              : retryCached.directUrl;
            return {
              directUrl: proxyDirectUrl,
              iframeUrl,
              provider: retryCached.provider,
              unavailable: false,
            };
          }
        }
      }
    }

    // 3. Consulta o Neon DB (se adquiriu o lock ou se a espera esgotou)
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
      if (acquired) {
        await releaseEpisodeResolutionLock(cleanEpId, lockToken);
      }
      return { directUrl: null, iframeUrl, unavailable: true };
    }

    const resolvedAtTime = sourceRecord.resolved_at
      ? new Date(sourceRecord.resolved_at).getTime()
      : 0;
    let directUrl = sourceRecord.direct_url;
    let resolvedAtStr = sourceRecord.resolved_at;

    // Se directUrl não existir ou resolved_at > 10 min, re-resolver via worker
    if (!directUrl || Date.now() - resolvedAtTime > tenMinutes) {
      try {
        const workerResolveUrl = `https://hikari-hls.workers.dev/resolve?page_url=${encodeURIComponent(sourceRecord.page_url)}`;
        const res = await fetch(workerResolveUrl, {
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const data = (await res.json()) as { directUrl?: string };
          if (data?.directUrl) {
            directUrl = data.directUrl;
            // 3.1. Executar o UPDATE no Neon e confirmar sucesso
            await sql.query(
              `UPDATE "episode_sources" SET "direct_url" = $1, "resolved_at" = NOW() WHERE "id" = $2;`,
              [directUrl, sourceRecord.id],
            );
            resolvedAtStr = new Date().toISOString();

            // 3.2. Invalidar/atualizar chave Redis de forma consistente respeitando o banco como fonte de verdade
            await invalidateRedisEpisodeSource(cleanEpId);
          }
        }
      } catch {
        // Falha na re-resolução de rede
      }
    }

    if (acquired) {
      await releaseEpisodeResolutionLock(cleanEpId, lockToken);
    }

    if (!directUrl) {
      return { directUrl: null, iframeUrl, unavailable: true };
    }

    // Calcula TTL restante com margem de segurança
    const finalResolvedAtTime = resolvedAtStr
      ? new Date(resolvedAtStr).getTime()
      : Date.now();
    const remainingMs = tenMinutes - (Date.now() - finalResolvedAtTime);
    const ttlSec = Math.floor((remainingMs - safetyMarginMs) / 1000);

    if (ttlSec > 10) {
      // Grava no Redis protegido por fencing (generation token)
      await setRedisEpisodeSourceWithFence(
        cleanEpId,
        {
          directUrl,
          iframeUrl,
          provider: sourceRecord.provider,
          resolvedAt: resolvedAtStr ?? new Date().toISOString(),
          pageUrl: sourceRecord.page_url,
        },
        ttlSec,
        generation,
      );
    }

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
