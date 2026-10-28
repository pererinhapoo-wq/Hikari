import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus, Trash2, Camera, Loader2, AlertCircle, CheckCircle2, Film } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { fetchAnimeDetail } from "@/lib/api";
import { animeToLocal, type Episode, type LocalAnime, type Season } from "@/lib/types";
import { useHikariStore } from "@/lib/store";
import { youtubeIdFrom } from "@/lib/utils";
import { uploadVideoToB2 } from "@/lib/b2";
import {
  captureAndUploadThumbnail,
  isHikariPlayableUrl,
  isEpisodePublished,
} from "@/lib/published-episodes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { FORMAT_PT, STATUS_PT, SEASON_PT } from "@/lib/labels";

export const Route = createFileRoute("/admin/$id")({
  validateSearch: (raw: Record<string, unknown>): { importId?: string } => ({
    importId: typeof raw.importId === "string" && raw.importId ? raw.importId : undefined,
  }),
  loaderDeps: ({ search }) => ({ importId: search.importId }),
  loader: async ({ params, deps }) => {
    const fetchId = params.id === "new" ? deps.importId : params.id;
    if (!fetchId || fetchId.startsWith("local-")) return { remote: null };
    try {
      const remote = await fetchAnimeDetail({ data: { id: fetchId } });
      return { remote };
    } catch {
      return { remote: null };
    }
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
  const { remote } = Route.useLoaderData();
  const navigate = useNavigate();
  const stored = useHikariStore((s) => s.animes);
  const hydrated = useHikariStore((s) => s.hydrated);
  const upsertAnime = useHikariStore((s) => s.upsertAnime);
  const removeAnime = useHikariStore((s) => s.removeAnime);
  const [form, setForm] = useState<LocalAnime | null>(null);
  const [genreText, setGenreText] = useState("");
  const [uploadingEpisode, setUploadingEpisode] = useState<string | null>(null);
  const [captureStatus, setCaptureStatus] = useState<
    Record<string, { status: "loading" | "error" | "success"; message?: string }>
  >({});

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
      toast.error(
        "Insira uma URL de vídeo válida antes de capturar a miniatura.",
      );
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
        err instanceof Error
          ? err.message
          : "Falha na captura do quadro do vídeo.";
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

  useEffect(() => {
    if (!hydrated) return;

    const locals = useHikariStore.getState().animes;
    const existing =
      locals.find((a) => a.id === id) ||
      (remote?.anilistId
        ? locals.find((a) => a.anilistId === remote.anilistId)
        : undefined);

    const next = existing ?? (remote ? animeToLocal(remote) : emptyLocal());

    setForm(next);
    setGenreText(next.genres.join(", "));
  }, [hydrated, id, remote]);

  if (!form) {
    return <div className="h-64 animate-pulse rounded-xl bg-elevated" />;
  }

  const current = form;

  function set<K extends keyof LocalAnime>(key: K, value: LocalAnime[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function save() {
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

    upsertAnime(next);
    toast.success("Salvo neste dispositivo.");
    void navigate({ to: "/admin/$id", params: { id: next.id } });
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
    setForm((f) =>
      f
        ? {
            ...f,
            seasons: f.seasons.filter((s) => s.id !== sid),
          }
        : f,
    );
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
  }

  return (
    <div className="space-y-8 pt-6 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            to="/admin"
            className="text-xs text-muted hover:text-fg"
          >
            ← Painel
          </Link>

          <h1 className="mt-1 font-display text-3xl tracking-tight">
            {id === "new" && !importId ? "Novo anime" : "Editar anime"}
          </h1>
        </div>

        <div className="flex gap-2">
          {id !== "new" &&
            stored.some((a) => a.id === current.id) && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  removeAnime(current.id);
                  toast.success("Excluído.");
                  void navigate({ to: "/admin" });
                }}
              >
                Excluir
              </Button>
            )}

          <Button type="button" onClick={save}>
            Salvar
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[12rem_1fr]">
        <div className="space-y-3">
          <div className="overflow-hidden rounded-lg bg-elevated shadow-[var(--shadow-border)]">
            {form.cover ? (
              <img
                src={form.cover}
                alt=""
                className="aspect-2/3 w-full object-cover"
              />
            ) : (
              <div className="flex aspect-2/3 items-center justify-center text-xs text-subtle">
                Sem capa
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Título (romaji)" className="sm:col-span-2">
            <Input
              value={form.titleRomaji}
              onChange={(e) =>
                set("titleRomaji", e.target.value)
              }
            />
          </Field>

          <Field label="Título em inglês">
            <Input
              value={form.titleEnglish}
              onChange={(e) =>
                set("titleEnglish", e.target.value)
              }
            />
          </Field>

          <Field label="Título original">
            <Input
              value={form.titleNative}
              onChange={(e) =>
                set("titleNative", e.target.value)
              }
            />
          </Field>

          <Field
            label="URL da capa"
            className="sm:col-span-2"
          >
            <Input
              value={form.cover}
              onChange={(e) =>
                set("cover", e.target.value)
              }
            />
          </Field>

          <Field
            label="URL do banner"
            className="sm:col-span-2"
          >
            <Input
              value={form.banner}
              onChange={(e) =>
                set("banner", e.target.value)
              }
            />
          </Field>

          <Field
            label="Sinopse"
            className="sm:col-span-2"
          >
            <Textarea
              value={form.synopsis}
              onChange={(e) =>
                set("synopsis", e.target.value)
              }
            />
          </Field>

          <Field
            label="Gêneros (vírgula)"
            className="sm:col-span-2"
          >
            <Input
              value={genreText}
              onChange={(e) =>
                setGenreText(e.target.value)
              }
            />
          </Field>

          <Field label="Nota (0–100)">
            <Input
              type="number"
              min={0}
              max={100}
              value={form.score ?? ""}
              onChange={(e) =>
                set(
                  "score",
                  e.target.value === ""
                    ? null
                    : Number(e.target.value),
                )
              }
            />
          </Field>

          <Field label="Ano">
            <Input
              type="number"
              value={form.year ?? ""}
              onChange={(e) =>
                set(
                  "year",
                  e.target.value === ""
                    ? null
                    : Number(e.target.value),
                )
              }
            />
          </Field>

          <Field label="Formato">
            <NativeSelect
              value={form.format}
              onChange={(e) =>
                set("format", e.target.value)
              }
            >
              {Object.entries(FORMAT_PT).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field label="Status">
            <NativeSelect
              value={form.status}
              onChange={(e) =>
                set("status", e.target.value)
              }
            >
              {Object.entries(STATUS_PT).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field label="Temporada">
            <NativeSelect
              value={form.season ?? ""}
              onChange={(e) =>
                set("season", e.target.value || null)
              }
            >
              <option value="">—</option>

              {Object.entries(SEASON_PT).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field label="Trailer (YouTube URL ou ID)">
            <Input
              value={form.trailerId ?? ""}
              onChange={(e) =>
                set(
                  "trailerId",
                  e.target.value || null,
                )
              }
            />
          </Field>

          <label className="flex h-11 items-center gap-2 text-sm text-muted sm:col-span-2">
            <input
              type="checkbox"
              checked={form.hidden}
              onChange={(e) =>
                set("hidden", e.target.checked)
              }
              className="size-4 accent-primary"
            />

            Ocultar do catálogo público
          </label>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">
            Temporadas e episódios
          </h2>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addSeason}
          >
            <Plus className="size-4" />
            Temporada
          </Button>
        </div>

        {form.seasons.map((season) => (
          <div
            key={season.id}
            className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]"
          >
            <div className="flex flex-col gap-3 sm:flex-row">
              <Field
                label="Nome"
                className="flex-1"
              >
                <Input
                  value={season.title}
                  onChange={(e) =>
                    patchSeason(season.id, {
                      title: e.target.value,
                    })
                  }
                />
              </Field>

              <Field
                label="Nº"
                className="w-24"
              >
                <Input
                  type="number"
                  value={season.number}
                  onChange={(e) =>
                    patchSeason(season.id, {
                      number: Number(e.target.value),
                    })
                  }
                />
              </Field>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="self-end"
                aria-label="Remover temporada"
                onClick={() =>
                  removeSeason(season.id)
                }
              >
                <Trash2 className="size-4 text-danger" />
              </Button>
            </div>

            <ul className="mt-4 space-y-3">
              {season.episodes.map((ep) => (
                <li
                  key={ep.id}
                  className="rounded-lg bg-elevated p-3"
                >
                  <div className="grid gap-2 sm:grid-cols-12">
                    <Field
                      label={
                        <span className="flex items-center gap-1">
                          <span>#</span>
                          {isEpisodePublished(ep) && (
                            <span className="size-1.5 rounded-full bg-emerald-400" title="Publicado no Hikari" />
                          )}
                        </span>
                      }
                      className="sm:col-span-1"
                    >
                      <Input
                        type="number"
                        value={ep.number}
                        onChange={(e) =>
                          patchEpisode(
                            season.id,
                            ep.id,
                            {
                              number: Number(
                                e.target.value,
                              ),
                            },
                          )
                        }
                      />
                    </Field>

                    <Field
                      label="Título"
                      className="sm:col-span-5"
                    >
                      <Input
                        value={ep.title}
                        onChange={(e) =>
                          patchEpisode(
                            season.id,
                            ep.id,
                            {
                              title: e.target.value,
                            },
                          )
                        }
                      />
                    </Field>

                    <Field
                      label="Duração"
                      className="sm:col-span-2"
                    >
                      <Input
                        value={ep.duration ?? ""}
                        onChange={(e) =>
                          patchEpisode(
                            season.id,
                            ep.id,
                            {
                              duration:
                                e.target.value,
                            },
                          )
                        }
                        placeholder="24 min"
                      />
                    </Field>

                    {[
                      {
                        key: "videoUrl" as const,
                        label: "Player 1",
                      },
                      {
                        key: "videoUrl2" as const,
                        label: "Player 2",
                      },
                      {
                        key: "videoUrl3" as const,
                        label: "Player 3",
                      },
                    ].map(({ key, label }) => (
                      <Field
                        key={key}
                        label={`${label} — URL do vídeo`}
                        className="sm:col-span-4"
                      >
                        <div className="flex gap-2">
                          <Input
                            value={ep[key] ?? ""}
                            onChange={(e) =>
                              patchEpisode(
                                season.id,
                                ep.id,
                                {
                                  [key]:
                                    e.target.value,
                                },
                              )
                            }
                            onBlur={(e) => {
                              const val = e.target.value.trim();
                              if (val && !ep.thumbnail && isHikariPlayableUrl(val)) {
                                void handleCaptureEpisodeFrame(season.id, ep, val);
                              }
                            }}
                            onPaste={(e) => {
                              const val = e.clipboardData.getData("text").trim();
                              if (val && !ep.thumbnail && isHikariPlayableUrl(val)) {
                                setTimeout(() => {
                                  void handleCaptureEpisodeFrame(season.id, ep, val);
                                }, 100);
                              }
                            }}
                            placeholder="URL do vídeo (MP4 / R2)"
                          />

                          <Button
                            type="button"
                            variant="outline"
                            className="shrink-0"
                            disabled={
                              uploadingEpisode ===
                              `${ep.id}-${key}`
                            }
                            onClick={async () => {
                              const uploadId = `${ep.id}-${key}`;

                              setUploadingEpisode(
                                uploadId,
                              );

                              try {
                                await uploadVideoToB2(
                                  (url, file) => {
                                    patchEpisode(
                                      season.id,
                                      ep.id,
                                      {
                                        [key]: url,
                                      },
                                    );

                                    toast.success(
                                      `${label} enviado com sucesso.`,
                                    );

                                    if (!ep.thumbnail) {
                                      const frameSource = file
                                        ? URL.createObjectURL(file)
                                        : url;

                                      captureAndUploadThumbnail(frameSource, {
                                        episodeTitle: ep.title || `Episódio ${ep.number}`,
                                      })
                                        .then((res) => {
                                          patchEpisode(
                                            season.id,
                                            ep.id,
                                            {
                                              thumbnail: res.url,
                                            },
                                          );
                                          toast.success(
                                            "Miniatura capturada e salva automaticamente!",
                                          );
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
                                  },
                                );
                              } catch (error) {
                                toast.error(
                                  error instanceof Error
                                    ? error.message
                                    : "Falha no upload.",
                                );
                              } finally {
                                setUploadingEpisode(
                                  null,
                                );
                              }
                            }}
                          >
                            {uploadingEpisode ===
                            `${ep.id}-${key}`
                              ? "Abrindo…"
                              : "Enviar"}
                          </Button>
                        </div>
                      </Field>
                    ))}

                    <Field
                      label="Player 4 — URL do vídeo"
                      className="sm:col-span-4"
                    >
                      <div className="flex gap-2">
                        <Input
                          value={ep.videoUrl4 ?? ""}
                          onChange={(e) =>
                            patchEpisode(
                              season.id,
                              ep.id,
                              {
                                videoUrl4:
                                  e.target.value,
                              },
                            )
                          }
                          onBlur={(e) => {
                            const val = e.target.value.trim();
                            if (val && !ep.thumbnail && isHikariPlayableUrl(val)) {
                              void handleCaptureEpisodeFrame(season.id, ep, val);
                            }
                          }}
                          onPaste={(e) => {
                            const val = e.clipboardData.getData("text").trim();
                            if (val && !ep.thumbnail && isHikariPlayableUrl(val)) {
                              setTimeout(() => {
                                void handleCaptureEpisodeFrame(season.id, ep, val);
                              }, 100);
                            }
                          }}
                          placeholder="URL do vídeo (MP4 / R2)"
                        />

                        <Button
                          type="button"
                          variant="outline"
                          className="shrink-0"
                          disabled
                        >
                          Enviar
                        </Button>
                      </div>
                    </Field>

                    <Field
                      label="Player 5 — URL do vídeo"
                      className="sm:col-span-4"
                    >
                      <div className="flex gap-2">
                        <Input
                          value={ep.videoUrl5 ?? ""}
                          onChange={(e) =>
                            patchEpisode(
                              season.id,
                              ep.id,
                              {
                                videoUrl5:
                                  e.target.value,
                              },
                            )
                          }
                          onBlur={(e) => {
                            const val = e.target.value.trim();
                            if (val && !ep.thumbnail && isHikariPlayableUrl(val)) {
                              void handleCaptureEpisodeFrame(season.id, ep, val);
                            }
                          }}
                          onPaste={(e) => {
                            const val = e.clipboardData.getData("text").trim();
                            if (val && !ep.thumbnail && isHikariPlayableUrl(val)) {
                              setTimeout(() => {
                                void handleCaptureEpisodeFrame(season.id, ep, val);
                              }, 100);
                            }
                          }}
                          placeholder="URL do vídeo (HLS / MP4)"
                        />
                      </div>
                    </Field>

                    <Field
                      label="Thumb do Episódio (Miniatura Real do Vídeo)"
                      className="sm:col-span-11"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {ep.thumbnail ? (
                            <div className="relative size-10 shrink-0 overflow-hidden rounded-md border border-purple-500/30 bg-black">
                              <img
                                src={ep.thumbnail}
                                alt=""
                                className="size-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-dashed border-zinc-700 bg-black/40 text-zinc-500">
                              <Film className="size-4" />
                            </div>
                          )}
                          <Input
                            value={ep.thumbnail ?? ""}
                            onChange={(e) =>
                              patchEpisode(
                                season.id,
                                ep.id,
                                {
                                  thumbnail:
                                    e.target.value,
                                },
                              )
                            }
                            placeholder="URL da miniatura do episódio (capturada ou manual)"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            disabled={captureStatus[ep.id]?.status === "loading"}
                            onClick={() =>
                              handleCaptureEpisodeFrame(
                                season.id,
                                ep,
                              )
                            }
                            className="shrink-0 gap-1.5 text-xs text-purple-300 hover:text-white"
                            title="Capturar quadro do vídeo agora"
                          >
                            {captureStatus[ep.id]?.status === "loading" ? (
                              <>
                                <Loader2 className="size-3.5 animate-spin" />
                                <span>Capturando…</span>
                              </>
                            ) : (
                              <>
                                <Camera className="size-3.5" />
                                <span>{ep.thumbnail ? "Recapturar" : "Capturar"}</span>
                              </>
                            )}
                          </Button>
                        </div>

                        {/* Feedback em tempo real do estado da captura */}
                        {captureStatus[ep.id]?.status === "loading" && (
                          <div className="flex items-center gap-2 rounded-md bg-purple-950/40 border border-purple-500/30 px-2.5 py-1.5 text-xs text-purple-300">
                            <Loader2 className="size-3.5 animate-spin shrink-0 text-purple-400" />
                            <span>Capturando quadro real e salvando miniatura persistente…</span>
                          </div>
                        )}

                        {captureStatus[ep.id]?.status === "error" && (
                          <div className="rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-200 space-y-1">
                            <div className="flex items-center gap-1.5 font-medium text-amber-300">
                              <AlertCircle className="size-3.5 shrink-0" />
                              <span>Captura automática indisponível para este vídeo:</span>
                            </div>
                            <p className="text-[11px] text-amber-200/90 pl-5">
                              {captureStatus[ep.id]?.message}
                            </p>
                            <p className="text-[10px] text-amber-300/70 pl-5">
                              Dica: Para Cloudflare R2, ative a regra de CORS no bucket (AllowedOrigins: [&quot;*&quot;]). Você também pode colar uma URL de imagem diretamente no campo acima.
                            </p>
                          </div>
                        )}

                        {captureStatus[ep.id]?.status === "success" && (
                          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                            <CheckCircle2 className="size-3.5 shrink-0" />
                            <span>Miniatura própria capturada e salva com sucesso!</span>
                          </div>
                        )}
                      </div>
                    </Field>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="sm:col-span-1 sm:self-end"
                      aria-label="Remover episódio"
                      onClick={() =>
                        removeEpisode(
                          season.id,
                          ep.id,
                        )
                      }
                    >
                      <Trash2 className="size-4 text-danger" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() =>
                addEpisode(season.id)
              }
            >
              <Plus className="size-4" />
              Episódio
            </Button>
          </div>
        ))}
      </section>
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
      <Label className="mb-1.5 block">
        {label}
      </Label>
      {children}
    </label>
  );
    }
