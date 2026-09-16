import { createFileRoute } from "@tanstack/react-router";
import { Logo } from "@/components/logo";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="grid min-h-[70vh] place-items-center py-12">
      <div className="w-full max-w-sm rounded-xl bg-surface p-6 shadow-[var(--shadow-border)]">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <h1 className="font-display text-2xl tracking-tight">Entrar na Conta</h1>
        <p className="mt-2 text-sm text-muted">Entre para usar sua conta no HIKARI.</p>
        <div className="mt-6 flex flex-col gap-2">
          {authEnabled ? (
            GROK_PROVIDERS.map((p) => (
              <button
                key={p.providerId}
                type="button"
                onClick={() => void signIn(p.providerId, { callbackURL: "/account" })}
                className="w-full cursor-pointer rounded-md border border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-elevated"
              >
                Continuar com {p.label}
              </button>
            ))
          ) : (
            <p className="text-sm text-danger">O sistema de contas está desativado.</p>
          )}
        </div>
      </div>
    </main>
  );
}
