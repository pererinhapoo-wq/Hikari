import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { auth, authConfigured } from "@/lib/auth/server";
import { DEV_USER_ID } from "@/lib/auth/verify.server";
import { isHikariAdmin } from "@/lib/auth/admin";
import {
  DEFAULT_BANNER_SETTINGS,
  sanitizeBannerSettings,
} from "@/lib/banner-settings";

export const Route = createFileRoute("/api/admin/banner-settings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const session = await auth.api.getSession({
            headers: request.headers,
          });

          let email = session?.user?.email ?? null;
          let userId = session?.user?.id ?? null;

          if (!userId && !authConfigured) {
            userId = DEV_USER_ID;
            email = "dev@example.com";
          }

          if (!userId || !isHikariAdmin(email)) {
            return Response.json(
              { error: "Acesso permitido somente ao administrador." },
              { status: 403 },
            );
          }

          const sql = await getSql();

          // Garante a tabela sem necessidade de migration separada
          await sql.query(`
            create table if not exists "admin_banner_settings" (
              "userId" text primary key,
              "settings" text not null,
              "updatedAt" timestamptz default current_timestamp not null
            );
          `);

          const result = await sql.query<{ settings: string }>(
            `
              select "settings"
              from "admin_banner_settings"
              where "userId" = $1
              limit 1
            `,
            [userId],
          );

          const rows = Array.isArray(result) ? result : (result as { rows?: Array<{ settings: string }> })?.rows ?? [];

          if (rows.length === 0 || !rows[0]?.settings) {
            return Response.json({
              success: true,
              settings: DEFAULT_BANNER_SETTINGS,
              isDefault: true,
            });
          }

          try {
            const parsed = JSON.parse(rows[0].settings);
            const settings = sanitizeBannerSettings(parsed);
            return Response.json({
              success: true,
              settings,
              isDefault: false,
            });
          } catch {
            return Response.json({
              success: true,
              settings: DEFAULT_BANNER_SETTINGS,
              isDefault: true,
            });
          }
        } catch (error) {
          console.error("ERRO AO RECUPERAR AJUSTES DE BANNER:", error);
          return Response.json(
            { error: "Não foi possível carregar as preferências de banner." },
            { status: 500 },
          );
        }
      },

      POST: async ({ request }) => {
        try {
          const session = await auth.api.getSession({
            headers: request.headers,
          });

          let email = session?.user?.email ?? null;
          let userId = session?.user?.id ?? null;

          if (!userId && !authConfigured) {
            userId = DEV_USER_ID;
            email = "dev@example.com";
          }

          if (!userId || !isHikariAdmin(email)) {
            return Response.json(
              { error: "Acesso permitido somente ao administrador." },
              { status: 403 },
            );
          }

          let body: unknown;
          try {
            body = await request.json();
          } catch {
            return Response.json(
              { error: "Formato JSON inválido." },
              { status: 400 },
            );
          }

          const rawSettings = (body as { settings?: unknown })?.settings ?? body;
          const settings = sanitizeBannerSettings(rawSettings);

          const sql = await getSql();

          await sql.query(`
            create table if not exists "admin_banner_settings" (
              "userId" text primary key,
              "settings" text not null,
              "updatedAt" timestamptz default current_timestamp not null
            );
          `);

          await sql.query(
            `
              insert into "admin_banner_settings" ("userId", "settings", "updatedAt")
              values ($1, $2, current_timestamp)
              on conflict ("userId")
              do update set
                "settings" = excluded."settings",
                "updatedAt" = current_timestamp;
            `,
            [userId, JSON.stringify(settings)],
          );

          return Response.json({
            success: true,
            settings,
          });
        } catch (error) {
          console.error("ERRO AO SALVAR AJUSTES DE BANNER:", error);
          return Response.json(
            { error: "Não foi possível salvar as preferências de banner." },
            { status: 500 },
          );
        }
      },
    },
  },
});
