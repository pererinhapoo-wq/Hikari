import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

export const Route = createFileRoute(
  "/api/users/search",
)({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(
            request.url,
          );

          const q =
            url.searchParams
              .get("q")
              ?.trim() ?? "";

          if (!q) {
            return Response.json({
              users: [],
            });
          }

          if (q.length > 100) {
            return Response.json(
              {
                error:
                  "A busca é muito longa.",
              },
              {
                status: 400,
              },
            );
          }

          const sql =
            await getSql();

          const result =
            await sql.query(
              `
                select
                  "id",
                  "name",
                  "image"
                from "user"
                where
                  "name" ilike $1
                order by
                  "name" asc
                limit 20
              `,
              [`%${q}%`],
            );

          const rows =
            Array.isArray(result)
              ? result
              : result?.rows ?? [];

          const users = rows.map(
            (user) => ({
              id: user.id,
              name:
                user.name ||
                "Usuário",
              image:
                user.image ??
                null,
            }),
          );

          return Response.json({
            users,
          });
        } catch (error) {
          console.error(
            "ERRO AO BUSCAR USUÁRIOS:",
            error,
          );

          return Response.json(
            {
              error:
                "Não foi possível buscar usuários.",
            },
            {
              status: 500,
            },
          );
        }
      },
    },
  },
});
