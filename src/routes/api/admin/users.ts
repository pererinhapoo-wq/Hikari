import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { assertSameSiteRequest, CrossSiteRequestError } from "@/lib/auth/isolation.server";
import {
  requireAdminUser,
  getEnvAdminUserIds,
  AdminGuardError,
} from "@/lib/auth/admin-guard";
import { isHikariAdmin } from "@/lib/auth/admin";
import { getSql } from "@/lib/db";

export interface AdminUserListItem {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: string;
  updatedAt: string;
  nick: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  accountType: string;
  role: "admin" | "user";
  bio: string | null;
  isVerified: boolean;
  isSystemAdmin: boolean;
  isCurrentAdmin: boolean;
}

const updateRoleSchema = z.object({
  userId: z.string().trim().min(1, "ID do usuário é obrigatório"),
  role: z.enum(["admin", "user"], {
    message: "O papel deve ser 'admin' ou 'user'",
  }),
});

export const Route = createFileRoute("/api/admin/users")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          assertSameSiteRequest();
          const callerAdminId = await requireAdminUser(request);

          const url = new URL(request.url);
          const search = (url.searchParams.get("search") || "").trim().toLowerCase();
          const roleFilter = (url.searchParams.get("role") || "all").trim().toLowerCase();
          const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
          const limit = Math.min(
            100,
            Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10) || 20),
          );
          const offset = (page - 1) * limit;

          const sql = await getSql();

          // Contagens estatísticas globais
          const [statsRow] = await sql.query<{
            total_users: string;
            total_admins: string;
            total_verified: string;
          }>(`
            SELECT
              COUNT(u."id")::text as total_users,
              COUNT(CASE WHEN COALESCE(p."role", 'user') = 'admin' THEN 1 END)::text as total_admins,
              COUNT(CASE WHEN p."isVerified" = true THEN 1 END)::text as total_verified
            FROM "user" u
            LEFT JOIN "profile" p ON p."userId" = u."id";
          `);

          const envAdminIds = getEnvAdminUserIds();

          // Montagem dinâmica dos filtros
          const conditions: string[] = [];
          const params: unknown[] = [];

          if (search) {
            params.push(`%${search}%`);
            const pIdx = params.length;
            conditions.push(`(
              LOWER(u."name") LIKE $${pIdx} OR
              LOWER(u."email") LIKE $${pIdx} OR
              LOWER(COALESCE(p."nick", '')) LIKE $${pIdx} OR
              LOWER(COALESCE(p."displayName", '')) LIKE $${pIdx}
            )`);
          }

          if (roleFilter === "admin") {
            conditions.push(`COALESCE(p."role", 'user') = 'admin'`);
          } else if (roleFilter === "user") {
            conditions.push(`COALESCE(p."role", 'user') != 'admin'`);
          }

          const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

          // Contagem do filtro
          const [countResult] = await sql.query<{ total: string }>(
            `SELECT COUNT(u."id")::text as total
             FROM "user" u
             LEFT JOIN "profile" p ON p."userId" = u."id"
             ${whereClause};`,
            params,
          );

          const totalFiltered = parseInt(countResult?.total || "0", 10);

          // Consulta paginada dos usuários
          const queryParams = [...params, limit, offset];
          const limitIdx = params.length + 1;
          const offsetIdx = params.length + 2;

          const rows = await sql.query<{
            id: string;
            name: string;
            email: string;
            emailVerified: boolean;
            image: string | null;
            createdAt: string;
            updatedAt: string;
            nick: string | null;
            displayName: string | null;
            avatarUrl: string | null;
            bannerUrl: string | null;
            accountType: string | null;
            role: string | null;
            bio: string | null;
            isVerified: boolean | null;
          }>(
            `SELECT
               u."id",
               u."name",
               u."email",
               u."emailVerified",
               u."image",
               u."createdAt"::text as "createdAt",
               u."updatedAt"::text as "updatedAt",
               p."nick",
               p."displayName",
               p."avatarUrl",
               p."bannerUrl",
               COALESCE(p."accountType", 'public') as "accountType",
               COALESCE(p."role", 'user') as "role",
               p."bio",
               COALESCE(p."isVerified", false) as "isVerified"
             FROM "user" u
             LEFT JOIN "profile" p ON p."userId" = u."id"
             ${whereClause}
             ORDER BY u."createdAt" DESC
             LIMIT $${limitIdx} OFFSET $${offsetIdx};`,
            queryParams,
          );

          const users: AdminUserListItem[] = rows.map((r) => {
            const isSysAdmin =
              envAdminIds.includes(r.id) || isHikariAdmin(r.email);

            return {
              id: r.id,
              name: r.name,
              email: r.email,
              emailVerified: Boolean(r.emailVerified),
              image: r.image,
              createdAt: r.createdAt,
              updatedAt: r.updatedAt,
              nick: r.nick,
              displayName: r.displayName,
              avatarUrl: r.avatarUrl,
              bannerUrl: r.bannerUrl,
              accountType: r.accountType || "public",
              role: (r.role === "admin" || isSysAdmin ? "admin" : "user") as "admin" | "user",
              bio: r.bio,
              isVerified: Boolean(r.isVerified),
              isSystemAdmin: isSysAdmin,
              isCurrentAdmin: r.id === callerAdminId,
            };
          });

          return Response.json({
            ok: true,
            users,
            pagination: {
              total: totalFiltered,
              page,
              limit,
              totalPages: Math.ceil(totalFiltered / limit) || 1,
            },
            stats: {
              totalUsers: parseInt(statsRow?.total_users || "0", 10),
              totalAdmins: parseInt(statsRow?.total_admins || "0", 10),
              totalVerified: parseInt(statsRow?.total_verified || "0", 10),
            },
            callerAdminId,
          });
        } catch (err) {
          if (err instanceof CrossSiteRequestError) {
            return Response.json({ error: "Origem cruzada não permitida." }, { status: err.status });
          }
          if (err instanceof AdminGuardError) {
            return Response.json({ error: err.message }, { status: err.status });
          }
          console.error("[api/admin/users] Erro ao listar usuários:", err);
          return Response.json({ error: "Erro interno ao consultar usuários." }, { status: 500 });
        }
      },

      PATCH: async ({ request }) => {
        try {
          assertSameSiteRequest();
          const callerAdminId = await requireAdminUser(request);

          let rawBody: unknown;
          try {
            rawBody = await request.json();
          } catch {
            return Response.json({ error: "JSON inválido." }, { status: 400 });
          }

          const parsed = updateRoleSchema.safeParse(rawBody);
          if (!parsed.success) {
            const msg = parsed.error.issues[0]?.message || "Dados inválidos.";
            return Response.json({ error: msg }, { status: 400 });
          }

          const { userId, role } = parsed.data;

          // 1. Não permite alterar o próprio privilégio (evita auto-despromoção acidental)
          if (userId === callerAdminId) {
            return Response.json(
              { error: "Você não pode alterar seu próprio privilégio administrativo." },
              { status: 400 },
            );
          }

          const sql = await getSql();

          // 2. Consulta o usuário de destino
          const [targetUser] = await sql.query<{ id: string; email: string; name: string }>(
            `SELECT "id", "email", "name" FROM "user" WHERE "id" = $1 LIMIT 1;`,
            [userId],
          );

          if (!targetUser) {
            return Response.json({ error: "Usuário não encontrado." }, { status: 404 });
          }

          // 3. Impede rebaixamento de administradores de sistema declarados via allowlist/env
          const isSysAdmin =
            getEnvAdminUserIds().includes(userId) || isHikariAdmin(targetUser.email);

          if (isSysAdmin && role === "user") {
            return Response.json(
              {
                error:
                  "Não é permitido rebaixar esta conta: ela é um administrador de sistema declarado por allowlist de infraestrutura.",
              },
              { status: 403 },
            );
          }

          // 4. Executa upsert em profile garantindo persistência do novo papel
          await sql.query(
            `INSERT INTO "profile" ("userId", "role", "createdAt", "updatedAt")
             VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON CONFLICT ("userId") DO UPDATE
             SET "role" = EXCLUDED."role", "updatedAt" = CURRENT_TIMESTAMP;`,
            [userId, role],
          );

          return Response.json({
            ok: true,
            userId,
            role,
            message: `Papel do usuário "${targetUser.name || targetUser.email}" atualizado com sucesso para "${role}".`,
          });
        } catch (err) {
          if (err instanceof CrossSiteRequestError) {
            return Response.json({ error: "Origem cruzada não permitida." }, { status: err.status });
          }
          if (err instanceof AdminGuardError) {
            return Response.json({ error: err.message }, { status: err.status });
          }
          console.error("[api/admin/users] Erro ao atualizar papel:", err);
          return Response.json({ error: "Erro interno ao atualizar usuário." }, { status: 500 });
        }
      },
    },
  },
});
