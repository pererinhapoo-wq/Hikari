import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import {
  assertSameSiteRequest,
  CrossSiteRequestError,
} from "@/lib/auth/isolation.server";
import {
  AdminAuthError,
  verifyAdminRequest,
} from "@/lib/auth/admin.server";
import { BAN_DURATION_PRESETS } from "@/lib/moderation-ban-types";
import {
  applyTemporaryUserBan,
  listBansAndHistory,
  ModerationBanError,
  revokeUserBan,
} from "@/lib/moderation-bans.server";

export const Route = createFileRoute("/api/admin/bans")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          assertSameSiteRequest();
          try {
            await verifyAdminRequest(request);
          } catch (err) {
            if (err instanceof AdminAuthError) {
              return Response.json({ error: err.message }, { status: err.status });
            }
            return Response.json({ error: "Acesso não autorizado." }, { status: 403 });
          }

          const sql = await getSql();
          const data = await listBansAndHistory(sql);

          return Response.json(
            {
              ok: true,
              activeBans: data.activeBans,
              history: data.history,
              presets: BAN_DURATION_PRESETS,
            },
            {
              headers: {
                "Cache-Control": "private, no-cache, no-store, must-revalidate",
              },
            },
          );
        } catch (err) {
          if (err instanceof CrossSiteRequestError) {
            return Response.json({ error: err.message }, { status: err.status });
          }
          console.error("[api/admin/bans] Erro no GET:", err);
          return Response.json(
            { error: "Não foi possível carregar os banimentos." },
            { status: 500 },
          );
        }
      },

      POST: async ({ request }) => {
        try {
          assertSameSiteRequest();
          let adminSession: { id: string; email: string; name?: string | null };
          try {
            adminSession = await verifyAdminRequest(request);
          } catch (err) {
            if (err instanceof AdminAuthError) {
              return Response.json({ error: err.message }, { status: err.status });
            }
            return Response.json({ error: "Acesso não autorizado." }, { status: 403 });
          }

          let body: Record<string, unknown>;
          try {
            body = (await request.json()) as Record<string, unknown>;
          } catch {
            return Response.json({ error: "JSON inválido." }, { status: 400 });
          }

          const userId =
            typeof body.userId === "string" ? body.userId.trim() : "";
          const preset =
            typeof body.preset === "string" ? body.preset.trim() : "1h";
          const customAmount =
            typeof body.customAmount === "number" ||
            typeof body.customAmount === "string"
              ? body.customAmount
              : null;
          const customUnit =
            typeof body.customUnit === "string" ? body.customUnit.trim() : null;
          const reason =
            typeof body.reason === "string" ? body.reason : "";
          const isPermanent =
            body.isPermanent === true || preset.toLowerCase() === "permanent";

          const sql = await getSql();
          const ban = await applyTemporaryUserBan(sql, {
            targetUserId: userId,
            preset,
            customAmount,
            customUnit,
            isPermanent,
            reason,
            actorId: adminSession.id,
            actorEmail: adminSession.email,
            actorName: adminSession.name,
          });

          return Response.json(
            {
              ok: true,
              ban,
              message: ban.isPermanent
                ? "Banimento permanente aplicado com sucesso."
                : `Banimento temporário aplicado por ${ban.durationLabel}.`,
            },
            { status: 201 },
          );
        } catch (err) {
          if (err instanceof CrossSiteRequestError) {
            return Response.json({ error: err.message }, { status: err.status });
          }
          if (err instanceof ModerationBanError) {
            return Response.json({ error: err.message }, { status: err.status });
          }
          console.error("[api/admin/bans] Erro no POST:", err);
          return Response.json(
            { error: "Não foi possível aplicar o banimento temporário." },
            { status: 500 },
          );
        }
      },

      DELETE: async ({ request }) => {
        try {
          assertSameSiteRequest();
          let adminSession: { id: string; email: string; name?: string | null };
          try {
            adminSession = await verifyAdminRequest(request);
          } catch (err) {
            if (err instanceof AdminAuthError) {
              return Response.json({ error: err.message }, { status: err.status });
            }
            return Response.json({ error: "Acesso não autorizado." }, { status: 403 });
          }

          const url = new URL(request.url);
          let userId = (url.searchParams.get("userId") || "").trim();
          let revokeReason: string | null =
            url.searchParams.get("reason")?.trim() || null;

          if (!userId) {
            try {
              const body = (await request.json()) as Record<string, unknown>;
              if (typeof body.userId === "string") {
                userId = body.userId.trim();
              }
              if (typeof body.reason === "string" && body.reason.trim()) {
                revokeReason = body.reason.trim();
              }
            } catch {
              // Query param flow without body
            }
          }

          const sql = await getSql();
          const result = await revokeUserBan(sql, {
            targetUserId: userId,
            actorId: adminSession.id,
            actorEmail: adminSession.email,
            actorName: adminSession.name,
            revokeReason,
          });

          return Response.json({
            ok: true,
            revokedBan: result.revokedBan,
            message: "Banimento encerrado antecipadamente.",
          });
        } catch (err) {
          if (err instanceof CrossSiteRequestError) {
            return Response.json({ error: err.message }, { status: err.status });
          }
          if (err instanceof ModerationBanError) {
            return Response.json({ error: err.message }, { status: err.status });
          }
          console.error("[api/admin/bans] Erro no DELETE:", err);
          return Response.json(
            { error: "Não foi possível remover o banimento." },
            { status: 500 },
          );
        }
      },
    },
  },
});
