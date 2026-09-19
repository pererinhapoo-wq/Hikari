import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";

import {
  Check,
  Moon,
  Palette,
  Sparkles,
  Sun,
  Type,
} from "lucide-react";

import { useState } from "react";

export const Route = createFileRoute(
  "/settings-appearance",
)({
  component: SettingsAppearance,
});

function SettingsAppearance() {
  const [theme, setTheme] = useState("Escuro");
  const [fontSize, setFontSize] = useState("Médio");
  const [animations, setAnimations] = useState(true);

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
              Personalize a aparência do Hikari.
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

          {/* ESCURO */}
          <button
            type="button"
            onClick={() => setTheme("Escuro")}
            className="flex w-full items-center gap-4 border-b border-border px-4 py-4 text-left transition-colors hover:bg-elevated"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
              <Moon className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">
                Escuro
              </p>

              <p className="mt-1 text-xs leading-5 text-muted">
                Usar o tema escuro no Hikari.
              </p>
            </div>

            {theme === "Escuro" && (
              <Check className="size-5 shrink-0 text-fg" />
            )}
          </button>

          {/* CLARO */}
          <button
            type="button"
            onClick={() => setTheme("Claro")}
            className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-elevated"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
              <Sun className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">
                Claro
              </p>

              <p className="mt-1 text-xs leading-5 text-muted">
                Usar o tema claro no Hikari.
              </p>
            </div>

            {theme === "Claro" && (
              <Check className="size-5 shrink-0 text-fg" />
            )}
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
            onClick={() => {
              const sizes = ["Pequeno", "Médio", "Grande"];
              const current = sizes.indexOf(fontSize);
              setFontSize(sizes[(current + 1) % sizes.length]);
            }}
            className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-elevated"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
              <Type className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">
                Tamanho da fonte
              </p>

              <p className="mt-1 text-xs leading-5 text-muted">
                Tamanho atual: {fontSize}
              </p>
            </div>
          </button>

        </div>
      </section>

      {/* ANIMAÇÕES */}
      <section>
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
          Efeitos
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
                Ativar ou desativar animações da interface.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={animations}
              onClick={() => setAnimations(!animations)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                animations ? "bg-fg" : "bg-elevated"
              }`}
            >
              <span
                className={`absolute top-1 size-4 rounded-full transition-transform ${
                  animations
                    ? "translate-x-6 bg-bg"
                    : "translate-x-1 bg-muted"
                }`}
              />
            </button>
          </div>

        </div>
      </section>

    </div>
  );
      }
