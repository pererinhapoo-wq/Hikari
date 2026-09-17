export const HIKARI_ADMIN_EMAIL = "pererinhapoo@gmail.com";

export function isHikariAdmin(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === HIKARI_ADMIN_EMAIL;
}
