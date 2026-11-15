import { dbSource, type Sql } from "@/lib/db";

export const TYPING_TTL_MS = 4500;
const PGLITE_EXPIRY_SWEEP_MS = 750;
const NEON_SYNC_INTERVAL_MS = 1500;

export interface ActiveTyper {
  userId: string;
  remainingMs: number;
}

export interface TypingViewPayload {
  isTyping: boolean;
  typingCount: number;
  expiresInMs: number;
}

interface TypingSubscriber {
  id: string;
  viewerUserId: string | null;
  lastSignature: string;
  lastSentAt: number;
  onUpdate: (payload: TypingViewPayload) => void;
}

interface RoomState {
  animeId: string;
  episodeId: string;
  subscribers: Map<string, TypingSubscriber>;
  hasKnownActive: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  sql: Sql | null;
}

interface TypingBus {
  rooms: Map<string, RoomState>;
}

const globalBusRef = globalThis as typeof globalThis & {
  __hikariCommentTypingBus__?: TypingBus;
};

function getTypingBus(): TypingBus {
  globalBusRef.__hikariCommentTypingBus__ ??= {
    rooms: new Map<string, RoomState>(),
  };
  return globalBusRef.__hikariCommentTypingBus__;
}

export function normalizeTypingRoom(
  rawAnimeId: unknown,
  rawEpisodeId: unknown,
): { animeId: string; episodeId: string } | null {
  const animeId =
    typeof rawAnimeId === "string" ? rawAnimeId.trim() : "";
  if (!animeId || animeId.length > 100) {
    return null;
  }

  const rawEp =
    typeof rawEpisodeId === "string" ? rawEpisodeId.trim() : "";
  const episodeId = rawEp || "anime";
  if (episodeId.length > 100) {
    return null;
  }

  return { animeId, episodeId };
}

export function makeRoomKey(animeId: string, episodeId: string): string {
  return `${animeId}::${episodeId}`;
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
  // Remove expired rows for this room so stale records never accumulate
  await sql.query(
    `
      delete from "comment_typing"
      where "animeId" = $1
        and "episodeId" = $2
        and "expiresAt" <= CURRENT_TIMESTAMP
    `,
    [animeId, episodeId],
  );

  const rawRows = await sql.query<{
    userId: string;
    remainingMs: number | string;
  }>(
    `
      select
        "userId",
        (extract(epoch from ("expiresAt" - CURRENT_TIMESTAMP)) * 1000) as "remainingMs"
      from "comment_typing"
      where "animeId" = $1
        and "episodeId" = $2
        and "expiresAt" > CURRENT_TIMESTAMP
    `,
    [animeId, episodeId],
  );

  const rows = Array.isArray(rawRows)
    ? rawRows
    : ((rawRows as { rows?: Array<{ userId: string; remainingMs: number | string }> })?.rows ?? []);

  return rows
    .map((row) => ({
      userId: String(row.userId),
      remainingMs: Math.max(0, Number(row.remainingMs) || 0),
    }))
    .filter((row) => Boolean(row.userId) && row.remainingMs > 0);
}

function clearRoomTimer(room: RoomState) {
  if (room.timer !== null) {
    clearTimeout(room.timer);
    room.timer = null;
  }
}

function notifyRoomSubscribers(
  room: RoomState,
  activeTypers: ReadonlyArray<ActiveTyper>,
) {
  const now = Date.now();
  room.hasKnownActive = activeTypers.length > 0;

  for (const sub of room.subscribers.values()) {
    const payload = computeTypingView(activeTypers, sub.viewerUserId);
    const sig = `${payload.isTyping}:${payload.typingCount}`;
    const shouldRefreshActive =
      payload.isTyping && now - sub.lastSentAt >= 1200;

    if (sig !== sub.lastSignature || shouldRefreshActive) {
      sub.lastSignature = sig;
      sub.lastSentAt = now;
      try {
        sub.onUpdate(payload);
      } catch {
        // Ignore stream write failure; cleanup handles closed subscribers
      }
    }
  }
}

function scheduleRoomSweep(room: RoomState) {
  clearRoomTimer(room);
  if (room.subscribers.size === 0 || !room.sql) {
    return;
  }

  // On Neon (potentially multi-instance), poll periodically so cross-instance writes sync;
  // on PGLite (single-process), only sweep while typers are active so TTL expiry pushes immediately.
  if (dbSource !== "neon" && !room.hasKnownActive) {
    return;
  }

  const delay =
    dbSource === "neon" ? NEON_SYNC_INTERVAL_MS : PGLITE_EXPIRY_SWEEP_MS;

  room.timer = setTimeout(async () => {
    room.timer = null;
    if (room.subscribers.size === 0 || !room.sql) {
      return;
    }
    try {
      const typers = await queryRoomTypers(
        room.sql,
        room.animeId,
        room.episodeId,
      );
      notifyRoomSubscribers(room, typers);
    } catch (err) {
      console.warn("[comment-typing] Room sweep warning:", err);
    } finally {
      scheduleRoomSweep(room);
    }
  }, delay);
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

  const bus = getTypingBus();
  const key = makeRoomKey(animeId, episodeId);
  const room = bus.rooms.get(key);
  if (room && room.subscribers.size > 0) {
    room.sql = sql;
    const typers = await queryRoomTypers(sql, animeId, episodeId);
    notifyRoomSubscribers(room, typers);
    scheduleRoomSweep(room);
  }
}

export async function subscribeTypingRoom(params: {
  sql: Sql;
  animeId: string;
  episodeId: string;
  viewerUserId: string | null;
  onUpdate: (payload: TypingViewPayload) => void;
}): Promise<{ initial: TypingViewPayload; unsubscribe: () => void }> {
  const { sql, animeId, episodeId, viewerUserId, onUpdate } = params;
  const bus = getTypingBus();
  const key = makeRoomKey(animeId, episodeId);

  let room = bus.rooms.get(key);
  if (!room) {
    room = {
      animeId,
      episodeId,
      subscribers: new Map(),
      hasKnownActive: false,
      timer: null,
      sql,
    };
    bus.rooms.set(key, room);
  } else {
    room.sql = sql;
  }

  const activeTypers = await queryRoomTypers(sql, animeId, episodeId);
  room.hasKnownActive = activeTypers.length > 0;
  const initial = computeTypingView(activeTypers, viewerUserId);

  const subId = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  room.subscribers.set(subId, {
    id: subId,
    viewerUserId,
    lastSignature: `${initial.isTyping}:${initial.typingCount}`,
    lastSentAt: Date.now(),
    onUpdate,
  });

  scheduleRoomSweep(room);

  const unsubscribe = () => {
    const currentRoom = bus.rooms.get(key);
    if (!currentRoom) return;
    currentRoom.subscribers.delete(subId);
    if (currentRoom.subscribers.size === 0) {
      clearRoomTimer(currentRoom);
      bus.rooms.delete(key);
    }
  };

  return { initial, unsubscribe };
}
