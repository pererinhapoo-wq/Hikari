import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardPaste,
  Film,
  Link2,
  RotateCcw,
  Search,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { StudioPanel } from "@/components/admin/studio-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminAccess } from "@/lib/auth/use-admin-access";
import { useHikariStore } from "@/lib/store";
import type { Episode, LocalAnime, Season } from "@/lib/types";
import {
  ANITUBE22_INVALID_URL_ERROR,
  isLegacyAnitube22Ref,
  parseAnitube22PlayerUrl,
  stripTimeQueryParam,
} from "@/lib/anitube22";
import { sanitizePlayableVideoUrl } from "@/lib/published-episodes";
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

export interface QuickAnimeSummary {
  id: string;
  title: string;
  searchText: string;
  episodeCount: number;
}

const quickAnimeSummaryCache = new WeakMap<LocalAnime, QuickAnimeSummary>();

export function getAnimeQuickSummary(anime: LocalAnime): QuickAnimeSummary {
  const cached = quickAnimeSummaryCache.get(anime);
  if (cached) return cached;

  let episodeCount = 0;
  for (const s of anime.seasons) {
    episodeCount += s.episodes.length;
  }
  const title = resolveAnimeDisplayTitle(anime);
  const summary: QuickAnimeSummary = {
    id: anime.id,
    title,
    searchText: `${anime.titleRomaji} ${anime.titleEnglish} ${anime.titleNative}`.toLowerCase(),
    episodeCount,
  };
  quickAnimeSummaryCache.set(anime, summary);
  return summary;
}

export function getAnimeQuickSummaries(animes: LocalAnime[]): QuickAnimeSummary[] {
  return animes.map(getAnimeQuickSummary);
}

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

  if (isLegacyAnitube22Ref(trimmed) || /^\d{3,16}$/.test(trimmed)) {
    return { valid: false, error: ANITUBE22_INVALID_URL_ERROR };
  }

  if (trimmed.toLowerCase().includes("playerricas.php")) {
    if (!parseAnitube22PlayerUrl(trimmed)) {
      return { valid: false, error: ANITUBE22_INVALID_URL_ERROR };
    }
    return { valid: true };
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

const QuickAnimeCatalogSelector = memo(function QuickAnimeCatalogSelector({
  matchingSummaries,
  selectedAnimeId,
  searchQuery,
  currentAnime,
  onSearchChange,
  onSelectAnime,
}: {
  matchingSummaries: QuickAnimeSummary[];
  selectedAnimeId: string;
  searchQuery: string;
  currentAnime: LocalAnime | null;
  onSearchChange: (q: string) => void;
  onSelectAnime: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="studio-label">1. Localizar Anime</label>
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="text-xs font-medium text-violet-400 hover:text-violet-300"
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
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filtrar por nome do anime..."
            className="studio-input h-10 pl-9 pr-8 text-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
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
            onChange={(e) => onSelectAnime(e.target.value)}
            aria-label="Selecionar anime"
            className="studio-input h-10 w-full cursor-pointer px-3 text-sm"
          >
            <option value="">-- Escolha um anime no catálogo --</option>
            {matchingSummaries.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title} ({item.episodeCount} eps)
              </option>
            ))}
          </select>
        </div>
      </div>

      {currentAnime && (
        <div className="studio-panel-alt flex items-center gap-3.5 rounded-lg p-3">
          <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md border border-[var(--studio-line)] bg-black/40">
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
  );
});

const QuickSeasonEpisodeSelector = memo(function QuickSeasonEpisodeSelector({
  seasons,
  selectedSeasonId,
  episodes,
  selectedEpisodeId,
  onSelectSeason,
  onSelectEpisode,
}: {
  seasons: Season[];
  selectedSeasonId: string;
  episodes: Episode[];
  selectedEpisodeId: string;
  onSelectSeason: (sid: string) => void;
  onSelectEpisode: (eid: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 border-t border-[var(--studio-line)] pt-5 sm:grid-cols-2">
      <div>
        <label className="studio-label mb-1.5 block">2. Temporada</label>
        <select
          value={selectedSeasonId}
          onChange={(e) => onSelectSeason(e.target.value)}
          aria-label="Selecionar temporada"
          className="studio-input h-10 w-full cursor-pointer px-3 text-sm"
        >
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title || `Temporada ${s.number}`} ({s.episodes.length} eps)
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="studio-label mb-1.5 block">3. Episódio</label>
        <select
          value={selectedEpisodeId}
          onChange={(e) => onSelectEpisode(e.target.value)}
          disabled={episodes.length === 0}
          aria-label="Selecionar episódio"
          className="studio-input h-10 w-full cursor-pointer px-3 text-sm disabled:opacity-50"
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
  );
});

const QuickPlayerSlotPicker = memo(function QuickPlayerSlotPicker({
  episode,
  selectedPlayerNumber,
  onSelectPlayer,
}: {
  episode: Episode;
  selectedPlayerNumber: number | null;
  onSelectPlayer: (playerNum: number) => void;
}) {
  return (
    <div className="space-y-3 border-t border-[var(--studio-line)] pt-5">
      <label className="studio-label block">
        4. Selecione o Player para Atualizar (Seleção Explícita Obrigatória)
      </label>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {PLAYER_CONFIGS.map((cfg) => {
          const isSelected = selectedPlayerNumber === cfg.id;
          const hasExistingLink = Boolean(episode[cfg.key]?.trim());

          return (
            <button
              key={cfg.id}
              type="button"
              onClick={() => onSelectPlayer(cfg.id)}
              className={cn(
                "flex min-h-[72px] cursor-pointer flex-col items-center justify-center rounded-lg border p-3 text-center transition-colors",
                isSelected
                  ? "border-violet-500 bg-violet-500/15 text-white shadow-[0_0_0_1px_rgba(139,92,246,0.4)]"
                  : "border-[var(--studio-line)] bg-[var(--studio-panel-alt)] text-[var(--color-fg)] hover:border-[var(--studio-line-strong)] hover:bg-white/[0.04]",
              )}
            >
              <span className="text-sm font-semibold">{cfg.label}</span>
              <span
                className={cn(
                  "studio-mono mt-1 text-[10px] font-medium",
                  hasExistingLink
                    ? "text-emerald-400"
                    : "text-[var(--color-subtle)]",
                )}
              >
                {hasExistingLink ? "Configurado" : "Vazio"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

const QuickPlayerUrlEditor = memo(function QuickPlayerUrlEditor({
  episode,
  playerConfig,
  onSaveUrl,
}: {
  episode: Episode;
  playerConfig: { id: number; key: PlayerKey; label: string };
  onSaveUrl: (safeDurableUrl: string, playerConfig: { id: number; key: PlayerKey; label: string }) => void;
}) {
  const registeredUrl = episode[playerConfig.key] ?? "";
  const [urlInput, setUrlInput] = useState(registeredUrl);

  useEffect(() => {
    setUrlInput(registeredUrl);
  }, [episode.id, playerConfig.id, registeredUrl]);

  const urlValidationPreview = useMemo(
    () => (urlInput.trim() ? validateHttpVideoUrl(urlInput) : null),
    [urlInput],
  );

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
      const normalized = parseAnitube22PlayerUrl(trimmed)
        ? stripTimeQueryParam(trimmed)
        : (sanitizePlayableVideoUrl(trimmed) ?? trimmed);
      setUrlInput(normalized);
      const validation = validateHttpVideoUrl(normalized);
      if (validation.valid) {
        toast.success("Fonte colada com sucesso!");
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
    const trimmedUrl = urlInput.trim();
    const validation = validateHttpVideoUrl(trimmedUrl);
    if (!validation.valid) {
      toast.error(validation.error || "Endereço de vídeo inválido.");
      return;
    }

    const safeDurableUrl = sanitizePlayableVideoUrl(trimmedUrl) ?? trimmedUrl;
    onSaveUrl(safeDurableUrl, playerConfig);
    setUrlInput(safeDurableUrl);
  };

  return (
    <div className="space-y-4 border-t border-[var(--studio-line)] pt-5">
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <label className="studio-label flex items-center gap-1.5">
            <Link2 className="size-3.5 text-violet-400" />
            <span>
              5. Nova URL para {playerConfig.label} (Episódio {episode.number})
            </span>
          </label>
          {registeredUrl && (
            <span className="studio-mono max-w-full truncate text-[11px] text-[var(--color-subtle)]">
              Atual: {registeredUrl.slice(0, 48)}
              {registeredUrl.length > 48 ? "…" : ""}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="URL completa do playerricas.php ou URL direta (.mp4 / .m3u8)"
              className="studio-input studio-mono h-10 pr-9 text-xs sm:text-sm"
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
            className="h-10 shrink-0 border-[var(--studio-line-strong)] bg-[var(--studio-panel-alt)] text-xs hover:bg-white/[0.06]"
            title="Colar da área de transferência"
          >
            <ClipboardPaste className="size-4 text-violet-400" />
            <span>Colar</span>
          </Button>
        </div>

        {urlValidationPreview && !urlValidationPreview.valid && (
          <p className="mt-1.5 text-xs text-rose-400">
            {urlValidationPreview.error}
          </p>
        )}
      </div>

      <div className="flex flex-col items-start justify-between gap-3 border-t border-[var(--studio-line)] pt-4 sm:flex-row sm:items-center">
        <p className="text-xs leading-relaxed text-[var(--color-muted)]">
          Apenas o{" "}
          <strong className="text-[var(--color-fg)]">{playerConfig.label}</strong>{" "}
          do{" "}
          <strong className="text-[var(--color-fg)]">
            Episódio {episode.number}
          </strong>{" "}
          será alterado. Todos os outros dados serão preservados.
        </p>

        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {registeredUrl && urlInput !== registeredUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setUrlInput(registeredUrl)}
              className="h-10 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
            >
              <RotateCcw className="size-3.5" />
              Restaurar original
            </Button>
          )}

          <Button
            type="button"
            onClick={handleSave}
            className="h-10 flex-1 bg-violet-600 px-6 text-xs font-semibold text-white hover:bg-violet-500 sm:flex-initial"
          >
            <CheckCircle2 className="size-4" />
            Salvar Alteração
          </Button>
        </div>
      </div>
    </div>
  );
});

export function QuickPlayerUpdate() {
  const { isAuthenticated, isAdmin, isPending } = useAdminAccess();
  const animes = useHikariStore((s) => s.animes);
  const upsertAnime = useHikariStore((s) => s.upsertAnime);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAnimeId, setSelectedAnimeId] = useState<string>("");
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string>("");
  const [selectedPlayerNumber, setSelectedPlayerNumber] = useState<number | null>(
    null,
  );

  const animeById = useMemo(() => {
    const map = new Map<string, LocalAnime>();
    for (const a of animes) {
      map.set(a.id, a);
    }
    return map;
  }, [animes]);

  const animeSummaries = useMemo(() => getAnimeQuickSummaries(animes), [animes]);

  const matchingSummaries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return animeSummaries;
    return animeSummaries.filter((item) => item.searchText.includes(q));
  }, [animeSummaries, searchQuery]);

  const currentAnime = useMemo(() => {
    if (!selectedAnimeId) return null;
    return animeById.get(selectedAnimeId) ?? null;
  }, [animeById, selectedAnimeId]);

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

  const handleSelectAnime = useCallback(
    (id: string) => {
      setSelectedAnimeId(id);
      const targetAnime = animeById.get(id);
      const firstSeason = targetAnime?.seasons?.[0];
      if (firstSeason) {
        setSelectedSeasonId(firstSeason.id);
        setSelectedEpisodeId(firstSeason.episodes?.[0]?.id ?? "");
      } else {
        setSelectedSeasonId("");
        setSelectedEpisodeId("");
      }
      setSelectedPlayerNumber(null);
    },
    [animeById],
  );

  const handleSelectSeason = useCallback(
    (sid: string) => {
      setSelectedSeasonId(sid);
      const targetSeason = seasons.find((s) => s.id === sid);
      setSelectedEpisodeId(targetSeason?.episodes?.[0]?.id ?? "");
      setSelectedPlayerNumber(null);
    },
    [seasons],
  );

  const handleSelectEpisode = useCallback((eid: string) => {
    setSelectedEpisodeId(eid);
    setSelectedPlayerNumber(null);
  }, []);

  const handleSelectPlayer = useCallback((playerNum: number) => {
    setSelectedPlayerNumber(playerNum);
  }, []);

  const handleSaveUrl = useCallback(
    (
      safeDurableUrl: string,
      playerConfig: { id: number; key: PlayerKey; label: string },
    ) => {
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

      const playerKey = playerConfig.key;

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
                [playerKey]: safeDurableUrl,
              };
            }),
          };
        }),
        updatedAt: Date.now(),
      };

      upsertAnime(updatedAnime);

      toast.success(
        `${playerConfig.label} do Episódio ${currentEpisode.number} atualizado com sucesso!`,
      );
    },
    [currentAnime, currentEpisode, selectedEpisodeId, selectedSeasonId, upsertAnime],
  );

  if (isPending || !isAuthenticated || !isAdmin) {
    return null;
  }

  return (
    <StudioPanel
      title="Fluxo Direto de Atualização"
      description="Selecione obra, temporada, episódio e slot sem abrir o editor completo."
      icon={<Zap className="size-4" />}
      right={
        <span className="studio-mono text-[11px] text-[var(--color-subtle)]">
          <span className="studio-tabular font-semibold text-[var(--color-fg)]">
            {matchingSummaries.length}
          </span>{" "}
          título(s) disponíveis
        </span>
      }
      bodyClassName="space-y-6"
    >
      <div id="quick-update" className="space-y-6">
        <QuickAnimeCatalogSelector
          matchingSummaries={matchingSummaries}
          selectedAnimeId={selectedAnimeId}
          searchQuery={searchQuery}
          currentAnime={currentAnime}
          onSearchChange={setSearchQuery}
          onSelectAnime={handleSelectAnime}
        />

        {currentAnime && (
          <QuickSeasonEpisodeSelector
            seasons={seasons}
            selectedSeasonId={selectedSeasonId}
            episodes={episodes}
            selectedEpisodeId={selectedEpisodeId}
            onSelectSeason={handleSelectSeason}
            onSelectEpisode={handleSelectEpisode}
          />
        )}

        {currentEpisode && (
          <QuickPlayerSlotPicker
            episode={currentEpisode}
            selectedPlayerNumber={selectedPlayerNumber}
            onSelectPlayer={handleSelectPlayer}
          />
        )}

        {currentEpisode && activePlayerConfig && (
          <QuickPlayerUrlEditor
            episode={currentEpisode}
            playerConfig={activePlayerConfig}
            onSaveUrl={handleSaveUrl}
          />
        )}
      </div>
    </StudioPanel>
  );
}

export default QuickPlayerUpdate;
