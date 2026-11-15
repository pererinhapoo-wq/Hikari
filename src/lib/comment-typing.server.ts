import { type Sql } from "@/lib/db";

export const TYPING_TTL_MS = 4500;

export interface ActiveTyper {
  userId: string;
  remainingMs: number;
}

export interface TypingViewPayload {
  isTyping: boolean;
  typingCount: number;
  expiresInMs: number;
}

export function normalizeTypingRoom(
  rawAnimeId: unknown,
  rawEpisodeId: unknown,
): { animeId: string; episodeId: string } | null {
  const animeId = typeof rawAnimeId === "string" ? rawAnimeId.trim() : "";
  if (!animeId || animeId.length > 100) {
    return null;
  }

  const rawEp = typeof rawEpisodeId === "string" ? rawEpisodeId.trim() : "";
  const episodeId = rawEp || "anime";
  if (episodeId.length > 100) {
    return null;
  }

  return { animeId, episodeId };
}

export function computeTypingView(
  activeTypers: ReadonlyArray<ActiveTyper>,
  viewerUserId: string | null,
): TypingViewPayload {
  const others = viewerUserId
    ? activeTypers.filter((t) => t.userId !== viewerUserId && t.remainingMs > 0)
    : activeTypers.filter((t) => t.remainingMs > 0);

  if (others.length === 0) {
    return {
      isTyping: false,
      typingCount: 0,
      expiresInMs: 0,
    };
  }

  const maxRemaining = Math.max(...others.map((t) => t.remainingMs));
  return {
    isTyping: true,
    typingCount: others.length,
    expiresInMs: Math.max(400, Math.min(TYPING_TTL_MS, Math.ceil(maxRemaining))),
  };
}

async function queryRoomTypers(
  sql: Sql,
  animeId: string,
  episodeId: string,
): Promise<ActiveTyper[]> {
  const rawRows = await sql.query<{
    userId: string;
    remainingMs: number | string;
    isExpired: boolean;
  }>(
    `
      select
        "userId",
        (extract(epoch from ("expiresAt" - CURRENT_TIMESTAMP)) * 1000) as "remainingMs",
        ("expiresAt" <= CURRENT_TIMESTAMP) as "isExpired"
      from "comment_typing"
      where "animeId" = $1
        and "episodeId" = $2
    `,
    [animeId, episodeId],
  );

  const rows = Array.isArray(rawRows)
    ? rawRows
    : ((
        rawRows as {
          rows?: Array<{
            userId: string;
            remainingMs: number | string;
            isExpired: boolean;
          }>;
        }
      )?.rows ?? []);

  let hasExpired = false;
  const active: ActiveTyper[] = [];

  for (const row of rows) {
    const remainingMs = Math.max(0, Number(row.remainingMs) || 0);
    if (Boolean(row.isExpired) || remainingMs <= 0) {
      hasExpired = true;
      continue;
    }
    const userId = String(row.userId || "").trim();
    if (userId) {
      active.push({ userId, remainingMs });
    }
  }

  // Only issue a DELETE when expired records are actually present in the room
  if (hasExpired) {
    await sql
      .query(
        `
          delete from "comment_typing"
          where "animeId" = $1
            and "episodeId" = $2
            and "expiresAt" <= CURRENT_TIMESTAMP
        `,
        [animeId, episodeId],
      )
      .catch((err) => {
        console.warn("[comment-typing] Expired row cleanup warning:", err);
      });
  }

  return active;
}

export async function getTypingViewForViewer(
  sql: Sql,
  params: {
    animeId: string;
    episodeId: string;
    viewerUserId: string | null;
  },
): Promise<TypingViewPayload> {
  const typers = await queryRoomTypers(sql, params.animeId, params.episodeId);
  return computeTypingView(typers, params.viewerUserId);
}

export async function setTypingStatus(
  sql: Sql,
  params: {
    animeId: string;
    episodeId: string;
    userId: string;
    active: boolean;
  },
): Promise<void> {
  const { animeId, episodeId, userId, active } = params;

  if (active) {
    await sql.query(
      `
        insert into "comment_typing" (
          "animeId",
          "episodeId",
          "userId",
          "expiresAt",
          "updatedAt"
        )
        values (
          $1,
          $2,
          $3,
          CURRENT_TIMESTAMP + interval '4500 milliseconds',
          CURRENT_TIMESTAMP
        )
        on conflict ("animeId", "episodeId", "userId")
        do update set
          "expiresAt" = CURRENT_TIMESTAMP + interval '4500 milliseconds',
          "updatedAt" = CURRENT_TIMESTAMP
      `,
      [animeId, episodeId, userId],
    );
  } else {
    await sql.query(
      `
        delete from "comment_typing"
        where "animeId" = $1
          and "episodeId" = $2
          and "userId" = $3
      `,
      [animeId, episodeId, userId],
    );
  }
}
