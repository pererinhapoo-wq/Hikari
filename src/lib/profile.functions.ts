import { createServerFn } from "@tanstack/react-start";

import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

export type UserProfile = {
  nick: string;
  bio: string;
  favorites: string[];
};

function parseFavorites(value: unknown): string[] {
  if (typeof value !== "string" || !value) return [];

  try {
    const parsed = JSON.parse(value);

    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is string => typeof item === "string",
        )
      : [];
  } catch {
    return [];
  }
}

function normalizeNick(value: unknown): string {
  if (typeof value !== "string") return "";

  return value
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .slice(0, 30);
}

function isValidNick(nick: string): boolean {
  return /^[a-z0-9_]{3,30}$/.test(nick);
}

export const getProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();

    const rows = await sql<{
      nick: string | null;
      bio: string | null;
      favorites: string | null;
    }>`
      select
        "nick",
        "bio",
        "favorites"
      from "profile"
      where "userId" = ${context.userId}
      limit 1
    `;

    const row = rows[0];

    return {
      nick: row?.nick ?? "",
      bio: row?.bio ?? "",
      favorites: parseFavorites(row?.favorites),
    } satisfies UserProfile;
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const input = data as {
      nick?: unknown;
      bio?: unknown;
      favorites?: unknown;
    };

    const nick = normalizeNick(input.nick);

    if (!nick) {
      throw new Error("O Nick é obrigatório.");
    }

    if (!isValidNick(nick)) {
      throw new Error(
        "O Nick deve ter entre 3 e 30 caracteres e usar apenas letras, números ou _.",
      );
    }

    const bio =
      typeof input.bio === "string"
        ? input.bio.trim().slice(0, 500)
        : "";

    const favorites = Array.isArray(input.favorites)
      ? input.favorites.filter(
          (item): item is string => typeof item === "string",
        )
      : [];

    const sql = await getSql();

    const existing = await sql<{
      userId: string;
    }>`
      select "userId"
      from "profile"
      where lower("nick") = lower(${nick})
        and "userId" <> ${context.userId}
      limit 1
    `;

    if (existing.length > 0) {
      throw new Error("Esse Nick já está em uso.");
    }

    await sql`
      insert into "profile" (
        "userId",
        "nick",
        "bio",
        "favorites"
      )
      values (
        ${context.userId},
        ${nick},
        ${bio},
        ${JSON.stringify(favorites)}
      )
      on conflict ("userId")
      do update set
        "nick" = excluded."nick",
        "bio" = excluded."bio",
        "favorites" = excluded."favorites",
        "updatedAt" = CURRENT_TIMESTAMP
    `;

    return {
      nick,
      bio,
      favorites,
    } satisfies UserProfile;
  });
