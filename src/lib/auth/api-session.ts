import { auth, authConfigured } from "@/lib/auth/server";
import { type Sql } from "@/lib/db";

export type ApiUser = {
  id: string;
  name: string;
  email: string | null;
  image: string | null;
};

/**
 * Resolves the authenticated user for API route handlers (/api/*).
 * Supports standard cookies, Authorization Bearer headers (preview iframe),
 * and dev fallback (when auth is off in sandbox).
 */
export async function resolveApiUser(
  request: Request,
  sql?: Sql,
): Promise<ApiUser | null> {
  // 1. Try Better Auth with request headers
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    if (session?.user?.id) {
      return {
        id: session.user.id,
        name: session.user.name || "Usuário",
        email: session.user.email ?? null,
        image: session.user.image ?? null,
      };
    }
  } catch (err) {
    console.warn("[api-session] getSession error:", err);
  }

  // 2. Explicit Bearer token header handling
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const headers = new Headers(request.headers);
      const session = await auth.api.getSession({ headers });
      if (session?.user?.id) {
        return {
          id: session.user.id,
          name: session.user.name || "Usuário",
          email: session.user.email ?? null,
          image: session.user.image ?? null,
        };
      }
    } catch {
      /* ignore */
    }
  }

  // 3. Fallback when auth is disabled in dev / preview (VITE_AUTH_ENABLED=false)
  const isAuthDisabled =
    process.env.VITE_AUTH_ENABLED === "false" || !authConfigured;

  if (isAuthDisabled) {
    if (sql) {
      try {
        await sql.query(
          `
            insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
            values ($1, $2, $3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            on conflict ("id") do nothing
          `,
          ["dev-user", "Dev User", "dev@example.com"],
        );
      } catch {
        /* ignore */
      }
    }
    return {
      id: "dev-user",
      name: "Dev User",
      email: "dev@example.com",
      image: null,
    };
  }

  return null;
}
