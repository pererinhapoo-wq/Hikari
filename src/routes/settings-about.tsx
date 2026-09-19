import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";

import {
  ChevronRight,
  Code2,
  Heart,
  Info,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute(
  "/settings-about",
)({
  component: SettingsAbout,
});

function SettingsAbout() {
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
            <Info className="size-5 text-fg" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-fg">
              Sobre
            </h1>

            <p className="mt-1 text-sm text-muted">
              Informações sobre o Hikari.
            </p>
          </div>
        </div>
      </div>

      {/* HIKARI */}
      <section className="mb-7">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
          Hikari
        </h2>

        <div className="overflow-hidden rounded-xl border border-border bg-bg">

          <div className="flex items-center gap-4 border-b border-border px-4 py-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
              <Sparkles className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">
                Hikari
              </p>

              <p className="mt-1 text-xs leading-5 text-muted">
                Uma plataforma criada para reunir sua experiência de anime em um só lugar.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 border-b border-border px-4 py-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
              <Code2 className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">
                Versão
              </p>

              <p className="mt-1 text-xs leading-5 text-muted">
                Hikari em desenvolvimento.
              </p>
            </div>

            <span className="text-xs font-medium text-muted">
              1.0
            </span>
          </div>

          <div className="flex items-center gap-4 px-4 py-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
              <Heart className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">
                Feito com carinho
              </p>

              <p className="mt-1 text-xs leading-5 text-muted">
                O Hikari continua evoluindo com novos recursos.
              </p>
            </div>

            <ChevronRight className="size-5 shrink-0 text-muted" />
          </div>

        </div>
      </section>

    </div>
  );
                }
