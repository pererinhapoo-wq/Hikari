import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  Check,
  ChevronRight,
  Gauge,
  Keyboard,
  MonitorPlay,
  Play,
  Settings2,
  Volume2,
} from "lucide-react";
import { useState } from "react";

function getSavedAutoplay(): boolean {
  if (typeof window === "undefined") return true;
  const saved = window.localStorage.getItem("hikari-player-autoplay");
  if (saved === null) {
    const novaSaved = window.localStorage.getItem("nova_player_autoplay");
    return novaSaved === null ? true : novaSaved !== "false";
  }
  return saved !== "false";
}

function getSavedPlaybackRate(): number {
  if (typeof window === "undefined") return 1;
  const saved = window.localStorage.getItem("nova_player_playback_rate");
  const parsed = saved ? Number.parseFloat(saved) : 1;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function getSavedQualityPref(): string {
  if (typeof window === "undefined") return "Automática";
  return window.localStorage.getItem("nova_player_quality_preference") || "Automática";
}

export const Route = createFileRoute("/settings-player")({
  component: SettingsPlayer,
});

function SettingsPlayer() {
  const [autoplay, setAutoplay] = useState<boolean>(getSavedAutoplay);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(getSavedPlaybackRate);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [qualityPref, setQualityPref] = useState<string>(getSavedQualityPref);

  function handleAutoplayToggle() {
    setAutoplay((current) => {
      const next = !current;
      try {
        localStorage.setItem("hikari-player-autoplay", String(next));
        localStorage.setItem("nova_player_autoplay", String(next));
      } catch (err) {
        void err;
      }
      return next;
    });
  }

  function handleSelectSpeed(speed: number) {
    setPlaybackRate(speed);
    try {
      localStorage.setItem("nova_player_playback_rate", String(speed));
    } catch (err) {
      void err;
    }
    setSpeedOpen(false);
  }

  function handleSelectQuality(pref: string) {
    setQualityPref(pref);
    try {
      localStorage.setItem("nova_player_quality_preference", pref);
    } catch (err) {
      void err;
    }
    setQualityOpen(false);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-20 pt-5">
      {/* CABEÇALHO */}
      <div className="mb-6">
        <Link
          to="/settings"
          className="mb-4 inline-flex items-center text-sm text-muted hover:text-fg"
        >
          ← Voltar
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-[#a855f7]/15 text-[#a855f7]">
            <MonitorPlay className="size-6" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-fg">Player NOVA STREAM</h1>
            <p className="mt-0.5 text-xs text-muted">
              Personalize o comportamento, velocidade e atalhos do player oficial.
            </p>
          </div>
        </div>
      </div>

      {/* SEÇÃO: REPRODUÇÃO */}
      <section className="mb-7">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
          Reprodução e Performance
        </h2>

        <div className="overflow-hidden rounded-2xl border border-border bg-bg">
          {/* AUTOPLAY */}
          <div className="flex items-center gap-4 border-b border-border px-4 py-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-elevated text-muted">
              <Play className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">Reprodução automática</p>
              <p className="mt-0.5 text-xs text-muted">
                Inicia a reprodução do episódio automaticamente assim que os dados estiverem prontos.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={autoplay}
              onClick={handleAutoplayToggle}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                autoplay ? "bg-[#a855f7]" : "bg-elevated"
              }`}
            >
              <span
                className={`absolute top-1 size-4 rounded-full bg-white transition-all ${
                  autoplay ? "left-6" : "left-1"
                }`}
              />
            </button>
          </div>

          {/* VELOCIDADE PADRÃO */}
          <button
            type="button"
            onClick={() => setSpeedOpen(true)}
            className="flex w-full items-center gap-4 border-b border-border px-4 py-4 text-left transition-colors hover:bg-elevated"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-elevated text-muted">
              <Gauge className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">Velocidade padrão</p>
              <p className="mt-0.5 text-xs text-muted">
                {playbackRate === 1 ? "1x (Normal)" : `${playbackRate}x`}
              </p>
            </div>

            <ChevronRight className="size-5 shrink-0 text-muted" />
          </button>

          {/* QUALIDADE */}
          <button
            type="button"
            onClick={() => setQualityOpen(true)}
            className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-elevated"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-elevated text-muted">
              <Settings2 className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">Perfil de resolução</p>
              <p className="mt-0.5 text-xs text-muted">{qualityPref}</p>
            </div>

            <ChevronRight className="size-5 shrink-0 text-muted" />
          </button>
        </div>
      </section>

      {/* SEÇÃO: RECURSOS EXCLUSIVOS */}
      <section className="mb-7">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
          Recursos do Player
        </h2>

        <div className="overflow-hidden rounded-2xl border border-border bg-bg p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#a855f7]/15 text-[#a855f7]">
              <Activity className="size-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-fg">Diagnóstico Técnico ("Stats for Nerds")</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Pressione a tecla <kbd className="rounded border border-white/20 bg-elevated px-1.5 py-0.5 font-mono text-[11px] text-white">D</kbd> durante o vídeo para inspecionar em tempo real resolução física, taxa de quadros, frames perdidos, buffer à frente e bitrate.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO: ATALHOS DE TECLADO E GESTOS */}
      <section>
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
          Atalhos de Teclado e Gestos
        </h2>

        <div className="overflow-hidden rounded-2xl border border-border bg-bg divide-y divide-border text-xs">
          <div className="flex items-center justify-between p-3.5">
            <span className="text-fg font-medium">Reproduzir / Pausar</span>
            <div className="flex items-center gap-1.5">
              <kbd className="rounded border border-white/20 bg-elevated px-2 py-1 font-mono text-white/80">Espaço</kbd>
              <span className="text-muted">ou</span>
              <kbd className="rounded border border-white/20 bg-elevated px-2 py-1 font-mono text-white/80">K</kbd>
            </div>
          </div>

          <div className="flex items-center justify-between p-3.5">
            <span className="text-fg font-medium">Retroceder 10 segundos</span>
            <div className="flex items-center gap-1.5">
              <kbd className="rounded border border-white/20 bg-elevated px-2 py-1 font-mono text-white/80">←</kbd>
              <span className="text-muted">ou</span>
              <kbd className="rounded border border-white/20 bg-elevated px-2 py-1 font-mono text-white/80">J</kbd>
            </div>
          </div>

          <div className="flex items-center justify-between p-3.5">
            <span className="text-fg font-medium">Avançar 10 segundos</span>
            <div className="flex items-center gap-1.5">
              <kbd className="rounded border border-white/20 bg-elevated px-2 py-1 font-mono text-white/80">→</kbd>
              <span className="text-muted">ou</span>
              <kbd className="rounded border border-white/20 bg-elevated px-2 py-1 font-mono text-white/80">L</kbd>
            </div>
          </div>

          <div className="flex items-center justify-between p-3.5">
            <span className="text-fg font-medium">Alternar Tela Cheia</span>
            <kbd className="rounded border border-white/20 bg-elevated px-2 py-1 font-mono text-white/80">F</kbd>
          </div>

          <div className="flex items-center justify-between p-3.5">
            <span className="text-fg font-medium">Silenciar Áudio</span>
            <kbd className="rounded border border-white/20 bg-elevated px-2 py-1 font-mono text-white/80">M</kbd>
          </div>

          <div className="flex items-center justify-between p-3.5">
            <span className="text-fg font-medium">Toque Duplo (Dispositivos Móveis)</span>
            <span className="text-white/60">Esquerda (-10s) / Direita (+10s)</span>
          </div>
        </div>
      </section>

      {/* MODAL: VELOCIDADE PADRÃO */}
      {speedOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-[#131316] p-5 shadow-2xl">
            <h2 className="text-lg font-semibold text-fg">Velocidade padrão</h2>
            <p className="mt-1 text-xs text-muted">
              Define a velocidade ao iniciar os vídeos no player.
            </p>

            <div className="mt-4 space-y-1.5">
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => handleSelectSpeed(rate)}
                  className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm transition-colors ${
                    playbackRate === rate
                      ? "bg-[#a855f7]/20 text-[#a855f7] font-semibold"
                      : "bg-elevated text-fg hover:bg-elevated/80"
                  }`}
                >
                  <span>{rate}x {rate === 1 && "(Normal)"}</span>
                  {playbackRate === rate && <Check className="size-4 text-[#a855f7]" />}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setSpeedOpen(false)}
              className="mt-4 w-full rounded-xl border border-border px-4 py-3 text-sm text-muted hover:text-white"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* MODAL: PERFIL DE QUALIDADE */}
      {qualityOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-[#131316] p-5 shadow-2xl">
            <h2 className="text-lg font-semibold text-fg">Perfil de resolução</h2>
            <p className="mt-1 text-xs text-muted">
              O motor HLS.js adapta dinamicamente a taxa de bits com base na sua conexão.
            </p>

            <div className="mt-4 space-y-1.5">
              {[
                { id: "Automática", desc: "Adaptativa inteligente por largura de banda" },
                { id: "Priorizar Alta Resolução (1080p/720p)", desc: "Tenta carregar o nível máximo disponível" },
                { id: "Economia de Dados (480p/SD)", desc: "Menor consumo de internet" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectQuality(opt.id)}
                  className={`flex w-full items-start justify-between rounded-xl px-4 py-3 text-left text-sm transition-colors ${
                    qualityPref === opt.id
                      ? "bg-[#a855f7]/20 text-[#a855f7] font-semibold"
                      : "bg-elevated text-fg hover:bg-elevated/80"
                  }`}
                >
                  <div>
                    <p className="font-medium">{opt.id}</p>
                    <p className="mt-0.5 text-xs text-muted">{opt.desc}</p>
                  </div>
                  {qualityPref === opt.id && <Check className="size-4 text-[#a855f7] shrink-0 mt-1" />}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setQualityOpen(false)}
              className="mt-4 w-full rounded-xl border border-border px-4 py-3 text-sm text-muted hover:text-white"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
