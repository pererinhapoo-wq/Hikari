export const HIKARI_ADMIN_EMAILS = [
  "pererinhapoo@gmail.com",
  "matheuss4243@gmail.com",
  "matheuspererinhaholtmail@gmail.com",
];

export function isHikariAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return HIKARI_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

