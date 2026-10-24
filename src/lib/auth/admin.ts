/**
 * Lista de emails com privilégios administrativos autorizados no Hikari.
 * Contas autorizadas padrão: a conta oficial do administrador principal (nexaweeb@gmail.com)
 * e os mantenedores originais do projeto.
 * Pode ser estendida de forma segura no servidor via variável de ambiente HIKARI_ADMIN_EMAILS (separada por vírgula).
 */
export const HIKARI_ADMIN_EMAILS: readonly string[] = [
  "nexaweeb@gmail.com",
  "pererinhapoo@gmail.com",
  "matheuss4243@gmail.com",
  "matheuspererinhaholtmail@gmail.com",
];

export function getAuthorizedAdminEmails(): string[] {
  const envRaw =
    typeof process !== "undefined" && process?.env?.HIKARI_ADMIN_EMAILS
      ? process.env.HIKARI_ADMIN_EMAILS
      : "";

  const envEmails = envRaw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const set = new Set<string>([
    ...HIKARI_ADMIN_EMAILS.map((e) => e.toLowerCase()),
    ...envEmails,
  ]);

  return Array.from(set);
}

/**
 * Validação rigorosa de privilégios de administrador:
 * - Apenas contas reais explicitamente autorizadas.
 * - NUNCA concede privilégios a 'dev@example.com' nem a qualquer conta fictícia ou de teste.
 * - NUNCA concede privilégios automaticamente por estar em preview, desenvolvimento ou com VITE_AUTH_ENABLED=false.
 * - Usuários recém-cadastrados ou com e-mails aleatórios são estritamente rejeitados.
 */
export function isHikariAdmin(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized || normalized === "dev@example.com") {
    return false;
  }
  return getAuthorizedAdminEmails().includes(normalized);
}
