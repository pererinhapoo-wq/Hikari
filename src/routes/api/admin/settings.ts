import { createFileRoute } from "@tanstack/react-router";
import { assertSameSiteRequest, CrossSiteRequestError } from "@/lib/auth/isolation.server";
import { requireAdminUser, AdminGuardError } from "@/lib/auth/admin-guard";
import {
  loadAllSettingsFromDb,
  saveSettingsToDb,
} from "@/lib/settings/settings.server";
import { updateAdminSettingsSchema } from "@/lib/settings/settings-types";

export const Route = createFileRoute("/api/admin/settings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          assertSameSiteRequest();
          const adminId = await requireAdminUser(request);
          const settings = await loadAllSettingsFromDb();

          return Response.json({
            ok: true,
            settings,
            adminId,
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

          console.error("[api/admin/settings] Erro ao carregar configurações:", err);
          return Response.json(
            { error: "Erro interno ao consultar configurações administrativas." },
            { status: 500 },
          );
        }
      },

      POST: async ({ request }) => {
        try {
          assertSameSiteRequest();
          const adminId = await requireAdminUser(request);

          let rawBody: unknown;
          try {
            rawBody = await request.json();
          } catch {
            return Response.json({ error: "JSON inválido." }, { status: 400 });
          }

          const parsed = updateAdminSettingsSchema.safeParse(rawBody);
          if (!parsed.success) {
            const firstMsg =
              parsed.error.issues[0]?.message || "Dados de configuração inválidos.";
            return Response.json(
              { error: firstMsg, details: parsed.error.issues },
              { status: 400 },
            );
          }

          const updated = await saveSettingsToDb(parsed.data);

          return Response.json({
            ok: true,
            settings: updated,
            adminId,
            message: "Configurações salvas com sucesso no Neon PostgreSQL.",
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

          console.error("[api/admin/settings] Erro ao salvar configurações:", err);
          return Response.json(
            { error: "Erro interno ao atualizar configurações administrativas." },
            { status: 500 },
          );
        }
      },
    },
  },
});
