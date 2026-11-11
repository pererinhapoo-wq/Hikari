import type { LocalAnime } from "@/lib/types";

export const BATCH_SIZE = 100;

export interface FailedBatchItem {
  batchIndex: number;
  animes: LocalAnime[];
  error: string;
  status?: number;
}

export interface BatchImportProgress {
  totalAnimes: number;
  processedAnimes: number;
  totalBatches: number;
  completedBatches: number;
  failedBatches: number;
  importedEpisodes: number;
  currentBatchIndex: number;
  status: "idle" | "importing" | "completed" | "error";
  message?: string;
}

export interface BatchImportResult {
  ok: boolean;
  totalAnimes: number;
  importedAnimes: number;
  importedEpisodes: number;
  completedBatchIndices: number[];
  failedBatches: FailedBatchItem[];
  abortedDueToAuth?: boolean;
  error?: string;
}

/**
 * Divide um array em fatias de tamanho máximo N.
 */
function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Espera assíncrona para políticas de backoff (ex: HTTP 429).
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executa a importação sequencial do catálogo por lotes de 100 animes.
 * Garante que falhas sejam identificáveis por lote para reenvio seletivo.
 */
export async function importCatalogInBatches(
  animes: LocalAnime[],
  onProgress?: (progress: BatchImportProgress) => void,
): Promise<BatchImportResult> {
  if (!Array.isArray(animes) || animes.length === 0) {
    return {
      ok: true,
      totalAnimes: 0,
      importedAnimes: 0,
      importedEpisodes: 0,
      completedBatchIndices: [],
      failedBatches: [],
    };
  }

  const chunks = chunkArray(animes, BATCH_SIZE);
  const totalBatches = chunks.length;
  const completedBatchIndices: number[] = [];
  const failedBatches: FailedBatchItem[] = [];

  let importedAnimesCount = 0;
  let importedEpisodesCount = 0;

  for (let i = 0; i < chunks.length; i++) {
    const currentChunk = chunks[i];

    onProgress?.({
      totalAnimes: animes.length,
      processedAnimes: importedAnimesCount,
      totalBatches,
      completedBatches: completedBatchIndices.length,
      failedBatches: failedBatches.length,
      importedEpisodes: importedEpisodesCount,
      currentBatchIndex: i + 1,
      status: "importing",
      message: `Enviando lote ${i + 1} de ${totalBatches} (${currentChunk.length} animes)...`,
    });

    let res: Response | null = null;
    let netError: string | null = null;

    try {
      res = await fetch("/api/admin/catalog-import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          animes: currentChunk,
        }),
      });

      // Política de espera para rate-limit (HTTP 429)
      if (res.status === 429) {
        console.warn("[catalog-import-client] Rate limit (429). Aguardando 2.5s...");
        await delay(2500);
        // Retenta uma vez após o backoff
        res = await fetch("/api/admin/catalog-import", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            animes: currentChunk,
          }),
        });
      }
    } catch (err) {
      netError = err instanceof Error ? err.message : "Falha na conexão de rede.";
    }

    // 1. Falha de autorização (401 ou 403): aborta a importação imediatamente
    if (res && (res.status === 401 || res.status === 403)) {
      const authMsg =
        res.status === 401
          ? "Sessão não autenticada. Faça login com conta de administrador."
          : "Acesso negado: a conta logada não possui papel de administrador.";

      failedBatches.push({
        batchIndex: i,
        animes: currentChunk,
        error: authMsg,
        status: res.status,
      });

      onProgress?.({
        totalAnimes: animes.length,
        processedAnimes: importedAnimesCount,
        totalBatches,
        completedBatches: completedBatchIndices.length,
        failedBatches: failedBatches.length,
        importedEpisodes: importedEpisodesCount,
        currentBatchIndex: i + 1,
        status: "error",
        message: authMsg,
      });

      return {
        ok: false,
        totalAnimes: animes.length,
        importedAnimes: importedAnimesCount,
        importedEpisodes: importedEpisodesCount,
        completedBatchIndices,
        failedBatches,
        abortedDueToAuth: true,
        error: authMsg,
      };
    }

    // 2. Resposta de sucesso do backend (2xx)
    if (res && res.ok) {
      try {
        const json = await res.json();
        if (json?.ok) {
          completedBatchIndices.push(i);
          importedAnimesCount += currentChunk.length;
          importedEpisodesCount += Number(json.episodeCount ?? 0);
          continue;
        }
      } catch {
        // falha no parse do retorno
      }
    }

    // 3. Falha no lote (servidor, conflito 409 ou rede)
    let errMsg = netError || `Falha no lote ${i + 1}`;
    if (res) {
      try {
        const errJson = await res.json();
        if (errJson?.error) errMsg = errJson.error;
      } catch {
        errMsg = `HTTP ${res.status}`;
      }
    }

    failedBatches.push({
      batchIndex: i,
      animes: currentChunk,
      error: errMsg,
      status: res?.status,
    });
  }

  const allCompleted = failedBatches.length === 0;

  onProgress?.({
    totalAnimes: animes.length,
    processedAnimes: importedAnimesCount,
    totalBatches,
    completedBatches: completedBatchIndices.length,
    failedBatches: failedBatches.length,
    importedEpisodes: importedEpisodesCount,
    currentBatchIndex: totalBatches,
    status: allCompleted ? "completed" : "error",
    message: allCompleted
      ? "Importação no banco de dados concluída com sucesso!"
      : `${failedBatches.length} lote(s) apresentaram falhas e podem ser reenviados.`,
  });

  return {
    ok: allCompleted,
    totalAnimes: animes.length,
    importedAnimes: importedAnimesCount,
    importedEpisodes: importedEpisodesCount,
    completedBatchIndices,
    failedBatches,
  };
}

/**
 * Reenvia EXCLUSIVAMENTE os lotes que falharam, sem reprocessar lotes já confirmados.
 */
export async function retryFailedBatches(
  failedList: FailedBatchItem[],
  onProgress?: (progress: BatchImportProgress) => void,
): Promise<BatchImportResult> {
  const retryAnimes = failedList.flatMap((item) => item.animes);
  return importCatalogInBatches(retryAnimes, onProgress);
}
