import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminMiddleware } from "@/lib/auth/middleware";
import type { AniListSyncStatusSnapshot } from "./anilist-sync-types";

const stepInputSchema = z
  .object({
    runId: z.string().max(128).optional().nullable(),
  })
  .optional();

/**
 * Consulta segura do status, checkpoint pendente, frequência e última execução
 * da sincronização AniList (somente administrador autenticado).
 */
export const getAniListSyncStatusFn = createServerFn({
  method: "GET",
})
  .middleware([adminMiddleware])
  .handler(async (): Promise<AniListSyncStatusSnapshot> => {
    const { getAniListSyncStatus } = await import("./anilist-sync.server");
    return getAniListSyncStatus();
  });

/**
 * Inicia a sincronização real da AniList em segundo plano (ou modo fatiado em serverless),
 * retornando imediatamente sem aguardar conclusão síncrona na requisição HTTP.
 */
export const startAniListSyncFn = createServerFn({
  method: "POST",
})
  .middleware([adminMiddleware])
  .handler(
    async ({
      context,
    }): Promise<{ accepted: true; snapshot: AniListSyncStatusSnapshot }> => {
      const { startAniListSync } = await import("./anilist-sync.server");
      return startAniListSync({ adminId: context.adminSession.id });
    },
  );

/**
 * Executa uma fatia temporal controlada da sincronização quando o runtime serverless
 * opera em modo fatiado (ex.: Vercel), preservando checkpoints atômicos a cada página.
 */
export const stepAniListSyncFn = createServerFn({
  method: "POST",
})
  .middleware([adminMiddleware])
  .validator((data: unknown) => stepInputSchema.parse(data))
  .handler(async ({ data }): Promise<AniListSyncStatusSnapshot> => {
    const { stepAniListSync } = await import("./anilist-sync.server");
    return stepAniListSync({ runId: data?.runId ?? null });
  });
