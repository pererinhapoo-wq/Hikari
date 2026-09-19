import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";

import {
  Ban,
  ChevronRight,
  Eye,
  Lock,
  Users,
} from "lucide-react";

export const Route = createFileRoute(
  "/settings-privacy",
)({
  component: SettingsPrivacy,
});

function SettingsPrivacy() {
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
            <Lock className="size-5 text-fg" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-fg">
              Privacidade
            </h1>

            <p className="mt-1 text-sm text-muted">
              Controle quem pode acessar e interagir com seu perfil.
            </p>
          </div>
        </div>
      </div>

      {/* VISIBILIDADE */}
      <section className="mb-7">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
          Visibilidade
        </h2>

        <div className="overflow-hidden rounded-xl border border-border bg-bg">

          <button
            type="button"
            className="flex w-full items-center gap-4 border-b border-border px-4 py-4 text-left transition-colors hover:bg-elevated"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
              <Eye className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">
                Perfil público
              </p>

              <p className="mt-1 text-xs leading-5 text-muted">
                Permitir que outras pessoas encontrem e vejam seu perfil.
              </p>
            </div>

            <ChevronRight className="size-5 shrink-0 text-muted" />
          </button>

        </div>
      </section>

      {/* SEGUIDORES */}
      <section className="mb-7">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
          Seguidores
        </h2>

        <div className="overflow-hidden rounded-xl border border-border bg-bg">

          <button
            type="button"
            className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-elevated"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
              <Users className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">
                Quem pode me seguir
              </p>

              <p className="mt-1 text-xs leading-5 text-muted">
                Escolha quem pode seguir seu perfil.
              </p>
            </div>

            <ChevronRight className="size-5 shrink-0 text-muted" />
          </button>

        </div>
      </section>

      {/* BLOQUEADOS */}
      <section>
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
          Usuários bloqueados
        </h2>

        <div className="overflow-hidden rounded-xl border border-border bg-bg">

          <button
            type="button"
            className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-elevated"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
              <Ban className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">
                Usuários bloqueados
              </p>

              <p className="mt-1 text-xs leading-5 text-muted">
                Gerencie as pessoas que você bloqueou.
              </p>
            </div>

            <ChevronRight className="size-5 shrink-0 text-muted" />
          </button>

        </div>
      </section>

    </div>
  );
      }
