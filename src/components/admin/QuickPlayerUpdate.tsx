import { useState, useMemo } from "react";
import {
  Zap,
  Search,
  ClipboardPaste,
  CheckCircle2,
  Film,
  RotateCcw,
  Link2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useHikariStore } from "@/lib/store";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { isHikariAdmin } from "@/lib/auth/admin";
import type { LocalAnime } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type PlayerKey =
  | "videoUrl"
  | "videoUrl2"
  | "videoUrl3"
  | "videoUrl4"
  | "videoUrl5";

export const PLAYER_CONFIGS: {
  id: number;
  key: PlayerKey;
  label: string;
}[] = [
  { id: 1, key: "videoUrl", label: "Player 1" },
  { id: 2, key: "videoUrl2", label: "Player 2" },
  { id: 3, key: "videoUrl3", label: "Player 3" },
  { id: 4, key: "videoUrl4", label: "Player 4" },
  { id: 5, key: "videoUrl5", label: "Player 5" },
];

/**
 * Validação não-presuntiva da URL de vídeo:
 * Exige formato HTTP ou HTTPS estrito com domínio válido.
 */
export function validateHttpVideoUrl(url: string): {
  valid: boolean;
  error?: string;
} {
  const trimmed = url.trim();
  if (!trimmed) {
    return { valid: false, error: "O endereço de vídeo não pode estar em branco." };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return {
        valid: false,
        error: "Apenas protocolos HTTP ou HTTPS são aceitos.",
      };
    }
    if (!parsed.hostname || !parsed.hostname.includes(".")) {
      return {
        valid: false,
        error: "O domínio da URL informada é inválido.",
      };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "A URL inserida é inválida ou malformada." };
  }
}

function resolveAnimeDisplayTitle(a: LocalAnime): string {
  return a.titleEnglish || a.titleRomaji || a.titleNative || "Sem título";
}

export function QuickPlayerUpdate() {
  const { user, isPending } = useCurrentUserState();
  const animes = useHikariStore((s) => s.animes);
  const upsertAnime = useHikariStore((s) => s.upsertAnime);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAnimeId, setSelectedAnimeId] = useState<string>("");
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string>("");
  const [selectedPlayerNumber, setSelectedPlayerNumber] = useState<number | null>(
    null,
  );
  const [urlInput, setUrlInput] = useState("");

  const matchingAnimes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return animes;
    return animes.filter((a) => {
      const full = `${a.titleRomaji} ${a.titleEnglish} ${a.titleNative}`.toLowerCase();
      return full.includes(q);
    });
  }, [animes, searchQuery]);

  const currentAnime = useMemo(() => {
    if (!selectedAnimeId) return null;
    return animes.find((a) => a.id === selectedAnimeId) ?? null;
  }, [animes, selectedAnimeId]);

  const seasons = useMemo(() => {
    return currentAnime?.seasons ?? [];
  }, [currentAnime]);

  const currentSeason = useMemo(() => {
    if (!selectedSeasonId) return null;
    return seasons.find((s) => s.id === selectedSeasonId) ?? null;
  }, [seasons, selectedSeasonId]);

  const episodes = useMemo(() => {
    return currentSeason?.episodes ?? [];
  }, [currentSeason]);

  const currentEpisode = useMemo(() => {
    if (!selectedEpisodeId) return null;
    return episodes.find((e) => e.id === selectedEpisodeId) ?? null;
  }, [episodes, selectedEpisodeId]);

  const activePlayerConfig = useMemo(() => {
    if (selectedPlayerNumber === null) return null;
    return (
      PLAYER_CONFIGS.find((p) => p.id === selectedPlayerNumber) ?? null
    );
  }, [selectedPlayerNumber]);

  const currentRegisteredUrl = useMemo(() => {
    if (!currentEpisode || !activePlayerConfig) return "";
    return currentEpisode[activePlayerConfig.key] ?? "";
  }, [currentEpisode, activePlayerConfig]);

  if (isPending) return null;
  if (!user || !isHikariAdmin(user.primaryEmail)) {
    return null;
  }

  const handleSelectAnime = (id: string) => {
    setSelectedAnimeId(id);
    const targetAnime = animes.find((a) => a.id === id);
    const firstSeason = targetAnime?.seasons?.[0];
    if (firstSeason) {
      setSelectedSeasonId(firstSeason.id);
      setSelectedEpisodeId(firstSeason.episodes?.[0]?.id ?? "");
    } else {
      setSelectedSeasonId("");
      setSelectedEpisodeId("");
    }
    setSelectedPlayerNumber(null);
    setUrlInput("");
  };

  const handleSelectSeason = (sid: string) => {
    setSelectedSeasonId(sid);
    const targetSeason = seasons.find((s) => s.id === sid);
    setSelectedEpisodeId(targetSeason?.episodes?.[0]?.id ?? "");
    setSelectedPlayerNumber(null);
    setUrlInput("");
  };

  const handleSelectEpisode = (eid: string) => {
    setSelectedEpisodeId(eid);
    setSelectedPlayerNumber(null);
    setUrlInput("");
  };

  const handleSelectPlayer = (playerNum: number) => {
    setSelectedPlayerNumber(playerNum);
    const cfg = PLAYER_CONFIGS.find((p) => p.id === playerNum);
    if (cfg && currentEpisode) {
      setUrlInput(currentEpisode[cfg.key] ?? "");
    } else {
      setUrlInput("");
    }
  };

  const handlePasteClipboard = async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.clipboard ||
      typeof navigator.clipboard.readText !== "function"
    ) {
      toast.info(
        "Acesso à área de transferência não suportado neste navegador. Cole manualmente no campo.",
      );
      return;
    }

    try {
      const text = await navigator.clipboard.readText();
      const trimmed = text.trim();
      if (!trimmed) {
        toast.info("A área de transferência está vazia.");
        return;
      }
      setUrlInput(trimmed);
      const validation = validateHttpVideoUrl(trimmed);
      if (validation.valid) {
        toast.success("URL colada com sucesso!");
      } else {
        toast.warning(`Texto colado, mas atenção: ${validation.error}`);
      }
    } catch {
      toast.info(
        "Permissão da área de transferência negada. Cole o link manualmente no campo de texto.",
      );
    }
  };

  const handleSave = () => {
    if (!currentAnime) {
      toast.error("Selecione um anime.");
      return;
    }
    if (!selectedSeasonId) {
      toast.error("Selecione uma temporada.");
      return;
    }
    if (!selectedEpisodeId || !currentEpisode) {
      toast.error("Selecione um episódio.");
      return;
    }
    if (selectedPlayerNumber === null || !activePlayerConfig) {
      toast.error(
        "Selecione explicitamente o player que deseja atualizar (Player 1 a 5).",
      );
      return;
    }

    const trimmedUrl = urlInput.trim();
    const validation = validateHttpVideoUrl(trimmedUrl);
    if (!validation.valid) {
      toast.error(validation.error || "Endereço de vídeo inválido.");
      return;
    }

    const playerKey = activePlayerConfig.key;

    const updatedAnime: LocalAnime = {
      ...currentAnime,
      seasons: currentAnime.seasons.map((s) => {
        if (s.id !== selectedSeasonId) return s;
        return {
          ...s,
          episodes: s.episodes.map((ep) => {
            if (ep.id !== selectedEpisodeId) return ep;
            return {
              ...ep,
              [playerKey]: trimmedUrl,
            };
          }),
        };
      }),
      updatedAt: Date.now(),
    };

    upsertAnime(updatedAnime);

    toast.success(
      `${activePlayerConfig.label} do Episódio ${currentEpisode.number} atualizado com sucesso!`,
    );
  };

  const urlValidationPreview = urlInput.trim()
    ? validateHttpVideoUrl(urlInput)
    : null;

  return (
    <section
      id="quick-update"
      className="studio-panel rounded-2xl p-4 sm:p-6 space-y-6"
    >
      {/* Barra de Resumo do Tool */}
      <div className="flex flex-col gap-3 border-b border-white/[0.07] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-purple-500/30 bg-purple-500/12 text-purple-300">
            <Zap className="size-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-[var(--color-fg)]">
              Atualização Rápida de Players
            </h2>
            <p className="text-xs text-[var(--color-muted)]">
              Atualize links capturados sem abrir o editor completo do anime.
            </p>
          </div>
        </div>

        <span className="studio-mono text-[11px] text-[var(--color-subtle)]">
          <span className="studio-tabular font-semibold text-[var(--color-fg)]">
            {matchingAnimes.length}
          </span>{" "}
          título(s) disponíveis
        </span>
      </div>

      {/* ETAPA 1: Localizar Anime */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            1. Localizar Anime
          </label>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-xs text-purple-400 hover:text-purple-300"
            >
              Limpar filtro
            </button>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-12">
          <div className="relative md:col-span-5">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-subtle)]" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrar por nome do anime..."
              className="h-11 border-white/10 bg-[var(--studio-panel-alt)] pl-9 pr-8 text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Limpar busca"
                className="absolute top-1/2 right-2.5 -translate-y-1/2 p-1 text-[var(--color-subtle)] hover:text-[var(--color-fg)]"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="md:col-span-7">
            <select
              value={selectedAnimeId}
              onChange={(e) => handleSelectAnime(e.target.value)}
              aria-label="Selecionar anime"
              className="h-11 w-full cursor-pointer rounded-md border border-white/10 bg-[var(--studio-panel-alt)] px-3 text-sm text-[var(--color-fg)] focus:border-purple-500/50 focus:outline-none"
            >
              <option value="">-- Escolha um anime no catálogo --</option>
              {matchingAnimes.map((a) => (
                <option key={a.id} value={a.id}>
                  {resolveAnimeDisplayTitle(a)} (
                  {a.seasons.reduce((acc, s) => acc + s.episodes.length, 0)} eps)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Cartão de Contexto do Anime Selecionado */}
        {currentAnime && (
          <div className="studio-panel-alt flex items-center gap-3.5 rounded-xl p-3">
            <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/40">
              {currentAnime.cover ? (
                <img
                  src={currentAnime.cover}
                  alt={resolveAnimeDisplayTitle(currentAnime)}
                  className="size-full object-cover"
                />
              ) : (
                <div className="grid size-full place-items-center text-[var(--color-subtle)]">
                  <Film className="size-4" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--color-fg)]">
                {resolveAnimeDisplayTitle(currentAnime)}
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                {currentAnime.format || "TV"} · {currentAnime.year || "—"} ·{" "}
                <span className="studio-tabular">
                  {currentAnime.seasons.length} temporada(s)
                </span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ETAPA 2: Temporada e Episódio */}
      {currentAnime && (
        <div className="grid grid-cols-1 gap-4 border-t border-white/[0.07] pt-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              2. Temporada
            </label>
            <select
              value={selectedSeasonId}
              onChange={(e) => handleSelectSeason(e.target.value)}
              aria-label="Selecionar temporada"
              className="h-11 w-full cursor-pointer rounded-md border border-white/10 bg-[var(--studio-panel-alt)] px-3 text-sm text-[var(--color-fg)] focus:border-purple-500/50 focus:outline-none"
            >
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title || `Temporada ${s.number}`} ({s.episodes.length} eps)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              3. Episódio
            </label>
            <select
              value={selectedEpisodeId}
              onChange={(e) => handleSelectEpisode(e.target.value)}
              disabled={episodes.length === 0}
              aria-label="Selecionar episódio"
              className="h-11 w-full cursor-pointer rounded-md border border-white/10 bg-[var(--studio-panel-alt)] px-3 text-sm text-[var(--color-fg)] focus:border-purple-500/50 focus:outline-none disabled:opacity-50"
            >
              {episodes.length === 0 ? (
                <option value="">Nenhum episódio nesta temporada</option>
              ) : (
                episodes.map((ep) => {
                  const activeP = [
                    ep.videoUrl ? "P1" : null,
                    ep.videoUrl2 ? "P2" : null,
                    ep.videoUrl3 ? "P3" : null,
                    ep.videoUrl4 ? "P4" : null,
                    ep.videoUrl5 ? "P5" : null,
                  ]
                    .filter(Boolean)
                    .join(", ");

                  return (
                    <option key={ep.id} value={ep.id}>
                      #{ep.number} — {ep.title || `Episódio ${ep.number}`}
                      {activeP ? ` [${activeP}]` : " [Sem vídeo]"}
                    </option>
                  );
                })
              )}
            </select>
          </div>
        </div>
      )}

      {/* ETAPA 3: Seleção Explícita de Player */}
      {currentEpisode && (
        <div className="space-y-3 border-t border-white/[0.07] pt-5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            4. Selecione o Player para Atualizar (Seleção Explícita Obrigatória)
          </label>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
            {PLAYER_CONFIGS.map((cfg) => {
              const isSelected = selectedPlayerNumber === cfg.id;
              const hasExistingLink = Boolean(currentEpisode[cfg.key]?.trim());

              return (
                <button
                  key={cfg.id}
                  type="button"
                  onClick={() => handleSelectPlayer(cfg.id)}
                  className={cn(
                    "flex min-h-[72px] cursor-pointer flex-col items-center justify-center rounded-xl border p-3 text-center transition-colors",
                    isSelected
                      ? "border-purple-500 bg-purple-500/15 text-white shadow-[0_0_0_1px_rgba(168,85,247,0.4)]"
                      : "border-white/10 bg-[var(--studio-panel-alt)] text-[var(--color-fg)] hover:border-white/20 hover:bg-white/[0.04]",
                  )}
                >
                  <span className="text-sm font-semibold">{cfg.label}</span>
                  <span
                    className={cn(
                      "studio-mono mt-1 text-[10px] font-medium",
                      hasExistingLink ? "text-emerald-400" : "text-[var(--color-subtle)]",
                    )}
                  >
                    {hasExistingLink ? "Configurado" : "Vazio"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ETAPA 4: Endereço do Vídeo */}
      {currentEpisode && activePlayerConfig && (
        <div className="space-y-4 border-t border-white/[0.07] pt-5">
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                <Link2 className="size-3.5 text-purple-400" />
                <span>
                  5. Nova URL para {activePlayerConfig.label} (Episódio{" "}
                  {currentEpisode.number})
                </span>
              </label>
              {currentRegisteredUrl && (
                <span className="studio-mono max-w-full truncate text-[11px] text-[var(--color-subtle)]">
                  Atual: {currentRegisteredUrl.slice(0, 48)}
                  {currentRegisteredUrl.length > 48 ? "…" : ""}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Cole a URL do vídeo (https://.../video.mp4 ou .m3u8)"
                  className="studio-mono h-11 border-white/10 bg-[var(--studio-panel-alt)] pr-9 text-xs sm:text-sm"
                />
                {urlInput && (
                  <button
                    type="button"
                    onClick={() => setUrlInput("")}
                    aria-label="Limpar campo"
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 p-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handlePasteClipboard}
                className="h-11 shrink-0 border-white/10 bg-[var(--studio-panel-alt)] text-xs hover:bg-white/[0.06]"
                title="Colar da área de transferência"
              >
                <ClipboardPaste className="size-4 text-purple-400" />
                <span>Colar</span>
              </Button>
            </div>

            {urlValidationPreview && !urlValidationPreview.valid && (
              <p className="mt-1.5 text-xs text-rose-400">
                {urlValidationPreview.error}
              </p>
            )}
          </div>

          <div className="flex flex-col items-start justify-between gap-3 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center">
            <p className="text-xs leading-relaxed text-[var(--color-muted)]">
              Apenas o{" "}
              <strong className="text-[var(--color-fg)]">
                {activePlayerConfig.label}
              </strong>{" "}
              do{" "}
              <strong className="text-[var(--color-fg)]">
                Episódio {currentEpisode.number}
              </strong>{" "}
              será alterado. Todos os outros dados serão preservados.
            </p>

            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              {currentRegisteredUrl && urlInput !== currentRegisteredUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setUrlInput(currentRegisteredUrl)}
                  className="h-11 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                >
                  <RotateCcw className="size-3.5" />
                  Restaurar original
                </Button>
              )}

              <Button
                type="button"
                onClick={handleSave}
                className="h-11 flex-1 bg-purple-600 px-6 text-xs font-semibold text-white hover:bg-purple-500 sm:flex-initial"
              >
                <CheckCircle2 className="size-4" />
                Salvar Alteração
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default QuickPlayerUpdate;
