import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import {
  Loader2,
  CheckCircle2,
  Film,
  AlertCircle,
  RefreshCw,
  Info,
  Layers,
} from "lucide-react";
import { memo, useEffect, useState, useCallback, useRef, useMemo } from "react";
import { toast } from "sonner";
import { fetchAdminAnimeDetail } from "@/lib/admin-dashboard.functions";
import {
  areAnimeRecentBadgesEqual,
  isCustomImageUrl,
  normalizeAnimeRecentBadges,
  normalizeEpisodeAudio,
  type Episode,
  type LocalAnime,
  type ResolvedMobileBannerInfo,
  type Season,
} from "@/lib/types";
import { useHikariStore } from "@/lib/store";
import { youtubeIdFrom, cn } from "@/lib/utils";
import { stripCatalogImageVersion } from "@/lib/image-utils";
import { uploadVideoToB2 } from "@/lib/b2";
import { getBearerToken } from "@/lib/auth/client";
import { flushAnimes } from "@/lib/catalog-storage";
import {
  buildAdminCatalogAnimeSavePayload,
  resolveAdminAnimeWithRemote,
  resolveAdminDisplayMedia,
  resolveSavedMediaFromServer,
} from "@/lib/overlay";
import {
  hasAdminCustomBanner,
  resolveSeasonMobileBanner,
  resolveSeasonMobileBannerSync,
} from "@/lib/season-banner";
import {
  captureAndUploadThumbnail,
  extractVideoThumbnailCandidates,
  hasEpisodePlayableSource,
  isPersistablePlayableVideoUrl,
  resolveEpisodeThumbnailUrl,
  sanitizeEpisodeThumbnailUrl,
  uploadThumbnailBlob,
  type VideoThumbnailCandidate,
} from "@/lib/published-episodes";
import { Button } from "@/components/ui/button";
import {
  clearOutboxForAnime,
  persistEpisode,
  persistEpisodeDelete,
  readOutbox,
  subscribeOutbox,
  writeOutbox,
  flushOutbox,
  type OutboxOperation,
  type PersistEpisodeResult,
} from "@/lib/episode-writer";
import {
  normalizeVideoProbeUrl,
  shouldRunAutoThumbnailProbe,
} from "@/lib/thumbnail-probe-guard";
import {
  EPISODE_SAVE_CONCURRENCY,
  runWithConcurrency,
} from "@/lib/concurrency";
import {
  getAdminCatalogEpisodes,
  invalidateCatalogEpisodesCache,
  mergeAdminEpisodesWithServer,
  type CatalogEpisodesResult,
} from "@/lib/catalog-episodes";
import {
  normalizeHikariPlayerEpisodeId,
  validateHikariPlayerEpisodeId,
} from "@/lib/hikari-player";
import {
  classifyThumbnailInput,
  createHikariPlayerThumbnailManager,
  HIKARI_PLAYER_THUMB_INPUT_MESSAGES,
  isHikariPlayerIdThumbnailCandidate,
  resolveInitialThumbnailOrigin,
  type EpisodeThumbnailOrigin,
  type HikariPlayerThumbStatusEntry,
  type HikariPlayerThumbnailManager,
} from "@/lib/hikari-player-thumbnail";
import {
  EditorHeader,
  type AnimeSyncState,
} from "@/components/admin/anime-editor/editor-header";
import { EditorMetadata } from "@/components/admin/anime-editor/editor-metadata";
import {
  EditorSeasons,
  type EpisodeCandidateState,
} from "@/components/admin/anime-editor/editor-seasons";
import { EditorMobileBar } from "@/components/admin/anime-editor/editor-mobile-bar";
import {
  discardOpeningSuggestion,
  getOpeningSuggestionKey,
  mergeLoadedOpeningSuggestions,
  parseReliableEpisodeDurationSeconds,
  reconcileDirtyEpisodeIdsAfterFormPopulation,
  type OpeningSuggestionEntry,
} from "@/lib/opening-admin-state";
import {
  createEpisodeSourcesSessionStore,
  getEpisodeSlotsSignature,
  type EpisodeSourcesSessionStore,
} from "@/lib/episode-sources-session";

const MemoEditorHeader = memo(EditorHeader);
const MemoEditorMetadata = memo(EditorMetadata);
const MemoEditorSeasons = memo(EditorSeasons);
const MemoEditorMobileBar = memo(EditorMobileBar);

export const Route = createFileRoute("/admin/$id")({
  validateSearch: (raw: Record<string, unknown>): { importId?: string } => ({
    importId: typeof raw.importId === "string" && raw.importId ? raw.importId : undefined,
  }),
  loaderDeps: ({ search }) => ({ importId: search.importId }),
  loader: async ({ params, deps }) => {
    let primary = null;
    let remote = null;
    let serverEpisodes: CatalogEpisodesResult | null = null;

    if (params.id && params.id !== "new") {
      const [primaryRes, episodesRes] = await Promise.all([
        fetchAdminAnimeDetail({ data: { id: params.id } }).catch(() => null),
        getAdminCatalogEpisodes({ data: { animeId: params.id } }).catch(() => null),
      ]);
      primary = primaryRes;
      serverEpisodes = episodesRes;
    }

    const externalFallbackId =
      (deps.importId && deps.importId !== params.id ? deps.importId : undefined) ??
      (primary?.anilistId ? String(primary.anilistId) : undefined) ??
      (primary?.malId ? `mal-${primary.malId}` : undefined) ??
      (primary?.kitsuId ? `kitsu-${primary.kitsuId}` : undefined);

    const primaryHasRemoteSeasons =
      Boolean(primary) &&
      primary?.source !== "local" &&
      Boolean(primary?.seasons?.some((s: { episodes: unknown[] }) => s.episodes.length > 0));

    // Otimização A1.B: Evitar chamadas externas desnecessárias quando dados persistidos já são suficientes
    const isPersistedSufficient =
      Boolean(primary) &&
      primary?.source === "local" &&
      Boolean(primary?.seasons?.length && primary.seasons.some((s: { episodes: unknown[] }) => s.episodes.length > 0)) &&
      (!deps.importId || deps.importId === params.id);

    if (!primary) {
      if (deps.importId) {
        try {
          remote = await fetchAdminAnimeDetail({ data: { id: deps.importId } });
        } catch {
          remote = null;
        }
      }
    } else if (
      !isPersistedSufficient &&
      externalFallbackId &&
      externalFallbackId !== params.id &&
      (!primaryHasRemoteSeasons || (deps.importId && deps.importId !== params.id))
    ) {
      try {
        const canonicalRemote = await fetchAdminAnimeDetail({
          data: { id: externalFallbackId },
        });
        if (canonicalRemote) {
          const mergedBanner = primary.banner || canonicalRemote.banner;
          const primaryHasCustomBanner = Boolean(
            primary.banner?.trim() &&
              isCustomImageUrl(primary.banner, canonicalRemote.banner),
          );
          remote = {
            ...canonicalRemote,
            ...primary,
            cover: primary.cover || canonicalRemote.cover,
            banner: mergedBanner,
            resolvedMobileBanner: primaryHasCustomBanner
              ? {
                  url: primary.banner.trim(),
                  isAlternative: false,
                  source: "admin" as const,
                  initialObjectPosition: "50% 24%",
                }
              : primary.resolvedMobileBanner ?? canonicalRemote.resolvedMobileBanner,
            seasons:
              canonicalRemote.seasons?.length > 0
                ? canonicalRemote.seasons
                : primary.seasons,
            serverCatalogId:
              primary.serverCatalogId || canonicalRemote.serverCatalogId,
            catalogUpdatedAt:
              primary.catalogUpdatedAt ?? canonicalRemote.catalogUpdatedAt,
          };
        } else {
          remote = primary;
        }
      } catch {
        remote = primary;
      }
    } else {
      remote = primary;
    }

    if (
      params.id &&
      params.id !== "new" &&
      (!serverEpisodes || serverEpisodes.episodes.length === 0) &&
      remote?.serverCatalogId &&
      remote.serverCatalogId !== params.id
    ) {
      try {
        serverEpisodes = await getAdminCatalogEpisodes({
          data: { animeId: remote.serverCatalogId },
        });
      } catch (err) {
        console.warn("[admin loader] Erro ao carregar episódios alternativos do servidor:", err);
      }
    }

    return { remote, serverEpisodes };
  },
  component: AdminEditor,
});

function emptyLocal(): LocalAnime {
  const now = Date.now();
  return {
    id: `local-${crypto.randomUUID()}`,
    titleRomaji: "",
    titleEnglish: "",
    titleNative: "",
    cover: "",
    banner: "",
    synopsis: "",
    score: null,
    genres: [],
    format: "TV",
    status: "FINISHED",
    episodesCount: null,
    season: null,
    year: new Date().getFullYear(),
    trailerId: null,
    hidden: false,
    seasons: [
      {
        id: `s-${crypto.randomUUID()}`,
        number: 1,
        title: "Temporada 1",
        episodes: [],
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

function AdminEditor() {
  const { id } = Route.useParams();
  const { importId } = Route.useSearch();
  const { remote, serverEpisodes } = Route.useLoaderData();
  const navigate = useNavigate();
  const router = useRouter();
  const stored = useHikariStore((s) => s.animes);
  const hydrated = useHikariStore((s) => s.hydrated);
  const upsertAnime = useHikariStore((s) => s.upsertAnime);
  const removeAnime = useHikariStore((s) => s.removeAnime);

  const [form, setForm] = useState<LocalAnime | null>(null);
  const [animeSyncState, setAnimeSyncState] = useState<AnimeSyncState>("local");
  const [activeTab, setActiveTab] = useState<"all" | "metadata" | "seasons">("all");
  const [genreText, setGenreText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingEpisode, setUploadingEpisode] = useState<string | null>(null);
  const [captureStatus, setCaptureStatus] = useState<
    Record<string, { status: "loading" | "error" | "success"; message?: string }>
  >({});
  const [outboxOps, setOutboxOps] = useState<OutboxOperation[]>(() =>
    typeof window !== "undefined" ? readOutbox() : [],
  );
  const [recoveryState, setRecoveryState] = useState<{
    status: "idle" | "loading" | "success" | "empty" | "error";
    message?: string;
    recoveredCount?: number;
  }>({ status: "idle" });

  const [openingSuggestions, setOpeningSuggestions] = useState<
    Record<string, OpeningSuggestionEntry>
  >({});
  const [isFetchingOpening, setIsFetchingOpening] = useState(false);

  const initializedRouteKeyRef = useRef<string | null>(null);
  const lastServerEpisodesRef = useRef<CatalogEpisodesResult | null | undefined>(undefined);
  const isSavingRef = useRef(false);
  const formRef = useRef<LocalAnime | null>(null);
  formRef.current = form;
  const genreTextRef = useRef(genreText);
  genreTextRef.current = genreText;
  const animeSyncStateRef = useRef<AnimeSyncState>(animeSyncState);
  animeSyncStateRef.current = animeSyncState;
  const idRef = useRef(id);
  idRef.current = id;
  const importIdRef = useRef(importId);
  importIdRef.current = importId;
  const dirtyEpisodeIdsRef = useRef<Set<string>>(new Set());
  const explicitUserDirtyEpisodeIdsRef = useRef<Set<string>>(new Set());
  const dirtyMediaRef = useRef<{ cover: boolean; banner: boolean }>({
    cover: false,
    banner: false,
  });
  const sourcesSessionRef = useRef<EpisodeSourcesSessionStore | null>(null);
  if (!sourcesSessionRef.current) {
    sourcesSessionRef.current = createEpisodeSourcesSessionStore();
  }
  const [sourcesSyncTick, setSourcesSyncTick] = useState(0);
  const [clientMobileBanner, setClientMobileBanner] =
    useState<ResolvedMobileBannerInfo | null>(null);
  const [episodeCandidates, setEpisodeCandidates] = useState<
    Record<string, EpisodeCandidateState>
  >({});
  const episodeCandidatesRef = useRef<Record<string, EpisodeCandidateState>>({});
  episodeCandidatesRef.current = episodeCandidates;
  const candidateTasksRef = useRef<
    Map<
      string,
      { generation: number; controller: AbortController; previewUrls: string[] }
    >
  >(new Map());
  const [thumbnailEditModes, setThumbnailEditModes] = useState<
    Record<string, "modified" | "cleared">
  >({});
  const thumbnailEditModesRef = useRef<Record<string, "modified" | "cleared">>({});
  thumbnailEditModesRef.current = thumbnailEditModes;
  const [thumbnailOrigins, setThumbnailOrigins] = useState<
    Record<string, EpisodeThumbnailOrigin>
  >({});
  const thumbnailOriginsRef = useRef<Record<string, EpisodeThumbnailOrigin>>({});
  thumbnailOriginsRef.current = thumbnailOrigins;
  const [hikariThumbStatuses, setHikariThumbStatuses] = useState<
    Record<string, HikariPlayerThumbStatusEntry>
  >({});
  const latestHikariIdsRef = useRef<Record<string, string>>({});
  const hikariThumbManagerRef = useRef<HikariPlayerThumbnailManager | null>(null);
  const [thumbInputHikariStatuses, setThumbInputHikariStatuses] = useState<
    Record<string, HikariPlayerThumbStatusEntry>
  >({});
  const latestThumbnailValuesRef = useRef<Record<string, string>>({});
  const thumbInputHikariManagerRef = useRef<HikariPlayerThumbnailManager | null>(null);

  const revokeEpisodePreviewUrls = useCallback((epId: string) => {
    const task = candidateTasksRef.current.get(epId);
    if (!task) return;
    task.controller.abort();
    for (const url of task.previewUrls) {
      if (url.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      }
    }
    candidateTasksRef.current.delete(epId);
  }, []);

  const revokeAllCandidatePreviewUrls = useCallback(() => {
    for (const epId of Array.from(candidateTasksRef.current.keys())) {
      revokeEpisodePreviewUrls(epId);
    }
    setEpisodeCandidates({});
  }, [revokeEpisodePreviewUrls]);

  useEffect(() => {
    const tasks = candidateTasksRef.current;
    return () => {
      for (const task of tasks.values()) {
        task.controller.abort();
        for (const url of task.previewUrls) {
          if (url.startsWith("blob:")) {
            try {
              URL.revokeObjectURL(url);
            } catch {
              // ignore
            }
          }
        }
      }
      tasks.clear();
    };
  }, []);

  const setEpisodeThumbnailEditMode = useCallback(
    (epId: string, mode?: "modified" | "cleared") => {
      setThumbnailEditModes((prev) => {
        const next = { ...prev };
        if (mode) {
          next[epId] = mode;
        } else {
          delete next[epId];
        }
        thumbnailEditModesRef.current = next;
        return next;
      });
    },
    [],
  );

  const setEpisodeThumbnailOrigin = useCallback(
    (epId: string, origin?: EpisodeThumbnailOrigin) => {
      setThumbnailOrigins((prev) => {
        const next = { ...prev };
        if (origin) {
          next[epId] = origin;
        } else {
          delete next[epId];
        }
        thumbnailOriginsRef.current = next;
        return next;
      });
    },
    [],
  );

  const syncThumbnailOriginsFromSeasons = useCallback(
    (seasons: Season[], options?: { preserveExisting?: boolean }) => {
      const preserveExisting = Boolean(options?.preserveExisting);
      const prevOrigins = thumbnailOriginsRef.current;
      const nextOrigins: Record<string, EpisodeThumbnailOrigin> = {};
      const nextIds: Record<string, string> = {};
      const nextThumbs: Record<string, string> = {};

      for (const season of seasons) {
        for (const ep of season.episodes) {
          nextIds[ep.id] = ep.hikariPlayerEpisodeId ?? "";
          nextThumbs[ep.id] = ep.thumbnail ?? "";
          if (preserveExisting && prevOrigins[ep.id]) {
            nextOrigins[ep.id] = prevOrigins[ep.id];
          } else {
            nextOrigins[ep.id] = resolveInitialThumbnailOrigin(ep.thumbnail);
          }
        }
      }

      latestHikariIdsRef.current = nextIds;
      latestThumbnailValuesRef.current = nextThumbs;
      thumbnailOriginsRef.current = nextOrigins;
      setThumbnailOrigins(nextOrigins);
    },
    [],
  );

  const remoteEpisodeThumbMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const season of remote?.seasons ?? []) {
      for (const ep of season.episodes ?? []) {
        const clean = sanitizeEpisodeThumbnailUrl(ep.thumbnail);
        if (clean) {
          map.set(`${season.number}:${ep.number}`, clean);
        }
      }
    }
    return map;
  }, [remote?.seasons]);

  const getInheritedEpisodeThumbnail = useCallback(
    (seasonNumber: number, ep: Episode): string | undefined => {
      const fromRemote = remoteEpisodeThumbMap.get(`${seasonNumber}:${ep.number}`);
      if (fromRemote) return fromRemote;
      return resolveEpisodeThumbnailUrl({
        videoUrl: ep.videoUrl,
        videoUrl2: ep.videoUrl2,
        videoUrl3: ep.videoUrl3,
        videoUrl4: ep.videoUrl4,
        videoUrl5: ep.videoUrl5,
      });
    },
    [remoteEpisodeThumbMap],
  );

  useEffect(() => subscribeOutbox(setOutboxOps), []);

  const recoverEpisodesFromServer = useCallback(
    async (targetId?: string, forcedResult?: CatalogEpisodesResult) => {
      const effectiveId = targetId || id;
      if (!effectiveId || effectiveId === "new") return;

      setRecoveryState({
        status: "loading",
        message: "Carregando episódios do servidor PostgreSQL...",
      });

      try {
        let result = forcedResult;
        if (!result) {
          const candidateIds = Array.from(
            new Set(
              [effectiveId, formRef.current?.id, remote?.serverCatalogId].filter(
                (cid): cid is string => Boolean(cid && cid !== "new"),
              ),
            ),
          );
          for (const candidateId of candidateIds) {
            const fetched = await getAdminCatalogEpisodes({
              data: { animeId: candidateId },
            });
            result = fetched;
            if (fetched && fetched.episodes.length > 0) {
              break;
            }
          }
        }

        if (!result || !result.episodes || result.episodes.length === 0) {
          setRecoveryState({
            status: "empty",
            message: "Nenhum episódio cadastrado no servidor para este anime.",
            recoveredCount: 0,
          });
          return;
        }

        const mergeAnimeId = result.animeId || formRef.current?.id || effectiveId;
        const currentOps = typeof window !== "undefined" ? readOutbox() : [];
        const baseForm = formRef.current;
        if (baseForm) {
          const mergeResult = mergeAdminEpisodesWithServer({
            animeId: mergeAnimeId,
            localSeasons: baseForm.seasons,
            serverResult: result!,
            outboxOps: currentOps,
          });
          reconcileDirtyEpisodeIdsAfterFormPopulation(
            dirtyEpisodeIdsRef.current,
            mergeResult.seasons,
            result.episodes,
            explicitUserDirtyEpisodeIdsRef.current,
          );
          sourcesSessionRef.current?.setBaselineSlotsFromEpisodes(result.episodes);
          sourcesSessionRef.current?.invalidateAll();
          setSourcesSyncTick((t) => t + 1);
          syncThumbnailOriginsFromSeasons(mergeResult.seasons, { preserveExisting: true });
          setForm({
            ...baseForm,
            seasons: mergeResult.seasons,
          });
        }

        setRecoveryState({
          status: "success",
          message: `Episódios recuperados com sucesso do PostgreSQL (${result.episodes.length} confirmados no banco).`,
          recoveredCount: result.episodes.length,
        });
      } catch (err) {
        console.warn("[admin] Falha ao recuperar episódios do servidor:", err);
        setRecoveryState({
          status: "error",
          message: "Falha ao consultar o servidor PostgreSQL. O catálogo local foi mantido intacto.",
        });
      }
    },
    [id, remote?.serverCatalogId, syncThumbnailOriginsFromSeasons],
  );

  const patchEpisode = useCallback(
    (sid: string, eid: string, patch: Partial<Episode>) => {
      const patchEntries = Object.entries(patch) as Array<
        [keyof Episode, Episode[keyof Episode]]
      >;
      if (patchEntries.length === 0) return;

      if ("hikariPlayerEpisodeId" in patch) {
        latestHikariIdsRef.current[eid] = patch.hikariPlayerEpisodeId ?? "";
      }
      if ("thumbnail" in patch) {
        latestThumbnailValuesRef.current[eid] = patch.thumbnail ?? "";
      }

      const liveSeason = formRef.current?.seasons.find((s) => s.id === sid);
      const liveEp = liveSeason?.episodes.find((e) => e.id === eid);
      if (liveEp) {
        const changedVsRef = patchEntries.some(([k, v]) => !Object.is(liveEp[k], v));
        if (!changedVsRef) {
          return;
        }
      }

      dirtyEpisodeIdsRef.current.add(eid);
      explicitUserDirtyEpisodeIdsRef.current.add(eid);
      setForm((f) => {
        if (!f) return f;
        const sIdx = f.seasons.findIndex((s) => s.id === sid);
        if (sIdx === -1) return f;
        const season = f.seasons[sIdx];
        const eIdx = season.episodes.findIndex((e) => e.id === eid);
        if (eIdx === -1) return f;

        const currentEp = season.episodes[eIdx];
        const hasActualChange = patchEntries.some(
          ([k, v]) => !Object.is(currentEp[k], v),
        );
        if (!hasActualChange) return f;

        const nextEpisodes = season.episodes.slice();
        nextEpisodes[eIdx] = { ...currentEp, ...patch };
        const nextSeasons = f.seasons.slice();
        nextSeasons[sIdx] = { ...season, episodes: nextEpisodes };
        return { ...f, seasons: nextSeasons };
      });
      setAnimeSyncState((prev) => (prev === "synced" ? "local" : prev));
    },
    [],
  );

  if (!hikariThumbManagerRef.current) {
    hikariThumbManagerRef.current = createHikariPlayerThumbnailManager({
      getCurrentEpisodeId: (epId) => {
        if (Object.prototype.hasOwnProperty.call(latestHikariIdsRef.current, epId)) {
          return latestHikariIdsRef.current[epId] ?? null;
        }
        for (const s of formRef.current?.seasons ?? []) {
          const found = s.episodes.find((e) => e.id === epId);
          if (found) return found.hikariPlayerEpisodeId ?? null;
        }
        return null;
      },
      getCurrentThumbnailState: (epId) => {
        for (const s of formRef.current?.seasons ?? []) {
          const found = s.episodes.find((e) => e.id === epId);
          if (found) {
            return {
              thumbnail: found.thumbnail ?? "",
              origin:
                thumbnailOriginsRef.current[epId] ??
                resolveInitialThumbnailOrigin(found.thumbnail),
            };
          }
        }
        return { thumbnail: "", origin: "empty" };
      },
      onStatusChange: (epId, status) => {
        setHikariThumbStatuses((prev) => {
          const next = { ...prev };
          if (status) {
            next[epId] = status;
          } else {
            delete next[epId];
          }
          return next;
        });
      },
      onApplyPoster: (epId, posterUrl) => {
        const seasons = formRef.current?.seasons ?? [];
        for (const s of seasons) {
          if (s.episodes.some((e) => e.id === epId)) {
            patchEpisode(s.id, epId, { thumbnail: posterUrl });
            setEpisodeThumbnailEditMode(epId, "modified");
            setEpisodeThumbnailOrigin(epId, "hikari-player");
            break;
          }
        }
      },
      getAuthHeaders: (): Record<string, string> => {
        const token = getBearerToken();
        if (!token) return {};
        return { Authorization: `Bearer ${token}` };
      },
    });
  }

  if (!thumbInputHikariManagerRef.current) {
    thumbInputHikariManagerRef.current = createHikariPlayerThumbnailManager({
      allowReplacePendingId: true,
      messages: HIKARI_PLAYER_THUMB_INPUT_MESSAGES,
      getCurrentEpisodeId: (epId) => {
        let rawThumb: string | undefined;
        if (Object.prototype.hasOwnProperty.call(latestThumbnailValuesRef.current, epId)) {
          rawThumb = latestThumbnailValuesRef.current[epId];
        } else {
          for (const s of formRef.current?.seasons ?? []) {
            const found = s.episodes.find((e) => e.id === epId);
            if (found) {
              rawThumb = found.thumbnail ?? "";
              break;
            }
          }
        }
        const classification = classifyThumbnailInput(rawThumb);
        return classification.kind === "hikari_player_id" ? classification.id : null;
      },
      getCurrentThumbnailState: (epId) => {
        let rawThumb = "";
        if (Object.prototype.hasOwnProperty.call(latestThumbnailValuesRef.current, epId)) {
          rawThumb = latestThumbnailValuesRef.current[epId] ?? "";
        } else {
          for (const s of formRef.current?.seasons ?? []) {
            const found = s.episodes.find((e) => e.id === epId);
            if (found) {
              rawThumb = found.thumbnail ?? "";
              break;
            }
          }
        }
        return {
          thumbnail: rawThumb,
          origin:
            thumbnailOriginsRef.current[epId] ??
            resolveInitialThumbnailOrigin(rawThumb),
        };
      },
      onStatusChange: (epId, status) => {
        setThumbInputHikariStatuses((prev) => {
          const next = { ...prev };
          if (status) {
            next[epId] = status;
          } else {
            delete next[epId];
          }
          return next;
        });
      },
      onApplyPoster: (epId, posterUrl) => {
        const seasons = formRef.current?.seasons ?? [];
        for (const s of seasons) {
          if (s.episodes.some((e) => e.id === epId)) {
            patchEpisode(s.id, epId, { thumbnail: posterUrl });
            setEpisodeThumbnailEditMode(epId, "modified");
            setEpisodeThumbnailOrigin(epId, "hikari-player");
            break;
          }
        }
      },
      getAuthHeaders: (): Record<string, string> => {
        const token = getBearerToken();
        if (!token) return {};
        return { Authorization: `Bearer ${token}` };
      },
    });
  }

  useEffect(() => {
    return () => {
      hikariThumbManagerRef.current?.dispose();
      thumbInputHikariManagerRef.current?.dispose();
    };
  }, []);

  const handleLookupHikariPlayerThumbnail = useCallback(
    (episodeId: string, rawHikariPlayerId: string) => {
      void hikariThumbManagerRef.current?.lookup(episodeId, rawHikariPlayerId);
    },
    [],
  );

  const handleCancelHikariPlayerThumbnailLookup = useCallback(
    (episodeId: string, clearStatus = true) => {
      hikariThumbManagerRef.current?.cancel(episodeId, { clearStatus });
    },
    [],
  );

  const handleLookupThumbnailHikariPlayer = useCallback(
    (episodeId: string, rawHikariPlayerId: string) => {
      void thumbInputHikariManagerRef.current?.lookup(episodeId, rawHikariPlayerId);
    },
    [],
  );

  const handleCancelThumbnailHikariPlayerLookup = useCallback(
    (episodeId: string, clearStatus = true) => {
      thumbInputHikariManagerRef.current?.cancel(episodeId, { clearStatus });
    },
    [],
  );

  const handleFetchOpeningSuggestions = useCallback(async () => {
    const currentForm = formRef.current;
    if (!currentForm) return;

    const malId = currentForm.malId ?? null;
    const anilistId = currentForm.anilistId ?? null;
    const kitsuId = currentForm.kitsuId ?? null;

    if (!malId && !anilistId && !kitsuId) {
      toast.error(
        "Este anime precisa de MAL ID, AniList ID ou Kitsu ID cadastrado para buscar sugestões de opening.",
      );
      return;
    }

    const seenKeys = new Set<string>();
    const episodeQueries: Array<{
      seasonNumber: number;
      episodeNumber: number;
      episodeLengthSeconds: number;
    }> = [];
    const previousSeasonMaxEpisodes: Record<number, number> = {};
    let runningMaxEp = 0;

    const sortedSeasons = [...currentForm.seasons].sort((a, b) => a.number - b.number);
    for (const season of sortedSeasons) {
      previousSeasonMaxEpisodes[season.number] = runningMaxEp;
      for (const ep of season.episodes) {
        if (!ep.number || ep.number <= 0) continue;
        if (ep.number > runningMaxEp) {
          runningMaxEp = ep.number;
        }
        const key = getOpeningSuggestionKey(season.number, ep.number);
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        episodeQueries.push({
          seasonNumber: season.number,
          episodeNumber: ep.number,
          episodeLengthSeconds: parseReliableEpisodeDurationSeconds(ep.duration),
        });
      }
    }

    if (episodeQueries.length === 0) {
      toast.error("Nenhum episódio encontrado para consultar sugestões.");
      return;
    }

    setIsFetchingOpening(true);
    toast.info("Consultando sugestões de opening (AniSkip → TheIntroDB → IntroDB)...");

    try {
      const CHUNK_SIZE = 25;
      let totalFound = 0;
      let totalTransientErrors = 0;

      for (let i = 0; i < episodeQueries.length; i += CHUNK_SIZE) {
        const chunk = episodeQueries.slice(i, i + CHUNK_SIZE);
        const res = await fetch("/api/admin/opening-suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            malId,
            anilistId,
            kitsuId,
            episodes: chunk,
            previousSeasonMaxEpisodes,
          }),
        });

        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error || `Erro HTTP ${res.status}`);
        }

        const data = (await res.json()) as {
          suggestionsByKey?: Record<string, OpeningSuggestionEntry>;
        };

        const incoming = data.suggestionsByKey || {};
        for (const item of Object.values(incoming)) {
          if (item.found) totalFound += 1;
          else if (
            item.status === "rate_limited" ||
            item.status === "timeout" ||
            item.status === "error"
          ) {
            totalTransientErrors += 1;
          }
        }

        // Atualiza apenas as sugestões exibidas para revisão manual (nunca altera form/timestamps silenciosamente)
        setOpeningSuggestions((prev) => mergeLoadedOpeningSuggestions(prev, incoming));
      }

      if (totalFound > 0) {
        toast.success(
          `${totalFound} sugestão(ões) de opening encontrada(s). Revise e clique em "Aplicar sugestão" para aprovar.`,
        );
      } else if (totalTransientErrors > 0) {
        toast.warning(
          "Algumas fontes falharam temporariamente ou atingiram limite. Tente novamente em instantes.",
        );
      } else {
        toast.info("Nenhuma sugestão de opening encontrada nas fontes consultadas.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao buscar sugestões de opening.");
    } finally {
      setIsFetchingOpening(false);
    }
  }, []);

  const handleApplyOpeningSuggestion = useCallback(
    (
      seasonId: string,
      episodeId: string,
      start: number | null,
      end: number | null,
    ) => {
      if (
        typeof start !== "number" ||
        typeof end !== "number" ||
        start < 0 ||
        end <= start
      ) {
        toast.error("Sugestão inválida para aplicação.");
        return;
      }
      patchEpisode(seasonId, episodeId, {
        openingStartSeconds: start,
        openingEndSeconds: end,
      });
      toast.success("Sugestão de opening aplicada! Clique em Salvar para gravar no banco.");
    },
    [patchEpisode],
  );

  const handleDiscardOpeningSuggestion = useCallback(
    (seasonNumber: number, episodeNumber: number) => {
      setOpeningSuggestions((prev) => discardOpeningSuggestion(prev, seasonNumber, episodeNumber));
    },
    [],
  );

  const handleDiscoverEpisodeThumbnails = useCallback(
    async (
      sid: string,
      ep: Episode,
      forcedUrl?: string,
      options?: { force?: boolean },
    ) => {
      const liveSeason = formRef.current?.seasons.find((s) => s.id === sid);
      const liveEp = liveSeason?.episodes.find((e) => e.id === ep.id) ?? ep;
      const rawCandidates = forcedUrl
        ? [forcedUrl.trim()]
        : [
            liveEp.videoUrl,
            liveEp.videoUrl2,
            liveEp.videoUrl3,
            liveEp.videoUrl4,
            liveEp.videoUrl5,
          ];
      const videoUrl = normalizeVideoProbeUrl(
        rawCandidates.find((u) => isPersistablePlayableVideoUrl(u)),
      );

      if (!videoUrl) {
        if (!forcedUrl) {
          toast.error("Insira uma URL de vídeo válida antes de buscar as imagens.");
        }
        return;
      }

      // Evita reprocessar automaticamente a mesma URL já consultada (mesmo em warning/erro); retry exige force=true
      const existingState = episodeCandidatesRef.current[ep.id];
      if (
        !shouldRunAutoThumbnailProbe(
          existingState,
          videoUrl,
          Boolean(options?.force),
        )
      ) {
        return;
      }

      const prevTask = candidateTasksRef.current.get(ep.id);
      const nextGeneration = (prevTask?.generation ?? 0) + 1;
      revokeEpisodePreviewUrls(ep.id);

      const controller = new AbortController();
      candidateTasksRef.current.set(ep.id, {
        generation: nextGeneration,
        controller,
        previewUrls: [],
      });

      setEpisodeCandidates((prev) => ({
        ...prev,
        [ep.id]: {
          loading: true,
          candidates: [],
          sourceUrl: videoUrl,
          selectedCandidateId: prev[ep.id]?.selectedCandidateId ?? null,
        },
      }));

      try {
        const { candidates, warning } = await extractVideoThumbnailCandidates(videoUrl, {
          maxCandidates: 6,
          signal: controller.signal,
        });

        const currentTask = candidateTasksRef.current.get(ep.id);
        if (!currentTask || currentTask.generation !== nextGeneration || controller.signal.aborted) {
          for (const c of candidates) {
            if (c.previewUrl.startsWith("blob:")) {
              URL.revokeObjectURL(c.previewUrl);
            }
          }
          return;
        }

        currentTask.previewUrls = candidates
          .map((c) => c.previewUrl)
          .filter((u) => u.startsWith("blob:"));

        setEpisodeCandidates((prev) => ({
          ...prev,
          [ep.id]: {
            loading: false,
            candidates,
            warning,
            sourceUrl: videoUrl,
            selectedCandidateId: prev[ep.id]?.selectedCandidateId ?? null,
          },
        }));
      } catch (err) {
        const currentTask = candidateTasksRef.current.get(ep.id);
        if (!currentTask || currentTask.generation !== nextGeneration || controller.signal.aborted) {
          return;
        }
        const errMsg =
          err instanceof Error
            ? err.message
            : "Não foi possível extrair imagens deste vídeo.";
        setEpisodeCandidates((prev) => ({
          ...prev,
          [ep.id]: {
            loading: false,
            candidates: [],
            error: errMsg,
            sourceUrl: videoUrl,
          },
        }));
      }
    },
    [revokeEpisodePreviewUrls],
  );

  const handleSelectEpisodeCandidate = useCallback(
    async (sid: string, ep: Episode, candidate: VideoThumbnailCandidate) => {
      const liveSeason = formRef.current?.seasons.find((s) => s.id === sid);
      const liveEp = liveSeason?.episodes.find((e) => e.id === ep.id) ?? ep;

      setEpisodeCandidates((prev) => {
        const curr = prev[ep.id];
        if (!curr) return prev;
        return {
          ...prev,
          [ep.id]: {
            ...curr,
            selectingCandidateId: candidate.id,
          },
        };
      });

      try {
        let finalUrl = candidate.remoteUrl?.trim();
        if (!finalUrl && candidate.blob) {
          finalUrl = await uploadThumbnailBlob(
            candidate.blob,
            liveEp.title || `episodio-${liveEp.number}`,
          );
        }

        if (!finalUrl) {
          throw new Error("A imagem selecionada não pôde ser preparada para salvamento.");
        }

        thumbInputHikariManagerRef.current?.cancel(ep.id, { clearStatus: true });
        patchEpisode(sid, ep.id, { thumbnail: finalUrl });
        setEpisodeThumbnailEditMode(ep.id, "modified");
        setEpisodeThumbnailOrigin(ep.id, "manual");

        setEpisodeCandidates((prev) => {
          const curr = prev[ep.id];
          if (!curr) return prev;
          return {
            ...prev,
            [ep.id]: {
              ...curr,
              selectingCandidateId: null,
              selectedCandidateId: candidate.id,
            },
          };
        });

        setCaptureStatus((prev) => ({
          ...prev,
          [ep.id]: {
            status: "success",
            message: `Miniatura (${candidate.label}) aplicada ao Episódio ${liveEp.number}.`,
          },
        }));
        toast.success(`Imagem (${candidate.label}) aplicada ao Episódio ${liveEp.number}!`);
      } catch (err) {
        const errMsg =
          err instanceof Error ? err.message : "Falha ao aplicar a imagem escolhida.";
        setEpisodeCandidates((prev) => {
          const curr = prev[ep.id];
          if (!curr) return prev;
          return {
            ...prev,
            [ep.id]: {
              ...curr,
              selectingCandidateId: null,
            },
          };
        });
        setCaptureStatus((prev) => ({
          ...prev,
          [ep.id]: {
            status: "error",
            message: errMsg,
          },
        }));
        toast.error(`Erro ao aplicar imagem (Ep. ${liveEp.number}): ${errMsg}`);
      }
    },
    [patchEpisode, setEpisodeThumbnailEditMode, setEpisodeThumbnailOrigin],
  );

  const handleCaptureEpisodeFrame = useCallback(
    async (
      sid: string,
      ep: Episode,
      forcedUrl?: string,
      options?: { isAuto?: boolean },
    ) => {
      const isAuto = Boolean(options?.isAuto);
      if (isAuto) {
        await handleDiscoverEpisodeThumbnails(sid, ep, forcedUrl, { force: false });
        return;
      }

      const liveSeason = formRef.current?.seasons.find((s) => s.id === sid);
      const liveEp = liveSeason?.episodes.find((e) => e.id === ep.id) ?? ep;

      const videoUrl =
        forcedUrl ||
        liveEp.videoUrl ||
        liveEp.videoUrl2 ||
        liveEp.videoUrl3 ||
        liveEp.videoUrl4 ||
        liveEp.videoUrl5;

      if (!videoUrl || !hasEpisodePlayableSource({ videoUrl })) {
        toast.error("Insira uma URL de vídeo válida antes de capturar a miniatura.");
        return;
      }

      const thumbAtStart = liveEp.thumbnail?.trim() ?? "";

      setCaptureStatus((prev) => ({
        ...prev,
        [ep.id]: {
          status: "loading",
          message: "Capturando miniatura do vídeo...",
        },
      }));

      try {
        const res = await captureAndUploadThumbnail(videoUrl, {
          episodeTitle: liveEp.title || `Episódio ${liveEp.number}`,
        });

        const latestEp = formRef.current?.seasons
          .find((s) => s.id === sid)
          ?.episodes.find((e) => e.id === ep.id);
        const latestThumb = latestEp?.thumbnail?.trim() ?? "";

        if (latestThumb && latestThumb !== thumbAtStart) {
          setCaptureStatus((prev) => {
            const next = { ...prev };
            delete next[ep.id];
            return next;
          });
          return;
        }

        thumbInputHikariManagerRef.current?.cancel(ep.id, { clearStatus: true });
        patchEpisode(sid, ep.id, { thumbnail: res.url });
        setEpisodeThumbnailEditMode(ep.id, "modified");
        setEpisodeThumbnailOrigin(ep.id, "manual");
        setCaptureStatus((prev) => ({
          ...prev,
          [ep.id]: {
            status: "success",
            message: "Miniatura capturada e salva com sucesso!",
          },
        }));
        toast.success(`Miniatura do Episódio ${liveEp.number} salva!`);
      } catch (err) {
        const errMsg =
          err instanceof Error ? err.message : "Falha na captura do quadro do vídeo.";
        setCaptureStatus((prev) => ({
          ...prev,
          [ep.id]: {
            status: "error",
            message: errMsg,
          },
        }));
        toast.error(`Falha na captura (Ep. ${liveEp.number}): ${errMsg}`);
      }
    },
    [
      handleDiscoverEpisodeThumbnails,
      patchEpisode,
      setEpisodeThumbnailEditMode,
      setEpisodeThumbnailOrigin,
    ],
  );

  const handleUploadVideoToB2 = useCallback(
    async (
      sid: string,
      ep: Episode,
      key: "videoUrl" | "videoUrl2" | "videoUrl3",
    ) => {
      const uploadId = `${ep.id}-${key}`;
      setUploadingEpisode(uploadId);
      try {
        await uploadVideoToB2((url) => {
          patchEpisode(sid, ep.id, { [key]: url });
          toast.success(`Vídeo enviado com sucesso para ${key}!`);

          const liveSeason = formRef.current?.seasons.find((s) => s.id === sid);
          const liveEp = liveSeason?.episodes.find((e) => e.id === ep.id) ?? ep;
          void handleDiscoverEpisodeThumbnails(sid, liveEp, url, { force: false });
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Falha no upload.");
      } finally {
        setUploadingEpisode(null);
      }
    },
    [patchEpisode, handleDiscoverEpisodeThumbnails],
  );

  useEffect(() => {
    if (!hydrated || isSavingRef.current) return;

    const routeKey = `${id}:${importId ?? ""}`;
    const isRouteChange = initializedRouteKeyRef.current !== routeKey;
    const isNewServerData = lastServerEpisodesRef.current !== serverEpisodes;

    if (!isRouteChange && !isNewServerData) {
      return;
    }

    lastServerEpisodesRef.current = serverEpisodes;

    if (!isRouteChange) {
      // Atualização incremental de serverEpisodes (ex: após router.invalidate())
      if (id !== "new" && serverEpisodes) {
        if (serverEpisodes.episodes.length > 0) {
          const currentOps = typeof window !== "undefined" ? readOutbox() : [];
          const baseForm = formRef.current;
          if (baseForm) {
            const mergeResult = mergeAdminEpisodesWithServer({
              animeId: serverEpisodes.animeId || baseForm.id || id,
              localSeasons: baseForm.seasons,
              serverResult: serverEpisodes,
              outboxOps: currentOps,
            });
            reconcileDirtyEpisodeIdsAfterFormPopulation(
              dirtyEpisodeIdsRef.current,
              mergeResult.seasons,
              serverEpisodes.episodes,
              explicitUserDirtyEpisodeIdsRef.current,
            );
            sourcesSessionRef.current?.setBaselineSlotsFromEpisodes(
              serverEpisodes.episodes,
            );
            sourcesSessionRef.current?.invalidateEpisodes(
              serverEpisodes.episodes.map((ep) => ep.id),
            );
            setSourcesSyncTick((t) => t + 1);
            syncThumbnailOriginsFromSeasons(mergeResult.seasons, { preserveExisting: true });
            setForm({
              ...baseForm,
              seasons: mergeResult.seasons,
            });
          }
          setRecoveryState({
            status: "success",
            message: `Episódios recuperados com sucesso do PostgreSQL (${serverEpisodes.episodes.length} confirmados no banco).`,
            recoveredCount: serverEpisodes.episodes.length,
          });
        } else {
          if (formRef.current) {
            reconcileDirtyEpisodeIdsAfterFormPopulation(
              dirtyEpisodeIdsRef.current,
              formRef.current.seasons,
              [],
              explicitUserDirtyEpisodeIdsRef.current,
            );
          }
          setRecoveryState({
            status: "empty",
            message: "Nenhum episódio cadastrado no servidor para este anime.",
            recoveredCount: 0,
          });
        }
      }
      return;
    }

    initializedRouteKeyRef.current = routeKey;
    sourcesSessionRef.current?.reset();
    setSourcesSyncTick((t) => t + 1);
    thumbnailEditModesRef.current = {};
    setThumbnailEditModes({});
    setHikariThumbStatuses({});
    latestHikariIdsRef.current = {};
    setThumbInputHikariStatuses({});
    latestThumbnailValuesRef.current = {};
    dirtyEpisodeIdsRef.current = new Set();
    explicitUserDirtyEpisodeIdsRef.current = new Set();
    dirtyMediaRef.current = { cover: false, banner: false };
    revokeAllCandidatePreviewUrls();

    const isDubbedTitle = (a: LocalAnime) =>
      /\b(dub|dublado|dublada)\b/i.test(
        `${a.titleRomaji} ${a.titleEnglish} ${a.titleNative}`,
      );

    const findByExternalIds = () =>
      (remote?.anilistId
        ? stored.find((a) => a.anilistId === remote.anilistId && !isDubbedTitle(a)) ||
          stored.find((a) => a.anilistId === remote.anilistId)
        : undefined) ||
      (remote?.kitsuId
        ? stored.find((a) => a.kitsuId === remote.kitsuId && !isDubbedTitle(a)) ||
          stored.find((a) => a.kitsuId === remote.kitsuId)
        : undefined) ||
      (remote?.malId
        ? stored.find((a) => a.malId === remote.malId && !isDubbedTitle(a)) ||
          stored.find((a) => a.malId === remote.malId)
        : undefined);

    const storedMatch =
      id === "new"
        ? (remote?.serverCatalogId
            ? stored.find((a) => a.id === remote.serverCatalogId)
            : undefined) || findByExternalIds()
        : stored.find((a) => a.id === id) ||
          (remote?.serverCatalogId
            ? stored.find((a) => a.id === remote.serverCatalogId)
            : undefined) ||
          findByExternalIds();

    const resolvedFromRemote = resolveAdminAnimeWithRemote(storedMatch, remote);
    const base =
      resolvedFromRemote ?? {
        ...emptyLocal(),
        id: id !== "new" ? id : `local-${crypto.randomUUID()}`,
      };

    if (id !== "new" && serverEpisodes && serverEpisodes.episodes.length > 0) {
      const currentOps = typeof window !== "undefined" ? readOutbox() : [];
      const mergeAnimeId =
        serverEpisodes.animeId || (base.id !== "new" ? base.id : id);
      const mergeResult = mergeAdminEpisodesWithServer({
        animeId: mergeAnimeId,
        localSeasons: base.seasons,
        serverResult: serverEpisodes,
        outboxOps: currentOps,
      });

      reconcileDirtyEpisodeIdsAfterFormPopulation(
        dirtyEpisodeIdsRef.current,
        mergeResult.seasons,
        serverEpisodes.episodes,
        explicitUserDirtyEpisodeIdsRef.current,
      );
      sourcesSessionRef.current?.setBaselineSlotsFromEpisodes(
        serverEpisodes.episodes,
      );
      syncThumbnailOriginsFromSeasons(mergeResult.seasons);
      setForm({
        ...base,
        seasons: mergeResult.seasons,
      });
      setGenreText(base.genres.join(", "));
      setAnimeSyncState("synced");
      setRecoveryState({
        status: "success",
        message: `Episódios recuperados com sucesso do PostgreSQL (${serverEpisodes.episodes.length} confirmados no banco).`,
        recoveredCount: serverEpisodes.episodes.length,
      });
    } else {
      reconcileDirtyEpisodeIdsAfterFormPopulation(
        dirtyEpisodeIdsRef.current,
        base.seasons,
        serverEpisodes?.episodes ?? [],
        explicitUserDirtyEpisodeIdsRef.current,
      );
      if (base.syncedAt && base.syncedAt >= (base.updatedAt ?? 0)) {
        sourcesSessionRef.current?.setBaselineSlotsFromSeasons(base.seasons);
      }
      syncThumbnailOriginsFromSeasons(base.seasons);
      setForm(base);
      setGenreText(base.genres.join(", "));
      if (base.syncedAt && base.syncedAt >= (base.updatedAt ?? 0)) {
        setAnimeSyncState("synced");
      } else {
        setAnimeSyncState("local");
      }

      if (id !== "new") {
        void recoverEpisodesFromServer(id);
      } else {
        setRecoveryState({ status: "idle" });
      }
    }
  }, [
    hydrated,
    stored,
    id,
    importId,
    remote,
    serverEpisodes,
    recoverEpisodesFromServer,
    revokeAllCandidatePreviewUrls,
    syncThumbnailOriginsFromSeasons,
  ]);

  const formLoaded = Boolean(form);
  const formBannerValue = form?.banner;
  const formCoverValue = form?.cover;
  const formAnilistId = form?.anilistId;
  const formMalId = form?.malId;
  const formKitsuId = form?.kitsuId;
  const formYear = form?.year;
  const formFormat = form?.format;
  const formStatus = form?.status;

  useEffect(() => {
    if (!remote && !formBannerValue && !formAnilistId && !formKitsuId && !formMalId) {
      setClientMobileBanner(null);
      return;
    }

    const activeLocal = formLoaded
      ? ({
          banner: formBannerValue ?? "",
        } as LocalAnime)
      : null;
    const isCustomAdmin = hasAdminCustomBanner(activeLocal, remote);
    if (isCustomAdmin) {
      setClientMobileBanner(null);
      return;
    }

    if (remote?.resolvedMobileBanner?.url && remote.resolvedMobileBanner.source !== "none") {
      setClientMobileBanner(remote.resolvedMobileBanner);
      return;
    }

    const targetAnimeId =
      remote?.id ||
      (formAnilistId ? String(formAnilistId) : undefined) ||
      (formKitsuId ? `kitsu-${formKitsuId}` : undefined) ||
      (formMalId ? `mal-${formMalId}` : undefined) ||
      id;

    if (!targetAnimeId || targetAnimeId === "new" || targetAnimeId.startsWith("local-")) {
      setClientMobileBanner(null);
      return;
    }

    const bannerInput = {
      animeId: targetAnimeId,
      anilistId: remote?.anilistId ?? formAnilistId,
      malId: remote?.malId ?? formMalId,
      kitsuId: remote?.kitsuId ?? formKitsuId,
      year: remote?.year ?? formYear ?? null,
      startYear: remote?.startDate?.year ?? remote?.year ?? formYear ?? null,
      format: remote?.format ?? formFormat ?? null,
      status: remote?.status ?? formStatus ?? null,
      currentBanner: remote?.banner ?? formBannerValue ?? null,
      currentCover: remote?.cover ?? formCoverValue ?? null,
      isAdminCustomBanner: false,
      preloadedMalPictures: remote?.images,
    };

    const syncResolved = resolveSeasonMobileBannerSync(bannerInput);
    if (syncResolved?.url) {
      setClientMobileBanner(syncResolved);
      return;
    }

    const controller = new AbortController();
    void resolveSeasonMobileBanner(bannerInput, controller.signal).then((resolved) => {
      if (controller.signal.aborted) return;
      if (resolved?.url && resolved.source !== "none") {
        setClientMobileBanner(resolved);
      }
    });

    return () => {
      controller.abort();
    };
  }, [
    id,
    remote,
    formLoaded,
    formBannerValue,
    formCoverValue,
    formAnilistId,
    formMalId,
    formKitsuId,
    formYear,
    formFormat,
    formStatus,
  ]);

  const displayMedia = useMemo(
    () =>
      form
        ? resolveAdminDisplayMedia(form, remote, clientMobileBanner)
        : null,
    [form, remote, clientMobileBanner],
  );

  const set = useCallback(<K extends keyof LocalAnime>(key: K, value: LocalAnime[K]) => {
    if (key === "cover") {
      dirtyMediaRef.current.cover = true;
    } else if (key === "banner") {
      dirtyMediaRef.current.banner = true;
    }
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setAnimeSyncState((prev) => (prev === "synced" ? "local" : prev));
  }, []);

  const handleGenreTextChange = useCallback((val: string) => {
    setGenreText(val);
    setAnimeSyncState((prev) => (prev === "synced" ? "local" : prev));
  }, []);

  const duplicateAsDubbed = useCallback(() => {
    const currentForm = formRef.current;
    if (!currentForm) return;

    const newId = `local-${crypto.randomUUID()}`;
    const baseTitleRomaji = currentForm.titleRomaji
      ? `${currentForm.titleRomaji} Dublado`
      : "";
    const baseTitleEnglish = currentForm.titleEnglish
      ? `${currentForm.titleEnglish} Dublado`
      : "";

    const clonedSeasons: Season[] = currentForm.seasons.map((s) => ({
      id: `s-${crypto.randomUUID()}`,
      number: s.number,
      title: s.title,
      episodes: s.episodes.map((e) => ({
        id: `e-${crypto.randomUUID()}`,
        number: e.number,
        title: e.title,
        duration: e.duration,
        thumbnail: e.thumbnail,
        synopsis: e.synopsis,
        audio: "dub" as const,
        videoUrl: "",
        videoUrl2: "",
        videoUrl3: "",
        videoUrl4: "",
        videoUrl5: "",
        hikariPlayerEpisodeId: undefined,
        recentBadges: { lancamento: false, novo: false, final: false },
        published: false,
      })),
    }));

    const duplicated: LocalAnime = {
      ...currentForm,
      id: newId,
      countryOfOrigin: currentForm.countryOfOrigin ?? null,
      duplicateOfId: currentForm.serverCatalogId || currentForm.id,
      titleRomaji: baseTitleRomaji || currentForm.titleRomaji,
      titleEnglish: baseTitleEnglish || currentForm.titleEnglish,
      seasons:
        clonedSeasons.length > 0
          ? clonedSeasons
          : [
              {
                id: `s-${crypto.randomUUID()}`,
                number: 1,
                title: "Temporada 1",
                episodes: [],
              },
            ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    upsertAnime(duplicated);
    toast.success("Cadastro independente criado para a versão dublada!");
    void navigate({ to: "/admin/$id", params: { id: newId } });
  }, [upsertAnime, navigate]);

  const handleDeleteAnime = useCallback(async () => {
    const currentForm = formRef.current;
    if (!currentForm) return;

    try {
      const token = getBearerToken();
      const res = await fetch(
        `/api/admin/catalog-anime?id=${encodeURIComponent(currentForm.id)}`,
        {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          credentials: "include",
        },
      );

      if (!res.ok) {
        let errMsg = res.statusText;
        try {
          const json = await res.json();
          errMsg = json.error || errMsg;
        } catch {
          errMsg = res.statusText || errMsg;
        }
        toast.error(
          `Falha ao excluir anime no servidor (${res.status}): ${errMsg}. O anime foi preservado localmente.`,
        );
        return;
      }
    } catch (err) {
      const currentSyncState = animeSyncStateRef.current;
      const isSyncedOnServer =
        !currentForm.id.startsWith("local-") ||
        currentSyncState === "synced" ||
        Boolean(currentForm.syncedAt) ||
        Boolean(currentForm.serverCatalogId);
      console.warn("[admin] Erro de rede ao deletar anime no servidor:", err);
      if (isSyncedOnServer) {
        toast.error(
          "Servidor indisponível. O anime foi preservado localmente para evitar divergência.",
        );
        return;
      }
    }

    // Limpa operações pendentes no outbox para este anime
    if (typeof window !== "undefined") {
      try {
        const existingOps = readOutbox();
        const filteredOps = existingOps.filter((op) => op.animeId !== currentForm.id);
        writeOutbox(filteredOps);
        setOutboxOps(filteredOps);
      } catch (e) {
        console.warn("[admin] Erro ao limpar outbox do anime:", e);
      }
    }

    removeAnime(currentForm.id);
    toast.success("Anime excluído com sucesso do servidor e do dispositivo.");
    void navigate({ to: "/admin" });
  }, [removeAnime, navigate]);

  const save = useCallback(async () => {
    const currentForm = formRef.current;
    if (!currentForm || isSavingRef.current) return;

    const currentRouteId = idRef.current;
    const currentImportId = importIdRef.current;

    const genres = genreTextRef.current
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean);

    const next: LocalAnime = {
      ...currentForm,
      genres,
      trailerId: youtubeIdFrom(currentForm.trailerId) ?? (currentForm.trailerId || null),
      updatedAt: Date.now(),
    };

    if (!next.titleRomaji && !next.titleEnglish && !next.titleNative) {
      toast.error("Dê um título ao anime.");
      return;
    }

    // Validação pré-salvamento: episódio marcado como Publicado exige ao menos 1 fonte válida
    // (URL válida de Player 1 a Player 5 ou ID válido do Hikari Player)
    for (const season of next.seasons) {
      for (const ep of season.episodes) {
        const hasValidUrlSource = [
          ep.videoUrl,
          ep.videoUrl2,
          ep.videoUrl3,
          ep.videoUrl4,
          ep.videoUrl5,
        ].some(isPersistablePlayableVideoUrl);
        const hikariPlayerValidation = validateHikariPlayerEpisodeId(
          ep.hikariPlayerEpisodeId,
        );
        if (!hikariPlayerValidation.valid && !hasValidUrlSource) {
          toast.error(
            `Não foi possível salvar: Episódio ${ep.number} (Temporada ${season.number}) — ${hikariPlayerValidation.error}`,
          );
          return;
        }
        if (ep.published === true && !hasEpisodePlayableSource(ep)) {
          toast.error(
            `Não foi possível salvar: o Episódio ${ep.number} (Temporada ${season.number}) está marcado como Publicado sem nenhuma fonte de reprodução válida (Player 1 a Player 5 ou ID válido do Hikari Player).`,
          );
          return;
        }
      }
    }

    isSavingRef.current = true;
    setIsSaving(true);
    setAnimeSyncState("pending");

    let effectiveAnime: LocalAnime = {
      ...next,
      cover: stripCatalogImageVersion(next.cover),
      banner: stripCatalogImageVersion(next.banner),
      seasons: next.seasons.map((season) => ({
        ...season,
        episodes: season.episodes.map((ep) => {
          const hikariValidation = validateHikariPlayerEpisodeId(
            ep.hikariPlayerEpisodeId,
          );
          const rawThumb = ep.thumbnail?.trim() || "";
          const safeThumbnail =
            rawThumb && !isHikariPlayerIdThumbnailCandidate(rawThumb)
              ? rawThumb
              : undefined;
          return {
            ...ep,
            thumbnail: safeThumbnail,
            hikariPlayerEpisodeId: hikariValidation.valid
              ? hikariValidation.value ?? undefined
              : undefined,
          };
        }),
      })),
    };

    // 1. Persistência local imediata (IndexedDB via Zustand)
    upsertAnime(effectiveAnime);

    let metadataSavedOnServer = false;
    let allEpisodesSynced = true;
    let serverErrorStatus: number | null = null;
    let serverErrorMessage = "";

    // 2. Persistência no servidor (await com validação de status HTTP)
    try {
      const token = getBearerToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const savePayload = buildAdminCatalogAnimeSavePayload(
        effectiveAnime,
        dirtyMediaRef.current,
      );
      const shouldSendCover = savePayload.coverExplicitlyEdited;
      const shouldSendBanner = savePayload.bannerExplicitlyEdited;

      const res = await fetch("/api/admin/catalog-anime", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(savePayload),
      });

      if (res.ok) {
        metadataSavedOnServer = true;
        dirtyMediaRef.current = { cover: false, banner: false };
        try {
          const json = (await res.json()) as {
            animeId?: string;
            cover?: string | null;
            banner?: string | null;
            updatedAt?: number;
          };
          const canonicalId =
            typeof json.animeId === "string" && json.animeId.trim()
              ? json.animeId.trim()
              : effectiveAnime.id;
          const serverUpdatedAt =
            typeof json.updatedAt === "number" && Number.isFinite(json.updatedAt) && json.updatedAt > 0
              ? json.updatedAt
              : effectiveAnime.updatedAt;
          const canonicalCover = resolveSavedMediaFromServer(
            effectiveAnime.cover,
            typeof json.cover === "string" ? stripCatalogImageVersion(json.cover) : json.cover,
            shouldSendCover,
          );
          const canonicalBanner = resolveSavedMediaFromServer(
            effectiveAnime.banner,
            typeof json.banner === "string" ? stripCatalogImageVersion(json.banner) : json.banner,
            shouldSendBanner,
          );

          if (canonicalId !== effectiveAnime.id) {
            if (typeof window !== "undefined") {
              const currentOps = readOutbox();
              const remapped = currentOps.map((op) =>
                op.animeId === effectiveAnime.id ? { ...op, animeId: canonicalId } : op,
              );
              writeOutbox(remapped);
              setOutboxOps(remapped);
            }
            removeAnime(effectiveAnime.id);
          }

          effectiveAnime = {
            ...effectiveAnime,
            id: canonicalId,
            serverCatalogId: canonicalId,
            cover: canonicalCover,
            banner: canonicalBanner,
            updatedAt: serverUpdatedAt,
            syncedAt: Date.now(),
          };
          upsertAnime(effectiveAnime);
          setForm(effectiveAnime);
        } catch {
          // resposta sem JSON detalhado
        }
      } else {
        serverErrorStatus = res.status;
        try {
          const json = await res.json();
          serverErrorMessage = json.error || "";
        } catch {
          serverErrorMessage = res.statusText || "";
        }
      }
    } catch (err) {
      console.warn("[admin] Erro de rede ao persistir metadados no servidor:", err);
      serverErrorStatus = 0;
    }

    if (!metadataSavedOnServer) {
      if (serverErrorStatus === 401 || serverErrorStatus === 403) {
        setAnimeSyncState("conflict");
        toast.error(
          "Não autorizado: sessão expirada ou permissão insuficiente no servidor. Alterações salvas localmente.",
        );
      } else if (serverErrorStatus === 400 || serverErrorStatus === 409) {
        setAnimeSyncState("conflict");
        toast.warning(
          `Conflito de validação: ${serverErrorMessage || "dados rejeitados pelo servidor"}. Salvo apenas no dispositivo.`,
        );
      } else if (serverErrorStatus === 500) {
        setAnimeSyncState("error");
        toast.error(
          `Falha no servidor (500): ${serverErrorMessage || "erro interno"}. Salvo com segurança neste dispositivo.`,
        );
      } else {
        setAnimeSyncState("error");
        toast.info(
          "Servidor indisponível: metadados salvos localmente com segurança neste dispositivo.",
        );
      }
    }

    // 3. Persistência seletiva 1-para-1 apenas dos episódios alterados, adicionados ou pendentes no outbox
    try {
      const animeTitleLabel =
        effectiveAnime.titleRomaji ||
        effectiveAnime.titleEnglish ||
        effectiveAnime.titleNative ||
        "Anime";
      const existingOutboxIds = new Set(
        (typeof window !== "undefined" ? readOutbox() : [])
          .filter(
            (op) =>
              op.type === "upsert" &&
              (op.animeId === effectiveAnime.id || op.animeId === currentForm.id),
          )
          .map((op) => op.episodeId),
      );
      const episodeTasks: Array<{
        seasonId: string;
        episodeId: string;
        run: () => Promise<PersistEpisodeResult>;
      }> = [];
      for (const season of effectiveAnime.seasons) {
        for (const ep of season.episodes) {
          const thumbMode = thumbnailEditModesRef.current[ep.id];
          const liveRawThumb =
            formRef.current?.seasons
              .find((s) => s.id === season.id)
              ?.episodes.find((e) => e.id === ep.id)?.thumbnail ?? ep.thumbnail;
          const isUnresolvedThumbId =
            isHikariPlayerIdThumbnailCandidate(liveRawThumb);
          const shouldReplaceThumb =
            !isUnresolvedThumbId &&
            (thumbMode === "modified" || thumbMode === "cleared");
          const isDirtyEpisode =
            dirtyEpisodeIdsRef.current.has(ep.id) ||
            existingOutboxIds.has(ep.id) ||
            shouldReplaceThumb;

          if (!isDirtyEpisode) {
            continue;
          }

          episodeTasks.push({
            seasonId: season.id,
            episodeId: ep.id,
            run: () =>
              persistEpisode(
                effectiveAnime.id,
                season.number,
                ep,
                animeTitleLabel,
                { replaceThumbnail: shouldReplaceThumb },
              ),
          });
        }
      }

      if (episodeTasks.length > 0) {
        const results = await runWithConcurrency(
          episodeTasks.map((task) => async (): Promise<PersistEpisodeResult> => {
            try {
              return await task.run();
            } catch (err) {
              return {
                confirmed: false,
                queued: false,
                status: "pending",
                error:
                  err instanceof Error
                    ? err.message
                    : "Erro inesperado ao sincronizar episódio.",
              };
            }
          }),
          EPISODE_SAVE_CONCURRENCY,
        );
        const resultByPair = new Map<string, PersistEpisodeResult>();
        episodeTasks.forEach((task, idx) => {
          const result = results[idx];
          if (result) {
            resultByPair.set(`${task.seasonId}:${task.episodeId}`, result);
            if (result.confirmed) {
              dirtyEpisodeIdsRef.current.delete(task.episodeId);
              explicitUserDirtyEpisodeIdsRef.current.delete(task.episodeId);
              if (result.canonicalId) {
                dirtyEpisodeIdsRef.current.delete(result.canonicalId);
                explicitUserDirtyEpisodeIdsRef.current.delete(result.canonicalId);
              }
            }
          }
        });

        setThumbnailEditModes((prev) => {
          const next = { ...prev };
          for (const task of episodeTasks) {
            const match = resultByPair.get(`${task.seasonId}:${task.episodeId}`);
            if (!match) continue;
            if (match.confirmed) {
              delete next[task.episodeId];
              if (match.canonicalId) {
                delete next[match.canonicalId];
              }
            } else if (match.canonicalId && match.canonicalId !== task.episodeId && next[task.episodeId]) {
              next[match.canonicalId] = next[task.episodeId];
              delete next[task.episodeId];
            }
          }
          thumbnailEditModesRef.current = next;
          return next;
        });

        let anyEpisodeChanged = false;
        const reconciledSeasons = effectiveAnime.seasons.map((season) => ({
          ...season,
          episodes: season.episodes.map((ep) => {
            const match = resultByPair.get(`${season.id}:${ep.id}`);
            if (!match) return ep;

            const nextId =
              match.canonicalId && match.status === "synced"
                ? match.canonicalId
                : ep.id;
            const nextPublished =
              typeof match.published === "boolean"
                ? match.published
                : Boolean(ep.published);
            const nextAired = nextPublished
              ? match.publishedAt
                ? new Date(match.publishedAt).toLocaleDateString("pt-BR")
                : ep.aired
              : undefined;

            const nextHikariPlayerEpisodeId =
              match.hikariPlayerEpisodeId !== undefined
                ? normalizeHikariPlayerEpisodeId(match.hikariPlayerEpisodeId) ?? undefined
                : ep.hikariPlayerEpisodeId;

            const shouldAdoptServerThumbnail =
              Boolean(match.thumbnail) &&
              !ep.thumbnail?.trim() &&
              thumbnailEditModesRef.current[ep.id] !== "cleared";
            const nextThumbnail = shouldAdoptServerThumbnail
              ? match.thumbnail ?? undefined
              : ep.thumbnail;
            if (shouldAdoptServerThumbnail) {
              setEpisodeThumbnailOrigin(ep.id, "hikari-player");
            }

            const nextRecentBadges =
              match.recentBadges !== undefined
                ? normalizeAnimeRecentBadges(match.recentBadges)
                : ep.recentBadges;

            const currentNormalizedAudio = normalizeEpisodeAudio(ep.audio);
            const nextAudio =
              match.audio !== undefined
                ? normalizeEpisodeAudio(match.audio)
                : currentNormalizedAudio;

            if (
              nextId !== ep.id ||
              nextThumbnail !== ep.thumbnail ||
              nextPublished !== Boolean(ep.published) ||
              nextAired !== ep.aired ||
              nextHikariPlayerEpisodeId !== ep.hikariPlayerEpisodeId ||
              nextAudio !== currentNormalizedAudio ||
              !areAnimeRecentBadgesEqual(nextRecentBadges, ep.recentBadges)
            ) {
              anyEpisodeChanged = true;
              return {
                ...ep,
                id: nextId,
                thumbnail: nextThumbnail,
                published: nextPublished,
                aired: nextAired,
                hikariPlayerEpisodeId: nextHikariPlayerEpisodeId,
                audio: nextAudio,
                recentBadges: nextRecentBadges,
              };
            }
            return ep;
          }),
        }));

        const baseReconciled: LocalAnime = anyEpisodeChanged
          ? { ...effectiveAnime, seasons: reconciledSeasons }
          : effectiveAnime;

        // Atualiza baseline dos slots e invalida o cache de fontes apenas dos episódios confirmados no servidor
        let anySourceInvalidated = false;
        const confirmedIds = new Set<string>();
        for (const task of episodeTasks) {
          const match = resultByPair.get(`${task.seasonId}:${task.episodeId}`);
          if (!match?.confirmed) continue;
          const finalId =
            match.canonicalId && match.status === "synced"
              ? match.canonicalId
              : task.episodeId;
          confirmedIds.add(task.episodeId);
          confirmedIds.add(finalId);
        }
        if (confirmedIds.size > 0 && sourcesSessionRef.current) {
          for (const season of reconciledSeasons) {
            for (const ep of season.episodes) {
              if (confirmedIds.has(ep.id)) {
                sourcesSessionRef.current.updateEpisodeBaseline(
                  ep.id,
                  getEpisodeSlotsSignature(ep),
                );
              }
            }
          }
          sourcesSessionRef.current.invalidateEpisodes(confirmedIds);
          anySourceInvalidated = true;
        }
        if (anySourceInvalidated) {
          setSourcesSyncTick((t) => t + 1);
        }

        const confirmedCount = results.filter((r) => r.confirmed).length;
        const conflictCount = results.filter((r) => r.status === "conflict").length;
        const pendingCount = results.filter((r) => r.status === "pending").length;
        allEpisodesSynced = confirmedCount === results.length;

        if (metadataSavedOnServer && allEpisodesSynced) {
          const syncedAt = Date.now();
          const syncedAnime = { ...baseReconciled, syncedAt };
          upsertAnime(syncedAnime);
          setForm((f) =>
            f ? { ...f, seasons: reconciledSeasons, syncedAt } : f,
          );
          setAnimeSyncState("synced");
          toast.success(
            "Salvo no servidor: metadados e episódios confirmados no PostgreSQL.",
          );
        } else {
          if (anyEpisodeChanged) {
            upsertAnime(baseReconciled);
            setForm((f) => (f ? { ...f, seasons: reconciledSeasons } : f));
          }
          if (conflictCount > 0) {
            setAnimeSyncState("conflict");
            const firstErr = results.find((r) => r.status === "conflict")?.error;
            toast.warning(
              `Ação necessária: ${conflictCount} episódio(s) preservados localmente com erro de validação (${firstErr || "verifique os dados"}).`,
            );
          } else if (pendingCount > 0) {
            if (metadataSavedOnServer) {
              const syncedAnime = { ...baseReconciled, syncedAt: Date.now() };
              upsertAnime(syncedAnime);
            }
            toast.info(
              `Sincronização pendente: ${pendingCount} episódio(s) preservados localmente aguardando conexão com o servidor.`,
            );
          }
        }
      } else {
        if (metadataSavedOnServer) {
          const syncedAt = Date.now();
          const syncedAnime = { ...effectiveAnime, syncedAt };
          upsertAnime(syncedAnime);
          setForm((f) => (f ? { ...f, syncedAt } : f));
          setAnimeSyncState("synced");
          toast.success("Metadados confirmados e sincronizados com sucesso no PostgreSQL!");
        }
      }

      await flushAnimes();
      invalidateCatalogEpisodesCache(
        effectiveAnime.id,
        currentForm.id,
        currentRouteId,
        effectiveAnime.serverCatalogId,
        effectiveAnime.anilistId ? String(effectiveAnime.anilistId) : undefined,
        effectiveAnime.malId ? `mal-${effectiveAnime.malId}` : undefined,
        effectiveAnime.kitsuId ? `kitsu-${effectiveAnime.kitsuId}` : undefined,
      );
    } catch (err) {
      allEpisodesSynced = false;
      console.warn("[admin] Erro ao sincronizar episódios:", err);
      toast.info("Salvo localmente: alterações preservadas neste dispositivo.");
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
      if (typeof window !== "undefined") {
        setOutboxOps(readOutbox());
      }
      if (metadataSavedOnServer) {
        void router.invalidate();
      }
      if (currentRouteId === "new" || (metadataSavedOnServer && effectiveAnime.id !== currentRouteId)) {
        const nextImportId =
          currentImportId ??
          (effectiveAnime.anilistId
            ? String(effectiveAnime.anilistId)
            : effectiveAnime.malId
              ? `mal-${effectiveAnime.malId}`
              : effectiveAnime.kitsuId
                ? `kitsu-${effectiveAnime.kitsuId}`
                : undefined);
        void navigate({
          to: "/admin/$id",
          params: { id: effectiveAnime.id },
          search: nextImportId ? { importId: nextImportId } : {},
          replace: currentRouteId !== "new",
        });
      }
    }
  }, [upsertAnime, removeAnime, router, navigate, setEpisodeThumbnailOrigin]);

  const addSeason = useCallback(() => {
    const nextNumber = (formRef.current?.seasons.length ?? 0) + 1;

    setForm((f) => {
      if (!f) return f;
      const n = f.seasons.length + 1;
      return {
        ...f,
        seasons: [
          ...f.seasons,
          {
            id: `s-${crypto.randomUUID()}`,
            number: n,
            title: `Temporada ${n}`,
            episodes: [],
          },
        ],
      };
    });
    setAnimeSyncState((prev) => (prev === "synced" ? "local" : prev));
    toast.success(`Temporada ${nextNumber} adicionada.`);
  }, []);

  const patchSeason = useCallback((sid: string, patch: Partial<Season>) => {
    const patchEntries = Object.entries(patch) as Array<
      [keyof Season, Season[keyof Season]]
    >;
    if (patchEntries.length === 0) return;

    setForm((f) => {
      if (!f) return f;
      const sIdx = f.seasons.findIndex((s) => s.id === sid);
      if (sIdx === -1) return f;
      const season = f.seasons[sIdx];
      const hasActualChange = patchEntries.some(([k, v]) => !Object.is(season[k], v));
      if (!hasActualChange) return f;
      const nextSeasons = f.seasons.slice();
      nextSeasons[sIdx] = { ...season, ...patch };
      return {
        ...f,
        seasons: nextSeasons,
      };
    });
    setAnimeSyncState((prev) => (prev === "synced" ? "local" : prev));
  }, []);

  const removeSeason = useCallback(
    async (sid: string) => {
      const currentForm = formRef.current;
      if (!currentForm) return;
      const targetSeason = currentForm.seasons.find((s) => s.id === sid);
      if (!targetSeason) return;

      const currentSyncState = animeSyncStateRef.current;
      const isServerBacked =
        !currentForm.id.startsWith("local-") &&
        (currentSyncState === "synced" || !!currentForm.syncedAt);

      if (isServerBacked) {
        try {
          const token = getBearerToken();
          const res = await fetch(
            `/api/admin/catalog-season?animeId=${encodeURIComponent(currentForm.id)}&seasonNumber=${encodeURIComponent(targetSeason.number)}`,
            {
              method: "DELETE",
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
              credentials: "include",
            },
          );

          if (!res.ok) {
            let errDetail = res.statusText;
            try {
              const errJson = await res.json();
              errDetail = errJson.error || errDetail;
            } catch {
              errDetail = res.statusText || errDetail;
            }
            toast.error(
              `Falha ao remover temporada no servidor (${res.status}): ${errDetail}. A temporada foi mantida localmente.`,
            );
            return;
          }
        } catch (err) {
          console.warn("[admin] Erro de rede ao remover temporada no servidor:", err);
          toast.error(
            "Servidor indisponível. A temporada não foi removida para evitar inconsistência com o servidor.",
          );
          return;
        }
      }

      // 1. Limpa operações pendentes/conflito no outbox para os episódios desta temporada
      if (typeof window !== "undefined") {
        try {
          const existingOps = readOutbox();
          const filteredOps = existingOps.filter(
            (op) => !(op.animeId === currentForm.id && op.seasonNumber === targetSeason.number),
          );
          if (filteredOps.length !== existingOps.length) {
            writeOutbox(filteredOps);
            setOutboxOps(filteredOps);
          }
        } catch (e) {
          console.warn("[admin] Erro ao limpar outbox de temporada removida:", e);
        }
      }

      // 2. Persist tombstone para garantir que qualquer outro nó/cache saiba da exclusão
      for (const ep of targetSeason.episodes) {
        sourcesSessionRef.current?.removeEpisode(ep.id);
        void persistEpisodeDelete(currentForm.id, targetSeason.number, ep.id, ep.number);
      }

      // 3. Atualiza estado local de forma segura
      const updatedSeasons = currentForm.seasons.filter((s) => s.id !== sid);
      const updatedAnime: LocalAnime = {
        ...currentForm,
        seasons: updatedSeasons,
        updatedAt: Date.now(),
      };

      setForm(updatedAnime);
      upsertAnime(updatedAnime);
      setAnimeSyncState((prev) => (prev === "synced" ? "local" : prev));
      toast.success(`Temporada ${targetSeason.number} removida com sucesso.`);
    },
    [upsertAnime],
  );

  const addEpisode = useCallback((sid: string) => {
    const newEpisodeId = `e-${crypto.randomUUID()}`;
    dirtyEpisodeIdsRef.current.add(newEpisodeId);
    explicitUserDirtyEpisodeIdsRef.current.add(newEpisodeId);

    setForm((f) => {
      if (!f) return f;
      const sIdx = f.seasons.findIndex((s) => s.id === sid);
      if (sIdx === -1) return f;
      const season = f.seasons[sIdx];
      const number = (season.episodes.at(-1)?.number ?? 0) + 1;
      const ep: Episode = {
        id: newEpisodeId,
        number,
        title: `Episódio ${number}`,
        recentBadges: { lancamento: false, novo: false, final: false },
        published: false,
      };
      const nextSeasons = f.seasons.slice();
      nextSeasons[sIdx] = {
        ...season,
        episodes: [...season.episodes, ep],
      };
      return {
        ...f,
        seasons: nextSeasons,
      };
    });
    setAnimeSyncState((prev) => (prev === "synced" ? "local" : prev));
  }, []);

  const removeEpisode = useCallback(
    (sid: string, eid: string) => {
      const currentForm = formRef.current;
      const season = currentForm?.seasons.find((s) => s.id === sid);
      const targetEp = season?.episodes.find((e) => e.id === eid);
      dirtyEpisodeIdsRef.current.delete(eid);
      explicitUserDirtyEpisodeIdsRef.current.delete(eid);
      sourcesSessionRef.current?.removeEpisode(eid);
      revokeEpisodePreviewUrls(eid);
      setEpisodeCandidates((prev) => {
        if (!(eid in prev)) return prev;
        const next = { ...prev };
        delete next[eid];
        return next;
      });
      setForm((f) => {
        if (!f) return f;
        const sIdx = f.seasons.findIndex((s) => s.id === sid);
        if (sIdx === -1) return f;
        const targetSeason = f.seasons[sIdx];
        const nextEpisodes = targetSeason.episodes.filter((e) => e.id !== eid);
        if (nextEpisodes.length === targetSeason.episodes.length) return f;
        const nextSeasons = f.seasons.slice();
        nextSeasons[sIdx] = {
          ...targetSeason,
          episodes: nextEpisodes,
        };
        return {
          ...f,
          seasons: nextSeasons,
        };
      });
      if (currentForm && season) {
        void persistEpisodeDelete(currentForm.id, season.number, eid, targetEp?.number);
      }
      hikariThumbManagerRef.current?.cancel(eid, { clearStatus: true });
      delete latestHikariIdsRef.current[eid];
      thumbInputHikariManagerRef.current?.cancel(eid, { clearStatus: true });
      delete latestThumbnailValuesRef.current[eid];
      setEpisodeThumbnailOrigin(eid, undefined);
      setEpisodeThumbnailEditMode(eid, undefined);
    },
    [
      revokeEpisodePreviewUrls,
      setEpisodeThumbnailEditMode,
      setEpisodeThumbnailOrigin,
    ],
  );

  const handleEpisodeThumbnailChange = useCallback(
    (sid: string, ep: Episode, value: string) => {
      patchEpisode(sid, ep.id, { thumbnail: value });
      const classification = classifyThumbnailInput(value);
      if (classification.kind === "hikari_player_id") {
        setEpisodeThumbnailEditMode(ep.id, "modified");
        setEpisodeThumbnailOrigin(ep.id, "empty");
      } else {
        setEpisodeThumbnailEditMode(ep.id, value.trim() ? "modified" : "cleared");
        setEpisodeThumbnailOrigin(ep.id, value.trim() ? "manual" : "empty");
      }
    },
    [patchEpisode, setEpisodeThumbnailEditMode, setEpisodeThumbnailOrigin],
  );

  const handleEpisodeThumbnailClear = useCallback(
    (sid: string, ep: Episode) => {
      thumbInputHikariManagerRef.current?.cancel(ep.id, { clearStatus: true });
      patchEpisode(sid, ep.id, { thumbnail: "" });
      setEpisodeThumbnailEditMode(ep.id, "cleared");
      setEpisodeThumbnailOrigin(ep.id, "empty");
      setEpisodeCandidates((prev) => {
        const curr = prev[ep.id];
        if (!curr) return prev;
        return {
          ...prev,
          [ep.id]: {
            ...curr,
            selectedCandidateId: null,
          },
        };
      });
    },
    [patchEpisode, setEpisodeThumbnailEditMode, setEpisodeThumbnailOrigin],
  );

  const handleReloadFromServer = useCallback(
    () => recoverEpisodesFromServer(idRef.current),
    [recoverEpisodesFromServer],
  );

  const handleFlushOutbox = useCallback(async () => {
    toast.info("Sincronizando operações do outbox...");
    const res = await flushOutbox();
    if (typeof window !== "undefined") {
      setOutboxOps(readOutbox());
    }
    if (res.processed > 0) {
      toast.success(`${res.processed} operação(ões) sincronizada(s) com sucesso!`);
    }
    if (res.error) {
      toast.error(res.error);
    }
  }, []);

  const animeTitleRomaji = form?.titleRomaji ?? "";
  const animeTitleEnglish = form?.titleEnglish ?? "";
  const animeTitleNative = form?.titleNative ?? "";
  const animeTitles = useMemo(
    () =>
      [animeTitleRomaji, animeTitleEnglish, animeTitleNative].filter(
        (t): t is string => Boolean(t && t.trim()),
      ),
    [animeTitleRomaji, animeTitleEnglish, animeTitleNative],
  );

  const currentAnimeId = form?.id ?? "";
  const animeOutboxOps = useMemo(
    () =>
      currentAnimeId
        ? outboxOps.filter((o) => o.animeId === currentAnimeId)
        : [],
    [outboxOps, currentAnimeId],
  );

  const canDelete = useMemo(
    () =>
      Boolean(
        currentAnimeId &&
          id !== "new" &&
          stored.some((a) => a.id === currentAnimeId),
      ),
    [currentAnimeId, id, stored],
  );

  const lastMetadataFormRef = useRef<LocalAnime | null>(null);
  const metadataForm = useMemo(() => {
    if (!form) {
      lastMetadataFormRef.current = null;
      return null;
    }
    const prev = lastMetadataFormRef.current;
    if (prev) {
      let sameMetadata = true;
      const keys = new Set([
        ...Object.keys(prev),
        ...Object.keys(form),
      ]) as Set<keyof LocalAnime>;
      for (const key of keys) {
        if (key === "seasons" || key === "updatedAt") continue;
        if (!Object.is(prev[key], form[key])) {
          sameMetadata = false;
          break;
        }
      }
      if (sameMetadata) {
        return prev;
      }
    }
    lastMetadataFormRef.current = form;
    return form;
  }, [form]);

  const lastHeaderAnimeRef = useRef<{
    anime: LocalAnime;
    seasonCount: number;
    episodeCount: number;
  } | null>(null);
  const headerAnime = useMemo(() => {
    if (!form) {
      lastHeaderAnimeRef.current = null;
      return null;
    }
    const seasonCount = form.seasons.length;
    let episodeCount = 0;
    for (const s of form.seasons) {
      episodeCount += s.episodes.length;
    }
    const prev = lastHeaderAnimeRef.current;
    if (
      prev &&
      prev.seasonCount === seasonCount &&
      prev.episodeCount === episodeCount &&
      prev.anime.id === form.id &&
      prev.anime.titleRomaji === form.titleRomaji &&
      prev.anime.titleEnglish === form.titleEnglish &&
      prev.anime.titleNative === form.titleNative &&
      prev.anime.cover === form.cover &&
      prev.anime.hidden === form.hidden &&
      prev.anime.format === form.format &&
      prev.anime.status === form.status &&
      prev.anime.year === form.year &&
      prev.anime.score === form.score &&
      prev.anime.syncedAt === form.syncedAt &&
      prev.anime.updatedAt === form.updatedAt
    ) {
      return prev.anime;
    }
    lastHeaderAnimeRef.current = {
      anime: form,
      seasonCount,
      episodeCount,
    };
    return form;
  }, [form]);

  const totalEpisodesInEditor = useMemo(
    () =>
      form ? form.seasons.reduce((acc, s) => acc + s.episodes.length, 0) : 0,
    [form],
  );

  if (!form || !metadataForm || !headerAnime) {
    return (
      <div className="space-y-6 pb-12 pt-2">
        <div className="studio-panel rounded-2xl p-6">
          <div className="h-4 w-32 animate-pulse rounded bg-white/[0.06]" />
          <div className="mt-4 flex items-center gap-4">
            <div className="h-16 w-12 animate-pulse rounded-lg bg-white/[0.06]" />
            <div className="space-y-2.5 flex-1">
              <div className="h-6 w-64 max-w-full animate-pulse rounded bg-white/[0.08]" />
              <div className="h-3.5 w-44 animate-pulse rounded bg-white/[0.05]" />
            </div>
          </div>
        </div>
        <div className="grid gap-6 xl:grid-cols-12">
          <div className="studio-panel h-80 animate-pulse rounded-2xl xl:col-span-7" />
          <div className="studio-panel h-80 animate-pulse rounded-2xl xl:col-span-5" />
        </div>
      </div>
    );
  }

  const current = form;
  const animeTitle =
    animeTitleRomaji || animeTitleEnglish || animeTitleNative || "Anime";

  const conflictCount = animeOutboxOps.filter((o) => o.status === "conflict").length;
  const pendingCount = animeOutboxOps.filter((o) => o.status !== "conflict").length;

  return (
    <div className="studio-enter space-y-6 pb-24 pt-2 sm:pb-12">
      {/* Cabeçalho do Editor */}
      <MemoEditorHeader
        anime={headerAnime}
        isNew={id === "new" && !importId}
        importId={importId}
        isSaving={isSaving}
        onSave={save}
        onDuplicateAsDubbed={duplicateAsDubbed}
        onDelete={handleDeleteAnime}
        onReloadFromServer={handleReloadFromServer}
        isReloading={recoveryState.status === "loading"}
        outboxOps={animeOutboxOps}
        canDelete={canDelete}
        syncState={animeSyncState}
      />

      {/* Abas de Navegação do Editor */}
      <nav
        aria-label="Seções do editor"
        className="flex flex-wrap items-center gap-2 border-b border-[var(--studio-line)] pb-4"
      >
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-lg px-4 text-xs font-semibold transition-all cursor-pointer",
            activeTab === "all"
              ? "bg-[var(--studio-accent)] text-white shadow-sm"
              : "border border-[var(--studio-line)] bg-[var(--studio-panel)] text-[var(--color-muted)] hover:border-purple-500/40 hover:bg-[#1f1a36] hover:text-[var(--color-fg)]"
          )}
        >
          <Info className="size-3.5" />
          <span>Visão Geral &amp; Completo</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("metadata")}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-lg px-4 text-xs font-semibold transition-all cursor-pointer",
            activeTab === "metadata"
              ? "bg-[var(--studio-accent)] text-white shadow-sm"
              : "border border-[var(--studio-line)] bg-[var(--studio-panel)] text-[var(--color-muted)] hover:border-purple-500/40 hover:bg-[#1f1a36] hover:text-[var(--color-fg)]"
          )}
        >
          <Info className="size-3.5 text-purple-400" />
          <span>Metadados &amp; Imagens</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("seasons")}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-lg px-4 text-xs font-semibold transition-all cursor-pointer",
            activeTab === "seasons"
              ? "bg-[var(--studio-accent)] text-white shadow-sm"
              : "border border-[var(--studio-line)] bg-[var(--studio-panel)] text-[var(--color-muted)] hover:border-purple-500/40 hover:bg-[#1f1a36] hover:text-[var(--color-fg)]"
          )}
        >
          <Layers className="size-3.5 text-teal-400" />
          <span>Temporadas &amp; Episódios</span>
          <span
            className={cn(
              "studio-mono rounded px-1.5 py-0.5 text-[10px]",
              activeTab === "seasons"
                ? "bg-white/20 text-white"
                : "bg-white/[0.08] text-zinc-200",
            )}
          >
            {current.seasons.length}T · {totalEpisodesInEditor}E
          </span>
        </button>
      </nav>

      {/* Banner de Sincronização do Outbox */}
      {animeOutboxOps.length > 0 && (
        <div className="studio-panel flex flex-wrap items-center justify-between gap-3 rounded-xl border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-100 sm:text-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-400" />
            <div className="space-y-0.5">
              <p className="font-semibold text-amber-200">
                Fila de Envio (Outbox): {animeOutboxOps.length} operação(ões) pendente(s)
              </p>
              <p className="text-xs text-amber-200/80">
                {conflictCount > 0
                  ? `${conflictCount} em conflito (aguardando correção) e ${pendingCount} pendente(s) de envio ao PostgreSQL.`
                  : `${pendingCount} operação(ões) aguardando sincronização com o banco.`}
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleFlushOutbox}
            className="h-9 border-amber-500/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
          >
            Sincronizar agora
          </Button>
        </div>
      )}

      {/* Banner de Feedback da Recuperação de Episódios do Servidor PostgreSQL */}
      {id !== "new" && recoveryState.status !== "idle" && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-xs transition-colors sm:text-sm ${
            recoveryState.status === "loading"
              ? "border-sky-500/30 bg-sky-500/10 text-sky-100"
              : recoveryState.status === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
              : recoveryState.status === "empty"
              ? "border-[var(--studio-line)] bg-[var(--studio-panel)] text-[var(--color-muted)]"
              : "border-amber-500/30 bg-amber-500/10 text-amber-100"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {recoveryState.status === "loading" && (
              <Loader2 className="size-4 shrink-0 animate-spin text-sky-400" />
            )}
            {recoveryState.status === "success" && (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
            )}
            {recoveryState.status === "empty" && (
              <Film className="size-4 shrink-0 text-[var(--color-muted)]" />
            )}
            {recoveryState.status === "error" && (
              <AlertCircle className="size-4 shrink-0 text-amber-400" />
            )}
            <span>{recoveryState.message}</span>
          </div>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={recoveryState.status === "loading"}
            onClick={handleReloadFromServer}
            className="h-9 gap-1.5 text-xs hover:bg-white/[0.08]"
          >
            <RefreshCw
              className={`size-3.5 ${recoveryState.status === "loading" ? "animate-spin" : ""}`}
            />
            Recarregar do servidor
          </Button>
        </div>
      )}

      {/* Seções condicionadas por aba (Console Daylight) */}
      {(activeTab === "all" || activeTab === "metadata") && (
        <MemoEditorMetadata
          form={metadataForm}
          onChange={set}
          genreText={genreText}
          onGenreTextChange={handleGenreTextChange}
          resolvedMobileBanner={displayMedia?.mobileBanner ?? null}
          hasCustomDesktopBanner={displayMedia?.hasCustomDesktopBanner ?? false}
        />
      )}

      {(activeTab === "all" || activeTab === "seasons") && (
        <MemoEditorSeasons
          animeId={current.id}
          animeTitles={animeTitles}
          seasons={current.seasons}
          onAddSeason={addSeason}
          onPatchSeason={patchSeason}
          onRemoveSeason={removeSeason}
          onAddEpisode={addEpisode}
          onPatchEpisode={patchEpisode}
          onRemoveEpisode={removeEpisode}
          onCaptureFrame={handleCaptureEpisodeFrame}
          onDiscoverCandidates={handleDiscoverEpisodeThumbnails}
          onSelectCandidate={handleSelectEpisodeCandidate}
          episodeCandidates={episodeCandidates}
          onUploadVideoToB2={handleUploadVideoToB2}
          uploadingEpisode={uploadingEpisode}
          captureStatus={captureStatus}
          outboxOps={animeOutboxOps}
          getInheritedThumbnail={getInheritedEpisodeThumbnail}
          thumbnailEditModes={thumbnailEditModes}
          thumbnailOrigins={thumbnailOrigins}
          hikariThumbStatuses={hikariThumbStatuses}
          onLookupHikariPlayerThumbnail={handleLookupHikariPlayerThumbnail}
          onCancelHikariPlayerThumbnailLookup={handleCancelHikariPlayerThumbnailLookup}
          thumbInputHikariStatuses={thumbInputHikariStatuses}
          onLookupThumbnailHikariPlayer={handleLookupThumbnailHikariPlayer}
          onCancelThumbnailHikariPlayerLookup={handleCancelThumbnailHikariPlayerLookup}
          onThumbnailChange={handleEpisodeThumbnailChange}
          onThumbnailClear={handleEpisodeThumbnailClear}
          onFetchOpeningSuggestions={handleFetchOpeningSuggestions}
          isFetchingOpening={isFetchingOpening}
          openingSuggestions={openingSuggestions}
          onApplyOpeningSuggestion={handleApplyOpeningSuggestion}
          onDiscardOpeningSuggestion={handleDiscardOpeningSuggestion}
          sourcesSession={sourcesSessionRef.current ?? undefined}
          sourcesSyncTick={sourcesSyncTick}
        />
      )}

      {/* Barra de Ação Mobile Fixa */}
      <MemoEditorMobileBar
        title={animeTitle}
        isSaving={isSaving}
        onSave={save}
        canDuplicate={id !== "new"}
        onDuplicate={duplicateAsDubbed}
      />
    </div>
  );
}
