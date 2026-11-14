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
import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { fetchAnimeDetail } from "@/lib/api";
import { animeToLocal, type Episode, type LocalAnime, type Season } from "@/lib/types";
import { useHikariStore } from "@/lib/store";
import { youtubeIdFrom } from "@/lib/utils";
import { stripCatalogImageVersion } from "@/lib/image-utils";
import { uploadVideoToB2 } from "@/lib/b2";
import { getBearerToken } from "@/lib/auth/client";
import { flushAnimes } from "@/lib/catalog-storage";
import {
  captureAndUploadThumbnail,
  hasEpisodePlayableSource,
} from "@/lib/published-episodes";
import { Button } from "@/components/ui/button";
import {
  persistEpisode,
  persistEpisodeDelete,
  readOutbox,
  writeOutbox,
  flushOutbox,
  type OutboxOperation,
  type PersistEpisodeResult,
} from "@/lib/episode-writer";
import {
  executeGetCatalogEpisodes,
  getAdminCatalogEpisodes,
  invalidateCatalogEpisodesCache,
  mergeAdminEpisodesWithServer,
  type CatalogEpisodesResult,
} from "@/lib/catalog-episodes";
import {
  EditorHeader,
  type AnimeSyncState,
} from "@/components/admin/anime-editor/editor-header";
import { EditorMetadata } from "@/components/admin/anime-editor/editor-metadata";
import { EditorSeasons } from "@/components/admin/anime-editor/editor-seasons";
import { EditorMobileBar } from "@/components/admin/anime-editor/editor-mobile-bar";

export const Route = createFileRoute("/admin/$id")({
  validateSearch: (raw: Record<string, unknown>): { importId?: string } => ({
    importId: typeof raw.importId === "string" && raw.importId ? raw.importId : undefined,
  }),
  loaderDeps: ({ search }) => ({ importId: search.importId }),
  loader: async ({ params, deps }) => {
    const fetchId = params.id === "new" ? deps.importId : params.id;
    let remote = null;
    let serverEpisodes: CatalogEpisodesResult | null = null;

    if (fetchId) {
      try {
        remote = await fetchAnimeDetail({ data: { id: fetchId } });
      } catch {
        remote = null;
      }
    }

    // Carrega episódios persistidos no PostgreSQL para o anime no painel administrativo
    if (params.id && params.id !== "new") {
      try {
        serverEpisodes =
          typeof window === "undefined"
            ? await executeGetCatalogEpisodes(params.id, {
                includeUnpublished: true,
              })
            : await getAdminCatalogEpisodes({ data: { animeId: params.id } });
      } catch (err) {
        console.warn("[admin loader] Erro ao carregar episódios do servidor:", err);
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

  const initializedRouteKeyRef = useRef<string | null>(null);
  const lastServerEpisodesRef = useRef<CatalogEpisodesResult | null | undefined>(undefined);
  const isSavingRef = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOutboxOps(readOutbox());
    }
  }, []);

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
          result = await getAdminCatalogEpisodes({ data: { animeId: effectiveId } });
        }

        if (!result || !result.episodes || result.episodes.length === 0) {
          setRecoveryState({
            status: "empty",
            message: "Nenhum episódio cadastrado no servidor para este anime.",
            recoveredCount: 0,
          });
          return;
        }

        setForm((currentForm) => {
          if (!currentForm) return currentForm;
          const currentOps = typeof window !== "undefined" ? readOutbox() : [];
          const mergeResult = mergeAdminEpisodesWithServer({
            animeId: effectiveId,
            localSeasons: currentForm.seasons,
            serverResult: result!,
            outboxOps: currentOps,
          });

          return {
            ...currentForm,
            seasons: mergeResult.seasons,
          };
        });

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
    [id],
  );

  async function handleCaptureEpisodeFrame(
    sid: string,
    ep: Episode,
    forcedUrl?: string,
  ) {
    const videoUrl =
      forcedUrl ||
      ep.videoUrl ||
      ep.videoUrl2 ||
      ep.videoUrl3 ||
      ep.videoUrl4 ||
      ep.videoUrl5;

    if (!videoUrl || !hasEpisodePlayableSource({ videoUrl })) {
      toast.error("Insira uma URL de vídeo válida antes de capturar a miniatura.");
      return;
    }

    setCaptureStatus((prev) => ({
      ...prev,
      [ep.id]: {
        status: "loading",
        message: "Capturando miniatura automática do vídeo...",
      },
    }));

    try {
      const res = await captureAndUploadThumbnail(videoUrl, {
        episodeTitle: ep.title || `Episódio ${ep.number}`,
      });

      patchEpisode(sid, ep.id, { thumbnail: res.url });
      setCaptureStatus((prev) => ({
        ...prev,
        [ep.id]: {
          status: "success",
          message: "Miniatura capturada e salva com sucesso!",
        },
      }));
      toast.success(`Miniatura do Episódio ${ep.number} salva!`);
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
      toast.error(`Falha na captura (Ep. ${ep.number}): ${errMsg}`);
    }
  }

  async function handleUploadVideoToB2(
    sid: string,
    ep: Episode,
    key: "videoUrl" | "videoUrl2" | "videoUrl3",
  ) {
    const uploadId = `${ep.id}-${key}`;
    setUploadingEpisode(uploadId);
    try {
      await uploadVideoToB2((url, file) => {
        patchEpisode(sid, ep.id, { [key]: url });
        toast.success(`Vídeo enviado com sucesso para ${key}!`);

        if (!ep.thumbnail) {
          const frameSource = file ? URL.createObjectURL(file) : url;
          captureAndUploadThumbnail(frameSource, {
            episodeTitle: ep.title || `Episódio ${ep.number}`,
          })
            .then((res) => {
              patchEpisode(sid, ep.id, { thumbnail: res.url });
              toast.success("Miniatura capturada e salva automaticamente!");
            })
            .catch((err) => {
              console.warn("Falha na captura automática do upload:", err);
            })
            .finally(() => {
              if (file) {
                URL.revokeObjectURL(frameSource);
              }
            });
        }
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no upload.");
    } finally {
      setUploadingEpisode(null);
    }
  }

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
          setForm((currentForm) => {
            if (!currentForm) return currentForm;
            const mergeResult = mergeAdminEpisodesWithServer({
              animeId: id,
              localSeasons: currentForm.seasons,
              serverResult: serverEpisodes,
              outboxOps: currentOps,
            });
            return {
              ...currentForm,
              seasons: mergeResult.seasons,
            };
          });
          setRecoveryState({
            status: "success",
            message: `Episódios recuperados com sucesso do PostgreSQL (${serverEpisodes.episodes.length} confirmados no banco).`,
            recoveredCount: serverEpisodes.episodes.length,
          });
        } else {
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

    const storedMatch =
      id === "new"
        ? remote?.serverCatalogId
          ? stored.find((a) => a.id === remote.serverCatalogId)
          : undefined
        : stored.find((a) => a.id === id) ||
          (remote?.serverCatalogId
            ? stored.find((a) => a.id === remote.serverCatalogId)
            : undefined) ||
          (remote?.anilistId
            ? stored.find((a) => a.anilistId === remote.anilistId)
            : undefined);

    const existing =
      storedMatch &&
      remote?.catalogUpdatedAt &&
      remote.catalogUpdatedAt > (storedMatch.updatedAt ?? 0)
        ? {
            ...storedMatch,
            titleRomaji: remote.titles.romaji || storedMatch.titleRomaji,
            titleEnglish: remote.titles.english || storedMatch.titleEnglish,
            titleNative: remote.titles.native || storedMatch.titleNative,
            cover: remote.cover || storedMatch.cover,
            banner: remote.banner || storedMatch.banner,
            synopsis: remote.synopsis || storedMatch.synopsis,
            genres: remote.genres?.length ? remote.genres : storedMatch.genres,
            format: remote.format || storedMatch.format,
            status: remote.status || storedMatch.status,
            episodesCount: remote.episodesCount ?? storedMatch.episodesCount,
            season: remote.season ?? storedMatch.season,
            year: remote.year ?? storedMatch.year,
            trailerId: remote.trailerId ?? storedMatch.trailerId,
            updatedAt: remote.catalogUpdatedAt,
            syncedAt: remote.catalogUpdatedAt,
          }
        : storedMatch;

    const baseFromRemote = remote ? animeToLocal(remote) : null;
    if (baseFromRemote && !existing && remote?.serverCatalogId) {
      baseFromRemote.id = remote.serverCatalogId;
    }

    const base =
      existing ??
      baseFromRemote ?? {
        ...emptyLocal(),
        id: id !== "new" ? id : `local-${crypto.randomUUID()}`,
      };

    if (id !== "new" && serverEpisodes && serverEpisodes.episodes.length > 0) {
      const currentOps = typeof window !== "undefined" ? readOutbox() : [];
      const mergeResult = mergeAdminEpisodesWithServer({
        animeId: id,
        localSeasons: base.seasons,
        serverResult: serverEpisodes,
        outboxOps: currentOps,
      });

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
      setForm(base);
      setGenreText(base.genres.join(", "));
      if (base.syncedAt && base.syncedAt >= (base.updatedAt ?? 0)) {
        setAnimeSyncState("synced");
      } else {
        setAnimeSyncState("local");
      }

      if (id !== "new") {
        if (serverEpisodes && serverEpisodes.episodes.length === 0) {
          setRecoveryState({
            status: "empty",
            message: "Nenhum episódio cadastrado no servidor para este anime.",
            recoveredCount: 0,
          });
        } else {
          void recoverEpisodesFromServer(id);
        }
      } else {
        setRecoveryState({ status: "idle" });
      }
    }
  }, [hydrated, stored, id, importId, remote, serverEpisodes, recoverEpisodesFromServer]);

  if (!form) {
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

  function set<K extends keyof LocalAnime>(key: K, value: LocalAnime[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setAnimeSyncState((prev) => (prev === "synced" ? "local" : prev));
  }

  function duplicateAsDubbed() {
    const newId = `local-${crypto.randomUUID()}`;
    const baseTitleRomaji = current.titleRomaji ? `${current.titleRomaji} Dublado` : "";
    const baseTitleEnglish = current.titleEnglish ? `${current.titleEnglish} Dublado` : "";

    const clonedSeasons: Season[] = current.seasons.map((s) => ({
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
        videoUrl: "",
        videoUrl2: "",
        videoUrl3: "",
        videoUrl4: "",
        videoUrl5: "",
        published: false,
      })),
    }));

    const duplicated: LocalAnime = {
      ...current,
      id: newId,
      titleRomaji: baseTitleRomaji || current.titleRomaji,
      titleEnglish: baseTitleEnglish || current.titleEnglish,
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
  }

  async function handleDeleteAnime() {
    const isServerBacked =
      !current.id.startsWith("local-") &&
      (animeSyncState === "synced" || !!current.syncedAt);

    if (isServerBacked) {
      try {
        const token = getBearerToken();
        const res = await fetch(
          `/api/admin/catalog-anime?id=${encodeURIComponent(current.id)}`,
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
        console.warn("[admin] Erro de rede ao deletar anime no servidor:", err);
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
        const filteredOps = existingOps.filter((op) => op.animeId !== current.id);
        writeOutbox(filteredOps);
        setOutboxOps(filteredOps);
      } catch (e) {
        console.warn("[admin] Erro ao limpar outbox do anime:", e);
      }
    }

    removeAnime(current.id);
    toast.success(
      isServerBacked
        ? "Anime excluído com sucesso do servidor e do dispositivo."
        : "Anime local excluído.",
    );
    void navigate({ to: "/admin" });
  }

  async function save() {
    if (isSaving) return;

    const genres = genreText
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean);

    const next: LocalAnime = {
      ...current,
      genres,
      trailerId: youtubeIdFrom(current.trailerId) ?? (current.trailerId || null),
      updatedAt: Date.now(),
    };

    if (!next.titleRomaji && !next.titleEnglish && !next.titleNative) {
      toast.error("Dê um título ao anime.");
      return;
    }

    // Validação pré-salvamento: episódio marcado como Publicado exige ao menos 1 fonte válida
    for (const season of next.seasons) {
      for (const ep of season.episodes) {
        if (ep.published === true && !hasEpisodePlayableSource(ep)) {
          toast.error(
            `Não foi possível salvar: o Episódio ${ep.number} (Temporada ${season.number}) está marcado como Publicado sem nenhuma fonte de reprodução válida (Player 1 a Player 5).`,
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
      const res = await fetch("/api/admin/catalog-anime", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          id: effectiveAnime.id,
          titleRomaji: effectiveAnime.titleRomaji,
          titleEnglish: effectiveAnime.titleEnglish,
          titleNative: effectiveAnime.titleNative,
          cover: effectiveAnime.cover,
          banner: effectiveAnime.banner,
          synopsis: effectiveAnime.synopsis,
          score: effectiveAnime.score,
          genres: effectiveAnime.genres,
          format: effectiveAnime.format,
          status: effectiveAnime.status,
          episodesCount: effectiveAnime.episodesCount,
          season: effectiveAnime.season,
          year: effectiveAnime.year,
          trailerId: effectiveAnime.trailerId,
          hidden: effectiveAnime.hidden,
          anilistId: effectiveAnime.anilistId,
          malId: effectiveAnime.malId,
          kitsuId: effectiveAnime.kitsuId,
          seasons: effectiveAnime.seasons.map((s) => ({
            id: s.id,
            number: s.number,
            title: s.title,
          })),
        }),
      });

      if (res.ok) {
        metadataSavedOnServer = true;
        try {
          const json = (await res.json()) as {
            animeId?: string;
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

          if (canonicalId !== effectiveAnime.id) {
            removeAnime(effectiveAnime.id);
          }

          effectiveAnime = {
            ...effectiveAnime,
            id: canonicalId,
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

    // 3. Persistência 1-para-1 de episódios
    try {
      const animeTitle =
        effectiveAnime.titleRomaji ||
        effectiveAnime.titleEnglish ||
        effectiveAnime.titleNative ||
        "Anime";
      const episodeTasks: Array<{
        seasonId: string;
        episodeId: string;
        promise: ReturnType<typeof persistEpisode>;
      }> = [];
      for (const season of effectiveAnime.seasons) {
        for (const ep of season.episodes) {
          episodeTasks.push({
            seasonId: season.id,
            episodeId: ep.id,
            promise: persistEpisode(effectiveAnime.id, season.number, ep, animeTitle),
          });
        }
      }

      if (episodeTasks.length > 0) {
        const results = await Promise.all(episodeTasks.map((t) => t.promise));
        const resultByPair = new Map<string, PersistEpisodeResult>();
        episodeTasks.forEach((task, idx) => {
          const result = results[idx];
          if (result) {
            resultByPair.set(`${task.seasonId}:${task.episodeId}`, result);
          }
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

            if (
              nextId !== ep.id ||
              nextPublished !== Boolean(ep.published) ||
              nextAired !== ep.aired
            ) {
              anyEpisodeChanged = true;
              return {
                ...ep,
                id: nextId,
                published: nextPublished,
                aired: nextAired,
              };
            }
            return ep;
          }),
        }));

        const baseReconciled: LocalAnime = anyEpisodeChanged
          ? { ...effectiveAnime, seasons: reconciledSeasons }
          : effectiveAnime;

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
      invalidateCatalogEpisodesCache(effectiveAnime.id);
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
      if (id === "new" || (metadataSavedOnServer && effectiveAnime.id !== id)) {
        void navigate({ to: "/admin/$id", params: { id: effectiveAnime.id } });
      }
    }
  }

  function addSeason() {
    const n = current.seasons.length + 1;

    setForm((f) =>
      f
        ? {
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
          }
        : f,
    );
    setAnimeSyncState((prev) => (prev === "synced" ? "local" : prev));
    toast.success(`Temporada ${n} adicionada.`);
  }

  function patchSeason(sid: string, patch: Partial<Season>) {
    setForm((f) =>
      f
        ? {
            ...f,
            seasons: f.seasons.map((s) =>
              s.id === sid ? { ...s, ...patch } : s,
            ),
          }
        : f,
    );
    setAnimeSyncState((prev) => (prev === "synced" ? "local" : prev));
  }

  async function removeSeason(sid: string) {
    const targetSeason = current.seasons.find((s) => s.id === sid);
    if (!targetSeason) return;

    const isServerBacked =
      !current.id.startsWith("local-") &&
      (animeSyncState === "synced" || !!current.syncedAt);

    if (isServerBacked) {
      try {
        const token = getBearerToken();
        const res = await fetch(
          `/api/admin/catalog-season?animeId=${encodeURIComponent(current.id)}&seasonNumber=${encodeURIComponent(targetSeason.number)}`,
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
          (op) => !(op.animeId === current.id && op.seasonNumber === targetSeason.number),
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
      void persistEpisodeDelete(current.id, targetSeason.number, ep.id, ep.number);
    }

    // 3. Atualiza estado local de forma segura
    const updatedSeasons = current.seasons.filter((s) => s.id !== sid);
    const updatedAnime: LocalAnime = {
      ...current,
      seasons: updatedSeasons,
      updatedAt: Date.now(),
    };

    setForm(updatedAnime);
    upsertAnime(updatedAnime);
    setAnimeSyncState((prev) => (prev === "synced" ? "local" : prev));
    toast.success(`Temporada ${targetSeason.number} removida com sucesso.`);
  }

  function addEpisode(sid: string) {
    setForm((f) =>
      f
        ? {
            ...f,
            seasons: f.seasons.map((s) => {
              if (s.id !== sid) return s;

              const number = (s.episodes.at(-1)?.number ?? 0) + 1;

              const ep: Episode = {
                id: `e-${crypto.randomUUID()}`,
                number,
                title: `Episódio ${number}`,
                published: false,
              };

              return {
                ...s,
                episodes: [...s.episodes, ep],
              };
            }),
          }
        : f,
    );
  }

  function patchEpisode(
    sid: string,
    eid: string,
    patch: Partial<Episode>,
  ) {
    setForm((f) =>
      f
        ? {
            ...f,
            seasons: f.seasons.map((s) =>
              s.id === sid
                ? {
                    ...s,
                    episodes: s.episodes.map((e) =>
                      e.id === eid ? { ...e, ...patch } : e,
                    ),
                  }
                : s,
            ),
          }
        : f,
    );
    setAnimeSyncState((prev) => (prev === "synced" ? "local" : prev));
  }

  function removeEpisode(sid: string, eid: string) {
    const season = current.seasons.find((s) => s.id === sid);
    const targetEp = season?.episodes.find((e) => e.id === eid);
    setForm((f) =>
      f
        ? {
            ...f,
            seasons: f.seasons.map((s) =>
              s.id === sid
                ? {
                    ...s,
                    episodes: s.episodes.filter((e) => e.id !== eid),
                  }
                : s,
            ),
          }
        : f,
    );
    if (season) {
      void persistEpisodeDelete(current.id, season.number, eid, targetEp?.number);
    }
  }

  const animeTitle =
    current.titleRomaji || current.titleEnglish || current.titleNative || "Anime";

  const totalEpisodesInEditor = current.seasons.reduce(
    (acc, s) => acc + s.episodes.length,
    0,
  );

  return (
    <div className="studio-enter space-y-6 pb-24 pt-2 sm:pb-12">
      {/* Cabeçalho do Editor */}
      <EditorHeader
        anime={current}
        isNew={id === "new" && !importId}
        importId={importId}
        isSaving={isSaving}
        onSave={save}
        onDuplicateAsDubbed={duplicateAsDubbed}
        onDelete={handleDeleteAnime}
        onReloadFromServer={() => recoverEpisodesFromServer(id)}
        isReloading={recoveryState.status === "loading"}
        outboxOps={outboxOps}
        canDelete={id !== "new" && stored.some((a) => a.id === current.id)}
        syncState={animeSyncState}
      />

      {/* Navegação rápida entre seções do editor */}
      <nav
        aria-label="Seções do editor"
        className="flex flex-wrap items-center gap-2"
      >
        <a
          href="#metadata"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-[var(--studio-panel)] px-3.5 text-xs font-medium text-[var(--color-muted)] transition-colors hover:border-purple-500/35 hover:text-[var(--color-fg)]"
        >
          <Info className="size-3.5 text-purple-400" />
          <span>Metadados &amp; Mídia</span>
        </a>
        <a
          href="#seasons"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-[var(--studio-panel)] px-3.5 text-xs font-medium text-[var(--color-muted)] transition-colors hover:border-purple-500/35 hover:text-[var(--color-fg)]"
        >
          <Layers className="size-3.5 text-purple-400" />
          <span>Temporadas &amp; Episódios</span>
          <span className="studio-mono rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-[var(--color-fg)]">
            {current.seasons.length}T · {totalEpisodesInEditor}E
          </span>
        </a>
      </nav>

      {/* Banner de Sincronização do Outbox */}
      {(() => {
        const animeOutboxOps = outboxOps.filter((o) => o.animeId === form.id);
        const conflictCount = animeOutboxOps.filter((o) => o.status === "conflict").length;
        const pendingCount = animeOutboxOps.filter((o) => o.status !== "conflict").length;

        if (animeOutboxOps.length === 0) return null;

        return (
          <div className="studio-panel flex flex-wrap items-center justify-between gap-3 rounded-2xl border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-100 sm:text-sm">
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
              onClick={async () => {
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
              }}
              className="h-9 border-amber-500/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
            >
              Sincronizar agora
            </Button>
          </div>
        );
      })()}

      {/* Banner de Feedback da Recuperação de Episódios do Servidor PostgreSQL */}
      {id !== "new" && recoveryState.status !== "idle" && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 text-xs transition-colors sm:text-sm ${
            recoveryState.status === "loading"
              ? "border-sky-500/30 bg-sky-500/10 text-sky-100"
              : recoveryState.status === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
              : recoveryState.status === "empty"
              ? "border-white/10 bg-[var(--studio-panel)] text-[var(--color-muted)]"
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
            onClick={() => void recoverEpisodesFromServer(id)}
            className="h-9 gap-1.5 text-xs hover:bg-white/[0.08]"
          >
            <RefreshCw
              className={`size-3.5 ${recoveryState.status === "loading" ? "animate-spin" : ""}`}
            />
            Recarregar do servidor
          </Button>
        </div>
      )}

      {/* Metadados Organizados do Anime */}
      <EditorMetadata
        form={current}
        onChange={set}
        genreText={genreText}
        onGenreTextChange={(val) => {
          setGenreText(val);
          setAnimeSyncState((prev) => (prev === "synced" ? "local" : prev));
        }}
      />

      {/* Gerenciamento Modernizado de Temporadas e Episódios */}
      <EditorSeasons
        animeId={current.id}
        seasons={current.seasons}
        onAddSeason={addSeason}
        onPatchSeason={patchSeason}
        onRemoveSeason={removeSeason}
        onAddEpisode={addEpisode}
        onPatchEpisode={patchEpisode}
        onRemoveEpisode={removeEpisode}
        onCaptureFrame={handleCaptureEpisodeFrame}
        onUploadVideoToB2={handleUploadVideoToB2}
        uploadingEpisode={uploadingEpisode}
        captureStatus={captureStatus}
        outboxOps={outboxOps}
      />

      {/* Barra de Ação Mobile Fixa */}
      <EditorMobileBar
        title={animeTitle}
        isSaving={isSaving}
        onSave={save}
        canDuplicate={id !== "new"}
        onDuplicate={duplicateAsDubbed}
      />
    </div>
  );
}
