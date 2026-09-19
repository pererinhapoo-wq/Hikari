import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";

import {
  Bell,
  Heart,
  MessageCircle,
  UserPlus,
} from "lucide-react";

export const Route = createFileRoute(
  "/settings-notifications",
)({
  component: SettingsNotifications,
});

function SettingsNotifications() {
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
            <Bell className="size-5 text-fg" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-fg">
              Notificações
            </h1>

            <p className="mt-1 text-sm text-muted">
              Escolha quais atividades podem gerar notificações.
            </p>
          </div>
        </div>
      </div>

      {/* CURTIDAS */}
      <section className="mb-7">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
          Atividades
        </h2>

        <div className="overflow-hidden rounded-xl border border-border bg-bg">

          <div className="flex items-center gap-4 border-b border-border px-4 py-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
              <Heart className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">
                Curtidas
              </p>

              <p className="mt-1 text-xs leading-5 text-muted">
                Receber notificações quando alguém curtir seu conteúdo.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked="true"
              className="relative h-6 w-11 shrink-0 rounded-full bg-fg"
            >
              <span className="absolute right-1 top-1 size-4 rounded-full bg-bg" />
            </button>
          </div>

          {/* RESPOSTAS */}
          <div className="flex items-center gap-4 border-b border-border px-4 py-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
              <MessageCircle className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">
                Respostas
              </p>

              <p className="mt-1 text-xs leading-5 text-muted">
                Receber notificações quando alguém responder aos seus comentários.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked="true"
              className="relative h-6 w-11 shrink-0 rounded-full bg-fg"
            >
              <span className="absolute right-1 top-1 size-4 rounded-full bg-bg" />
            </button>
          </div>

          {/* SEGUIDORES */}
          <div className="flex items-center gap-4 px-4 py-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
              <UserPlus className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">
                Novos seguidores
              </p>

              <p className="mt-1 text-xs leading-5 text-muted">
                Receber notificações quando alguém começar a seguir você.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked="true"
              className="relative h-6 w-11 shrink-0 rounded-full bg-fg"
            >
              <span className="absolute right-1 top-1 size-4 rounded-full bg-bg" />
            </button>
          </div>

        </div>
      </section>

    </div>
  );
      }
