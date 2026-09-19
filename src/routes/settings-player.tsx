import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";

import {
  Captions,
  ChevronRight,
  Maximize,
  MonitorPlay,
  Play,
  Settings2,
} from "lucide-react";

export const Route = createFileRoute(
  "/settings-player",
)({
  component: SettingsPlayer,
});

function SettingsPlayer() {
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
            <MonitorPlay className="size-5 text-fg" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-fg">
              Player
            </h1>

            <p className="mt-1 text-sm text-muted">
              Personalize o comportamento do player de vídeo.
            </p>
          </div>
        </div>
      </div>

      {/* REPRODUÇÃO */}
      <section className="mb-7">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
          Reprodução
        </h2>

        <div className="overflow-hidden rounded-xl border border-border bg-bg">

          {/* AUTOPLAY */}
          <div className="flex items-center gap-4 border-b border-border px-4 py-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
              <Play className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">
                Reprodução automática
              </p>

              <p className="mt-1 text-xs leading-5 text-muted">
                Iniciar o episódio automaticamente ao abrir o player.
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

          {/* QUALIDADE */}
          <button
            type="button"
            className="flex w-full items-center gap-4 border-b border-border px-4 py-4 text-left transition-colors hover:bg-elevated"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
              <Settings2 className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">
                Qualidade do vídeo
              </p>

              <p className="mt-1 text-xs leading-5 text-muted">
                Escolha a qualidade padrão dos episódios.
              </p>
            </div>

            <ChevronRight className="size-5 shrink-0 text-muted" />
          </button>

        </div>
      </section>

      {/* LEGENDAS */}
      <section className="mb-7">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
          Legendas
        </h2>

        <div className="overflow-hidden rounded-xl border border-border bg-bg">

          <button
            type="button"
            className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-elevated"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
              <Captions className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">
                Legendas
              </p>

              <p className="mt-1 text-xs leading-5 text-muted">
                Escolha o comportamento padrão das legendas.
              </p>
            </div>

            <ChevronRight className="size-5 shrink-0 text-muted" />
          </button>

        </div>
      </section>

      {/* TELA */}
      <section>
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
          Tela
        </h2>

        <div className="overflow-hidden rounded-xl border border-border bg-bg">

          <button
            type="button"
            className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-elevated"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
              <Maximize className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">
                Tela cheia
              </p>

              <p className="mt-1 text-xs leading-5 text-muted">
                Defina o comportamento da tela cheia ao iniciar um episódio.
              </p>
            </div>

            <ChevronRight className="size-5 shrink-0 text-muted" />
          </button>

        </div>
      </section>

    </div>
  );
      }
