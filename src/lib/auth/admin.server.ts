import { getRequest } from "@tanstack/react-start/server";
import { auth } from "./server";
import {
  AdminGuardError,
  isAuthorizedAdminAccount,
  resolveAdminSession,
  type VerifiedAdminSession,
} from "./admin-guard";

export class AdminAuthError extends Error {
  readonly status: 401 | 403;
  constructor(message: string, status: 401 | 403) {
    super(message);
    this.name = "AdminAuthError";
    this.status = status;
  }
}

export type AdminUserSession = VerifiedAdminSession;

/**
 * Validação segura de sessão administrativa no servidor:
 * - Requer sessão ativa e válida via Better Auth.
 * - Suporta cookies de sessão e cabeçalho Authorization: Bearer (preview iframe).
 * - Reconhece todos os critérios oficiais: ADMIN_USER_IDS, HIKARI_ADMIN_EMAILS e profile.role === 'admin'.
 * - Rejeita com 401 requisições sem sessão válida ou deslogadas.
 * - Rejeita com 403 requisições autenticadas sem privilégios administrativos.
 */
export async function verifyAdminRequest(
  request: Request,
  bearerToken?: string,
): Promise<AdminUserSession> {
  try {
    return await resolveAdminSession(request, bearerToken);
  } catch (err) {
    if (err instanceof AdminGuardError) {
      throw new AdminAuthError(err.message, err.status);
    }
    throw err;
  }
}

/**
 * Validação administrativa para Server Functions do TanStack Start.
 */
export async function verifyAdminServerCaller(
  bearerToken?: string,
): Promise<AdminUserSession> {
  const req = getRequest();
  if (!req) {
    throw new AdminAuthError("Requisição não encontrada.", 401);
  }
  return verifyAdminRequest(req, bearerToken);
}

/**
 * Consulta segura do status de autenticação e privilégio administrativo da requisição atual
 * sem lançar exceção (para checagem de acesso pela interface administrativa).
 */
export async function getAdminStatusFromRequest(
  request: Request,
  bearerToken?: string,
): Promise<{
  authenticated: boolean;
  isAdmin: boolean;
  userId: string | null;
}> {
  let headers = request.headers;
  if (bearerToken && !headers.has("authorization")) {
    headers = new Headers(request.headers);
    headers.set("Authorization", `Bearer ${bearerToken}`);
  }

  try {
    const session = await auth.api.getSession({ headers });
    const userId = session?.user?.id ?? null;
    if (!userId || userId === "dev-user") {
      return { authenticated: false, isAdmin: false, userId: null };
    }

    const isAdmin = await isAuthorizedAdminAccount({
      userId,
      email: session?.user?.email ?? null,
    });

    return {
      authenticated: true,
      isAdmin,
      userId,
    };
  } catch {
    return { authenticated: false, isAdmin: false, userId: null };
  }
}

/**
 * Consulta segura de status administrativo para Server Functions do TanStack Start.
 */
export async function getAdminStatusFromServerCaller(
  bearerToken?: string,
): Promise<{
  authenticated: boolean;
  isAdmin: boolean;
  userId: string | null;
}> {
  const req = getRequest();
  if (!req) {
    return { authenticated: false, isAdmin: false, userId: null };
  }
  return getAdminStatusFromRequest(req, bearerToken);
}

/**
 * Retorna uma Response HTTP pronta com status 401 ou 403 caso a verificação falhe,
 * ou null caso a requisição pertença a um administrador autenticado e autorizado.
 */
export async function assertAdminResponse(request: Request): Promise<Response | null> {
  try {
    await verifyAdminRequest(request);
    return null;
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json(
      { error: "Erro de autenticação administrativa." },
      { status: 403 },
    );
  }
}
