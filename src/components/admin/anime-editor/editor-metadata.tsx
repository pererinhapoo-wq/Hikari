import { useState, useRef, type ReactNode } from "react";
import {
  Upload,
  ExternalLink,
  Film,
  Info,
  SlidersHorizontal,
  Image as ImageIcon,
  X,
  Globe,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { FORMAT_PT, STATUS_PT, SEASON_PT, GENRE_PT } from "@/lib/labels";
import {
  uploadImageFile,
  isPersistentStorageUrl,
} from "@/lib/storage/image-storage-client";
import type { LocalAnime } from "@/lib/types";

interface EditorMetadataProps {
  form: LocalAnime;
  onChange: <K extends keyof LocalAnime>(key: K, value: LocalAnime[K]) => void;
  genreText: string;
  onGenreTextChange: (text: string) => void;
}

export function EditorMetadata({
  form,
  onChange,
  genreText,
  onGenreTextChange,
}: EditorMetadataProps) {
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [coverLoadError, setCoverLoadError] = useState(false);
  const [bannerLoadError, setBannerLoadError] = useState(false);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const currentGenres = genreText
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean);

  const handleAddGenreTag = (genre: string) => {
    if (!currentGenres.includes(genre)) {
      const updated = [...currentGenres, genre].join(", ");
      onGenreTextChange(updated);
    }
  };

  const handleRemoveGenreTag = (genre: string) => {
    const updated = currentGenres.filter((g) => g !== genre).join(", ");
    onGenreTextChange(updated);
  };

  const handleCoverUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione um arquivo de imagem válido.");
      return;
    }
    setUploadingCover(true);
    try {
      const permanentUrl = await uploadImageFile(file, "anime-covers");
      onChange("cover", permanentUrl);
      setCoverLoadError(false);
      toast.success("Capa enviada para o armazenamento permanente!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload da capa.");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleBannerUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione um arquivo de imagem válido.");
      return;
    }
    setUploadingBanner(true);
    try {
      const permanentUrl = await uploadImageFile(file, "anime-banners");
      onChange("banner", permanentUrl);
      setBannerLoadError(false);
      toast.success("Banner enviado para o armazenamento permanente!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload do banner.");
    } finally {
      setUploadingBanner(false);
    }
  };

  return (
    <div id="metadata" className="grid gap-6 scroll-mt-20 xl:grid-cols-12">
      {/* Coluna Principal: Títulos, Sinopse e Classificação */}
      <div className="space-y-6 xl:col-span-7">
        {/* Informações Principais */}
        <section className="studio-panel rounded-2xl p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-2.5 border-b border-white/[0.07] pb-3.5">
            <Info className="size-4 text-purple-400" />
            <h2 className="font-display text-base font-semibold text-[var(--color-fg)]">
              Informações Principais
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Título (Romaji)" className="sm:col-span-2">
              <Input
                value={form.titleRomaji}
                onChange={(e) => onChange("titleRomaji", e.target.value)}
                placeholder="Ex: Sousou no Frieren"
                className="h-10 border-white/10 bg-[var(--studio-panel-alt)]"
              />
            </Field>

            <Field label="Título em Inglês">
              <Input
                value={form.titleEnglish}
                onChange={(e) => onChange("titleEnglish", e.target.value)}
                placeholder="Ex: Frieren: Beyond Journey's End"
                className="h-10 border-white/10 bg-[var(--studio-panel-alt)]"
              />
            </Field>

            <Field label="Título Original (Nativo)">
              <Input
                value={form.titleNative}
                onChange={(e) => onChange("titleNative", e.target.value)}
                placeholder="Ex: 葬送のフリーレン"
                className="h-10 border-white/10 bg-[var(--studio-panel-alt)]"
              />
            </Field>

            <Field label="Sinopse Oficial" className="sm:col-span-2">
              <Textarea
                rows={5}
                value={form.synopsis}
                onChange={(e) => onChange("synopsis", e.target.value)}
                placeholder="Sinopse detalhada do anime..."
                className="border-white/10 bg-[var(--studio-panel-alt)] leading-relaxed"
              />
            </Field>
          </div>
        </section>

        {/* Classificação & Propriedades */}
        <section className="studio-panel rounded-2xl p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-2.5 border-b border-white/[0.07] pb-3.5">
            <SlidersHorizontal className="size-4 text-purple-400" />
            <h2 className="font-display text-base font-semibold text-[var(--color-fg)]">
              Classificação &amp; Propriedades
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Formato de Exibição">
              <NativeSelect
                value={form.format}
                onChange={(e) => onChange("format", e.target.value)}
                className="h-10 border-white/10 bg-[var(--studio-panel-alt)]"
              >
                {Object.entries(FORMAT_PT).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field label="Status de Lançamento">
              <NativeSelect
                value={form.status}
                onChange={(e) => onChange("status", e.target.value)}
                className="h-10 border-white/10 bg-[var(--studio-panel-alt)]"
              >
                {Object.entries(STATUS_PT).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field label="Ano de Lançamento">
              <Input
                type="number"
                min={1950}
                max={2100}
                value={form.year ?? ""}
                onChange={(e) =>
                  onChange("year", e.target.value === "" ? null : Number(e.target.value))
                }
                placeholder="Ex: 2024"
                className="studio-tabular h-10 border-white/10 bg-[var(--studio-panel-alt)]"
              />
            </Field>

            <Field label="Estação do Ano">
              <NativeSelect
                value={form.season ?? ""}
                onChange={(e) => onChange("season", e.target.value || null)}
                className="h-10 border-white/10 bg-[var(--studio-panel-alt)]"
              >
                {[
                  <option key="__empty" value="">
                    — Não especificado —
                  </option>,
                  ...Object.entries(SEASON_PT).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  )),
                ]}
              </NativeSelect>
            </Field>

            <Field label="Nota da Crítica (0–100)">
              <Input
                type="number"
                min={0}
                max={100}
                value={form.score ?? ""}
                onChange={(e) =>
                  onChange("score", e.target.value === "" ? null : Number(e.target.value))
                }
                placeholder="Ex: 88"
                className="studio-tabular h-10 border-white/10 bg-[var(--studio-panel-alt)]"
              />
            </Field>

            <Field label="Total Previsto de Episódios">
              <Input
                type="number"
                min={0}
                value={form.episodesCount ?? ""}
                onChange={(e) =>
                  onChange(
                    "episodesCount",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                placeholder="Ex: 28"
                className="studio-tabular h-10 border-white/10 bg-[var(--studio-panel-alt)]"
              />
            </Field>

            <Field label="Trailer (YouTube URL ou ID)" className="sm:col-span-2 lg:col-span-3">
              <div className="flex gap-2">
                <Input
                  value={form.trailerId ?? ""}
                  onChange={(e) => onChange("trailerId", e.target.value || null)}
                  placeholder="Ex: https://youtube.com/watch?v=... ou ID"
                  className="h-10 border-white/10 bg-[var(--studio-panel-alt)]"
                />
                {form.trailerId && (
                  <a
                    href={
                      form.trailerId.startsWith("http")
                        ? form.trailerId
                        : `https://www.youtube.com/watch?v=${form.trailerId}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[var(--studio-panel-alt)] text-[var(--color-muted)] transition-colors hover:border-purple-500/40 hover:text-[var(--color-fg)]"
                    title="Testar trailer no YouTube"
                  >
                    <ExternalLink className="size-4" />
                  </a>
                )}
              </div>
            </Field>

            {/* Gêneros */}
            <Field
              label="Gêneros (separados por vírgula)"
              className="sm:col-span-2 lg:col-span-3"
            >
              <div className="space-y-2.5">
                <Input
                  value={genreText}
                  onChange={(e) => onGenreTextChange(e.target.value)}
                  placeholder="Ex: Ação, Aventura, Fantasia, Drama"
                  className="h-10 border-white/10 bg-[var(--studio-panel-alt)]"
                />

                {currentGenres.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-[var(--color-subtle)]">Ativos:</span>
                    {currentGenres.map((g) => (
                      <span
                        key={g}
                        className="inline-flex items-center gap-1 rounded-md border border-purple-500/35 bg-purple-500/12 px-2 py-0.5 text-xs text-purple-200"
                      >
                        <span>{g}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveGenreTag(g)}
                          className="text-purple-300 hover:text-white"
                          title="Remover gênero"
                          aria-label={`Remover ${g}`}
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-[var(--color-subtle)]">Sugestões:</span>
                  {Object.values(GENRE_PT)
                    .slice(0, 8)
                    .map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => handleAddGenreTag(g)}
                        className="rounded border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[11px] text-[var(--color-muted)] transition-colors hover:border-purple-500/35 hover:bg-purple-500/15 hover:text-purple-200"
                      >
                        + {g}
                      </button>
                    ))}
                </div>
              </div>
            </Field>

            {/* Visibilidade */}
            <div className="pt-1 sm:col-span-2 lg:col-span-3">
              <label className="flex cursor-pointer items-center gap-3.5 rounded-xl border border-white/[0.08] bg-[var(--studio-panel-alt)] p-3.5 transition-colors hover:border-white/15">
                <input
                  type="checkbox"
                  checked={form.hidden}
                  onChange={(e) => onChange("hidden", e.target.checked)}
                  className="size-4.5 rounded border-white/20 bg-black accent-purple-600"
                />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-[var(--color-fg)]">
                      Ocultar do catálogo público
                    </span>
                    <span
                      className={
                        form.hidden
                          ? "studio-mono text-[10px] font-semibold text-amber-300"
                          : "studio-mono text-[10px] font-semibold text-emerald-400"
                      }
                    >
                      {form.hidden ? "Invisível no site público" : "Visível na vitrine"}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--color-muted)]">
                    Quando ativado, o título fica restrito à visualização administrativa.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </section>
      </div>

      {/* Coluna Secundária: Imagens e Identificadores Externos */}
      <div className="space-y-6 xl:col-span-5">
        <section className="studio-panel rounded-2xl p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-2.5 border-b border-white/[0.07] pb-3.5">
            <ImageIcon className="size-4 text-purple-400" />
            <h2 className="font-display text-base font-semibold text-[var(--color-fg)]">
              Imagens Oficiais (Capa &amp; Banner)
            </h2>
          </div>

          <div className="space-y-6">
            {/* Capa */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-semibold text-[var(--color-fg)]">
                  Capa Vertical (2:3)
                </Label>
                {form.cover && (
                  <span
                    className={
                      isPersistentStorageUrl(form.cover)
                        ? "studio-mono text-[10px] text-emerald-400"
                        : "studio-mono text-[10px] text-[var(--color-subtle)]"
                    }
                  >
                    {isPersistentStorageUrl(form.cover)
                      ? "Armazenamento Permanente"
                      : "URL Externa"}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="relative mx-auto flex aspect-2/3 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/50 sm:mx-0">
                  {form.cover && !coverLoadError ? (
                    <img
                      src={form.cover}
                      alt="Capa"
                      className="size-full object-cover"
                      onError={() => setCoverLoadError(true)}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-3 text-center text-[var(--color-subtle)]">
                      <Film className="mb-1.5 size-6 opacity-60" />
                      <span className="text-[11px]">
                        {coverLoadError ? "Falha ao carregar" : "Sem capa"}
                      </span>
                    </div>
                  )}

                  {form.cover && (
                    <button
                      type="button"
                      onClick={() => onChange("cover", "")}
                      title="Remover capa"
                      className="absolute top-1.5 right-1.5 rounded-full bg-black/80 p-1 text-[var(--color-muted)] hover:text-rose-400"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex-1 space-y-2.5">
                  <Input
                    value={form.cover}
                    onChange={(e) => {
                      onChange("cover", e.target.value);
                      setCoverLoadError(false);
                    }}
                    placeholder="Cole a URL direta da imagem (JPG/PNG/WEBP)"
                    className="h-10 border-white/10 bg-[var(--studio-panel-alt)] text-xs"
                  />

                  <input
                    type="file"
                    ref={coverInputRef}
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleCoverUpload(f);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingCover}
                    onClick={() => coverInputRef.current?.click()}
                    className="h-9 w-full border-white/10 bg-[var(--studio-panel-alt)] text-xs text-[var(--color-fg)] hover:border-purple-500/40"
                  >
                    {uploadingCover ? (
                      <>
                        <Loader2 className="mr-1.5 size-3.5 animate-spin text-purple-400" />
                        <span>Enviando capa…</span>
                      </>
                    ) : (
                      <>
                        <Upload className="mr-1.5 size-3.5 text-purple-400" />
                        <span>Upload de Capa</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="border-t border-white/[0.06] pt-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-semibold text-[var(--color-fg)]">
                  Banner Panorâmico (16:9 / 21:9)
                </Label>
                {form.banner && (
                  <span
                    className={
                      isPersistentStorageUrl(form.banner)
                        ? "studio-mono text-[10px] text-emerald-400"
                        : "studio-mono text-[10px] text-[var(--color-subtle)]"
                    }
                  >
                    {isPersistentStorageUrl(form.banner)
                      ? "Armazenamento Permanente"
                      : "URL Externa"}
                  </span>
                )}
              </div>

              <div className="relative flex aspect-21/9 w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/50">
                {form.banner && !bannerLoadError ? (
                  <img
                    src={form.banner}
                    alt="Banner"
                    className="size-full object-cover"
                    onError={() => setBannerLoadError(true)}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-4 text-center text-[var(--color-subtle)]">
                    <ImageIcon className="mb-1.5 size-6 opacity-60" />
                    <span className="text-[11px]">
                      {bannerLoadError ? "Falha ao carregar banner" : "Sem banner cadastrado"}
                    </span>
                  </div>
                )}

                {form.banner && (
                  <button
                    type="button"
                    onClick={() => onChange("banner", "")}
                    title="Remover banner"
                    className="absolute top-2 right-2 rounded-full bg-black/80 p-1.5 text-[var(--color-muted)] hover:text-rose-400"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <Input
                  value={form.banner}
                  onChange={(e) => {
                    onChange("banner", e.target.value);
                    setBannerLoadError(false);
                  }}
                  placeholder="Cole a URL direta do banner panorâmico (JPG/PNG/WEBP)"
                  className="h-10 border-white/10 bg-[var(--studio-panel-alt)] text-xs"
                />

                <input
                  type="file"
                  ref={bannerInputRef}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleBannerUpload(f);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingBanner}
                  onClick={() => bannerInputRef.current?.click()}
                  className="h-9 w-full border-white/10 bg-[var(--studio-panel-alt)] text-xs text-[var(--color-fg)] hover:border-purple-500/40"
                >
                  {uploadingBanner ? (
                    <>
                      <Loader2 className="mr-1.5 size-3.5 animate-spin text-purple-400" />
                      <span>Enviando banner…</span>
                    </>
                  ) : (
                    <>
                      <Upload className="mr-1.5 size-3.5 text-purple-400" />
                      <span>Upload de Banner</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Identificadores Externos */}
        <section className="studio-panel rounded-2xl p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2.5 border-b border-white/[0.07] pb-3.5">
            <Globe className="size-4 text-purple-400" />
            <h2 className="font-display text-base font-semibold text-[var(--color-fg)]">
              Identificadores &amp; Relação Externa
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="studio-panel-alt space-y-1 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[var(--color-muted)]">
                  AniList
                </span>
                {form.anilistId && (
                  <a
                    href={`https://anilist.co/anime/${form.anilistId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-purple-300 hover:underline"
                  >
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
              <p className="studio-mono text-sm font-semibold text-[var(--color-fg)]">
                {form.anilistId ? `#${form.anilistId}` : "—"}
              </p>
            </div>

            <div className="studio-panel-alt space-y-1 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[var(--color-muted)]">
                  MAL
                </span>
                {form.malId && (
                  <a
                    href={`https://myanimelist.net/anime/${form.malId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-purple-300 hover:underline"
                  >
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
              <p className="studio-mono text-sm font-semibold text-[var(--color-fg)]">
                {form.malId ? `#${form.malId}` : "—"}
              </p>
            </div>

            <div className="studio-panel-alt space-y-1 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[var(--color-muted)]">
                  Kitsu
                </span>
                {form.kitsuId && (
                  <a
                    href={`https://kitsu.io/anime/${form.kitsuId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-purple-300 hover:underline"
                  >
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
              <p className="studio-mono text-sm font-semibold text-[var(--color-fg)]">
                {form.kitsuId ? `#${form.kitsuId}` : "—"}
              </p>
            </div>
          </div>

          <div className="studio-tabular mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-[11px] text-[var(--color-subtle)]">
            <span>
              Cadastro:{" "}
              <strong className="text-[var(--color-muted)]">
                {form.createdAt ? new Date(form.createdAt).toLocaleString("pt-BR") : "—"}
              </strong>
            </span>
            <span>
              Modificado:{" "}
              <strong className="text-[var(--color-muted)]">
                {form.updatedAt ? new Date(form.updatedAt).toLocaleString("pt-BR") : "—"}
              </strong>
            </span>
          </div>
        </section>
      </div>
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
