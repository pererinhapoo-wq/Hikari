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

import { useState } from "react";

export const Route = createFileRoute(
  "/settings-about",
)({
  component: SettingsAbout,
});

function SettingsAbout() {
  const [aboutOpen, setAboutOpen] =
    useState(false);

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

          {/* HIKARI */}
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

          {/* VERSÃO */}
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

          {/* FEITO COM CARINHO */}
          <button
            type="button"
            onClick={() =>
              setAboutOpen(true)
            }
            className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-elevated"
          >
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                aboutOpen
                  ? "bg-green-500/15 text-green-500"
                  : "bg-elevated text-muted"
              }`}
            >
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
          </button>

        </div>
      </section>

      {/* MODAL */}
      {aboutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-bg p-5">

            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-green-500/15">
                <Heart className="size-5 text-green-500" />
              </div>

              <h2 className="text-lg font-semibold text-fg">
                Sobre o Hikari
              </h2>
            </div>

            <p className="mt-4 text-sm leading-6 text-muted">
              O Hikari é um projeto em desenvolvimento,
              criado para oferecer uma experiência completa
              para quem gosta de anime.
            </p>

            <p className="mt-3 text-sm leading-6 text-muted">
              Novos recursos e melhorias continuarão sendo
              adicionados ao longo do desenvolvimento.
            </p>

            <button
              type="button"
              onClick={() =>
                setAboutOpen(false)
              }
              className="mt-5 w-full rounded-xl border border-border px-4 py-3 text-sm text-muted"
            >
              Fechar
            </button>

          </div>
        </div>
      )}

    </div>
  );
}