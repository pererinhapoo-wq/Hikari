import { auth } from "./server";
import { isHikariAdmin } from "./admin";
import { getSql } from "@/lib/db";

export class AdminGuardError extends Error {
  readonly status: 401 | 403;

  constructor(message: string, status: 401 | 403) {
    super(message);
    this.name = "AdminGuardError";
    this.status = status;
  }
}

/**
 * Validação rigorosa de autorização administrativa no servidor:
 *
 * 1. Valida a sessão no servidor via Better Auth (cookies ou Authorization Bearer).
 * 2. Retorna erro HTTP 401 se não houver usuário autenticado.
 * 3. Consulta "ADMIN_USER_IDS" (allowlist de emergência por ID).
 * 4. Consulta "profile.role" no banco de dados para validar o papel "admin".
 * 5. Valida também emails na allowlist de administradores autorizados.
 * 6. Retorna erro HTTP 403 se o usuário não for administrador.
 * 7. Retorna o ID do administrador autenticado quando autorizado.
 *
 * NÃO confia em dados de cliente, Zustand, localStorage ou identificadores livres.
 */
export async function requireAdminUser(request: Request): Promise<string> {
  const headers = request.headers;

  const session = await auth.api.getSession({
    headers,
  });

  const userId = session?.user?.id;
  const email = session?.user?.email;

  if (!userId) {
    throw new AdminGuardError(
      "Não autenticado. É necessário estar logado para acessar operações administrativas.",
      401,
    );
  }

  // 1. Allowlist de emergência configurada via variável de ambiente ADMIN_USER_IDS
  const envAdminIds =
    typeof process !== "undefined" && process?.env?.ADMIN_USER_IDS
      ? process.env.ADMIN_USER_IDS.split(",")
          .map((id) => id.trim())
          .filter(Boolean)
      : [];

  if (envAdminIds.includes(userId)) {
    return userId;
  }

  // 2. Allowlist oficial de emails autorizados (admin.ts / HIKARI_ADMIN_EMAILS)
  if (email && isHikariAdmin(email)) {
    return userId;
  }

  // 3. Validação do papel 'admin' na tabela 'profile' do PostgreSQL
  try {
    const sql = await getSql();
    const rows = await sql.query<{ role: string | null }>(
      `SELECT "role" FROM "profile" WHERE "userId" = $1 LIMIT 1;`,
      [userId],
    );

    const role = rows[0]?.role?.trim()?.toLowerCase();
    if (role === "admin") {
      return userId;
    }
  } catch (err) {
    console.error("[admin-guard] Erro ao consultar role de perfil:", err);
  }

  throw new AdminGuardError(
    "Acesso proibido. Esta conta não possui privilégios administrativos no Hikari.",
    403,
  );
}
