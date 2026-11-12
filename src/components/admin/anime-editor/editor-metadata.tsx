import { useState, useRef, type ReactNode } from "react";
import {
  Upload,
  Link as LinkIcon,
  ExternalLink,
  Film,
  Sparkles,
  Info,
  SlidersHorizontal,
  Image as ImageIcon,
  Calendar,
  Star,
  CheckCircle2,
  X,
  PlaySquare,
  Globe,
  Tag,
  EyeOff,
  Eye,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { FORMAT_PT, STATUS_PT, SEASON_PT, GENRE_PT } from "@/lib/labels";
import { uploadImageFile, isPersistentStorageUrl } from "@/lib/storage/image-storage-client";
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

  // Lista parsed de gêneros para exibição de tags visuais
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

  // Upload seguro de Capa via Vercel Blob
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

  // Upload seguro de Banner via Vercel Blob
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
    <div className="space-y-6">
      {/* 1. SEÇÃO: INFORMAÇÕES PRINCIPAIS */}
      <section className="rounded-2xl border border-white/5 bg-surface/70 p-5 shadow-sm backdrop-blur-md sm:p-6">
        <div className="mb-4 flex items-center gap-2 border-b border-white/5 pb-3">
          <Info className="size-4 text-purple-400" />
          <h2 className="font-display text-base font-semibold text-white">
            Informações Principais
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Título (Romaji)" className="sm:col-span-2 lg:col-span-1">
            <Input
              value={form.titleRomaji}
              onChange={(e) => onChange("titleRomaji", e.target.value)}
              placeholder="Ex: Sousou no Frieren"
              className="bg-elevated/50 focus:border-purple-500/50"
            />
          </Field>

          <Field label="Título em Inglês" className="sm:col-span-1">
            <Input
              value={form.titleEnglish}
              onChange={(e) => onChange("titleEnglish", e.target.value)}
              placeholder="Ex: Frieren: Beyond Journey's End"
              className="bg-elevated/50 focus:border-purple-500/50"
            />
          </Field>

          <Field label="Título Original (Nativo)" className="sm:col-span-1">
            <Input
              value={form.titleNative}
              onChange={(e) => onChange("titleNative", e.target.value)}
              placeholder="Ex: 葬送のフリーレン"
              className="bg-elevated/50 focus:border-purple-500/50"
            />
          </Field>

          <Field label="Sinopse Oficial" className="sm:col-span-2 lg:col-span-3">
            <Textarea
              rows={4}
              value={form.synopsis}
              onChange={(e) => onChange("synopsis", e.target.value)}
              placeholder="Sinopse detalhada do anime..."
              className="bg-elevated/50 leading-relaxed focus:border-purple-500/50"
            />
          </Field>
        </div>
      </section>

      {/* 2. SEÇÃO: CLASSIFICAÇÃO E PROPRIEDADES */}
      <section className="rounded-2xl border border-white/5 bg-surface/70 p-5 shadow-sm backdrop-blur-md sm:p-6">
        <div className="mb-4 flex items-center gap-2 border-b border-white/5 pb-3">
          <SlidersHorizontal className="size-4 text-purple-400" />
          <h2 className="font-display text-base font-semibold text-white">
            Classificação & Propriedades
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          <Field label="Formato de Exibição">
            <NativeSelect
              value={form.format}
              onChange={(e) => onChange("format", e.target.value)}
              className="bg-elevated/50"
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
              className="bg-elevated/50"
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
              className="bg-elevated/50"
            />
          </Field>

          <Field label="Estação do Ano">
            <NativeSelect
              value={form.season ?? ""}
              onChange={(e) => onChange("season", e.target.value || null)}
              className="bg-elevated/50"
            >
              <option value="">— Não especificado —</option>
              {Object.entries(SEASON_PT).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
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
              className="bg-elevated/50"
            />
          </Field>

          <Field label="Total Previsto de Episódios">
            <Input
              type="number"
              min={0}
              value={form.episodesCount ?? ""}
              onChange={(e) =>
                onChange("episodesCount", e.target.value === "" ? null : Number(e.target.value))
              }
              placeholder="Ex: 28"
              className="bg-elevated/50"
            />
          </Field>

          <Field label="Trailer (YouTube URL ou ID)" className="sm:col-span-2">
            <div className="flex gap-2">
              <Input
                value={form.trailerId ?? ""}
                onChange={(e) => onChange("trailerId", e.target.value || null)}
                placeholder="Ex: https://youtube.com/watch?v=... ou ID"
                className="bg-elevated/50"
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
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-elevated/80 text-muted transition-colors hover:text-white"
                  title="Testar trailer no YouTube"
                >
                  <ExternalLink className="size-4" />
                </a>
              )}
            </div>
          </Field>

          {/* Gêneros com Chips Visuais */}
          <Field label="Gêneros (separados por vírgula)" className="sm:col-span-2 md:grid-cols-3 lg:col-span-4">
            <div className="space-y-2">
              <Input
                value={genreText}
                onChange={(e) => onGenreTextChange(e.target.value)}
                placeholder="Ex: Ação, Aventura, Fantasia, Drama"
                className="bg-elevated/50"
              />

              {/* Tags Atuais Selecionadas */}
              {currentGenres.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-zinc-500">Ativos:</span>
                  {currentGenres.map((g) => (
                    <span
                      key={g}
                      className="group inline-flex items-center gap-1 rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-xs text-purple-200"
                    >
                      <span>{g}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveGenreTag(g)}
                        className="text-purple-400 hover:text-white"
                        title="Remover gênero"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Sugestões rápidas de gêneros */}
              <div className="flex flex-wrap items-center gap-1 pt-1">
                <span className="text-[10px] text-zinc-500">Adicionar rápido:</span>
                {Object.values(GENRE_PT)
                  .slice(0, 8)
                  .map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => handleAddGenreTag(g)}
                      className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-400 transition-colors hover:bg-purple-500/20 hover:text-purple-300"
                    >
                      + {g}
                    </button>
                  ))}
              </div>
            </div>
          </Field>

          {/* Visibilidade no Catálogo Público */}
          <div className="sm:col-span-2 md:col-span-3 lg:col-span-4 pt-1">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/5 bg-elevated/30 p-3 transition-colors hover:border-white/10 hover:bg-elevated/50">
              <input
                type="checkbox"
                checked={form.hidden}
                onChange={(e) => onChange("hidden", e.target.checked)}
                className="size-4.5 rounded border-white/20 bg-zinc-900 accent-purple-600 focus:ring-purple-500/40"
              />
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">
                    Ocultar do catálogo público
                  </span>
                  {form.hidden ? (
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">
                      Invisível para usuários comuns
                    </span>
                  ) : (
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300">
                      Visível na vitrine pública
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted">
                  Quando ativado, o anime só pode ser visualizado por administradores no painel.
                </p>
              </div>
            </label>
          </div>
        </div>
      </section>

      {/* 3. SEÇÃO: IMAGENS DO ANIME (CAPA E BANNER) */}
      <section className="rounded-2xl border border-white/5 bg-surface/70 p-5 shadow-sm backdrop-blur-md sm:p-6">
        <div className="mb-4 flex items-center gap-2 border-b border-white/5 pb-3">
          <ImageIcon className="size-4 text-purple-400" />
          <h2 className="font-display text-base font-semibold text-white">
            Imagens Oficiais (Capa & Banner)
          </h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          {/* Campo da Capa (Vertical 2:3) */}
          <div className="space-y-3 lg:col-span-5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-zinc-300">
                Capa Vertical (Proporção 2:3)
              </Label>
              {form.cover && (
                <span className="text-[10px] text-zinc-400">
                  {isPersistentStorageUrl(form.cover) ? (
                    <span className="text-emerald-400">Armazenamento Permanente</span>
                  ) : (
                    <span className="text-zinc-500">URL Externa</span>
                  )}
                </span>
              )}
            </div>

            {/* Preview da Capa */}
            <div className="relative mx-auto flex aspect-2/3 max-w-[200px] w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-zinc-950 shadow-md sm:mx-0">
              {form.cover && !coverLoadError ? (
                <img
                  src={form.cover}
                  alt="Capa"
                  className="size-full object-cover"
                  onError={() => setCoverLoadError(true)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-4 text-center text-zinc-600">
                  <Film className="mb-2 size-8 text-zinc-700" />
                  <span className="text-xs">
                    {coverLoadError ? "Falha ao carregar URL" : "Sem capa cadastrada"}
                  </span>
                </div>
              )}

              {/* Overlay com ação de limpar */}
              {form.cover && (
                <button
                  type="button"
                  onClick={() => onChange("cover", "")}
                  title="Remover capa"
                  className="absolute top-2 right-2 rounded-full bg-black/70 p-1.5 text-zinc-400 backdrop-blur-md transition-colors hover:text-rose-400"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Inputs e Upload da Capa */}
            <div className="space-y-2">
              <Input
                value={form.cover}
                onChange={(e) => {
                  onChange("cover", e.target.value);
                  setCoverLoadError(false);
                }}
                placeholder="Cole a URL direta da imagem (JPG/PNG/WEBP)"
                className="bg-elevated/50 text-xs"
              />

              <div className="flex items-center gap-2">
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
                  className="w-full h-8 border-white/10 text-xs text-zinc-300 hover:border-purple-500/40 hover:bg-elevated"
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

          {/* Campo do Banner (Horizontal Panorâmico) */}
          <div className="space-y-3 lg:col-span-7">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-zinc-300">
                Banner Panorâmico (Proporção 16:9 / 21:9)
              </Label>
              {form.banner && (
                <span className="text-[10px] text-zinc-400">
                  {isPersistentStorageUrl(form.banner) ? (
                    <span className="text-emerald-400">Armazenamento Permanente</span>
                  ) : (
                    <span className="text-zinc-500">URL Externa</span>
                  )}
                </span>
              )}
            </div>

            {/* Preview do Banner */}
            <div className="relative flex aspect-21/9 w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-zinc-950 shadow-md">
              {form.banner && !bannerLoadError ? (
                <img
                  src={form.banner}
                  alt="Banner"
                  className="size-full object-cover"
                  onError={() => setBannerLoadError(true)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-4 text-center text-zinc-600">
                  <ImageIcon className="mb-2 size-8 text-zinc-700" />
                  <span className="text-xs">
                    {bannerLoadError ? "Falha ao carregar banner" : "Sem banner cadastrado"}
                  </span>
                </div>
              )}

              {/* Overlay com ação de limpar */}
              {form.banner && (
                <button
                  type="button"
                  onClick={() => onChange("banner", "")}
                  title="Remover banner"
                  className="absolute top-2 right-2 rounded-full bg-black/70 p-1.5 text-zinc-400 backdrop-blur-md transition-colors hover:text-rose-400"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Inputs e Upload do Banner */}
            <div className="space-y-2">
              <Input
                value={form.banner}
                onChange={(e) => {
                  onChange("banner", e.target.value);
                  setBannerLoadError(false);
                }}
                placeholder="Cole a URL direta do banner panorâmico (JPG/PNG/WEBP)"
                className="bg-elevated/50 text-xs"
              />

              <div className="flex items-center gap-2">
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
                  className="w-full h-8 border-white/10 text-xs text-zinc-300 hover:border-purple-500/40 hover:bg-elevated"
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
        </div>
      </section>

      {/* 4. SEÇÃO: IDENTIFICADORES E RELAÇÃO EXTERNA */}
      <section className="rounded-2xl border border-white/5 bg-surface/70 p-5 shadow-sm backdrop-blur-md sm:p-6">
        <div className="mb-4 flex items-center gap-2 border-b border-white/5 pb-3">
          <Globe className="size-4 text-purple-400" />
          <h2 className="font-display text-base font-semibold text-white">
            Identificadores & Relação Externa
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {/* AniList ID */}
          <div className="rounded-xl border border-white/5 bg-elevated/40 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">AniList ID</span>
              {form.anilistId ? (
                <a
                  href={`https://anilist.co/anime/${form.anilistId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:underline"
                >
                  <span>Abrir</span>
                  <ExternalLink className="size-3" />
                </a>
              ) : (
                <span className="text-[10px] text-zinc-600">Não vinculado</span>
              )}
            </div>
            <p className="font-mono text-sm font-semibold text-white">
              {form.anilistId ? `#${form.anilistId}` : "—"}
            </p>
          </div>

          {/* MAL ID */}
          <div className="rounded-xl border border-white/5 bg-elevated/40 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">MyAnimeList ID</span>
              {form.malId ? (
                <a
                  href={`https://myanimelist.net/anime/${form.malId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:underline"
                >
                  <span>Abrir</span>
                  <ExternalLink className="size-3" />
                </a>
              ) : (
                <span className="text-[10px] text-zinc-600">Não vinculado</span>
              )}
            </div>
            <p className="font-mono text-sm font-semibold text-white">
              {form.malId ? `#${form.malId}` : "—"}
            </p>
          </div>

          {/* Kitsu ID */}
          <div className="rounded-xl border border-white/5 bg-elevated/40 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">Kitsu ID</span>
              {form.kitsuId ? (
                <a
                  href={`https://kitsu.io/anime/${form.kitsuId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:underline"
                >
                  <span>Abrir</span>
                  <ExternalLink className="size-3" />
                </a>
              ) : (
                <span className="text-[10px] text-zinc-600">Não vinculado</span>
              )}
            </div>
            <p className="font-mono text-sm font-semibold text-white">
              {form.kitsuId ? `#${form.kitsuId}` : "—"}
            </p>
          </div>

          {/* Metadados de Data de Registro */}
          <div className="sm:col-span-2 md:col-span-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3 text-[11px] text-zinc-500">
            <span>
              Cadastrado em:{" "}
              <strong className="text-zinc-400">
                {form.createdAt ? new Date(form.createdAt).toLocaleString("pt-BR") : "—"}
              </strong>
            </span>
            <span>
              Última modificação:{" "}
              <strong className="text-zinc-400">
                {form.updatedAt ? new Date(form.updatedAt).toLocaleString("pt-BR") : "—"}
              </strong>
            </span>
          </div>
        </div>
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
      <Label className="mb-1.5 block text-xs font-semibold text-zinc-300">
        {label}
      </Label>
      {children}
    </label>
  );
}
