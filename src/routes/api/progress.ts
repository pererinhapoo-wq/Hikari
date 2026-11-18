import { createFileRoute } from "@tanstack/react-router";
import { resolveApiUser } from "@/lib/auth/api-session";
import { getSql } from "@/lib/db";
import {
  recordProgressInRedis,
  getProgressFromRedis,
} from "@/lib/redis";

const MAX_PROGRESS_BODY_BYTES = 1024;
const VALID_PROGRESS_EVENTS = new Set(["interval", "pause", "seek", "hide"]);

function hasSessionCredentials(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return true;
  }
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return false;
  }
  return (
    cookieHeader.includes("session_token=") ||
    cookieHeader.includes("session_data=")
  );
}

async function resolveProgressUserKey(
  request: Request,
  sessionId?: string,
): Promise<string> {
  const cleanSessionId = sessionId?.trim();
  const fallbackKey = cleanSessionId ? `anon:${cleanSessionId}` : "anon:default";

  if (!hasSessionCredentials(request)) {
    return fallbackKey;
  }

  try {
    const apiUser = await resolveApiUser(request);
    if (apiUser?.id && apiUser.id !== "dev-user") {
      return apiUser.id;
    }
  } catch {
    // Fallback anônimo seguro sem tocar no banco
  }

  return fallbackKey;
}

export const Route = createFileRoute("/api/progress")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const episodeId = url.searchParams.get("episodeId")?.trim();
          const sessionId = url.searchParams.get("sessionId")?.trim();

          if (!episodeId || episodeId.length > 128 || episodeId.includes("|")) {
            return Response.json(
              { error: "episodeId inválido" },
              { status: 400 },
            );
          }

          if (sessionId && (sessionId.length > 128 || sessionId.includes("|"))) {
            return Response.json(
              { error: "sessionId inválido" },
              { status: 400 },
            );
          }

          // Resolver chave de sessão: userId se autenticado, senão anon:<sessionId>
          const userKey = await resolveProgressUserKey(request, sessionId);

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
        } catch {
          return Response.json(
            { error: "Falha ao consultar progresso" },
            { status: 500 },
          );
        }
      },

      POST: async ({ request }) => {
        try {
          // Limite estrito de 1KB
          const contentLength = request.headers.get("content-length");
          if (contentLength) {
            const declaredBytes = Number.parseInt(contentLength, 10);
            if (Number.isFinite(declaredBytes) && declaredBytes > MAX_PROGRESS_BODY_BYTES) {
              return new Response("Payload too large", { status: 413 });
            }
          }

          const rawText = await request.text();
          if (Buffer.byteLength(rawText, "utf8") > MAX_PROGRESS_BODY_BYTES) {
            return new Response("Payload too large", { status: 413 });
          }

          let body: Record<string, unknown>;
          try {
            const parsed = JSON.parse(rawText);
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
              return Response.json({ error: "JSON inválido" }, { status: 400 });
            }
            body = parsed as Record<string, unknown>;
          } catch {
            return Response.json({ error: "JSON inválido" }, { status: 400 });
          }

          const { episodeId, position, duration, sessionId, event } = body;

          if (
            typeof episodeId !== "string" ||
            !episodeId.trim() ||
            episodeId.trim().length > 128 ||
            episodeId.includes("|") ||
            typeof position !== "number" ||
            !Number.isFinite(position) ||
            position < 0 ||
            typeof duration !== "number" ||
            !Number.isFinite(duration) ||
            duration <= 0 ||
            typeof sessionId !== "string" ||
            !sessionId.trim() ||
            sessionId.trim().length > 128 ||
            sessionId.includes("|") ||
            typeof event !== "string" ||
            !VALID_PROGRESS_EVENTS.has(event)
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
          const userKey = await resolveProgressUserKey(request, sessionId);

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
