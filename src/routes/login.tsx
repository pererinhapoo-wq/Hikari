import { createFileRoute } from "@tanstack/react-router";
import { type AuthMenuMode, LoginMenu } from "@/components/LoginMenu";

function sanitizeRedirect(raw: unknown): string {
  if (typeof raw !== "string") return "/account";
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/account";
  }
  return trimmed;
}

type LoginSearch = {
  redirect?: string;
  mode?: AuthMenuMode;
};

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => {
    const out: LoginSearch = {};
    if (typeof search.redirect === "string") {
      out.redirect = search.redirect;
    }
    if (search.mode === "register" || search.mode === "forgot" || search.mode === "login") {
      out.mode = search.mode;
    }
    return out;
  },
  component: Login,
});

function Login() {
  const { redirect, mode } = Route.useSearch();
  const callbackURL = sanitizeRedirect(redirect);

  return (
    <section
      aria-label="Autenticação Hikari"
      className="relative flex min-h-[calc(100dvh-6rem)] items-center justify-center overflow-hidden px-1 py-6 sm:px-4 sm:py-12"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_65%_55%_at_50%_20%,rgba(168,85,247,0.12),transparent_70%)]"
      />
      <div className="relative z-10 flex w-full justify-center">
        <LoginMenu
          isModal={false}
          callbackURL={callbackURL}
          initialMode={mode ?? "login"}
        />
      </div>
    </section>
  );
}
