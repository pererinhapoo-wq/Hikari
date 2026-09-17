import { createServerFn } from "@tanstack/react-start";

import { authMiddleware } from "@/lib/auth/middleware";

export type UserProfile = {
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

export const getProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { getSql } = await import("@/lib/db");

    const sql = await getSql();

    const rows = await sql<{
      bio: string | null;
      favorites: string | null;
    }>`
      select "bio", "favorites"
      from "profile"
      where "userId" = ${context.userId}
      limit 1
    `;

    const row = rows[0];

    return {
      bio: row?.bio ?? "",
      favorites: parseFavorites(row?.favorites),
    } satisfies UserProfile;
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const input = data as {
      bio?: unknown;
      favorites?: unknown;
    };

    const bio =
      typeof input.bio === "string"
        ? input.bio.trim().slice(0, 500)
        : "";

    const favorites = Array.isArray(input.favorites)
      ? input.favorites.filter(
          (item): item is string => typeof item === "string",
        )
      : [];

    const { getSql } = await import("@/lib/db");

    const sql = await getSql();

    await sql`
      insert into "profile" (
        "userId",
        "bio",
        "favorites"
      )
      values (
        ${context.userId},
        ${bio},
        ${JSON.stringify(favorites)}
      )
      on conflict ("userId")
      do update set
        "bio" = excluded."bio",
        "favorites" = excluded."favorites",
        "updatedAt" = CURRENT_TIMESTAMP
    `;

    return {
      bio,
      favorites,
    } satisfies UserProfile;
  });
