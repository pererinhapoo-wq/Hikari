import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";

import {
  AlertTriangle,
  ChevronRight,
  Lock,
  Mail,
} from "lucide-react";

import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute(
  "/settings-account",
)({
  component: SettingsAccount,
});

function SettingsAccount() {
  const { user } =
    useCurrentUserState();

  const email =
    user?.primaryEmail ?? "";

  return (
    <div className="min-h-screen pb-20 pt-5">

      {/* CABEÇALHO */}
      <div className="mb-6">
        <Link
          to="/settings"
          className="mb-4 inline-flex items-center text-sm text-muted hover:text-fg"
        >
          ← Voltar
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-elevated">
            <Mail className="size-5 text-fg" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-fg">
              Conta
            </h1>

            <p className="mt-1 text-sm text-muted">
              Gerencie seus dados de acesso.
            </p>
          </div>
        </div>
      </div>

      {/* E-MAIL */}
      <section className="mb-7">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
          E-mail
        </h2>

        <div className="rounded-xl border border-border bg-bg p-4">
          <div className="flex items-center gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
              <Mail className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">
                E-mail da conta
              </p>

              <p className="mt-1 truncate text-sm text-muted">
                {email || "E-mail não disponível"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SENHA */}
      <section className="mb-7">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
          Segurança
        </h2>

        <button
          type="button"
          className="flex w-full items-center gap-4 rounded-xl border border-border bg-bg px-4 py-4 text-left transition-colors hover:bg-elevated"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
            <Lock className="size-5" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-fg">
              Alterar senha
            </p>

            <p className="mt-1 text-xs text-muted">
              Altere a senha usada para acessar sua conta.
            </p>
          </div>

          <ChevronRight className="size-5 shrink-0 text-muted" />
        </button>
      </section>

      {/* EXCLUIR CONTA */}
      <section>
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-red-400">
          Zona de perigo
        </h2>

        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-start gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
              <AlertTriangle className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">
                Excluir conta
              </p>

              <p className="mt-1 text-xs leading-5 text-muted">
                A exclusão da conta é uma ação permanente.
                Esta opção será configurada posteriormente.
              </p>

              <button
                type="button"
                disabled
                className="mt-4 rounded-lg border border-red-500/20 px-4 py-2.5 text-sm font-medium text-red-400 opacity-50"
              >
                Excluir minha conta
              </button>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
