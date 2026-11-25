import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { resolveApiUser } from "@/lib/auth/api-session";

const ALLOWED_PROFILE_REPORT_REASONS = new Set([
  "harassment",
  "hate",
  "spam",
  "impersonation",
  "inappropriate",
  "other",
]);

export const Route = createFileRoute("/api/profile/report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const sql = await getSql();
          const apiUser = await resolveApiUser(request, sql);

          if (!apiUser?.id) {
            return Response.json(
              { error: "É necessário estar autenticado para denunciar um perfil." },
              { status: 401 },
            );
          }

          let body: any;
          try {
            body = await request.json();
          } catch {
            return Response.json(
              { error: "Formato de dados inválido (esperado JSON)." },
              { status: 400 },
            );
          }

          const targetUserId =
            typeof body?.targetUserId === "string" ? body.targetUserId.trim() : "";
          const targetNick =
            typeof body?.targetNick === "string" ? body.targetNick.trim() : "";
          const rawReason =
            typeof body?.reason === "string" ? body.reason.trim().toLowerCase() : "";
          const description =
            typeof body?.description === "string" ? body.description.trim() : "";

          let resolvedTargetUserId = targetUserId;

          if (!resolvedTargetUserId && targetNick) {
            const userRes = await sql.query(
              `select "id" from "user" where lower("nick") = lower($1) limit 1`,
              [targetNick.replace(/^@+/, "")],
            );
            const rows = Array.isArray(userRes) ? userRes : (userRes as any)?.rows ?? [];
            if (rows.length > 0) {
              resolvedTargetUserId = rows[0].id;
            }
          }

          if (!resolvedTargetUserId) {
            return Response.json(
              { error: "Usuário alvo não especificado ou não encontrado." },
              { status: 400 },
            );
          }

          if (resolvedTargetUserId === apiUser.id) {
            return Response.json(
              { error: "Não é permitido denunciar o próprio perfil." },
              { status: 400 },
            );
          }

          // Verificar se o usuário alvo realmente existe
          const targetCheck = await sql.query(
            `select "id" from "user" where "id" = $1 limit 1`,
            [resolvedTargetUserId],
          );
          const targetRows = Array.isArray(targetCheck) ? targetCheck : (targetCheck as any)?.rows ?? [];
          if (targetRows.length === 0) {
            return Response.json(
              { error: "O perfil informado não foi encontrado." },
              { status: 404 },
            );
          }

          const reason = ALLOWED_PROFILE_REPORT_REASONS.has(rawReason) ? rawReason : "other";

          if (description.length > 1000) {
            return Response.json(
              { error: "A descrição não pode exceder 1000 caracteres." },
              { status: 400 },
            );
          }

          // Prevenir spam / denúncias duplicadas abusivas pendentes recentes
          const existingPending = await sql.query(
            `
              select "id" from "profile_report"
              where "reporterUserId" = $1
                and "reportedUserId" = $2
                and "status" = 'pending'
              limit 1
            `,
            [apiUser.id, resolvedTargetUserId],
          );
          const existingRows = Array.isArray(existingPending) ? existingPending : (existingPending as any)?.rows ?? [];
          if (existingRows.length > 0) {
            return Response.json({
              success: true,
              message: "Denúncia já enviada anteriormente e pendente de análise.",
            });
          }

          const reportId = `pr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

          await sql.query(
            `
              insert into "profile_report" (
                "id",
                "reporterUserId",
                "reportedUserId",
                "reason",
                "description",
                "status",
                "createdAt",
                "updatedAt"
              )
              values ($1, $2, $3, $4, $5, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `,
            [reportId, apiUser.id, resolvedTargetUserId, reason, description || null],
          );

          return Response.json({
            success: true,
            message: "Denúncia enviada com sucesso. Nossa equipe analisará em breve.",
          });
        } catch (error) {
          console.error("[api/profile/report] Erro ao registrar denúncia de perfil:", error);
          return Response.json(
            { error: "Não foi possível registrar a denúncia neste momento." },
            { status: 500 },
          );
        }
      },
    },
  },
});
