import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, CheckCircle2, Film, AlertCircle, RefreshCw } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { fetchAnimeDetail } from "@/lib/api";
import { animeToLocal, type Episode, type LocalAnime, type Season } from "@/lib/types";
import { useHikariStore } from "@/lib/store";
import { youtubeIdFrom } from "@/lib/utils";
import { uploadVideoToB2 } from "@/lib/b2";
import {
  captureAndUploadThumbnail,
  isHikariPlayableUrl,
} from "@/lib/published-episodes";
import { Button } from "@/components/ui/button";
import {
  persistEpisode,
  persistEpisodeDelete,
  readOutbox,
  flushOutbox,
  type OutboxOperation,
} from "@/lib/episode-writer";
import {
  executeGetCatalogEpisodes,
  getAdminCatalogEpisodes,
  mergeAdminEpisodesWithServer,
  type CatalogEpisodesResult,
} from "@/lib/catalog-episodes";
import { EditorHeader } from "@/components/admin/anime-editor/editor-header";
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

    if (fetchId && !fetchId.startsWith("local-")) {
      try {
        remote = await fetchAnimeDetail({ data: { id: fetchId } });
      } catch {
        remote = null;
      }
    }

    // Carrega episódios persistidos no PostgreSQL para o anime no painel administrativo
    if (params.id && params.id !== "new") {
      try {
        serverEpisodes = await executeGetCatalogEpisodes(params.id, {
          includeUnpublished: true,
        });
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
  const stored = useHikariStore((s) => s.animes);
  const hydrated = useHikariStore((s) => s.hydrated);
  const upsertAnime = useHikariStore((s) => s.upsertAnime);
  const removeAnime = useHikariStore((s) => s.removeAnime);

  const [form, setForm] = useState<LocalAnime | null>(null);
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
          const currentOps = typeof window !== "undefined" ? readOutbox() : outboxOps;
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
    [id, outboxOps],
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

    if (!videoUrl || !isHikariPlayableUrl(videoUrl)) {
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
    if (!hydrated) return;

    const existing =
      id === "new"
        ? undefined
        : stored.find((a) => a.id === id) ||
          (remote?.anilistId
            ? stored.find((a) => a.anilistId === remote.anilistId)
            : undefined);

    const base =
      existing ??
      (remote
        ? animeToLocal(remote)
        : {
            ...emptyLocal(),
            id: id !== "new" ? id : `local-${crypto.randomUUID()}`,
          });

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
      setRecoveryState({
        status: "success",
        message: `Episódios recuperados com sucesso do PostgreSQL (${serverEpisodes.episodes.length} confirmados no banco).`,
        recoveredCount: serverEpisodes.episodes.length,
      });
    } else {
      setForm(base);
      setGenreText(base.genres.join(", "));

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
      }
    }
  }, [hydrated, stored, id, remote, serverEpisodes, recoverEpisodesFromServer]);

  if (!form) {
    return (
      <div className="space-y-6 pt-6 pb-12">
        <div className="h-28 animate-pulse rounded-2xl bg-surface/60 border border-white/5" />
        <div className="h-96 animate-pulse rounded-2xl bg-surface/60 border border-white/5" />
      </div>
    );
  }

  const current = form;

  function set<K extends keyof LocalAnime>(key: K, value: LocalAnime[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
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
    removeAnime(current.id);
    toast.success("Anime excluído deste dispositivo.");
    void navigate({ to: "/admin" });

    try {
      await fetch(`/api/admin/catalog-anime?id=${encodeURIComponent(current.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
    } catch (err) {
      console.warn("[admin] Falha ao deletar anime no servidor:", err);
    }
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

    setIsSaving(true);

    // 1. Persistência local inicial (IndexedDB via Zustand)
    upsertAnime(next);
    void navigate({ to: "/admin/$id", params: { id: next.id } });

    // 2. Persistência no servidor e reconciliação com o outbox
    try {
      void fetch("/api/admin/catalog-anime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: next.id,
          titleRomaji: next.titleRomaji,
          titleEnglish: next.titleEnglish,
          titleNative: next.titleNative,
          cover: next.cover,
          banner: next.banner,
          synopsis: next.synopsis,
          score: next.score,
          genres: next.genres,
          format: next.format,
          status: next.status,
          episodesCount: next.episodesCount,
          season: next.season,
          year: next.year,
          trailerId: next.trailerId,
          hidden: next.hidden,
          anilistId: next.anilistId,
          malId: next.malId,
          kitsuId: next.kitsuId,
          seasons: next.seasons.map((s) => ({
            id: s.id,
            number: s.number,
            title: s.title,
          })),
        }),
      }).catch((err) => {
        console.warn("[admin] Falha ao persistir metadados do anime no servidor:", err);
      });

      const animeTitle = next.titleRomaji || next.titleEnglish || next.titleNative || "Anime";
      const promises: ReturnType<typeof persistEpisode>[] = [];
      for (const season of next.seasons) {
        for (const ep of season.episodes) {
          promises.push(persistEpisode(next.id, season.number, ep, animeTitle));
        }
      }

      if (promises.length > 0) {
        const results = await Promise.all(promises);

        // Reconcilia os IDs no estado local do formulário se o servidor tiver retornado um ID canônico preexistente
        let formNeedsUpdate = false;
        const reconciledSeasons = next.seasons.map((season) => ({
          ...season,
          episodes: season.episodes.map((ep) => {
            const match = results.find(
              (r) => r.canonicalId && r.canonicalId !== ep.id && r.status === "synced",
            );
            if (match && match.canonicalId) {
              formNeedsUpdate = true;
              return { ...ep, id: match.canonicalId };
            }
            return ep;
          }),
        }));

        if (formNeedsUpdate) {
          setForm((f) => (f ? { ...f, seasons: reconciledSeasons } : f));
        }

        const confirmedCount = results.filter((r) => r.confirmed).length;
        const conflictCount = results.filter((r) => r.status === "conflict").length;
        const pendingCount = results.filter((r) => r.status === "pending").length;

        if (conflictCount > 0) {
          const firstErr = results.find((r) => r.status === "conflict")?.error;
          toast.warning(
            `Ação necessária: ${conflictCount} episódio(s) preservados localmente com erro de validação (${firstErr || "verifique os dados"}).`,
          );
        } else if (pendingCount > 0) {
          toast.info(
            `Sincronização pendente: ${pendingCount} episódio(s) preservados localmente aguardando conexão com o servidor.`,
          );
        } else if (confirmedCount === results.length) {
          toast.success("Salvo no servidor: episódios e alterações confirmados no PostgreSQL.");
        } else {
          toast.info("Salvo localmente: aguardando confirmação do servidor.");
        }
      } else {
        toast.success("Anime salvo com sucesso!");
      }
    } catch (err) {
      console.warn("[admin] Erro ao sincronizar episódios:", err);
      toast.info("Salvo localmente: alterações preservadas neste dispositivo.");
    } finally {
      setIsSaving(false);
      if (typeof window !== "undefined") {
        setOutboxOps(readOutbox());
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
  }

  function removeSeason(sid: string) {
    const targetSeason = current.seasons.find((s) => s.id === sid);
    if (targetSeason) {
      for (const ep of targetSeason.episodes) {
        void persistEpisodeDelete(current.id, targetSeason.number, ep.id, ep.number);
      }
    }
    setForm((f) =>
      f
        ? {
            ...f,
            seasons: f.seasons.filter((s) => s.id !== sid),
          }
        : f,
    );
    toast.info("Temporada removida.");
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

  return (
    <div className="space-y-8 pt-4 pb-20 sm:pb-12">
      {/* Cabeçalho do Editor Modernizado */}
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
      />

      {/* Banner de Sincronização do Outbox */}
      {(() => {
        const animeOutboxOps = outboxOps.filter((o) => o.animeId === form.id);
        const conflictCount = animeOutboxOps.filter((o) => o.status === "conflict").length;
        const pendingCount = animeOutboxOps.filter((o) => o.status !== "conflict").length;

        if (animeOutboxOps.length === 0) return null;

        return (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs sm:text-sm text-amber-200 backdrop-blur-md">
            <div className="space-y-0.5">
              <p className="font-semibold text-amber-300">
                Fila de Envio (Outbox): {animeOutboxOps.length} operação(ões) pendente(s)
              </p>
              <p className="text-xs text-amber-200/80">
                {conflictCount > 0
                  ? `${conflictCount} em conflito (aguardando correção) e ${pendingCount} pendente(s) de envio ao PostgreSQL.`
                  : `${pendingCount} operação(ões) aguardando sincronização com o banco.`}
              </p>
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
              className="border-amber-500/40 text-amber-200 hover:bg-amber-500/20"
            >
              Sincronizar agora
            </Button>
          </div>
        );
      })()}

      {/* Banner de Feedback da Recuperação de Episódios do Servidor PostgreSQL */}
      {id !== "new" && recoveryState.status !== "idle" && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 text-xs sm:text-sm border transition-colors backdrop-blur-md ${
            recoveryState.status === "loading"
              ? "border-sky-500/30 bg-sky-500/10 text-sky-200"
              : recoveryState.status === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : recoveryState.status === "empty"
              ? "border-white/10 bg-surface/60 text-muted"
              : "border-amber-500/30 bg-amber-500/10 text-amber-200"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {recoveryState.status === "loading" && (
              <Loader2 className="size-4 animate-spin text-sky-400 shrink-0" />
            )}
            {recoveryState.status === "success" && (
              <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
            )}
            {recoveryState.status === "empty" && (
              <Film className="size-4 text-muted shrink-0" />
            )}
            {recoveryState.status === "error" && (
              <AlertCircle className="size-4 text-amber-400 shrink-0" />
            )}
            <span>{recoveryState.message}</span>
          </div>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={recoveryState.status === "loading"}
            onClick={() => void recoverEpisodesFromServer(id)}
            className="h-8 text-xs gap-1.5 hover:bg-white/10"
          >
            <RefreshCw className={`size-3.5 ${recoveryState.status === "loading" ? "animate-spin" : ""}`} />
            Recarregar do servidor
          </Button>
        </div>
      )}

      {/* Metadados Organizados do Anime */}
      <EditorMetadata
        form={current}
        onChange={set}
        genreText={genreText}
        onGenreTextChange={setGenreText}
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
