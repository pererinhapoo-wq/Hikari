import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { resolveApiUser } from "@/lib/auth/api-session";
import {
  getTypingViewForViewer,
  normalizeTypingRoom,
  setTypingStatus,
  subscribeTypingRoom,
  type TypingViewPayload,
} from "@/lib/comment-typing.server";

export const Route = createFileRoute("/api/comments/typing")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const room = normalizeTypingRoom(
            url.searchParams.get("animeId"),
            url.searchParams.get("episodeId"),
          );

          if (!room) {
            return Response.json(
              { error: "Parâmetros 'animeId' e 'episodeId' inválidos." },
              { status: 400 },
            );
          }

          const sql = await getSql();
          const apiUser = await resolveApiUser(request, sql);
          const viewerUserId = apiUser?.id ?? null;

          const acceptHeader = request.headers.get("accept") ?? "";
          const wantsStream =
            acceptHeader.includes("text/event-stream") ||
            url.searchParams.get("stream") === "1";

          if (!wantsStream) {
            const view = await getTypingViewForViewer(sql, {
              animeId: room.animeId,
              episodeId: room.episodeId,
              viewerUserId,
            });
            return Response.json(view, {
              headers: {
                "Cache-Control":
                  "private, no-cache, no-store, must-revalidate",
              },
            });
          }

          const encoder = new TextEncoder();
          let cleanup: (() => void) | null = null;

          const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
              let closed = false;
              let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
              let unsubscribe: (() => void) | null = null;

              const closeStream = () => {
                if (closed) return;
                closed = true;
                if (keepaliveTimer !== null) {
                  clearInterval(keepaliveTimer);
                  keepaliveTimer = null;
                }
                if (unsubscribe) {
                  unsubscribe();
                  unsubscribe = null;
                }
                request.signal.removeEventListener("abort", closeStream);
                try {
                  controller.close();
                } catch {
                  // Stream already closed
                }
              };

              cleanup = closeStream;

              const sendTypingEvent = (payload: TypingViewPayload) => {
                if (closed) return;
                try {
                  const chunk = `event: typing\ndata: ${JSON.stringify(payload)}\n\n`;
                  controller.enqueue(encoder.encode(chunk));
                } catch {
                  closeStream();
                }
              };

              if (request.signal.aborted) {
                closeStream();
                return;
              }

              request.signal.addEventListener("abort", closeStream, {
                once: true,
              });

              try {
                const sub = await subscribeTypingRoom({
                  sql,
                  animeId: room.animeId,
                  episodeId: room.episodeId,
                  viewerUserId,
                  onUpdate: sendTypingEvent,
                });
                unsubscribe = sub.unsubscribe;

                if (closed) {
                  closeStream();
                  return;
                }

                sendTypingEvent(sub.initial);

                keepaliveTimer = setInterval(() => {
                  if (closed) return;
                  try {
                    controller.enqueue(encoder.encode(": keepalive\n\n"));
                  } catch {
                    closeStream();
                  }
                }, 15_000);
              } catch (err) {
                console.error("[api/comments/typing] Erro no stream SSE:", err);
                closeStream();
              }
            },
            cancel() {
              cleanup?.();
            },
          });

          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream; charset=utf-8",
              "Cache-Control": "private, no-cache, no-store, no-transform",
              Connection: "keep-alive",
              "X-Accel-Buffering": "no",
            },
          });
        } catch (error) {
          console.error("[api/comments/typing] Erro no GET:", error);
          return Response.json(
            { error: "Não foi possível obter o status de digitação." },
            { status: 500 },
          );
        }
      },

      POST: async ({ request }) => {
        try {
          const sql = await getSql();
          const apiUser = await resolveApiUser(request, sql);

          if (!apiUser?.id) {
            return Response.json(
              { error: "Autenticação necessária." },
              { status: 401 },
            );
          }

          let body: any = null;
          try {
            const rawText = await request.text();
            body = rawText ? JSON.parse(rawText) : null;
          } catch {
            return Response.json(
              { error: "Formato de dados inválido." },
              { status: 400 },
            );
          }

          const room = normalizeTypingRoom(body?.animeId, body?.episodeId);
          if (!room) {
            return Response.json(
              { error: "Os campos 'animeId' e 'episodeId' são obrigatórios." },
              { status: 400 },
            );
          }

          await setTypingStatus(sql, {
            animeId: room.animeId,
            episodeId: room.episodeId,
            userId: apiUser.id,
            active: Boolean(body?.active),
          });

          return Response.json(
            { ok: true },
            {
              headers: {
                "Cache-Control":
                  "private, no-cache, no-store, must-revalidate",
              },
            },
          );
        } catch (error) {
          console.error("[api/comments/typing] Erro no POST:", error);
          return Response.json(
            { error: "Não foi possível atualizar o status de digitação." },
            { status: 500 },
          );
        }
      },
    },
  },
});
