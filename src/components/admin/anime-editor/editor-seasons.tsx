import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Plus,
  Trash2,
  Camera,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Film,
  Layers,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Globe,
  EyeOff,
  X,
  Sparkles,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { getBearerToken } from "@/lib/auth/client";
import {
  createEpisodeSourcesSessionStore,
  getEpisodeSlotsSignature,
  type EpisodeSourcesSessionStore,
} from "@/lib/episode-sources-session";
import {
  EPISODES_PER_PAGE,
  buildInitialCollapsedSeasons,
  buildOutboxIndex,
  filterSeasonEpisodes,
  getCompactPageNumbers,
  getOutboxOpForEpisode,
  paginateEpisodes,
  type OutboxIndex,
} from "@/lib/editor-episodes-window";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  hasEpisodePlayableSource,
  isPersistablePlayableVideoUrl,
  resolveEpisodeThumbnailUrl,
  type VideoThumbnailCandidate,
} from "@/lib/published-episodes";
import {
  ANITUBE22_INVALID_URL_ERROR,
  ANITUBE22_PROVIDER,
  ANITUBE22_WRONG_LANG_ERROR,
  detectEpisodeLanguageHint,
  isLegacyAnitube22Ref,
  parseAnitube22PlayerUrl,
  parseExplicitSourceLang,
  stripTimeQueryParam,
  validateAnitube22PlayerUrl,
  type EpisodeSourceItem,
  type SourceLang,
} from "@/lib/anitube22";
import {
  normalizeAnimeRecentBadges,
  normalizeEpisodeAudio,
  type Episode,
  type Season,
} from "@/lib/types";
import type { OutboxOperation } from "@/lib/episode-writer";
import {
  buildHikariPlayerEpisodeUrl,
  validateHikariPlayerEpisodeId,
} from "@/lib/hikari-player";
import type {
  EpisodeThumbnailOrigin,
  HikariPlayerThumbStatusEntry,
} from "@/lib/hikari-player-thumbnail";
import { cn } from "@/lib/utils";
import {
  getOpeningSuggestionKey,
  type OpeningSuggestionEntry,
} from "@/lib/opening-admin-state";
import {
  isDuplicatePasteTrigger,
  isValidImagePreviewUrl,
  type RecentPasteRecord,
} from "@/lib/thumbnail-probe-guard";

export interface EpisodeCandidateState {
  loading: boolean;
  error?: string;
  warning?: string;
  candidates: VideoThumbnailCandidate[];
  selectingCandidateId?: string | null;
  selectedCandidateId?: string | null;
  sourceUrl?: string;
}

type CaptureStatusEntry = {
  status: "loading" | "error" | "success";
  message?: string;
};

type VideoSlotKey = "videoUrl" | "videoUrl2" | "videoUrl3" | "videoUrl4" | "videoUrl5";
type UploadVideoSlotKey = "videoUrl" | "videoUrl2" | "videoUrl3";

const EMPTY_TITLES: string[] = [];

const PLAYER_SLOTS_1_TO_3: Array<{ key: UploadVideoSlotKey; label: string }> = [
  { key: "videoUrl", label: "Player 1" },
  { key: "videoUrl2", label: "Player 2" },
  { key: "videoUrl3", label: "Player 3" },
];

interface EditorSeasonsProps {
  animeId: string;
  animeTitles?: string[];
  seasons: Season[];
  onAddSeason: () => void;
  onPatchSeason: (sid: string, patch: Partial<Season>) => void;
  onRemoveSeason: (sid: string) => void;
  onAddEpisode: (sid: string) => void;
  onPatchEpisode: (sid: string, eid: string, patch: Partial<Episode>) => void;
  onRemoveEpisode: (sid: string, eid: string) => void;
  onCaptureFrame: (
    sid: string,
    ep: Episode,
    forcedUrl?: string,
    options?: { isAuto?: boolean },
  ) => Promise<void>;
  onDiscoverCandidates?: (
    sid: string,
    ep: Episode,
    forcedUrl?: string,
    options?: { force?: boolean },
  ) => Promise<void>;
  onSelectCandidate?: (
    sid: string,
    ep: Episode,
    candidate: VideoThumbnailCandidate,
  ) => Promise<void>;
  episodeCandidates?: Record<string, EpisodeCandidateState>;
  onUploadVideoToB2: (
    sid: string,
    ep: Episode,
    key: UploadVideoSlotKey,
  ) => Promise<void>;
  uploadingEpisode: string | null;
  captureStatus: Record<string, CaptureStatusEntry>;
  outboxOps: OutboxOperation[];
  getInheritedThumbnail?: (seasonNumber: number, ep: Episode) => string | undefined;
  thumbnailEditModes?: Record<string, "modified" | "cleared">;
  thumbnailOrigins?: Record<string, EpisodeThumbnailOrigin>;
  hikariThumbStatuses?: Record<string, HikariPlayerThumbStatusEntry>;
  onLookupHikariPlayerThumbnail?: (episodeId: string, rawHikariPlayerId: string) => void;
  onCancelHikariPlayerThumbnailLookup?: (episodeId: string, clearStatus?: boolean) => void;
  onThumbnailChange?: (sid: string, ep: Episode, value: string) => void;
  onThumbnailClear?: (sid: string, ep: Episode) => void;
  onFetchOpeningSuggestions?: () => Promise<void>;
  isFetchingOpening?: boolean;
  openingSuggestions?: Record<string, OpeningSuggestionEntry>;
  onApplyOpeningSuggestion?: (
    seasonId: string,
    episodeId: string,
    start: number | null,
    end: number | null,
  ) => void;
  onDiscardOpeningSuggestion?: (seasonNumber: number, episodeNumber: number) => void;
  sourcesSession?: EpisodeSourcesSessionStore;
  sourcesSyncTick?: number;
}

function formatSecs(secs: number | null | undefined): string {
  if (secs === null || secs === undefined || isNaN(secs) || secs < 0) return "";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function parseTimeInput(val: string): number | null {
  const trimmed = val.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    return isNaN(n) ? null : n;
  }
  const parts = trimmed.split(":").map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function getPublishSourceError(ep: Episode): string {
  const rawUrls = [
    ep.videoUrl,
    ep.videoUrl2,
    ep.videoUrl3,
    ep.videoUrl4,
    ep.videoUrl5,
  ]
    .map((u) => u?.trim() ?? "")
    .filter(Boolean);
  const hikariValidation = validateHikariPlayerEpisodeId(ep.hikariPlayerEpisodeId);
  if (!hikariValidation.valid && rawUrls.length === 0) {
    return (
      hikariValidation.error ||
      "Informe um ID válido do Hikari Player ou adicione pelo menos uma URL de vídeo válida (Player 1 a Player 5) antes de publicar este episódio."
    );
  }
  if (rawUrls.length === 0) {
    return "Adicione pelo menos uma URL de vídeo válida (Player 1 a Player 5) ou informe um ID válido do Hikari Player antes de publicar este episódio.";
  }
  return "Nenhuma fonte de reprodução válida encontrada. Use uma URL HTTP/HTTPS direta de vídeo (MP4, HLS ou R2) ou um ID válido do Hikari Player; links externos como YouTube ou Crunchyroll não permitem publicação.";
}

function getSlotValidationError(rawVal: string): string | null {
  const trimmed = rawVal.trim();
  if (!trimmed) return null;
  if (
    isLegacyAnitube22Ref(trimmed) ||
    /^\d{3,16}$/.test(trimmed) ||
    (trimmed.toLowerCase().includes("playerricas.php") && !parseAnitube22PlayerUrl(trimmed))
  ) {
    return ANITUBE22_INVALID_URL_ERROR;
  }
  if (!isPersistablePlayableVideoUrl(trimmed)) {
    return "URL inválida ou não suportada para publicação.";
  }
  return null;
}

function countPublishedEpisodes(episodes: Episode[]): number {
  let count = 0;
  for (const ep of episodes) {
    if (ep.published === true && hasEpisodePlayableSource(ep)) {
      count += 1;
    }
  }
  return count;
}

export function EditorSeasons({
  animeId,
  animeTitles = EMPTY_TITLES,
  seasons,
  onAddSeason,
  onPatchSeason,
  onRemoveSeason,
  onAddEpisode,
  onPatchEpisode,
  onRemoveEpisode,
  onCaptureFrame,
  onDiscoverCandidates,
  onSelectCandidate,
  episodeCandidates,
  onUploadVideoToB2,
  uploadingEpisode,
  captureStatus,
  outboxOps,
  getInheritedThumbnail,
  thumbnailEditModes,
  thumbnailOrigins,
  hikariThumbStatuses,
  onLookupHikariPlayerThumbnail,
  onCancelHikariPlayerThumbnailLookup,
  onThumbnailChange,
  onThumbnailClear,
  onFetchOpeningSuggestions,
  isFetchingOpening,
  openingSuggestions,
  onApplyOpeningSuggestion,
  onDiscardOpeningSuggestion,
  sourcesSession,
  sourcesSyncTick = 0,
}: EditorSeasonsProps) {
  const fallbackSourcesSessionRef = useRef<EpisodeSourcesSessionStore | null>(null);
  if (!sourcesSession && !fallbackSourcesSessionRef.current) {
    fallbackSourcesSessionRef.current = createEpisodeSourcesSessionStore();
  }
  const effectiveSourcesSession =
    sourcesSession ?? fallbackSourcesSessionRef.current!;

  const [activeSeasonTab, setActiveSeasonTab] = useState<string>("all");
  const [collapsedSeasons, setCollapsedSeasons] = useState<Record<string, boolean>>(
    () => buildInitialCollapsedSeasons(seasons),
  );
  const [seasonToDelete, setSeasonToDelete] = useState<Season | null>(null);
  const [publishErrors, setPublishErrors] = useState<Record<string, string>>({});

  const lastAnimeIdRef = useRef<string>(animeId);
  const hasAutoCollapsedLargeMultiSeasonRef = useRef<boolean>(
    Object.keys(buildInitialCollapsedSeasons(seasons)).length > 0,
  );

  useEffect(() => {
    if (lastAnimeIdRef.current !== animeId) {
      lastAnimeIdRef.current = animeId;
      setActiveSeasonTab("all");
      setPublishErrors({});
      setSeasonToDelete(null);
      const initial = buildInitialCollapsedSeasons(seasons);
      setCollapsedSeasons(initial);
      hasAutoCollapsedLargeMultiSeasonRef.current =
        Object.keys(initial).length > 0;
      return;
    }

    // Caso temporadas/episódios carreguem assincronamente após a montagem inicial
    if (!hasAutoCollapsedLargeMultiSeasonRef.current && seasons.length > 1) {
      const initial = buildInitialCollapsedSeasons(seasons);
      if (Object.keys(initial).length > 0) {
        hasAutoCollapsedLargeMultiSeasonRef.current = true;
        setCollapsedSeasons((prev) => ({
          ...initial,
          ...prev,
        }));
      }
    }
  }, [animeId, seasons]);

  const setPublishError = useCallback((epId: string, msg: string) => {
    setPublishErrors((prev) => {
      if (prev[epId] === msg) return prev;
      return { ...prev, [epId]: msg };
    });
  }, []);

  const clearPublishError = useCallback((epId: string) => {
    setPublishErrors((prev) => {
      if (!(epId in prev)) return prev;
      const next = { ...prev };
      delete next[epId];
      return next;
    });
  }, []);

  const toggleCollapse = useCallback((sid: string) => {
    setCollapsedSeasons((prev) => ({
      ...prev,
      [sid]: !prev[sid],
    }));
  }, []);

  const handleSelectSeasonTab = useCallback((tabId: string) => {
    setActiveSeasonTab(tabId);
    if (tabId !== "all") {
      setCollapsedSeasons((prev) =>
        prev[tabId] ? { ...prev, [tabId]: false } : prev,
      );
    }
  }, []);

  const handleRequestDeleteSeason = useCallback(
    (season: Season) => {
      if (season.episodes.length > 0) {
        setSeasonToDelete(season);
      } else {
        onRemoveSeason(season.id);
      }
    },
    [onRemoveSeason],
  );

  const outboxIndex = useMemo(
    () => buildOutboxIndex(outboxOps, animeId),
    [outboxOps, animeId],
  );

  const totalEpisodesCount = useMemo(() => {
    let total = 0;
    for (const s of seasons) {
      total += s.episodes.length;
    }
    return total;
  }, [seasons]);

  const effectiveActiveSeasonTab =
    activeSeasonTab === "all" || seasons.some((s) => s.id === activeSeasonTab)
      ? activeSeasonTab
      : "all";

  return (
    <section id="seasons" className="scroll-mt-20 space-y-5">
      {/* Cabeçalho da Seção */}
      <div className="studio-panel flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <Layers className="size-5 text-violet-400" />
            <h2 className="font-display text-lg font-bold tracking-tight text-[var(--color-fg)]">
              Gerenciamento de Temporadas &amp; Episódios
            </h2>
          </div>
          <p className="studio-tabular mt-1 text-xs text-[var(--color-muted)]">
            {seasons.length} {seasons.length === 1 ? "temporada" : "temporadas"} ·{" "}
            {totalEpisodesCount} episódios cadastrados
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onFetchOpeningSuggestions && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isFetchingOpening}
              onClick={onFetchOpeningSuggestions}
              className="h-10 border-purple-500/35 bg-purple-500/12 px-4 text-xs font-semibold text-purple-200 hover:bg-purple-500/22 hover:text-white"
            >
              {isFetchingOpening ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  <span>Buscando sugestões…</span>
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 size-4 text-purple-300" />
                  <span>Buscar Sugestões de Opening</span>
                </>
              )}
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddSeason}
            className="h-10 border-violet-500/35 bg-violet-500/12 px-4 text-xs font-semibold text-violet-200 hover:bg-violet-500/22 hover:text-white"
          >
            <Plus className="mr-1.5 size-4" />
            <span>Nova Temporada</span>
          </Button>
        </div>
      </div>

      {/* Navegação por Abas de Temporadas */}
      {seasons.length > 1 && (
        <div className="studio-scroll flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => handleSelectSeasonTab("all")}
            className={cn(
              "h-9 shrink-0 rounded-lg px-3.5 text-xs font-medium transition-colors",
              effectiveActiveSeasonTab === "all"
                ? "bg-violet-600 text-white"
                : "border border-white/10 bg-[var(--studio-panel)] text-[var(--color-muted)] hover:bg-white/[0.05] hover:text-[var(--color-fg)]",
            )}
          >
            Todas as Temporadas ({seasons.length})
          </button>

          {seasons.map((s) => {
            const epCount = s.episodes.length;
            const publishedCount = countPublishedEpisodes(s.episodes);
            const isSelected = effectiveActiveSeasonTab === s.id;

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelectSeasonTab(s.id)}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-2 rounded-lg px-3.5 text-xs font-medium transition-colors",
                  isSelected
                    ? "bg-violet-600 text-white"
                    : "border border-white/10 bg-[var(--studio-panel)] text-[var(--color-muted)] hover:bg-white/[0.05] hover:text-[var(--color-fg)]",
                )}
              >
                <span>{s.title || `Temporada ${s.number}`}</span>
                <span
                  className={cn(
                    "studio-mono text-[11px]",
                    isSelected ? "text-violet-100" : "text-[var(--color-subtle)]",
                  )}
                >
                  {publishedCount}/{epCount}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Listagem das Temporadas (mantém abas inativas ocultas via CSS para preservar página, filtro e gavetas C1) */}
      <div className="space-y-6">
        {seasons.map((season) => {
          const isTabVisible =
            effectiveActiveSeasonTab === "all" ||
            effectiveActiveSeasonTab === season.id;
          const isCollapsed = collapsedSeasons[season.id] ?? false;

          return (
            <SeasonSection
              key={season.id}
              animeId={animeId}
              animeTitles={animeTitles}
              season={season}
              isCollapsed={isCollapsed}
              isTabVisible={isTabVisible}
              outboxIndex={outboxIndex}
              uploadingEpisode={uploadingEpisode}
              captureStatus={captureStatus}
              episodeCandidates={episodeCandidates}
              thumbnailEditModes={thumbnailEditModes}
              thumbnailOrigins={thumbnailOrigins}
              hikariThumbStatuses={hikariThumbStatuses}
              openingSuggestions={openingSuggestions}
              publishErrors={publishErrors}
              getInheritedThumbnail={getInheritedThumbnail}
              sourcesSession={effectiveSourcesSession}
              sourcesSyncTick={sourcesSyncTick}
              onToggleCollapse={toggleCollapse}
              onPatchSeason={onPatchSeason}
              onRequestDeleteSeason={handleRequestDeleteSeason}
              onAddEpisode={onAddEpisode}
              onPatchEpisode={onPatchEpisode}
              onRemoveEpisode={onRemoveEpisode}
              onCaptureFrame={onCaptureFrame}
              onDiscoverCandidates={onDiscoverCandidates}
              onSelectCandidate={onSelectCandidate}
              onUploadVideoToB2={onUploadVideoToB2}
              onLookupHikariPlayerThumbnail={onLookupHikariPlayerThumbnail}
              onCancelHikariPlayerThumbnailLookup={onCancelHikariPlayerThumbnailLookup}
              onThumbnailChange={onThumbnailChange}
              onThumbnailClear={onThumbnailClear}
              onApplyOpeningSuggestion={onApplyOpeningSuggestion}
              onDiscardOpeningSuggestion={onDiscardOpeningSuggestion}
              onSetPublishError={setPublishError}
              onClearPublishError={clearPublishError}
            />
          );
        })}
      </div>

      {/* Modal de Confirmação para Remoção de Temporada */}
      <Dialog
        open={Boolean(seasonToDelete)}
        onOpenChange={(open) => {
          if (!open) setSeasonToDelete(null);
        }}
      >
        <DialogContent className="hikari-studio-dialog max-h-[88dvh] overflow-y-auto border border-rose-500/25 bg-[var(--studio-panel)] text-[var(--color-fg)] sm:max-w-md">
          <DialogTitle className="flex items-center gap-2 font-display text-lg font-semibold text-rose-400">
            <AlertTriangle className="size-5 shrink-0" />
            <span>Excluir temporada e seus episódios?</span>
          </DialogTitle>
          <DialogDescription className="mt-2 text-xs leading-relaxed text-[var(--color-muted)]">
            A temporada{" "}
            <strong className="text-[var(--color-fg)]">
              {seasonToDelete?.title || `Temporada ${seasonToDelete?.number}`}
            </strong>{" "}
            possui{" "}
            <strong className="text-[var(--color-fg)]">
              {seasonToDelete?.episodes.length} episódios
            </strong>
            . Esta ação excluirá a temporada e disparará a exclusão dos episódios associados no
            banco e outbox.
          </DialogDescription>

          <div className="mt-6 flex justify-end gap-2.5 border-t border-[var(--studio-line)] pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSeasonToDelete(null)}
              className="h-9 border-white/10 text-xs text-[var(--color-muted)] hover:bg-white/[0.06]"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => {
                if (seasonToDelete) {
                  onRemoveSeason(seasonToDelete.id);
                  setSeasonToDelete(null);
                }
              }}
              className="h-9 bg-rose-600 text-xs font-semibold text-white hover:bg-rose-500"
            >
              Sim, Excluir Temporada
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

interface SeasonSectionProps {
  animeId: string;
  animeTitles: string[];
  season: Season;
  isCollapsed: boolean;
  isTabVisible: boolean;
  outboxIndex: OutboxIndex;
  uploadingEpisode: string | null;
  captureStatus: Record<string, CaptureStatusEntry>;
  episodeCandidates?: Record<string, EpisodeCandidateState>;
  thumbnailEditModes?: Record<string, "modified" | "cleared">;
  thumbnailOrigins?: Record<string, EpisodeThumbnailOrigin>;
  hikariThumbStatuses?: Record<string, HikariPlayerThumbStatusEntry>;
  openingSuggestions?: Record<string, OpeningSuggestionEntry>;
  publishErrors: Record<string, string>;
  getInheritedThumbnail?: (seasonNumber: number, ep: Episode) => string | undefined;
  sourcesSession: EpisodeSourcesSessionStore;
  sourcesSyncTick: number;
  onToggleCollapse: (sid: string) => void;
  onPatchSeason: (sid: string, patch: Partial<Season>) => void;
  onRequestDeleteSeason: (season: Season) => void;
  onAddEpisode: (sid: string) => void;
  onPatchEpisode: (sid: string, eid: string, patch: Partial<Episode>) => void;
  onRemoveEpisode: (sid: string, eid: string) => void;
  onCaptureFrame: (
    sid: string,
    ep: Episode,
    forcedUrl?: string,
    options?: { isAuto?: boolean },
  ) => Promise<void>;
  onDiscoverCandidates?: (
    sid: string,
    ep: Episode,
    forcedUrl?: string,
  ) => Promise<void>;
  onSelectCandidate?: (
    sid: string,
    ep: Episode,
    candidate: VideoThumbnailCandidate,
  ) => Promise<void>;
  onUploadVideoToB2: (
    sid: string,
    ep: Episode,
    key: UploadVideoSlotKey,
  ) => Promise<void>;
  onLookupHikariPlayerThumbnail?: (episodeId: string, rawHikariPlayerId: string) => void;
  onCancelHikariPlayerThumbnailLookup?: (episodeId: string, clearStatus?: boolean) => void;
  onThumbnailChange?: (sid: string, ep: Episode, value: string) => void;
  onThumbnailClear?: (sid: string, ep: Episode) => void;
  onApplyOpeningSuggestion?: (
    seasonId: string,
    episodeId: string,
    start: number | null,
    end: number | null,
  ) => void;
  onDiscardOpeningSuggestion?: (seasonNumber: number, episodeNumber: number) => void;
  onSetPublishError: (epId: string, msg: string) => void;
  onClearPublishError: (epId: string) => void;
}

const SeasonSection = memo(function SeasonSection({
  animeId,
  animeTitles,
  season,
  isCollapsed,
  isTabVisible,
  outboxIndex,
  uploadingEpisode,
  captureStatus,
  episodeCandidates,
  thumbnailEditModes,
  thumbnailOrigins,
  hikariThumbStatuses,
  openingSuggestions,
  publishErrors,
  getInheritedThumbnail,
  sourcesSession,
  sourcesSyncTick,
  onToggleCollapse,
  onPatchSeason,
  onRequestDeleteSeason,
  onAddEpisode,
  onPatchEpisode,
  onRemoveEpisode,
  onCaptureFrame,
  onDiscoverCandidates,
  onSelectCandidate,
  onUploadVideoToB2,
  onLookupHikariPlayerThumbnail,
  onCancelHikariPlayerThumbnailLookup,
  onThumbnailChange,
  onThumbnailClear,
  onApplyOpeningSuggestion,
  onDiscardOpeningSuggestion,
  onSetPublishError,
  onClearPublishError,
}: SeasonSectionProps) {
  const [page, setPage] = useState(1);
  const [episodeQuery, setEpisodeQuery] = useState("");
  const lastSeasonIdentityRef = useRef(`${animeId}:${season.id}`);

  useEffect(() => {
    const identity = `${animeId}:${season.id}`;
    if (lastSeasonIdentityRef.current !== identity) {
      lastSeasonIdentityRef.current = identity;
      setPage(1);
      setEpisodeQuery("");
    }
  }, [animeId, season.id]);

  const publishedCount = useMemo(
    () => countPublishedEpisodes(season.episodes),
    [season.episodes],
  );

  const filteredEpisodes = useMemo(
    () => (isCollapsed ? [] : filterSeasonEpisodes(season.episodes, episodeQuery)),
    [isCollapsed, season.episodes, episodeQuery],
  );

  const pagination = useMemo(
    () => paginateEpisodes(filteredEpisodes, page, EPISODES_PER_PAGE),
    [filteredEpisodes, page],
  );

  useEffect(() => {
    if (!isCollapsed && page !== pagination.currentPage) {
      setPage(pagination.currentPage);
    }
  }, [isCollapsed, page, pagination.currentPage]);

  const compactPages = useMemo(
    () => getCompactPageNumbers(pagination.currentPage, pagination.totalPages),
    [pagination.currentPage, pagination.totalPages],
  );

  const handleAddEpisodeAndJumpToLastPage = useCallback(() => {
    const nextTotalPages = Math.max(
      1,
      Math.ceil((season.episodes.length + 1) / EPISODES_PER_PAGE),
    );
    setEpisodeQuery("");
    setPage(nextTotalPages);
    onAddEpisode(season.id);
  }, [season.id, season.episodes.length, onAddEpisode]);

  const handleQueryChange = useCallback((value: string) => {
    setEpisodeQuery(value);
    setPage(1);
  }, []);

  const showToolbar =
    season.episodes.length > EPISODES_PER_PAGE || episodeQuery.trim().length > 0;

  return (
    <div
      data-season-id={season.id}
      data-season-number={season.number}
      className={cn(
        "studio-panel rounded-xl p-4 sm:p-6",
        !isTabVisible && "hidden",
      )}
    >
      {/* Cabeçalho da Temporada */}
      <div className="flex flex-col gap-4 border-b border-[var(--studio-line)] pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="studio-mono flex size-10 shrink-0 items-center justify-center rounded-xl border border-violet-500/35 bg-violet-500/12 text-xs font-bold text-violet-200">
            T{season.number}
          </div>

          <div className="min-w-[180px] flex-1">
            <Input
              value={season.title}
              onChange={(e) =>
                onPatchSeason(season.id, {
                  title: e.target.value,
                })
              }
              placeholder="Nome da temporada"
              className="h-10 border-white/10 bg-[var(--studio-panel-alt)] text-sm font-semibold"
            />
          </div>

          <div className="w-24">
            <Input
              type="number"
              min={1}
              value={season.number}
              onChange={(e) =>
                onPatchSeason(season.id, {
                  number: Number(e.target.value),
                })
              }
              placeholder="Nº"
              title="Número da temporada"
              className="studio-tabular h-10 border-white/10 bg-[var(--studio-panel-alt)] text-center text-sm"
            />
          </div>

          <div className="studio-tabular flex items-center gap-3 text-xs text-[var(--color-muted)]">
            <span>
              {season.episodes.length}{" "}
              {season.episodes.length === 1 ? "episódio" : "episódios"}
            </span>
            <span className="text-white/20">·</span>
            <span className="font-semibold text-emerald-400">
              {publishedCount} publicados
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end lg:self-auto">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onToggleCollapse(season.id)}
            className="h-9 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
            title={isCollapsed ? "Expandir episódios" : "Recolher episódios"}
          >
            {isCollapsed ? (
              <>
                <ChevronDown className="mr-1 size-3.5" />
                <span>Expandir ({season.episodes.length})</span>
              </>
            ) : (
              <>
                <ChevronUp className="mr-1 size-3.5" />
                <span>Recolher</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 text-[var(--color-subtle)] hover:bg-rose-500/12 hover:text-rose-400"
            aria-label="Remover temporada"
            onClick={() => onRequestDeleteSeason(season)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {/* Episódios */}
      {!isCollapsed && (
        <div className="mt-5 space-y-4">
          {season.episodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/15 p-8 text-center text-[var(--color-muted)]">
              <Film className="mb-2 size-8 opacity-50" />
              <p className="text-xs">Nenhum episódio cadastrado nesta temporada.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 h-9 border-violet-500/35 text-xs text-violet-300 hover:bg-violet-500/15"
                onClick={handleAddEpisodeAndJumpToLastPage}
              >
                <Plus className="mr-1.5 size-3.5" />
                Adicionar Episódio 1
              </Button>
            </div>
          ) : (
            <>
              {showToolbar && (
                <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[var(--studio-panel-alt)]/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative w-full sm:max-w-xs">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-[var(--color-subtle)]" />
                    <Input
                      value={episodeQuery}
                      onChange={(e) => handleQueryChange(e.target.value)}
                      placeholder="Ir para nº (ex: 500) ou título..."
                      aria-label={`Filtrar episódios da ${season.title || `Temporada ${season.number}`}`}
                      className="h-9 border-white/10 bg-[var(--studio-panel)] pr-8 pl-8 text-xs"
                    />
                    {episodeQuery && (
                      <button
                        type="button"
                        onClick={() => handleQueryChange("")}
                        aria-label="Limpar busca de episódio"
                        title="Limpar busca"
                        className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-[var(--color-subtle)] hover:bg-white/[0.08] hover:text-white"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
                    <span className="studio-tabular text-[11px] text-[var(--color-muted)]">
                      {pagination.totalItems === 0
                        ? `0 de ${season.episodes.length}`
                        : episodeQuery.trim()
                          ? `Exibindo ${pagination.startItem}–${pagination.endItem} de ${pagination.totalItems} (filtrado de ${season.episodes.length})`
                          : `Exibindo ${pagination.startItem}–${pagination.endItem} de ${pagination.totalItems}`}
                    </span>

                    {pagination.totalPages > 1 && (
                      <SeasonPaginationControls
                        currentPage={pagination.currentPage}
                        totalPages={pagination.totalPages}
                        compactPages={compactPages}
                        onPageChange={setPage}
                      />
                    )}
                  </div>
                </div>
              )}

              {pagination.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/15 p-6 text-center text-[var(--color-muted)]">
                  <Search className="mb-2 size-6 opacity-50" />
                  <p className="text-xs">
                    Nenhum episódio encontrado para &ldquo;{episodeQuery}&rdquo;.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleQueryChange("")}
                    className="mt-3 h-8 border-white/10 text-xs"
                  >
                    Limpar filtro
                  </Button>
                </div>
              ) : (
                <ul className="space-y-4">
                  {pagination.items.map((ep) => {
                    const outboxOp = getOutboxOpForEpisode(
                      outboxIndex,
                      ep.id,
                      season.number,
                      ep.number,
                    );
                    const uploadPrefix = `${ep.id}-`;
                    const uploadingSlot =
                      uploadingEpisode && uploadingEpisode.startsWith(uploadPrefix)
                        ? (uploadingEpisode.slice(uploadPrefix.length) as UploadVideoSlotKey)
                        : null;
                    const thumbMode = thumbnailEditModes?.[ep.id];
                    const savedThumb = ep.thumbnail?.trim() ?? "";
                    const inheritedThumbnail =
                      !savedThumb && thumbMode !== "cleared"
                        ? getInheritedThumbnail?.(season.number, ep) ??
                          resolveEpisodeThumbnailUrl({
                            videoUrl: ep.videoUrl,
                            videoUrl2: ep.videoUrl2,
                            videoUrl3: ep.videoUrl3,
                            videoUrl4: ep.videoUrl4,
                            videoUrl5: ep.videoUrl5,
                          })
                        : undefined;
                    const sugKey = getOpeningSuggestionKey(season.number, ep.number);
                    const openingSuggestion =
                      openingSuggestions?.[sugKey] ??
                      openingSuggestions?.[String(ep.number)];

                    return (
                      <EpisodeCard
                        key={ep.id}
                        animeId={animeId}
                        animeTitles={animeTitles}
                        seasonId={season.id}
                        seasonNumber={season.number}
                        seasonTitle={season.title}
                        episode={ep}
                        outboxOp={outboxOp}
                        uploadingSlot={uploadingSlot}
                        captureStatusEntry={captureStatus[ep.id]}
                        candidateState={episodeCandidates?.[ep.id]}
                        thumbnailEditMode={thumbMode}
                        thumbnailOrigin={thumbnailOrigins?.[ep.id]}
                        hikariThumbStatus={hikariThumbStatuses?.[ep.id]}
                        inheritedThumbnail={inheritedThumbnail}
                        explicitPublishError={publishErrors[ep.id]}
                        openingSuggestion={openingSuggestion}
                        sourcesSession={sourcesSession}
                        sourcesSyncTick={sourcesSyncTick}
                        onPatchEpisode={onPatchEpisode}
                        onRemoveEpisode={onRemoveEpisode}
                        onCaptureFrame={onCaptureFrame}
                        onDiscoverCandidates={onDiscoverCandidates}
                        onSelectCandidate={onSelectCandidate}
                        onUploadVideoToB2={onUploadVideoToB2}
                        onLookupHikariPlayerThumbnail={onLookupHikariPlayerThumbnail}
                        onCancelHikariPlayerThumbnailLookup={onCancelHikariPlayerThumbnailLookup}
                        onThumbnailChange={onThumbnailChange}
                        onThumbnailClear={onThumbnailClear}
                        onApplyOpeningSuggestion={onApplyOpeningSuggestion}
                        onDiscardOpeningSuggestion={onDiscardOpeningSuggestion}
                        onSetPublishError={onSetPublishError}
                        onClearPublishError={onClearPublishError}
                      />
                    );
                  })}
                </ul>
              )}

              {pagination.totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[var(--studio-panel-alt)]/50 px-3 py-2.5">
                  <span className="studio-tabular text-[11px] text-[var(--color-muted)]">
                    Página {pagination.currentPage} de {pagination.totalPages} ·{" "}
                    {pagination.startItem}–{pagination.endItem} de {pagination.totalItems}
                  </span>
                  <SeasonPaginationControls
                    currentPage={pagination.currentPage}
                    totalPages={pagination.totalPages}
                    compactPages={compactPages}
                    onPageChange={setPage}
                  />
                </div>
              )}
            </>
          )}

          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddEpisodeAndJumpToLastPage}
              className="h-10 border-white/10 bg-[var(--studio-panel-alt)] px-4 text-xs text-[var(--color-fg)] hover:border-violet-500/40"
            >
              <Plus className="mr-1.5 size-3.5 text-violet-400" />
              Adicionar Episódio
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});

const SeasonPaginationControls = memo(function SeasonPaginationControls({
  currentPage,
  totalPages,
  compactPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  compactPages: Array<number | "ellipsis">;
  onPageChange: (page: number) => void;
}) {
  return (
    <nav
      aria-label="Paginação de episódios"
      className="flex flex-wrap items-center gap-1"
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        aria-label="Página anterior"
        className="h-8 border-white/10 bg-[var(--studio-panel)] px-2 text-xs text-[var(--color-muted)] hover:text-white disabled:opacity-40"
      >
        <ChevronLeft className="size-3.5" />
        <span className="hidden sm:inline">Anterior</span>
      </Button>

      {compactPages.map((item, idx) =>
        item === "ellipsis" ? (
          <span
            key={`ellipsis-${idx}`}
            aria-hidden="true"
            className="px-1 text-xs text-[var(--color-subtle)]"
          >
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            aria-label={`Ir para página ${item}`}
            aria-current={item === currentPage ? "page" : undefined}
            className={cn(
              "studio-tabular inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-medium transition-colors",
              item === currentPage
                ? "bg-violet-600 text-white"
                : "border border-white/10 bg-[var(--studio-panel)] text-[var(--color-muted)] hover:bg-white/[0.06] hover:text-white",
            )}
          >
            {item}
          </button>
        ),
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        aria-label="Próxima página"
        className="h-8 border-white/10 bg-[var(--studio-panel)] px-2 text-xs text-[var(--color-muted)] hover:text-white disabled:opacity-40"
      >
        <span className="hidden sm:inline">Próxima</span>
        <ChevronRight className="size-3.5" />
      </Button>
    </nav>
  );
});

interface EpisodeCardProps {
  animeId: string;
  animeTitles: string[];
  seasonId: string;
  seasonNumber: number;
  seasonTitle: string;
  episode: Episode;
  outboxOp?: OutboxOperation;
  uploadingSlot: UploadVideoSlotKey | null;
  captureStatusEntry?: CaptureStatusEntry;
  candidateState?: EpisodeCandidateState;
  thumbnailEditMode?: "modified" | "cleared";
  thumbnailOrigin?: EpisodeThumbnailOrigin;
  hikariThumbStatus?: HikariPlayerThumbStatusEntry;
  inheritedThumbnail?: string;
  explicitPublishError?: string;
  openingSuggestion?: OpeningSuggestionEntry;
  sourcesSession: EpisodeSourcesSessionStore;
  sourcesSyncTick: number;
  onPatchEpisode: (sid: string, eid: string, patch: Partial<Episode>) => void;
  onRemoveEpisode: (sid: string, eid: string) => void;
  onCaptureFrame: (
    sid: string,
    ep: Episode,
    forcedUrl?: string,
    options?: { isAuto?: boolean },
  ) => Promise<void>;
  onDiscoverCandidates?: (
    sid: string,
    ep: Episode,
    forcedUrl?: string,
    options?: { force?: boolean },
  ) => Promise<void>;
  onSelectCandidate?: (
    sid: string,
    ep: Episode,
    candidate: VideoThumbnailCandidate,
  ) => Promise<void>;
  onUploadVideoToB2: (
    sid: string,
    ep: Episode,
    key: UploadVideoSlotKey,
  ) => Promise<void>;
  onLookupHikariPlayerThumbnail?: (episodeId: string, rawHikariPlayerId: string) => void;
  onCancelHikariPlayerThumbnailLookup?: (episodeId: string, clearStatus?: boolean) => void;
  onThumbnailChange?: (sid: string, ep: Episode, value: string) => void;
  onThumbnailClear?: (sid: string, ep: Episode) => void;
  onApplyOpeningSuggestion?: (
    seasonId: string,
    episodeId: string,
    start: number | null,
    end: number | null,
  ) => void;
  onDiscardOpeningSuggestion?: (seasonNumber: number, episodeNumber: number) => void;
  onSetPublishError: (epId: string, msg: string) => void;
  onClearPublishError: (epId: string) => void;
}

const EpisodeCard = memo(function EpisodeCard({
  animeId,
  animeTitles,
  seasonId,
  seasonNumber,
  seasonTitle,
  episode: ep,
  outboxOp,
  uploadingSlot,
  captureStatusEntry,
  candidateState,
  thumbnailEditMode,
  thumbnailOrigin,
  hikariThumbStatus,
  inheritedThumbnail,
  explicitPublishError,
  openingSuggestion,
  sourcesSession,
  sourcesSyncTick,
  onPatchEpisode,
  onRemoveEpisode,
  onCaptureFrame,
  onDiscoverCandidates,
  onSelectCandidate,
  onUploadVideoToB2,
  onLookupHikariPlayerThumbnail,
  onCancelHikariPlayerThumbnailLookup,
  onThumbnailChange,
  onThumbnailClear,
  onApplyOpeningSuggestion,
  onDiscardOpeningSuggestion,
  onSetPublishError,
  onClearPublishError,
}: EpisodeCardProps) {
  const hasValidSource = hasEpisodePlayableSource(ep);
  const isMarkedPublished = ep.published === true;
  const isEffectivelyPublished = isMarkedPublished && hasValidSource;
  const inlinePublishError =
    explicitPublishError ??
    (isMarkedPublished && !hasValidSource ? getPublishSourceError(ep) : undefined);
  const displayThumbnail =
    thumbnailEditMode === "cleared"
      ? ""
      : (ep.thumbnail ?? inheritedThumbnail ?? "");
  const hasExistingThumbnail = Boolean(displayThumbnail.trim());
  const isDiscovering = Boolean(candidateState?.loading);

  const handleSetEpisodePublished = (nextPublished: boolean) => {
    if (!nextPublished) {
      onClearPublishError(ep.id);
      onPatchEpisode(seasonId, ep.id, { published: false });
      return;
    }

    if (!hasEpisodePlayableSource(ep)) {
      const msg = getPublishSourceError(ep);
      onSetPublishError(ep.id, msg);
      toast.error(msg);
      if (ep.published) {
        onPatchEpisode(seasonId, ep.id, { published: false });
      }
      return;
    }

    onClearPublishError(ep.id);
    onPatchEpisode(seasonId, ep.id, { published: true });
  };

  const handleVideoUrlChange = (key: VideoSlotKey, value: string) => {
    const updatedEp = { ...ep, [key]: value };
    const stillValid = hasEpisodePlayableSource(updatedEp);
    if (stillValid) {
      onClearPublishError(ep.id);
    } else if (ep.published === true) {
      onSetPublishError(ep.id, getPublishSourceError(updatedEp));
    }
    onPatchEpisode(seasonId, ep.id, { [key]: value });
  };

  const hikariLookupTimerRef = useRef<number | null>(null);
  const hikariRecentPasteAtRef = useRef<number>(0);

  const clearHikariLookupTimer = useCallback(() => {
    if (hikariLookupTimerRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(hikariLookupTimerRef.current);
      hikariLookupTimerRef.current = null;
    }
  }, []);

  const scheduleHikariPlayerLookup = useCallback(
    (rawValue: string, delayMs: number) => {
      clearHikariLookupTimer();
      const validation = validateHikariPlayerEpisodeId(rawValue);
      if (!validation.valid || !validation.value) {
        onCancelHikariPlayerThumbnailLookup?.(ep.id, true);
        return;
      }
      if (!onLookupHikariPlayerThumbnail) return;
      const targetId = validation.value;
      if (delayMs <= 0) {
        onLookupHikariPlayerThumbnail(ep.id, targetId);
        return;
      }
      hikariLookupTimerRef.current = window.setTimeout(() => {
        hikariLookupTimerRef.current = null;
        onLookupHikariPlayerThumbnail(ep.id, targetId);
      }, delayMs);
    },
    [
      clearHikariLookupTimer,
      ep.id,
      onCancelHikariPlayerThumbnailLookup,
      onLookupHikariPlayerThumbnail,
    ],
  );

  const handleHikariPlayerIdChange = (
    value: string,
    options?: { triggerLookup?: boolean },
  ) => {
    const updatedEp = { ...ep, hikariPlayerEpisodeId: value };
    const stillValid = hasEpisodePlayableSource(updatedEp);
    if (stillValid) {
      onClearPublishError(ep.id);
    } else if (ep.published === true) {
      onSetPublishError(ep.id, getPublishSourceError(updatedEp));
    }
    onPatchEpisode(seasonId, ep.id, { hikariPlayerEpisodeId: value });

    if (options?.triggerLookup === false) {
      return;
    }

    const isPasteTriggered = Date.now() - hikariRecentPasteAtRef.current < 150;
    if (isPasteTriggered) {
      hikariRecentPasteAtRef.current = 0;
    }
    scheduleHikariPlayerLookup(value, isPasteTriggered ? 20 : 450);
  };

  const normalizeDurableSourceInput = (key: VideoSlotKey, raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return "";
    if (isLegacyAnitube22Ref(trimmed) || /^\d{3,16}$/.test(trimmed)) {
      toast.error(ANITUBE22_INVALID_URL_ERROR);
      return trimmed;
    }
    if (parseAnitube22PlayerUrl(trimmed) || /[?&]time=/i.test(trimmed)) {
      const clean = stripTimeQueryParam(trimmed);
      if (clean !== raw) {
        handleVideoUrlChange(key, clean);
      }
      return clean;
    }
    return trimmed;
  };

  const pasteTimeoutRef = useRef<number | null>(null);
  const lastPasteTriggerRef = useRef<RecentPasteRecord | null>(null);

  useEffect(() => {
    return () => {
      clearHikariLookupTimer();
      if (pasteTimeoutRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(pasteTimeoutRef.current);
        pasteTimeoutRef.current = null;
      }
    };
  }, [clearHikariLookupTimer]);

  const handleSlotBlur = (key: VideoSlotKey, rawValue: string) => {
    const val = normalizeDurableSourceInput(key, rawValue);
    if (isDuplicatePasteTrigger(lastPasteTriggerRef.current, key, val, Date.now())) {
      return;
    }
    lastPasteTriggerRef.current = null;
    if (
      val &&
      isPersistablePlayableVideoUrl(val) &&
      !parseAnitube22PlayerUrl(val)
    ) {
      if (onDiscoverCandidates) {
        void onDiscoverCandidates(seasonId, ep, val, { force: false });
      }
    }
  };

  const handleSlotPaste = (
    key: VideoSlotKey,
    e: React.ClipboardEvent<HTMLInputElement>,
  ) => {
    const pasted = e.clipboardData.getData("text").trim();
    if (!pasted) return;
    if (parseAnitube22PlayerUrl(pasted) || /[?&]time=/i.test(pasted)) {
      e.preventDefault();
      normalizeDurableSourceInput(key, pasted);
      return;
    }
    if (isPersistablePlayableVideoUrl(pasted)) {
      lastPasteTriggerRef.current = {
        slotKey: key,
        value: pasted,
        at: Date.now(),
      };
      if (pasteTimeoutRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(pasteTimeoutRef.current);
      }
      pasteTimeoutRef.current = window.setTimeout(() => {
        pasteTimeoutRef.current = null;
        if (onDiscoverCandidates) {
          void onDiscoverCandidates(seasonId, ep, pasted, { force: false });
        }
      }, 100);
    }
  };

  const rawVal4 = ep.videoUrl4 ?? "";
  const slotError4 = getSlotValidationError(rawVal4);
  const isLegacySlot4 = isLegacyAnitube22Ref(rawVal4);

  const rawVal5 = ep.videoUrl5 ?? "";
  const slotError5 = getSlotValidationError(rawVal5);
  const isLegacySlot5 = isLegacyAnitube22Ref(rawVal5);

  const rawHikariPlayerId = ep.hikariPlayerEpisodeId ?? "";
  const hikariPlayerValidation = validateHikariPlayerEpisodeId(rawHikariPlayerId);
  const hikariPlayerPreviewUrl =
    hikariPlayerValidation.valid && hikariPlayerValidation.value
      ? buildHikariPlayerEpisodeUrl(hikariPlayerValidation.value)
      : null;

  const epBadges = normalizeAnimeRecentBadges(ep.recentBadges);

  return (
    <li
      data-episode-id={ep.id}
      data-episode-number={ep.number}
      className="studio-panel-alt rounded-xl p-4 transition-colors hover:border-white/15"
    >
      {/* Barra de Status e Publicação do Episódio */}
      <div className="mb-4 flex flex-col gap-3 border-b border-white/[0.06] pb-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="studio-mono text-xs font-bold text-[var(--color-fg)]">
            Episódio {ep.number}
          </span>

          {outboxOp ? (
            outboxOp.status === "conflict" ? (
              <span
                className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/12 px-2 py-0.5 text-[11px] font-medium text-rose-300"
                title={`Ação necessária: ${outboxOp.lastError || "Erro de validação ou conflito no servidor"}`}
              >
                Ação necessária
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/12 px-2 py-0.5 text-[11px] font-medium text-amber-200"
                title="Sincronização pendente: episódio preservado aguardando envio ao servidor"
              >
                Pendente
              </span>
            )
          ) : isEffectivelyPublished ? (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/12 px-2 py-0.5 text-[11px] font-medium text-emerald-300"
              title="Episódio visível no catálogo público quando salvo"
            >
              <Globe className="size-3" />
              Publicado
            </span>
          ) : isMarkedPublished && !hasValidSource ? (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/12 px-2 py-0.5 text-[11px] font-medium text-rose-300"
              title="URL de vídeo válida (Player 1 a Player 5) ou ID válido do Hikari Player obrigatório para publicar"
            >
              <AlertCircle className="size-3" />
              Fonte inválida
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-[var(--color-muted)]"
              title="Salvo apenas como rascunho; oculto no catálogo público"
            >
              <EyeOff className="size-3" />
              Rascunho
            </span>
          )}
        </div>

        <div
          role="group"
          aria-label={`Status de publicação do Episódio ${ep.number}`}
          className="inline-flex items-center gap-1 self-start rounded-lg border border-white/10 bg-black/35 p-0.5 sm:self-auto"
        >
          <button
            type="button"
            aria-pressed={!isMarkedPublished}
            onClick={() => handleSetEpisodePublished(false)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
              !isMarkedPublished
                ? "bg-zinc-700 text-white"
                : "text-[var(--color-muted)] hover:text-white",
            )}
          >
            <EyeOff className="size-3.5" />
            <span>Rascunho</span>
          </button>
          <button
            type="button"
            aria-pressed={isMarkedPublished}
            onClick={() => handleSetEpisodePublished(true)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
              isMarkedPublished
                ? hasValidSource
                  ? "bg-emerald-600 text-white"
                  : "bg-rose-600 text-white"
                : hasValidSource
                  ? "text-[var(--color-muted)] hover:bg-emerald-500/15 hover:text-emerald-300"
                  : "text-[var(--color-muted)] hover:bg-white/[0.05] hover:text-white",
            )}
          >
            <Globe className="size-3.5" />
            <span>Publicado</span>
          </button>
        </div>
      </div>

      {inlinePublishError && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
        >
          <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-rose-400" />
          <span>{inlinePublishError}</span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-12">
        <Field label="#" className="sm:col-span-2 lg:col-span-1">
          <Input
            type="number"
            value={ep.number}
            onChange={(e) =>
              onPatchEpisode(seasonId, ep.id, {
                number: Number(e.target.value),
              })
            }
            className="studio-tabular h-10 border-white/10 bg-[var(--studio-panel)] text-center font-semibold"
          />
        </Field>

        <Field label="Título do Episódio" className="sm:col-span-5 lg:col-span-5">
          <Input
            value={ep.title}
            onChange={(e) =>
              onPatchEpisode(seasonId, ep.id, {
                title: e.target.value,
              })
            }
            placeholder="Ex: O Retorno do Herói"
            className="h-10 border-white/10 bg-[var(--studio-panel)]"
          />
        </Field>

        <Field label="Áudio" className="sm:col-span-2 lg:col-span-2">
          <select
            value={normalizeEpisodeAudio(ep.audio) ?? ""}
            onChange={(e) => {
              const nextVal = e.target.value;
              onPatchEpisode(seasonId, ep.id, {
                audio: nextVal === "sub" || nextVal === "dub" ? nextVal : null,
              });
            }}
            aria-label="Áudio do episódio"
            className="h-10 w-full rounded-md border border-white/10 bg-[var(--studio-panel)] px-2.5 text-sm text-[var(--color-fg)] outline-none focus:border-violet-500"
          >
            <option value="">Sem classificação</option>
            <option value="sub">Legendado</option>
            <option value="dub">Dublado</option>
          </select>
        </Field>

        <Field label="Duração" className="sm:col-span-2 lg:col-span-3">
          <Input
            value={ep.duration ?? ""}
            onChange={(e) =>
              onPatchEpisode(seasonId, ep.id, {
                duration: e.target.value,
              })
            }
            placeholder="24 min"
            className="h-10 border-white/10 bg-[var(--studio-panel)]"
          />
        </Field>

        <div className="flex items-end justify-end sm:col-span-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 text-[var(--color-subtle)] hover:bg-rose-500/12 hover:text-rose-400"
            aria-label="Remover episódio"
            onClick={() => onRemoveEpisode(seasonId, ep.id)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>

        {/* Início OP / Fim OP & Sugestões AniSkip */}
        <Field label="Início OP (MM:SS ou seg)" className="sm:col-span-3 lg:col-span-3">
          <Input
            value={formatSecs(ep.openingStartSeconds)}
            onChange={(e) => {
              const secs = parseTimeInput(e.target.value);
              onPatchEpisode(seasonId, ep.id, { openingStartSeconds: secs });
            }}
            placeholder="00:02"
            className="studio-mono h-10 border-white/10 bg-[var(--studio-panel)] text-xs"
          />
        </Field>

        <Field label="Fim OP (MM:SS ou seg)" className="sm:col-span-3 lg:col-span-3">
          <Input
            value={formatSecs(ep.openingEndSeconds)}
            onChange={(e) => {
              const secs = parseTimeInput(e.target.value);
              onPatchEpisode(seasonId, ep.id, { openingEndSeconds: secs });
            }}
            placeholder="03:00"
            className="studio-mono h-10 border-white/10 bg-[var(--studio-panel)] text-xs"
          />
        </Field>

        {openingSuggestion && (
          <EpisodeOpeningSuggestionBox
            seasonId={seasonId}
            seasonNumber={seasonNumber}
            episodeId={ep.id}
            episodeNumber={ep.number}
            openingStartSeconds={ep.openingStartSeconds}
            openingEndSeconds={ep.openingEndSeconds}
            suggestion={openingSuggestion}
            onApplyOpeningSuggestion={onApplyOpeningSuggestion}
            onDiscardOpeningSuggestion={onDiscardOpeningSuggestion}
          />
        )}

        {/* Players 1, 2 e 3 com Upload B2 */}
        {PLAYER_SLOTS_1_TO_3.map(({ key, label }) => {
          const rawVal = ep[key] ?? "";
          const slotError = getSlotValidationError(rawVal);
          const isLegacySlot = isLegacyAnitube22Ref(rawVal);

          return (
            <Field
              key={key}
              label={
                <span className="inline-flex items-center gap-1.5">
                  <span>{label} — URL do vídeo</span>
                  {isLegacySlot && (
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-300">
                      incompleto
                    </span>
                  )}
                </span>
              }
              className="sm:col-span-6 lg:col-span-4"
            >
              <div className="flex gap-2">
                <Input
                  value={rawVal}
                  onChange={(e) => handleVideoUrlChange(key, e.target.value)}
                  onBlur={(e) => handleSlotBlur(key, e.target.value)}
                  onPaste={(e) => handleSlotPaste(key, e)}
                  placeholder="URL completa do playerricas.php ou URL direta (MP4 / HLS)"
                  className="studio-mono h-10 border-white/10 bg-[var(--studio-panel)] text-xs"
                />

                <Button
                  type="button"
                  variant="outline"
                  className="h-10 shrink-0 border-white/10 bg-[var(--studio-panel)] text-xs"
                  disabled={uploadingSlot === key}
                  onClick={() => onUploadVideoToB2(seasonId, ep, key)}
                >
                  {uploadingSlot === key ? "Abrindo…" : "Enviar"}
                </Button>
              </div>
              {slotError && (
                <p className="mt-1 text-[11px] text-rose-400">{slotError}</p>
              )}
            </Field>
          );
        })}

        {/* Player 4 */}
        <Field
          label={
            <span className="inline-flex items-center gap-1.5">
              <span>Player 4 — URL do vídeo</span>
              {isLegacySlot4 && (
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-300">
                  incompleto
                </span>
              )}
            </span>
          }
          className="sm:col-span-6 lg:col-span-6"
        >
          <div className="flex gap-2">
            <Input
              value={rawVal4}
              onChange={(e) => handleVideoUrlChange("videoUrl4", e.target.value)}
              onBlur={(e) => handleSlotBlur("videoUrl4", e.target.value)}
              onPaste={(e) => handleSlotPaste("videoUrl4", e)}
              placeholder="URL completa do playerricas.php ou URL direta (MP4 / HLS)"
              className="studio-mono h-10 border-white/10 bg-[var(--studio-panel)] text-xs"
            />
            <Button
              type="button"
              variant="outline"
              className="h-10 shrink-0 border-white/10 text-xs"
              disabled
            >
              Enviar
            </Button>
          </div>
          {slotError4 && (
            <p className="mt-1 text-[11px] text-rose-400">{slotError4}</p>
          )}
        </Field>

        {/* Player 5 */}
        <Field
          label={
            <span className="inline-flex items-center gap-1.5">
              <span>Player 5 — URL do vídeo</span>
              {isLegacySlot5 && (
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-300">
                  incompleto
                </span>
              )}
            </span>
          }
          className="sm:col-span-6 lg:col-span-6"
        >
          <Input
            value={rawVal5}
            onChange={(e) => handleVideoUrlChange("videoUrl5", e.target.value)}
            onBlur={(e) => handleSlotBlur("videoUrl5", e.target.value)}
            onPaste={(e) => handleSlotPaste("videoUrl5", e)}
            placeholder="URL completa do playerricas.php ou URL direta (HLS / MP4)"
            className="studio-mono h-10 border-white/10 bg-[var(--studio-panel)] text-xs"
          />
          {slotError5 && (
            <p className="mt-1 text-[11px] text-rose-400">{slotError5}</p>
          )}
        </Field>

        {/* Associação opcional com o Hikari Player separado */}
        <div className="sm:col-span-12">
          <div className="rounded-xl border border-white/10 bg-[var(--studio-panel)]/55 p-3">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <Label
                htmlFor={`ep-hikari-player-${ep.id}`}
                className="text-xs font-semibold text-[var(--color-muted)]"
              >
                ID do episódio no Hikari Player (opcional)
              </Label>
              <span className="studio-mono text-[10px] text-[var(--color-subtle)]">
                hikari-player-2.vercel.app/e/&#123;id&#125;
              </span>
            </div>

            <div className="relative">
              <Input
                id={`ep-hikari-player-${ep.id}`}
                value={rawHikariPlayerId}
                onChange={(e) => handleHikariPlayerIdChange(e.target.value)}
                onPaste={() => {
                  hikariRecentPasteAtRef.current = Date.now();
                }}
                onBlur={(e) => {
                  const trimmed = e.target.value.trim();
                  if (trimmed !== e.target.value) {
                    handleHikariPlayerIdChange(trimmed, { triggerLookup: false });
                  }
                  scheduleHikariPlayerLookup(trimmed, 0);
                }}
                placeholder="Ex: abc123 (informe apenas o ID no Hikari Player, sem URL)"
                aria-invalid={!hikariPlayerValidation.valid}
                className={cn(
                  "studio-mono h-10 border-white/10 bg-[var(--studio-panel)] pr-8 text-xs",
                  !hikariPlayerValidation.valid &&
                    "border-rose-500/60 focus-visible:border-rose-400",
                )}
              />
              {Boolean(rawHikariPlayerId) && (
                <button
                  type="button"
                  onClick={() => handleHikariPlayerIdChange("")}
                  aria-label={`Remover associação do Hikari Player no Episódio ${ep.number}`}
                  title="Remover associação com o Hikari Player"
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-[var(--color-subtle)] hover:bg-white/[0.08] hover:text-rose-400"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {!hikariPlayerValidation.valid ? (
              <p
                role="alert"
                className="mt-1.5 text-[11px] font-medium text-rose-400"
              >
                {hikariPlayerValidation.error}
              </p>
            ) : hikariPlayerPreviewUrl ? (
              <div className="mt-1.5 space-y-1">
                <p className="text-[11px] text-emerald-300/90">
                  Associado ao destino{" "}
                  <span className="studio-mono">{hikariPlayerPreviewUrl}</span>
                </p>

                {hikariThumbStatus &&
                  hikariThumbStatus.status !== "idle" &&
                  hikariThumbStatus.episodeIdRequested ===
                    hikariPlayerValidation.value && (
                    <p
                      aria-live="polite"
                      data-hikari-thumb-status={hikariThumbStatus.status}
                      className={cn(
                        "flex items-center gap-1.5 text-[11px]",
                        hikariThumbStatus.status === "loading" &&
                          "text-violet-300",
                        hikariThumbStatus.status === "imported" &&
                          (hikariThumbStatus.preservedManual
                            ? "text-sky-300"
                            : "text-emerald-400"),
                        hikariThumbStatus.status === "no_image" &&
                          "text-[var(--color-muted)]",
                        hikariThumbStatus.status === "not_found" &&
                          "text-amber-300",
                        hikariThumbStatus.status === "error" &&
                          "text-amber-300/90",
                      )}
                    >
                      {hikariThumbStatus.status === "loading" && (
                        <Loader2 className="size-3 shrink-0 animate-spin" />
                      )}
                      {hikariThumbStatus.status === "imported" && (
                        <CheckCircle2 className="size-3 shrink-0" />
                      )}
                      {(hikariThumbStatus.status === "not_found" ||
                        hikariThumbStatus.status === "error") && (
                        <AlertCircle className="size-3 shrink-0" />
                      )}
                      <span>{hikariThumbStatus.message}</span>
                    </p>
                  )}
              </div>
            ) : (
              <p className="mt-1.5 text-[11px] text-[var(--color-subtle)]">
                Opcional. Informe somente o identificador do episódio no Hikari Player separado (ex.: abc123). Deixe vazio para manter sem associação.
              </p>
            )}
          </div>
        </div>

        {/* Selos individuais do episódio (controle totalmente manual) */}
        <div className="sm:col-span-12">
          <div className="rounded-xl border border-white/10 bg-[var(--studio-panel)]/55 p-3">
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-semibold text-[var(--color-fg)]">
                  Selos do Episódio
                </h4>
                <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
                  Controle manual independente para este episódio. O selo{" "}
                  <span className="font-semibold text-emerald-400">DUB</span>{" "}
                  continua automático quando o episódio for dublado.
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  {
                    key: "lancamento" as const,
                    label: "LANÇAMENTO",
                    description: "Selo violeta médio sobre a miniatura",
                    badgeClass:
                      "bg-violet-600/95 border-violet-300/60 text-white text-[9.5px] h-5 px-2",
                  },
                  {
                    key: "novo" as const,
                    label: "NOVO",
                    description: "Selo âmbar discreto sobre a miniatura",
                    badgeClass:
                      "bg-amber-400/95 border-amber-200/75 text-zinc-950 text-[8.5px] h-4 px-1.5",
                  },
                  {
                    key: "final" as const,
                    label: "FINAL",
                    description: "Selo vermelho na miniatura e no título",
                    badgeClass:
                      "bg-rose-600/95 border-rose-300/65 text-white text-[10.5px] h-6 px-2.5",
                  },
                ] as const
              ).map((item) => {
                const checked = epBadges[item.key];
                return (
                  <label
                    key={item.key}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-colors ${
                      checked
                        ? "border-violet-500/45 bg-violet-500/10"
                        : "border-white/[0.08] bg-black/25 hover:border-white/15"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        onPatchEpisode(seasonId, ep.id, {
                          recentBadges: {
                            ...epBadges,
                            [item.key]: e.target.checked,
                          },
                        })
                      }
                      aria-label={`Selo ${item.label} — Episódio ${ep.number}`}
                      className="mt-0.5 size-4 rounded border-white/20 bg-black accent-violet-600"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center justify-center rounded border font-extrabold tracking-wider leading-none uppercase ${item.badgeClass}`}
                        >
                          {item.label}
                        </span>
                        <span
                          className={`studio-mono text-[10px] font-semibold ${
                            checked
                              ? "text-emerald-400"
                              : "text-[var(--color-subtle)]"
                          }`}
                        >
                          {checked ? "Ativo" : "Oculto"}
                        </span>
                      </div>
                      <p className="text-[11px] leading-snug text-[var(--color-muted)]">
                        {item.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Gerenciador de Fontes Duráveis (playerricas.php) — carregamento sob demanda */}
        <div className="sm:col-span-12">
          <EpisodeSourcesManager
            animeId={animeId}
            episode={ep}
            seasonTitle={seasonTitle}
            animeTitles={animeTitles}
            sourcesSession={sourcesSession}
            sourcesSyncTick={sourcesSyncTick}
            hasPendingOutbox={Boolean(outboxOp && outboxOp.type === "upsert")}
          />
        </div>

        {/* Imagem do episódio (URL) */}
        <div className="sm:col-span-12">
          <Label
            htmlFor={`ep-thumb-${ep.id}`}
            className="mb-1.5 block text-xs font-semibold text-[var(--color-muted)]"
          >
            Imagem do episódio (URL)
          </Label>

          <div className="space-y-2.5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <EpisodeThumbnailPreview
                key={ep.id}
                src={displayThumbnail}
                episodeNumber={ep.number}
                immediatePreview={thumbnailOrigin === "hikari-player"}
                onClear={() => {
                  if (onThumbnailClear) {
                    onThumbnailClear(seasonId, ep);
                  } else {
                    onPatchEpisode(seasonId, ep.id, {
                      thumbnail: "",
                    });
                  }
                }}
              />

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                  <div className="relative min-w-0 flex-1">
                    <Input
                      id={`ep-thumb-${ep.id}`}
                      value={displayThumbnail}
                      onChange={(e) => {
                        if (onThumbnailChange) {
                          onThumbnailChange(seasonId, ep, e.target.value);
                        } else {
                          onPatchEpisode(seasonId, ep.id, {
                            thumbnail: e.target.value,
                          });
                        }
                      }}
                      placeholder="Cole a URL da imagem do episódio (opcional)"
                      className="h-10 w-full border-white/10 bg-[var(--studio-panel)] pr-8 text-xs"
                    />
                    {Boolean(displayThumbnail) && (
                      <button
                        type="button"
                        onClick={() => {
                          if (onThumbnailClear) {
                            onThumbnailClear(seasonId, ep);
                          } else {
                            onPatchEpisode(seasonId, ep.id, {
                              thumbnail: "",
                            });
                          }
                        }}
                        aria-label={`Limpar imagem do Episódio ${ep.number}`}
                        title="Limpar URL da imagem"
                        className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-[var(--color-subtle)] hover:bg-white/[0.08] hover:text-rose-400"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={isDiscovering || captureStatusEntry?.status === "loading"}
                    onClick={() => {
                      if (onDiscoverCandidates) {
                        void onDiscoverCandidates(seasonId, ep, undefined, { force: true });
                      } else {
                        void onCaptureFrame(seasonId, ep);
                      }
                    }}
                    className="h-10 shrink-0 gap-1.5 border-white/10 bg-[var(--studio-panel)] text-xs text-violet-300 hover:text-white"
                    title="Extrair opções de imagem do vídeo sem apagar a thumbnail atual"
                  >
                    {isDiscovering || captureStatusEntry?.status === "loading" ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        <span>Buscando…</span>
                      </>
                    ) : (
                      <>
                        <Camera className="size-3.5" />
                        <span>
                          {hasExistingThumbnail
                            ? "Ver imagens do vídeo"
                            : "Capturar imagens"}
                        </span>
                      </>
                    )}
                  </Button>
                </div>

                <p className="text-[11px] text-[var(--color-subtle)]">
                  Opcional. A URL informada ou escolhida aqui tem prioridade sobre a imagem automática ou padrão do Hikari, e nunca é apagada ao colar um link de vídeo.
                </p>
              </div>
            </div>

            {candidateState &&
              (candidateState.loading ||
                candidateState.candidates.length > 0 ||
                candidateState.warning ||
                candidateState.error) && (
                <div className="space-y-2 rounded-lg border border-white/10 bg-black/25 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-violet-200">
                      {candidateState.loading
                        ? "Extraindo imagens disponíveis do vídeo…"
                        : candidateState.candidates.length > 0
                          ? `Imagens encontradas no vídeo (${candidateState.candidates.length}) — clique para escolher`
                          : "Extração automática de imagens do vídeo"}
                    </span>
                    {candidateState.loading && (
                      <Loader2 className="size-3.5 animate-spin text-violet-300" />
                    )}
                  </div>

                  {candidateState.candidates.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
                      {candidateState.candidates.map((cand) => {
                        const isSelected =
                          candidateState.selectedCandidateId === cand.id ||
                          (Boolean(cand.remoteUrl) &&
                            displayThumbnail.trim() === cand.remoteUrl);
                        const isApplying =
                          candidateState.selectingCandidateId === cand.id;

                        return (
                          <button
                            key={cand.id}
                            type="button"
                            disabled={Boolean(candidateState.selectingCandidateId)}
                            onClick={() => {
                              if (onSelectCandidate) {
                                void onSelectCandidate(seasonId, ep, cand);
                              }
                            }}
                            className={cn(
                              "group relative aspect-video overflow-hidden rounded-md border bg-black/60 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400",
                              isSelected
                                ? "border-violet-400 ring-2 ring-violet-500/70"
                                : "border-white/10 hover:border-violet-400/70",
                            )}
                            title={`Usar imagem (${cand.label}) no Episódio ${ep.number}`}
                          >
                            <img
                              src={cand.previewUrl}
                              alt={`Opção ${cand.label} do Episódio ${ep.number}`}
                              className="size-full object-cover transition-transform group-hover:scale-105"
                            />
                            <span className="studio-mono absolute bottom-1 left-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
                              {cand.label}
                            </span>
                            {isSelected && (
                              <span className="absolute top-1 right-1 rounded bg-violet-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                                Em uso
                              </span>
                            )}
                            {isApplying && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/65">
                                <Loader2 className="size-4 animate-spin text-white" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {(candidateState.warning || candidateState.error) && (
                    <p className="text-[11px] text-amber-200/90">
                      {candidateState.warning || candidateState.error}
                    </p>
                  )}
                </div>
              )}

            {captureStatusEntry?.status === "loading" && (
              <div className="flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs text-violet-200">
                <Loader2 className="size-3.5 shrink-0 animate-spin text-violet-300" />
                <span>
                  {captureStatusEntry.message ||
                    "Salvando miniatura persistente do episódio…"}
                </span>
              </div>
            )}

            {captureStatusEntry?.status === "error" && (
              <div className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                <div className="flex items-center gap-1.5 font-medium text-amber-300">
                  <AlertCircle className="size-3.5 shrink-0" />
                  <span>
                    Captura automática indisponível (não impede o salvamento nem a imagem manual):
                  </span>
                </div>
                <p className="pl-5 text-[11px] text-amber-200/90">
                  {captureStatusEntry.message}
                </p>
              </div>
            )}

            {captureStatusEntry?.status === "success" && (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                <CheckCircle2 className="size-3.5 shrink-0" />
                <span>
                  {captureStatusEntry.message ||
                    "Miniatura aplicada ao episódio com sucesso!"}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  );
});

const EpisodeOpeningSuggestionBox = memo(function EpisodeOpeningSuggestionBox({
  seasonId,
  seasonNumber,
  episodeId,
  episodeNumber,
  openingStartSeconds,
  openingEndSeconds,
  suggestion,
  onApplyOpeningSuggestion,
  onDiscardOpeningSuggestion,
}: {
  seasonId: string;
  seasonNumber: number;
  episodeId: string;
  episodeNumber: number;
  openingStartSeconds?: number | null;
  openingEndSeconds?: number | null;
  suggestion: OpeningSuggestionEntry;
  onApplyOpeningSuggestion?: (
    seasonId: string,
    episodeId: string,
    start: number | null,
    end: number | null,
  ) => void;
  onDiscardOpeningSuggestion?: (seasonNumber: number, episodeNumber: number) => void;
}) {
  const isAlreadyApplied =
    suggestion.found &&
    openingStartSeconds === suggestion.startSeconds &&
    openingEndSeconds === suggestion.endSeconds;

  const confidencePct =
    suggestion.confidence !== null && suggestion.confidence !== undefined
      ? suggestion.confidence <= 1
        ? Math.round(suggestion.confidence * 100)
        : Math.round(suggestion.confidence)
      : null;

  const statusBadgeLabel =
    suggestion.status === "found"
      ? isAlreadyApplied
        ? "Aplicada nos campos"
        : "Sugestão pronta"
      : suggestion.status === "no_intro"
        ? "Sem opening confirmada"
        : suggestion.status === "rate_limited"
          ? "Limite atingido (429)"
          : suggestion.status === "timeout"
            ? "Tempo esgotado"
            : suggestion.status === "error"
              ? "Falha temporária"
              : "Não encontrada";

  return (
    <div className="flex flex-col justify-end sm:col-span-6 lg:col-span-6">
      {suggestion.found ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-xs">
          <div className="space-y-0.5 text-purple-100">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold">
                {suggestion.sourceLabel ?? "Fonte"}:
              </span>
              <span className="studio-mono font-semibold text-white">
                {suggestion.startTime} — {suggestion.endTime}
              </span>
              <span className="rounded bg-purple-500/25 px-1.5 py-0.5 text-[10px] font-medium text-purple-100">
                {statusBadgeLabel}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-purple-200/80">
              <span>Ep. {episodeNumber}</span>
              {confidencePct !== null && (
                <span>· Confiança: {confidencePct}%</span>
              )}
              {suggestion.submissionCount !== null && (
                <span>
                  · {suggestion.submissionCount}{" "}
                  {suggestion.submissionCount === 1 ? "contribuição" : "contribuições"}
                </span>
              )}
              {suggestion.remappedFrom && (
                <span>
                  · Remapeado (MAL #{suggestion.remappedFrom.targetMalId} Ep.{" "}
                  {suggestion.remappedFrom.targetEpisodeNumber})
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 border-purple-500/40 bg-purple-500/20 px-2.5 text-[11px] text-purple-100 hover:bg-purple-500/30"
              onClick={() =>
                onApplyOpeningSuggestion?.(
                  seasonId,
                  episodeId,
                  suggestion.startSeconds,
                  suggestion.endSeconds,
                )
              }
            >
              {isAlreadyApplied ? "Reaplicar" : "Aplicar sugestão"}
            </Button>
            {onDiscardOpeningSuggestion && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[11px] text-purple-200/80 hover:bg-white/10 hover:text-white"
                onClick={() =>
                  onDiscardOpeningSuggestion(seasonNumber, episodeNumber)
                }
                title="Descartar sugestão sem alterar os horários"
              >
                Descartar
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-[var(--color-muted)]">
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium text-[var(--color-fg)]">
                Ep. {episodeNumber} · {statusBadgeLabel}
              </span>
              {suggestion.sourceLabel && (
                <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px]">
                  {suggestion.sourceLabel}
                </span>
              )}
            </div>
            {suggestion.message && (
              <p className="text-[11px] text-[var(--color-muted)]">
                {suggestion.message}
              </p>
            )}
          </div>
          {onDiscardOpeningSuggestion && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 shrink-0 px-2 text-[11px] text-[var(--color-muted)] hover:bg-white/10 hover:text-white"
              onClick={() =>
                onDiscardOpeningSuggestion(seasonNumber, episodeNumber)
              }
              aria-label="Descartar aviso de busca"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
});

function EpisodeThumbnailPreview({
  src,
  episodeNumber,
  immediatePreview = false,
  onClear,
}: {
  src?: string;
  episodeNumber: number;
  immediatePreview?: boolean;
  onClear: () => void;
}) {
  const trimmed = src?.trim() ?? "";
  const [debouncedSrc, setDebouncedSrc] = useState<string>(() =>
    isValidImagePreviewUrl(trimmed) ? trimmed : "",
  );
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    setFailedSrc(null);
    if (!trimmed || !isValidImagePreviewUrl(trimmed)) {
      setDebouncedSrc("");
      return;
    }
    if (
      immediatePreview ||
      trimmed.startsWith("/") ||
      trimmed.startsWith("blob:") ||
      trimmed.startsWith("data:image/")
    ) {
      setDebouncedSrc(trimmed);
      return;
    }
    const timer = window.setTimeout(() => {
      setDebouncedSrc(trimmed);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [trimmed, immediatePreview]);

  const hasError = Boolean(debouncedSrc) && failedSrc === debouncedSrc;

  return (
    <div className="relative flex aspect-video w-36 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/50">
      {debouncedSrc && !hasError ? (
        <>
          <img
            src={debouncedSrc}
            alt={`Pré-visualização do Episódio ${episodeNumber}`}
            className="size-full object-cover"
            onError={() => setFailedSrc(debouncedSrc)}
          />
          <button
            type="button"
            onClick={onClear}
            title="Remover imagem do episódio"
            aria-label={`Remover imagem do Episódio ${episodeNumber}`}
            className="absolute top-1 right-1 rounded-full bg-black/80 p-1 text-[var(--color-muted)] hover:text-rose-400"
          >
            <X className="size-3" />
          </button>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center px-2 text-center text-[var(--color-subtle)]">
          <Film className="mb-1 size-4 opacity-60" />
          <span className="text-[10px] leading-tight">
            {hasError ? "Prévia indisponível" : "Sem imagem"}
          </span>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={className}>
      <Label className="mb-1.5 block text-xs font-semibold text-[var(--color-muted)]">
        {label}
      </Label>
      {children}
    </label>
  );
}

const EpisodeSourcesManager = memo(function EpisodeSourcesManager({
  animeId,
  episode,
  seasonTitle,
  animeTitles,
  sourcesSession,
  sourcesSyncTick = 0,
  hasPendingOutbox = false,
}: {
  animeId: string;
  episode: Episode;
  seasonTitle?: string;
  animeTitles: string[];
  sourcesSession: EpisodeSourcesSessionStore;
  sourcesSyncTick?: number;
  hasPendingOutbox?: boolean;
}) {
  const drawerPanelId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const cachedEntry = sourcesSession.isValid(episode.id)
    ? sourcesSession.getCached(episode.id)
    : undefined;
  const [sources, setSources] = useState<EpisodeSourceItem[]>(
    () => cachedEntry?.sources ?? [],
  );
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [langInput, setLangInput] = useState<"" | SourceLang>("");
  const [qualityInput, setQualityInput] = useState("");
  const [priorityInput, setPriorityInput] = useState("0");
  const [formError, setFormError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const activeEpisodeIdRef = useRef(episode.id);
  activeEpisodeIdRef.current = episode.id;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const currentSlotsSignature = getEpisodeSlotsSignature(episode);
  const hasUnsavedSlotChanges =
    hasPendingOutbox ||
    sourcesSession.hasUnsavedSlotChanges(episode) ||
    (Boolean(cachedEntry) && cachedEntry!.slotsSignature !== currentSlotsSignature);

  const fetchEpisodeSourcesFromApi = useCallback(
    async (targetEpisodeId: string): Promise<EpisodeSourceItem[]> => {
      const token = getBearerToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(
        `/api/episode-sources?episodeId=${encodeURIComponent(targetEpisodeId)}&includeBroken=1`,
        {
          headers: token ? headers : undefined,
          credentials: "include",
        },
      );

      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        sources?: EpisodeSourceItem[];
        error?: string;
      } | null;

      if (!res.ok || !data?.ok || !Array.isArray(data.sources)) {
        throw new Error(
          data?.error || `Falha ao carregar fontes do episódio (HTTP ${res.status}).`,
        );
      }

      return data.sources;
    },
    [],
  );

  const loadSources = useCallback(
    async (options?: { force?: boolean }) => {
      const targetEpisodeId = episode.id;
      if (!targetEpisodeId) return;

      setLoading(true);
      setLoadError(null);

      try {
        const baselineOrCurrentSlots =
          sourcesSession.getBaselineSlots(targetEpisodeId) ?? currentSlotsSignature;
        const result = await sourcesSession.loadEpisodeSources(
          targetEpisodeId,
          fetchEpisodeSourcesFromApi,
          {
            force: Boolean(options?.force),
            slotsSignature: baselineOrCurrentSlots,
          },
        );

        if (!mountedRef.current || activeEpisodeIdRef.current !== targetEpisodeId) {
          return;
        }

        const latestValid = sourcesSession.isValid(targetEpisodeId)
          ? sourcesSession.getCached(targetEpisodeId)
          : undefined;
        if (latestValid) {
          setSources(latestValid.sources);
          setLoadError(null);
        } else if (!sourcesSession.isInFlight(targetEpisodeId)) {
          setSources(result.sources);
          setLoadError(null);
        }
      } catch (err) {
        if (!mountedRef.current || activeEpisodeIdRef.current !== targetEpisodeId) {
          return;
        }
        setLoadError(
          err instanceof Error
            ? err.message
            : "Erro de rede ao carregar fontes do episódio.",
        );
      } finally {
        if (mountedRef.current && activeEpisodeIdRef.current === targetEpisodeId) {
          setLoading(false);
        }
      }
    },
    [
      episode.id,
      currentSlotsSignature,
      sourcesSession,
      fetchEpisodeSourcesFromApi,
    ],
  );

  // Carrega fontes exclusivamente quando a gaveta estiver aberta
  useEffect(() => {
    if (!isOpen) {
      const valid = sourcesSession.isValid(episode.id)
        ? sourcesSession.getCached(episode.id)
        : undefined;
      setSources(valid?.sources ?? []);
      setLoadError(null);
      return;
    }

    if (!episode.id) return;

    if (sourcesSession.isValid(episode.id)) {
      const valid = sourcesSession.getCached(episode.id)!;
      setSources(valid.sources);
      setLoadError(null);
      return;
    }

    void loadSources({ force: false });
  }, [isOpen, episode.id, sourcesSyncTick, sourcesSession, loadSources]);

  const handleAddSource = async () => {
    setFormError(null);
    const trimmedUrl = urlInput.trim();
    const urlCheck = validateAnitube22PlayerUrl(trimmedUrl);
    if (!urlCheck.ok) {
      setFormError(urlCheck.error);
      toast.error(urlCheck.error);
      return;
    }

    if (langInput !== "sub" && langInput !== "dub") {
      const msg = "Selecione o idioma da fonte (legendado ou dublado).";
      setFormError(msg);
      toast.error(msg);
      return;
    }

    const expectedLang =
      parseExplicitSourceLang(
        typeof episode.audio === "string" ? episode.audio : null,
      ) ??
      detectEpisodeLanguageHint([
        episode.title,
        seasonTitle,
        ...animeTitles,
      ]);
    if (expectedLang && expectedLang !== langInput) {
      setFormError(ANITUBE22_WRONG_LANG_ERROR);
      toast.error(ANITUBE22_WRONG_LANG_ERROR);
      return;
    }

    setSaving(true);
    try {
      const token = getBearerToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch("/api/episode-sources", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          action: "upsert",
          episodeId: episode.id,
          animeId,
          provider: ANITUBE22_PROVIDER,
          externalId: trimmedUrl,
          lang: langInput,
          quality: qualityInput.trim() || null,
          priority: Number.isFinite(Number(priorityInput)) ? Math.max(0, Number(priorityInput)) : 0,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        source?: EpisodeSourceItem;
      } | null;
      if (!res.ok || !data?.ok) {
        const msg = data?.error || "Falha ao cadastrar fonte.";
        setFormError(msg);
        toast.error(msg);
        return;
      }

      toast.success("Fonte cadastrada com sucesso!");
      setUrlInput("");
      setLangInput("");
      setQualityInput("");
      setPriorityInput("0");

      if (data.source) {
        const nextSources = sourcesSession.applyUpsertedSource(
          episode.id,
          data.source,
          sourcesSession.getBaselineSlots(episode.id) ?? currentSlotsSignature,
        );
        setSources(nextSources);
        setLoadError(null);
      } else {
        await loadSources({ force: true });
      }
    } catch {
      const msg = "Erro de rede ao salvar fonte.";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    if (deletingSourceId === sourceId) return;
    setDeletingSourceId(sourceId);
    try {
      const token = getBearerToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch("/api/episode-sources", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          action: "delete",
          sourceId,
          animeId,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        deleted?: boolean;
        error?: string;
      } | null;

      if (!res.ok || data?.ok === false) {
        toast.error(data?.error || "Não foi possível remover a fonte.");
        return;
      }

      const nextSources = sourcesSession.applyDeletedSource(episode.id, sourceId);
      setSources(nextSources);
      toast.success("Fonte removida.");
    } catch {
      toast.error("Não foi possível remover a fonte.");
    } finally {
      setDeletingSourceId((curr) => (curr === sourceId ? null : curr));
    }
  };

  const displaySources = cachedEntry ? cachedEntry.sources : sources;
  const issueCount = cachedEntry
    ? cachedEntry.sources.filter(
        (src) =>
          src.status === "broken" ||
          src.status === "incomplete" ||
          (src.provider === ANITUBE22_PROVIDER &&
            (!src.namePath?.trim() || !src.urlPath?.trim())),
      ).length
    : 0;

  return (
    <div className="rounded-xl border border-white/10 bg-[var(--studio-panel)]/70">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={drawerPanelId}
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[var(--color-fg)]">
            Fontes de Reprodução
          </span>
          <span className="studio-mono text-[10px] text-[var(--color-subtle)]">
            (playerricas.php)
          </span>

          {cachedEntry ? (
            <span className="studio-mono rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
              {cachedEntry.sources.length}{" "}
              {cachedEntry.sources.length === 1 ? "fonte" : "fontes"}
            </span>
          ) : loading ? (
            <span className="inline-flex items-center gap-1 rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] text-violet-200">
              <Loader2 className="size-2.5 animate-spin" />
              Carregando…
            </span>
          ) : (
            <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-[var(--color-subtle)]">
              Sob demanda
            </span>
          )}

          {issueCount > 0 && (
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
              {issueCount} com aviso
            </span>
          )}

          {hasUnsavedSlotChanges && (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-200">
              Slots editados (não salvo)
            </span>
          )}
        </div>

        <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-muted)]">
          <span>{isOpen ? "Recolher" : "Gerenciar"}</span>
          {isOpen ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
        </span>
      </button>

      {isOpen && (
        <div
          id={drawerPanelId}
          className="space-y-3 border-t border-white/[0.08] p-3.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--color-fg)]">
                Fontes registradas (playerricas.php)
              </span>
              <span className="studio-mono rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
                {displaySources.length}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void loadSources({ force: true })}
              disabled={loading}
              className="h-7 gap-1.5 px-2 text-[11px] text-[var(--color-muted)] hover:text-white"
            >
              <RefreshCw className={cn("size-3", loading && "animate-spin")} />
              <span>{loading ? "Atualizando…" : "Atualizar lista"}</span>
            </Button>
          </div>

          {hasUnsavedSlotChanges && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200"
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-300" />
              <span>
                Os slots Player 1–5 deste episódio possuem alterações locais ainda não salvas.
                Salve o anime para sincronizar as fontes registradas no banco.
              </span>
            </div>
          )}

          {loading && displaySources.length === 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-xs text-[var(--color-muted)]">
              <Loader2 className="size-3.5 animate-spin text-violet-300" />
              <span>Carregando fontes de reprodução…</span>
            </div>
          )}

          {loadError && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="size-3.5 shrink-0 text-rose-400" />
                <span>{loadError}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => void loadSources({ force: true })}
                className="h-7 border-rose-400/35 bg-rose-500/15 px-2.5 text-[11px] text-rose-100 hover:bg-rose-500/25"
              >
                Tentar novamente
              </Button>
            </div>
          )}

          {!loading && !loadError && displaySources.length === 0 && (
            <p className="rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-2.5 text-xs text-[var(--color-muted)]">
              Nenhuma fonte registrada no banco para este episódio.
            </p>
          )}

          {displaySources.length > 0 && (
            <ul className="space-y-1.5">
              {displaySources.map((src) => {
                const isIncomplete =
                  src.status === "incomplete" ||
                  (src.provider === ANITUBE22_PROVIDER &&
                    (!src.namePath?.trim() || !src.urlPath?.trim()));

                return (
                  <li
                    key={src.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-xs"
                  >
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                          src.lang === "dub"
                            ? "bg-sky-500/20 text-sky-300"
                            : "bg-violet-500/20 text-violet-300",
                        )}
                      >
                        {src.lang === "dub" ? "Dublado" : "Legendado"}
                      </span>

                      {isIncomplete ? (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-300">
                          incompleto
                        </span>
                      ) : src.status === "broken" ? (
                        <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-300">
                          quebrado
                        </span>
                      ) : (
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-300">
                          ativo
                        </span>
                      )}

                      <span className="studio-mono text-[11px] text-[var(--color-fg)]">
                        ID {src.externalId || "—"}
                      </span>

                      {src.urlPath && (
                        <span className="studio-mono max-w-[260px] truncate text-[10px] text-[var(--color-muted)]">
                          {src.urlPath}
                        </span>
                      )}

                      {src.quality && (
                        <span className="text-[10px] text-[var(--color-muted)]">
                          {src.quality}
                        </span>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={deletingSourceId === src.id}
                      aria-label={`Remover fonte ${src.externalId || src.id}`}
                      onClick={() => void handleDeleteSource(src.id)}
                      className="h-7 px-2 text-[11px] text-[var(--color-muted)] hover:bg-rose-500/15 hover:text-rose-300"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="grid gap-2 sm:grid-cols-12">
            <div className="sm:col-span-6">
              <Input
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  if (formError) setFormError(null);
                }}
                placeholder="Cole a URL completa do playerricas.php (com name, img, url)"
                className="studio-mono h-9 border-white/10 bg-black/35 text-xs"
              />
            </div>

            <div className="sm:col-span-2">
              <select
                value={langInput}
                onChange={(e) => {
                  setLangInput((e.target.value as "" | SourceLang) || "");
                  if (formError) setFormError(null);
                }}
                aria-label="Idioma obrigatório da fonte"
                className="h-9 w-full rounded-md border border-white/10 bg-black/35 px-2 text-xs text-[var(--color-fg)] outline-none focus:border-violet-500"
              >
                <option value="">Idioma *</option>
                <option value="sub">Legendado (sub)</option>
                <option value="dub">Dublado (dub)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <Input
                value={qualityInput}
                onChange={(e) => setQualityInput(e.target.value)}
                placeholder="Qualidade (ex: 1080p)"
                className="h-9 border-white/10 bg-black/35 text-xs"
              />
            </div>

            <div className="flex gap-1.5 sm:col-span-2">
              <Input
                type="number"
                min={0}
                value={priorityInput}
                onChange={(e) => setPriorityInput(e.target.value)}
                title="Prioridade (menor = primeiro)"
                className="studio-tabular h-9 w-14 border-white/10 bg-black/35 text-center text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => void handleAddSource()}
                className="h-9 flex-1 border-violet-500/35 bg-violet-500/15 px-2.5 text-xs font-semibold text-violet-200 hover:bg-violet-500/25 hover:text-white"
              >
                {saving ? "Validando…" : "Adicionar"}
              </Button>
            </div>
          </div>

          {formError && (
            <p role="alert" className="text-[11px] font-medium text-rose-400">
              {formError}
            </p>
          )}
        </div>
      )}
    </div>
  );
});
