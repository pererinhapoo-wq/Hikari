export const PROGRESS_PREFIX = "hikari_progress_";
export const PROGRESS_LIMIT = 300;

interface ProgressKeyInfo {
  key: string;
  animeId: string;
  episodeId: string;
  updatedAt?: number;
}

function parseProgressKey(
  key: string,
): { animeId: string; episodeId: string } | null {
  if (!key.startsWith(PROGRESS_PREFIX)) return null;
  const rest = key.slice(PROGRESS_PREFIX.length);
  const firstUnderscore = rest.indexOf("_");
  if (firstUnderscore === -1) {
    return { animeId: rest, episodeId: "" };
  }
  const animeId = rest.slice(0, firstUnderscore);
  const episodeId = rest.slice(firstUnderscore + 1);
  return { animeId, episodeId };
}

/**
 * Poda chaves de progresso de reprodução do localStorage se excederem o limite de 300.
 * Preserva os registros dos animes passados em keepAnimeIds.
 * Retorna o número de chaves removidas.
 */
export function pruneProgressKeys(keepAnimeIds?: Iterable<string>): number {
  if (typeof window === "undefined") return 0;

  try {
    const protectedSet = new Set(keepAnimeIds ?? []);
    const progressKeys: ProgressKeyInfo[] = [];

    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(PROGRESS_PREFIX)) {
        const parsed = parseProgressKey(key);
        if (parsed) {
          let updatedAt = 0;
          try {
            const rawVal = window.localStorage.getItem(key);
            if (rawVal) {
              const parsedVal = JSON.parse(rawVal);
              if (typeof parsedVal?.updatedAt === "number") {
                updatedAt = parsedVal.updatedAt;
              }
            }
          } catch (err) {
            void err;
          }
          progressKeys.push({
            key,
            animeId: parsed.animeId,
            episodeId: parsed.episodeId,
            updatedAt,
          });
        }
      }
    }

    // Só executa a poda quando a quantidade de chaves exceder o limite
    if (progressKeys.length <= PROGRESS_LIMIT) {
      return 0;
    }

    // Filtrar candidatos à remoção: preservar animes protegidos
    const candidates = progressKeys.filter(
      (item) => !protectedSet.has(item.animeId),
    );

    // Ordenar do mais antigo para o mais recente se tiver updatedAt
    candidates.sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0));

    const toRemoveCount = progressKeys.length - PROGRESS_LIMIT;
    const toRemove = candidates.slice(0, toRemoveCount);

    let removed = 0;
    for (const item of toRemove) {
      try {
        window.localStorage.removeItem(item.key);
        removed++;
      } catch (err) {
        console.warn("[Hikari] Erro ao remover chave durante poda:", err);
      }
    }

    return removed;
  } catch (err) {
    console.warn("[Hikari] Erro na verificação de poda de progresso:", err);
    return 0;
  }
}

/**
 * Executa uma operação com retry e poda em caso de estouro de quota no localStorage.
 * Trata erros de quota sem interromper a aplicação.
 */
export function withQuotaRetry<T>(
  fn: () => T,
  keepAnimeIds?: Iterable<string>,
): T | null {
  try {
    return fn();
  } catch (err: unknown) {
    const isQuotaError =
      err instanceof DOMException &&
      (err.code === 22 ||
        err.code === 1014 ||
        err.name === "QuotaExceededError" ||
        err.name === "NS_ERROR_DOM_QUOTA_REACHED");

    if (isQuotaError) {
      console.warn(
        "[Hikari] Quota de armazenamento atingida. Executando poda de progresso...",
      );
      try {
        pruneProgressKeys(keepAnimeIds);
        return fn();
      } catch (retryErr) {
        console.warn(
          "[Hikari] Falha na segunda tentativa após poda. Mantendo operação em memória.",
          retryErr,
        );
        return null;
      }
    }

    console.warn("[Hikari] Exceção em operação de armazenamento:", err);
    return null;
  }
}
