import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { assertSameSiteRequest, CrossSiteRequestError } from "@/lib/auth/isolation.server";
import { AdminGuardError, requireAdminUser } from "@/lib/auth/admin-guard";
import {
  getCalendarSyncStatus,
  runAdminCalendarSync,
} from "@/lib/calendar-sync.server";

const syncRequestSchema = z.object({
  mode: z.enum(["schedule", "incremental", "full"]).default("schedule"),
  scheduleDaysForward: z.number().int().min(7).max(180).optional(),
});

export const Route = createFileRoute("/api/admin/calendar-sync")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          assertSameSiteRequest();
          const adminId = await requireAdminUser(request);
          const status = await getCalendarSyncStatus();

          return Response.json({
            ok: true,
            adminId,
            ...status,
          });
        } catch (err) {
          if (err instanceof CrossSiteRequestError) {
            return Response.json(
              { error: "Origem cruzada não permitida." },
              { status: err.status },
            );
          }
          if (err instanceof AdminGuardError) {
            return Response.json({ error: err.message }, { status: err.status });
          }
          console.error("[api/admin/calendar-sync] Erro no GET:", err);
          return Response.json(
            { error: "Erro interno ao consultar status da sincronização do calendário." },
            { status: 500 },
          );
        }
      },

      POST: async ({ request }) => {
        try {
          assertSameSiteRequest();
          const adminId = await requireAdminUser(request);

          let rawBody: unknown = {};
          const textBody = await request.text().catch(() => "");
          if (textBody.trim()) {
            try {
              rawBody = JSON.parse(textBody);
            } catch {
              return Response.json({ error: "JSON inválido." }, { status: 400 });
            }
          }

          const parsed = syncRequestSchema.safeParse(rawBody);
          if (!parsed.success) {
            return Response.json(
              {
                error:
                  parsed.error.issues[0]?.message ||
                  "Parâmetros de sincronização inválidos.",
              },
              { status: 400 },
            );
          }

          const { mode, scheduleDaysForward } = parsed.data;
          const result = await runAdminCalendarSync({
            mode,
            scheduleDaysForward: scheduleDaysForward ?? 90,
            timeBudgetMs: 25000,
          });

          if (result.status === "skipped_locked") {
            return Response.json(
              {
                ok: false,
                error:
                  "Já existe uma sincronização administrativa da AniList em andamento.",
                result,
              },
              { status: 409 },
            );
          }

          const status = await getCalendarSyncStatus();

          return Response.json({
            ok: true,
            adminId,
            result,
            ...status,
            message:
              result.status === "paused_checkpoint"
                ? `Sincronização avançou e salvou checkpoint (${result.importedSchedulesCount ?? 0} horários importados nesta etapa). Clique para retomar.`
                : `Sincronização concluída (${result.importedSchedulesCount ?? 0} horários em catalog_airing_schedule, ${result.totalInserted ?? 0} animes inseridos, ${result.totalUpdated ?? 0} atualizados).`,
          });
        } catch (err) {
          if (err instanceof CrossSiteRequestError) {
            return Response.json(
              { error: "Origem cruzada não permitida." },
              { status: err.status },
            );
          }
          if (err instanceof AdminGuardError) {
            return Response.json({ error: err.message }, { status: err.status });
          }
          console.error("[api/admin/calendar-sync] Erro no POST:", err);
          return Response.json(
            {
              error:
                err instanceof Error
                  ? err.message
                  : "Erro interno ao executar sincronização do calendário.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
