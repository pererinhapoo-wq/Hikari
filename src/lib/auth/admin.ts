export const HIKARI_ADMIN_EMAIL = "matheussilva65554@gmail.com";

export function isHikariAdmin(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === HIKARI_ADMIN_EMAIL;
}
