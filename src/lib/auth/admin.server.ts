import { auth } from "./server";
import { isHikariAdmin } from "./admin";

export class AdminAuthError extends Error {
  readonly status: 401 | 403;
  constructor(message: string, status: 401 | 403) {
    super(message);
    this.name = "AdminAuthError";
    this.status = status;
  }
}

export type AdminUserSession = {
  id: string;
  email: string;
  name?: string | null;
};

/**
 * Validação segura de sessão administrativa no servidor:
 * - Requer sessão ativa e válida via Better Auth.
 * - Rejeita com 401 requisições sem sessão válida ou deslogadas.
 * - Rejeita com 403 requisições autenticadas cujo email não pertença à lista administrativa oficial.
 */
export async function verifyAdminRequest(request: Request): Promise<AdminUserSession> {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  const userId = session?.user?.id;
  const email = session?.user?.email;

  if (!userId || !email) {
    throw new AdminAuthError(
      "Não autenticado. É necessário estar logado para acessar operações administrativas.",
      401,
    );
  }

  if (!isHikariAdmin(email)) {
    throw new AdminAuthError(
      "Acesso proibido. Esta conta não possui privilégios administrativos no Hikari.",
      403,
    );
  }

  return {
    id: userId,
    email,
    name: session.user.name,
  };
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
