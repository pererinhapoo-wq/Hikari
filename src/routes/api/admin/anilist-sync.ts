import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  assertSameSiteRequest,
  CrossSiteRequestError,
} from "@/lib/auth/isolation.server";
import { AdminGuardError, requireAdminUser } from "@/lib/auth/admin-guard";
import {
  AniListSyncConflictError,
  getAniListSyncStatus,
  startAniListSync,
  stepAniListSync,
} from "@/lib/anilist-sync.server";

const postBodySchema = z.object({
  action: z.enum(["start", "step"]).default("start"),
  runId: z.string().max(128).optional().nullable(),
});

export const Route = createFileRoute("/api/admin/anilist-sync")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          assertSameSiteRequest();
          await requireAdminUser(request);

          const sync = await getAniListSyncStatus();
          return Response.json({ ok: true, sync });
        } catch (err) {
          if (err instanceof CrossSiteRequestError) {
            return Response.json(
              { ok: false, error: "Origem cruzada não permitida." },
              { status: err.status },
            );
          }
          if (err instanceof AdminGuardError) {
            return Response.json(
              { ok: false, error: err.message },
              { status: err.status },
            );
          }
          console.error("[api/admin/anilist-sync] Erro no GET:", err);
          return Response.json(
            { ok: false, error: "Erro interno ao consultar status da sincronização." },
            { status: 500 },
          );
        }
      },

      POST: async ({ request }) => {
        try {
          assertSameSiteRequest();
          const adminId = await requireAdminUser(request);

          let rawBody: unknown = {};
          const contentType = request.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            try {
              rawBody = await request.json();
            } catch {
              return Response.json(
                { ok: false, error: "JSON inválido." },
                { status: 400 },
              );
            }
          }

          const parsed = postBodySchema.safeParse(rawBody);
          if (!parsed.success) {
            return Response.json(
              { ok: false, error: "Ação de sincronização inválida." },
              { status: 400 },
            );
          }

          if (parsed.data.action === "step") {
            const sync = await stepAniListSync({ runId: parsed.data.runId ?? null });
            return Response.json({ ok: true, sync });
          }

          const { snapshot } = await startAniListSync({ adminId });
          return Response.json(
            {
              ok: true,
              accepted: true,
              sync: snapshot,
            },
            { status: 202 },
          );
        } catch (err) {
          if (err instanceof CrossSiteRequestError) {
            return Response.json(
              { ok: false, error: "Origem cruzada não permitida." },
              { status: err.status },
            );
          }
          if (err instanceof AdminGuardError) {
            return Response.json(
              { ok: false, error: err.message },
              { status: err.status },
            );
          }
          if (err instanceof AniListSyncConflictError) {
            return Response.json(
              { ok: false, error: err.message },
              { status: 409 },
            );
          }
          console.error("[api/admin/anilist-sync] Erro no POST:", err);
          return Response.json(
            { ok: false, error: "Erro interno ao controlar sincronização AniList." },
            { status: 500 },
          );
        }
      },
    },
  },
});
