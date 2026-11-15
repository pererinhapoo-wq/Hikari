import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { resolveApiUser } from "@/lib/auth/api-session";
import {
  getTypingViewForViewer,
  normalizeTypingRoom,
  setTypingStatus,
} from "@/lib/comment-typing.server";
import {
  buildBannedCommentResponse,
  getActiveUserBan,
} from "@/lib/moderation-bans.server";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
};

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
              { status: 400, headers: NO_STORE_HEADERS },
            );
          }

          const sql = await getSql();
          const apiUser = await resolveApiUser(request, sql);
          const viewerUserId = apiUser?.id ?? null;

          const view = await getTypingViewForViewer(sql, {
            animeId: room.animeId,
            episodeId: room.episodeId,
            viewerUserId,
          });

          return Response.json(view, { headers: NO_STORE_HEADERS });
        } catch (error) {
          console.error("[api/comments/typing] Erro no GET:", error);
          return Response.json(
            { error: "Não foi possível obter o status de digitação." },
            { status: 500, headers: NO_STORE_HEADERS },
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
              { status: 401, headers: NO_STORE_HEADERS },
            );
          }

          const activeBan = await getActiveUserBan(sql, apiUser.id);
          if (activeBan) {
            return buildBannedCommentResponse(activeBan);
          }

          let body: { animeId?: unknown; episodeId?: unknown; active?: unknown } | null = null;
          try {
            const rawText = await request.text();
            body = rawText ? JSON.parse(rawText) : null;
          } catch {
            return Response.json(
              { error: "Formato de dados inválido." },
              { status: 400, headers: NO_STORE_HEADERS },
            );
          }

          const room = normalizeTypingRoom(body?.animeId, body?.episodeId);
          if (!room) {
            return Response.json(
              { error: "Os campos 'animeId' e 'episodeId' são obrigatórios." },
              { status: 400, headers: NO_STORE_HEADERS },
            );
          }

          await setTypingStatus(sql, {
            animeId: room.animeId,
            episodeId: room.episodeId,
            userId: apiUser.id,
            active: Boolean(body?.active),
          });

          return Response.json({ ok: true }, { headers: NO_STORE_HEADERS });
        } catch (error) {
          console.error("[api/comments/typing] Erro no POST:", error);
          return Response.json(
            { error: "Não foi possível atualizar o status de digitação." },
            { status: 500, headers: NO_STORE_HEADERS },
          );
        }
      },
    },
  },
});
