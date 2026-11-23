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

export type VerifiedAdminSession = {
  id: string;
  email: string;
  name?: string | null;
};

/**
 * Lê a allowlist de emergência configurada via variável de ambiente ADMIN_USER_IDS.
 * Nunca deve ser exposta ao navegador.
 */
export function getEnvAdminUserIds(): string[] {
  const raw =
    typeof process !== "undefined" && process?.env?.ADMIN_USER_IDS
      ? process.env.ADMIN_USER_IDS
      : "";

  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

const ADMIN_ROLE_CACHE_TTL_MS = 10_000;
const ADMIN_ROLE_CACHE_MAX_SIZE = 500;

interface CachedRoleEntry {
  role: string | null;
  expiresAt: number;
}

const adminRoleCache = new Map<string, CachedRoleEntry>();
const inFlightRoleLookups = new Map<string, Promise<string | null>>();
const roleInvalidationEpochs = new Map<string, number>();
let globalRoleCacheEpoch = 0;

const requestSessionCache = new WeakMap<
  Request,
  Map<string, Promise<VerifiedAdminSession>>
>();

/**
 * Invalida o cache curto de papel administrativo no servidor.
 * Deve ser chamado imediatamente após alterações em `profile.role` (ex: PATCH /api/admin/users).
 */
export function invalidateAdminRoleCache(userId?: string): void {
  if (typeof userId === "string" && userId.trim()) {
    const clean = userId.trim();
    adminRoleCache.delete(clean);
    inFlightRoleLookups.delete(clean);
    roleInvalidationEpochs.set(
      clean,
      (roleInvalidationEpochs.get(clean) ?? 0) + 1,
    );
    return;
  }

  adminRoleCache.clear();
  inFlightRoleLookups.clear();
  roleInvalidationEpochs.clear();
  globalRoleCacheEpoch += 1;
}

async function resolveProfileRoleCached(userId: string): Promise<string | null> {
  const now = Date.now();
  const cached = adminRoleCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.role;
  }
  if (cached) {
    adminRoleCache.delete(userId);
  }

  const existingInFlight = inFlightRoleLookups.get(userId);
  if (existingInFlight) {
    return existingInFlight;
  }

  const startGlobalEpoch = globalRoleCacheEpoch;
  const startUserEpoch = roleInvalidationEpochs.get(userId) ?? 0;

  const lookupPromise = (async (): Promise<string | null> => {
    const sql = await getSql();
    const rows = await sql.query<{ role: string | null }>(
      `SELECT "role" FROM "profile" WHERE "userId" = $1 LIMIT 1;`,
      [userId],
    );
    const role = rows[0]?.role?.trim()?.toLowerCase() ?? null;

    if (
      globalRoleCacheEpoch === startGlobalEpoch &&
      (roleInvalidationEpochs.get(userId) ?? 0) === startUserEpoch
    ) {
      if (adminRoleCache.size >= ADMIN_ROLE_CACHE_MAX_SIZE) {
        const oldestKey = adminRoleCache.keys().next().value;
        if (oldestKey !== undefined) {
          adminRoleCache.delete(oldestKey);
        }
      }
      adminRoleCache.set(userId, {
        role,
        expiresAt: Date.now() + ADMIN_ROLE_CACHE_TTL_MS,
      });
    }

    return role;
  })().finally(() => {
    if (inFlightRoleLookups.get(userId) === lookupPromise) {
      inFlightRoleLookups.delete(userId);
    }
  });

  inFlightRoleLookups.set(userId, lookupPromise);
  return lookupPromise;
}

/**
 * Regra única e canônica de autorização administrativa no servidor.
 * Reconhece exatamente os três critérios oficiais do Hikari:
 * 1. `ADMIN_USER_IDS` (allowlist por ID de usuário)
 * 2. `HIKARI_ADMIN_EMAILS` (allowlist oficial + variável de ambiente)
 * 3. `profile.role === 'admin'` (papel salvo no PostgreSQL)
 *
 * Rejeita explicitamente a conta fictícia/fallback local (`dev-user` / `dev@example.com`).
 */
export async function isAuthorizedAdminAccount(params: {
  userId: string | null | undefined;
  email?: string | null;
  profileRole?: string | null;
}): Promise<boolean> {
  const cleanUserId = typeof params.userId === "string" ? params.userId.trim() : "";
  const normalizedEmail =
    typeof params.email === "string" ? params.email.trim().toLowerCase() : "";

  if (!cleanUserId) {
    return false;
  }

  // Nunca concede privilégios administrativos à conta fictícia/fallback local
  if (cleanUserId === "dev-user" || normalizedEmail === "dev@example.com") {
    return false;
  }

  // 1. Allowlist configurada via variável de ambiente ADMIN_USER_IDS
  if (getEnvAdminUserIds().includes(cleanUserId)) {
    return true;
  }

  // 2. Allowlist oficial de emails autorizados (admin.ts / HIKARI_ADMIN_EMAILS)
  if (normalizedEmail && isHikariAdmin(normalizedEmail)) {
    return true;
  }

  // 3. Validação do papel 'admin' na tabela 'profile' do PostgreSQL
  if (params.profileRole !== undefined) {
    return (
      typeof params.profileRole === "string" &&
      params.profileRole.trim().toLowerCase() === "admin"
    );
  }

  try {
    const role = await resolveProfileRoleCached(cleanUserId);
    return role === "admin";
  } catch (err) {
    console.error("[admin-guard] Erro ao consultar role de perfil:", err);
    return false;
  }
}

async function resolveAdminSessionUncached(
  request: Request,
  bearerToken?: string,
): Promise<VerifiedAdminSession> {
  let headers = request.headers;
  if (bearerToken && !headers.has("authorization")) {
    headers = new Headers(request.headers);
    headers.set("Authorization", `Bearer ${bearerToken}`);
  }

  const session = await auth.api.getSession({
    headers,
  });

  const userId = session?.user?.id;
  const email = session?.user?.email ?? "";

  if (!userId) {
    throw new AdminGuardError(
      "Não autenticado. É necessário estar logado para acessar operações administrativas.",
      401,
    );
  }

  const authorized = await isAuthorizedAdminAccount({
    userId,
    email: session?.user?.email ?? null,
  });

  if (!authorized) {
    throw new AdminGuardError(
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
 * Validação rigorosa de sessão administrativa no servidor:
 *
 * 1. Valida a sessão no servidor via Better Auth (cookies ou Authorization Bearer).
 * 2. Retorna erro HTTP 401 se não houver usuário autenticado.
 * 3. Aplica a regra única (`ADMIN_USER_IDS`, `HIKARI_ADMIN_EMAILS`, `profile.role === 'admin'`).
 * 4. Retorna erro HTTP 403 se o usuário não for administrador.
 * 5. Retorna os dados da sessão administrativa autenticada quando autorizado.
 *
 * NÃO confia em dados de cliente, Zustand, localStorage, sessionStorage ou identificadores livres.
 */
export async function resolveAdminSession(
  request: Request,
  bearerToken?: string,
): Promise<VerifiedAdminSession> {
  const cacheKey = bearerToken ?? "";
  let perRequest = requestSessionCache.get(request);
  if (!perRequest) {
    perRequest = new Map();
    requestSessionCache.set(request, perRequest);
  }

  const existing = perRequest.get(cacheKey);
  if (existing) {
    return existing;
  }

  const promise = resolveAdminSessionUncached(request, bearerToken);
  perRequest.set(cacheKey, promise);
  return promise;
}

/**
 * Atalho compatível que retorna apenas o ID do administrador autenticado.
 */
export async function requireAdminUser(
  request: Request,
  bearerToken?: string,
): Promise<string> {
  const adminSession = await resolveAdminSession(request, bearerToken);
  return adminSession.id;
}
