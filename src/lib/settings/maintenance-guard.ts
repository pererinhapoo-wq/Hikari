export type MaintenanceViewMode =
  | "admin_route"
  | "login_isolated"
  | "checking_admin"
  | "blocked"
  | "allowed";

export interface ResolveMaintenanceViewInput {
  pathname: string;
  maintenanceActive: boolean;
  allowAdminBypass: boolean;
  isServerVerifiedAdmin: boolean;
  isCheckingAdmin: boolean;
}

export function isMaintenanceLoginRoute(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/login/");
}

export function isMaintenanceAdminRoute(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/**
 * Decide qual modo de exibição o Shell deve aplicar diante do modo de manutenção.
 *
 * Regras de segurança:
 * - Rotas `/admin/*` sempre seguem para o AdminGuard (que exige sessão admin verificada no servidor).
 * - A rota `/login` permanece acessível durante a manutenção para permitir autenticação.
 * - Visitantes não autenticados e usuários comuns autenticados veem a tela de manutenção quando ativa.
 * - Somente contas verificadas no servidor (`isServerVerifiedAdmin === true`) recebem bypass.
 */
export function resolveMaintenanceViewMode(
  input: ResolveMaintenanceViewInput,
): MaintenanceViewMode {
  if (isMaintenanceAdminRoute(input.pathname)) {
    return "admin_route";
  }

  if (!input.maintenanceActive) {
    return "allowed";
  }

  const canBypass = input.isServerVerifiedAdmin && input.allowAdminBypass;

  if (isMaintenanceLoginRoute(input.pathname)) {
    return canBypass ? "allowed" : "login_isolated";
  }

  if (canBypass) {
    return "allowed";
  }

  if (input.isCheckingAdmin) {
    return "checking_admin";
  }

  return "blocked";
}
