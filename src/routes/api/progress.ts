import { createFileRoute } from "@tanstack/react-router";
import { resolveApiUser } from "@/lib/auth/api-session";
import { getSql } from "@/lib/db";
import {
  recordProgressInRedis,
  getProgressFromRedis,
} from "@/lib/redis";

export const Route = createFileRoute("/api/progress")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const episodeId = url.searchParams.get("episodeId")?.trim();
          const sessionId = url.searchParams.get("sessionId")?.trim();

          if (!episodeId) {
            return Response.json(
              { error: "episodeId é obrigatório" },
              { status: 400 },
            );
          }

          // Resolver chave de sessão: userId se autenticado, senão anon:<sessionId>
          let userKey = sessionId ? `anon:${sessionId}` : "anon:default";
          try {
            const apiUser = await resolveApiUser(request);
            if (apiUser?.id) {
              userKey = apiUser.id;
            }
          } catch {}

          // 1. Tentar ler do Redis
          const cached = await getProgressFromRedis(userKey, episodeId);
          if (cached && cached.position > 0) {
            return Response.json(cached, {
              headers: {
                "Cache-Control": "private, no-cache, no-store, must-revalidate",
              },
            });
          }

          // 2. Fallback para Postgres
          try {
            const sql = await getSql();
            const rows = await sql.query<{
              position: number;
              duration: number;
            }>(
              `SELECT position, duration FROM progress WHERE user_key = $1 AND episode_id = $2 LIMIT 1`,
              [userKey, episodeId],
            );
            if (rows && rows.length > 0) {
              return Response.json(
                {
                  position: Number(rows[0].position) || 0,
                  duration: Number(rows[0].duration) || 0,
                },
                {
                  headers: {
                    "Cache-Control": "private, no-cache, no-store, must-revalidate",
                  },
                },
              );
            }
          } catch {
            // fallback safe
          }

          // 3. Padrão zero
          return Response.json(
            { position: 0, duration: 0 },
            {
              headers: {
                "Cache-Control": "private, no-cache, no-store, must-revalidate",
              },
            },
          );
        } catch (err) {
          return Response.json(
            { error: "Falha ao consultar progresso" },
            { status: 500 },
          );
        }
      },

      POST: async ({ request }) => {
        try {
          // Limite de 1KB
          const contentLength = request.headers.get("content-length");
          if (contentLength && parseInt(contentLength, 10) > 1024) {
            return new Response("Payload too large", { status: 413 });
          }

          const rawText = await request.text();
          if (rawText.length > 1024) {
            return new Response("Payload too large", { status: 413 });
          }

          let body: Record<string, unknown>;
          try {
            body = JSON.parse(rawText);
          } catch {
            return Response.json({ error: "JSON inválido" }, { status: 400 });
          }

          const { episodeId, position, duration, sessionId, event } = body;

          if (
            typeof episodeId !== "string" ||
            !episodeId.trim() ||
            typeof position !== "number" ||
            Number.isNaN(position) ||
            position < 0 ||
            typeof duration !== "number" ||
            Number.isNaN(duration) ||
            duration <= 0 ||
            typeof sessionId !== "string" ||
            !sessionId.trim() ||
            typeof event !== "string" ||
            !["interval", "pause", "seek", "hide"].includes(event)
          ) {
            return Response.json(
              { error: "Dados inválidos" },
              { status: 400 },
            );
          }

          // Validação de range (position <= duration + 5)
          if (position > duration + 5) {
            return Response.json(
              { error: "Posição fora do range válido" },
              { status: 400 },
            );
          }

          // Chave de sessão: userId se autenticado, senão anon:<sessionId>
          let userKey = `anon:${sessionId.trim()}`;
          try {
            const apiUser = await resolveApiUser(request);
            if (apiUser?.id) {
              userKey = apiUser.id;
            }
          } catch {}

          // Gravar no Redis sem tocar no Postgres (com rate limit de max 1 aceite a cada 5s)
          const result = await recordProgressInRedis({
            userKey,
            episodeId: episodeId.trim(),
            position: Math.floor(position),
            duration: Math.floor(duration),
            event: event as "interval" | "pause" | "seek" | "hide",
          });

          // Se excedente de rate limit: responder 202 e descartar
          if (!result.accepted) {
            return new Response(null, { status: 202 });
          }

          // Gravado com sucesso no Redis: responder 204
          return new Response(null, { status: 204 });
        } catch (err) {
          console.error("[api/progress] Erro no POST:", err);
          return Response.json(
            { error: "Erro interno" },
            { status: 500 },
          );
        }
      },
    },
  },
});
