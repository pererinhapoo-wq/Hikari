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

import { useState } from "react";

export const Route = createFileRoute(
  "/settings-player",
)({
  component: SettingsPlayer,
});

function SettingsPlayer() {
  const [autoplay, setAutoplay] = useState(true);

  const [qualityOpen, setQualityOpen] = useState(false);
  const [quality, setQuality] = useState("Automática");

  const [captionsOpen, setCaptionsOpen] = useState(false);
  const [captions, setCaptions] = useState("Ativadas");

  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState("Perguntar");

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
              aria-checked={autoplay}
              onClick={() => setAutoplay(!autoplay)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                autoplay
                  ? "bg-green-500"
                  : "bg-elevated"
              }`}
            >
              <span
                className={`absolute top-1 size-4 rounded-full bg-white transition-all ${
                  autoplay
                    ? "left-6"
                    : "left-1"
                }`}
              />
            </button>
          </div>

          {/* QUALIDADE */}
          <button
            type="button"
            onClick={() => setQualityOpen(true)}
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
                {quality}
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
            onClick={() => setCaptionsOpen(true)}
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
                {captions}
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
            onClick={() => setFullscreenOpen(true)}
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
                {fullscreen}
              </p>
            </div>

            <ChevronRight className="size-5 shrink-0 text-muted" />
          </button>

        </div>
      </section>

      {/* MODAL QUALIDADE */}
      {qualityOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-bg p-5">
            <h2 className="text-lg font-semibold text-fg">
              Qualidade do vídeo
            </h2>

            <div className="mt-4 space-y-2">
              {["Automática", "1080p", "720p", "480p"].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setQuality(option);
                    setQualityOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-xl bg-elevated px-4 py-3 text-left text-sm text-fg"
                >
                  {option}

                  {quality === option && (
                    <span className="text-green-500">✓</span>
                  )}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setQualityOpen(false)}
              className="mt-4 w-full rounded-xl border border-border px-4 py-3 text-sm text-muted"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* MODAL LEGENDAS */}
      {captionsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-bg p-5">
            <h2 className="text-lg font-semibold text-fg">
              Legendas
            </h2>

            <div className="mt-4 space-y-2">
              {["Ativadas", "Desativadas"].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setCaptions(option);
                    setCaptionsOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-xl bg-elevated px-4 py-3 text-left text-sm text-fg"
                >
                  {option}

                  {captions === option && (
                    <span className="text-green-500">✓</span>
                  )}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setCaptionsOpen(false)}
              className="mt-4 w-full rounded-xl border border-border px-4 py-3 text-sm text-muted"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* MODAL TELA CHEIA */}
      {fullscreenOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-bg p-5">
            <h2 className="text-lg font-semibold text-fg">
              Tela cheia
            </h2>

            <div className="mt-4 space-y-2">
              {["Perguntar", "Entrar automaticamente"].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setFullscreen(option);
                    setFullscreenOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-xl bg-elevated px-4 py-3 text-left text-sm text-fg"
                >
                  {option}

                  {fullscreen === option && (
                    <span className="text-green-500">✓</span>
                  )}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setFullscreenOpen(false)}
              className="mt-4 w-full rounded-xl border border-border px-4 py-3 text-sm text-muted"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

    </div>
  );
          }
