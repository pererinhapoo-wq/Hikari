import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";

import {
  Check,
  ChevronRight,
  Moon,
  Palette,
  Sparkles,
  Type,
} from "lucide-react";

export const Route = createFileRoute(
  "/settings-appearance",
)({
  component: SettingsAppearance,
});

function SettingsAppearance() {
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
            <Palette className="size-5 text-fg" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-fg">
              Aparência
            </h1>

            <p className="mt-1 text-sm text-muted">
              Personalize a aparência e a experiência do Hikari.
            </p>
          </div>
        </div>
      </div>

      {/* TEMA */}
      <section className="mb-7">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
          Tema
        </h2>

        <div className="overflow-hidden rounded-xl border border-border bg-bg">

          <button
            type="button"
            className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-elevated"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
              <Moon className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">
                Tema escuro
              </p>

              <p className="mt-1 text-xs leading-5 text-muted">
                Usar o tema escuro na interface do Hikari.
              </p>
            </div>

            <Check className="size-5 shrink-0 text-fg" />
          </button>

        </div>
      </section>

      {/* FONTE */}
      <section className="mb-7">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
          Texto
        </h2>

        <div className="overflow-hidden rounded-xl border border-border bg-bg">

          <button
            type="button"
            className="flex w-full items-center gap-4 border-b border-border px-4 py-4 text-left transition-colors hover:bg-elevated"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
              <Type className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">
                Tamanho da fonte
              </p>

              <p className="mt-1 text-xs leading-5 text-muted">
                Ajuste o tamanho dos textos exibidos no Hikari.
              </p>
            </div>

            <ChevronRight className="size-5 shrink-0 text-muted" />
          </button>

        </div>
      </section>

      {/* ANIMAÇÕES */}
      <section>
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
          Experiência
        </h2>

        <div className="overflow-hidden rounded-xl border border-border bg-bg">

          <div className="flex items-center gap-4 px-4 py-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
              <Sparkles className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">
                Animações
              </p>

              <p className="mt-1 text-xs leading-5 text-muted">
                Ativar animações e transições da interface.
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
