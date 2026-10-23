export const HIKARI_ADMIN_EMAILS = [
  "pererinhapoo@gmail.com",
  "matheuss4243@gmail.com",
  "matheuspererinhaholtmail@gmail.com",
];

export function isHikariAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (HIKARI_ADMIN_EMAILS.includes(normalized)) return true;
  if (normalized === "dev@example.com") return true;
  return false;
}

