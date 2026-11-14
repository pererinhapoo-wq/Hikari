import { createServerFn } from "@tanstack/react-start";
import { bearerForwardMiddleware } from "./middleware";

export interface AdminAccessStatus {
  authenticated: boolean;
  isAdmin: boolean;
}

/**
 * Server Function GET para consultar de forma segura se a sessão atual
 * pertence a um administrador autorizado (via ADMIN_USER_IDS, HIKARI_ADMIN_EMAILS
 * ou profile.role === 'admin').
 *
 * Não expõe variáveis secretas nem listas de e-mails/IDs ao navegador.
 */
export const getCurrentAdminAccess = createServerFn({
  method: "GET",
})
  .middleware([bearerForwardMiddleware])
  .handler(async ({ context }): Promise<AdminAccessStatus> => {
    const { assertSameSiteRequest } = await import("./isolation.server");
    const { getAdminStatusFromServerCaller } = await import("./admin.server");
    assertSameSiteRequest();
    const status = await getAdminStatusFromServerCaller(context?.bearerToken);
    return {
      authenticated: status.authenticated,
      isAdmin: status.isAdmin,
    };
  });
