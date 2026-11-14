import { createMiddleware } from "@tanstack/react-start";

/**
 * Auth middleware for server functions — the standard way to get the caller's
 * verified user id. When deployed the session cookie is same-origin and rides
 * along automatically. In the live preview the client also forwards the bearer
 * token (partitioned cookies) via the `.client` hook below — call sites do not
 * thread it themselves.
 *
 *   import { createServerFn } from "@tanstack/react-start";
 *   import { getSql } from "@/lib/db";
 *   import { authMiddleware } from "@/lib/auth/middleware";
 *
 *   export const listTodos = createServerFn({ method: "GET" })
 *     .middleware([authMiddleware])
 *     .handler(async ({ context }) => {
 *       const sql = await getSql();
 *       return sql`select * from todos where user_id = ${context.userId}`;
 *     });
 *
 * Signed out with auth on (live preview included) -> throws `UnauthorizedError`
 * (see `verify.server.ts`). With auth disabled (`VITE_AUTH_ENABLED=false`, the
 * shipped default) it resolves the shared dev user — but throws instead when a
 * `DATABASE_URL` is also set, so an app without sign-in must not use this at
 * all. On the auth-on path, use it on every server function that touches
 * per-user data and scope every query by `context.userId`.
 */
export const authMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    // Live preview (partitioned iframe): the session rides a bearer token, not a
    // cookie, so forward it to the server. Null when deployed (cookie auth), so
    // this is a no-op there.
    const { getBearerToken } = await import("./client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    // ONLY import `*.server` modules here. This file is dual client/server
    // (bearer hook on the client). A plain `./isolation` path was renamed to
    // `isolation.server.ts` — keep this import in sync so image `tsc` resolves
    // it, and so Vite does not ship `@tanstack/react-start/server` to the browser.
    const { assertSameSiteRequest } = await import("./isolation.server");
    const { requireUserId } = await import("./verify.server");
    // Reject scripted cross-site/sibling requests before touching per-user data.
    assertSameSiteRequest();
    const userId = await requireUserId(context.bearerToken);
    return next({ context: { userId } });
  });

/**
 * Middleware para consultas públicas opcionais que precisam distinguir visitantes de
 * usuários autenticados para avaliação de privacidade e propriedade sem exigir login.
 */
export const optionalAuthMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("./client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    const { assertSameSiteRequest } = await import("./isolation.server");
    assertSameSiteRequest();
    let userId: string | null = null;
    try {
      const { getSessionUser, authConfigured, DEV_USER_ID } = await import(
        "./verify.server"
      );
      const user = await getSessionUser(context.bearerToken);
      if (user) {
        userId = user.id;
      } else if (
        !authConfigured &&
        process.env.VITE_AUTH_ENABLED === "false" &&
        !process.env.DATABASE_URL?.trim()
      ) {
        userId = DEV_USER_ID;
      }
    } catch {
      userId = null;
    }
    return next({ context: { userId } });
  });

/**
 * Middleware administrativo para Server Functions do Hikari Studio.
 * Encaminha o Bearer token do preview no cliente e valida no servidor:
 * 1. Isolamento same-site (proteção contra requisições cross-site/sibling).
 * 2. Sessão Better Auth válida (cookie ou Bearer).
 * 3. Regra única administrativa (ADMIN_USER_IDS, HIKARI_ADMIN_EMAILS ou profile.role === 'admin').
 */
export const adminMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("./client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    const { assertSameSiteRequest } = await import("./isolation.server");
    const { verifyAdminServerCaller } = await import("./admin.server");
    assertSameSiteRequest();
    const adminSession = await verifyAdminServerCaller(context?.bearerToken);
    return next({ context: { adminSession } });
  });

/**
 * Middleware leve que apenas encaminha o Bearer token do preview para o servidor
 * sem exigir autenticação prévia (usado em consultas condicionais ou checagem de acesso).
 */
export const bearerForwardMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("./client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    return next({ context: { bearerToken: context?.bearerToken } });
  });

