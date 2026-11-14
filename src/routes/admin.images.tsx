import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Film,
  Image as ImageIcon,
  RefreshCw,
  Search,
  User,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getBearerToken } from "@/lib/auth/client";
import {
  StudioEmptyState,
  StudioLoadingState,
  StudioPageHeader,
  StudioStatStrip,
} from "@/components/admin/studio-ui";
import { cn } from "@/lib/utils";
import type { AdminImageItem, ImageType } from "@/routes/api/admin/images";

export const Route = createFileRoute("/admin/images")({
  component: AdminImagesPage,
});

function AdminImagesPage() {
  const [images, setImages] = useState<AdminImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState<ImageType | "all">("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({
    totalAll: 0,
    totalCovers: 0,
    totalBanners: 0,
    totalThumbnails: 0,
    totalAvatars: 0,
  });

  const [brokenUrls, setBrokenUrls] = useState<Record<string, boolean>>({});
  const [previewImage, setPreviewImage] = useState<AdminImageItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchImages = async () => {
    setLoading(true);
    try {
      const token = getBearerToken();
      const params = new URLSearchParams({
        type: activeType,
        search,
        page: page.toString(),
        limit: "24",
      });

      const res = await fetch(`/api/admin/images?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || "Falha ao carregar imagens.");
      }

      const data = await res.json();
      setImages(data.images || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalCount(data.pagination?.total || 0);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error("[admin.images] Erro:", err);
      toast.error(
        err instanceof Error ? err.message : "Erro ao carregar galeria de imagens.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchImages();
  }, [page, activeType]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      void fetchImages();
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const handleCopyUrl = async (img: AdminImageItem) => {
    try {
      await navigator.clipboard.writeText(img.url);
      setCopiedId(img.id);
      toast.success("URL da imagem copiada para a área de transferência!");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Não foi possível copiar a URL.");
    }
  };

  return (
    <div className="studio-enter space-y-6">
      <StudioPageHeader
        kicker="Mídia & Players"
        title="Central de Imagens"
        description="Supervisione capas, banners panorâmicos, miniaturas de episódios e avatares reais cadastrados na plataforma."
        backTo="/admin"
        backLabel="Voltar à Central"
        status={<span className="studio-mono font-semibold text-violet-300">Galeria do Catálogo</span>}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchImages()}
            disabled={loading}
            className="h-9 border-[var(--studio-line)] bg-[var(--studio-panel)] text-xs hover:bg-white/[0.06]"
          >
            <RefreshCw className={cn("mr-1.5 size-3.5", loading && "animate-spin")} />
            Atualizar Galeria
          </Button>
        }
      />

      {/* KPIs Reais */}
      <StudioStatStrip
        columns={5}
        items={[
          {
            label: "Total Geral",
            value: stats.totalAll.toLocaleString("pt-BR"),
          },
          {
            label: "Capas de Anime",
            value: stats.totalCovers.toLocaleString("pt-BR"),
            accent: "violet",
          },
          {
            label: "Banners Panorâmicos",
            value: stats.totalBanners.toLocaleString("pt-BR"),
          },
          {
            label: "Miniaturas de Ep.",
            value: stats.totalThumbnails.toLocaleString("pt-BR"),
            accent: "emerald",
          },
          {
            label: "Avatares de Conta",
            value: stats.totalAvatars.toLocaleString("pt-BR"),
            accent: "amber",
          },
        ]}
      />

      {/* Barra de Filtros e Busca */}
      <div className="studio-panel flex flex-col gap-3 rounded-xl p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-subtle)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por anime, episódio, usuário ou URL..."
            className="studio-input h-9 pl-9 pr-8 text-xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-[var(--color-subtle)] hover:text-white"
              aria-label="Limpar busca"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] p-0.5">
          {[
            { id: "all", label: "Todas" },
            { id: "cover", label: "Capas" },
            { id: "banner", label: "Banners" },
            { id: "thumbnail", label: "Miniaturas" },
            { id: "avatar", label: "Avatares" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveType(tab.id as ImageType | "all");
                setPage(1);
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                activeType === tab.id
                  ? "border border-[var(--studio-accent-border)] bg-[var(--studio-accent-soft)] text-violet-200"
                  : "text-[var(--color-muted)] hover:text-white",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grade de Imagens */}
      {loading ? (
        <StudioLoadingState message="Consultando catálogo de imagens no PostgreSQL..." />
      ) : images.length === 0 ? (
        <StudioEmptyState
          icon={<ImageIcon className="size-6" />}
          title="Nenhuma imagem encontrada"
          description={
            search
              ? `Nenhum resultado para "${search}".`
              : "Não há imagens cadastradas para este filtro."
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {images.map((img) => {
            const isBroken = brokenUrls[img.id] || img.isBlobOrInvalid;

            return (
              <div
                key={img.id}
                className="studio-panel group relative flex flex-col overflow-hidden rounded-xl transition-colors hover:border-[var(--studio-accent-border)]"
              >
                <div
                  className={cn(
                    "relative w-full cursor-pointer overflow-hidden bg-black/40",
                    img.type === "cover"
                      ? "aspect-[3/4]"
                      : img.type === "avatar"
                        ? "aspect-square"
                        : "aspect-[16/9]",
                  )}
                  onClick={() => setPreviewImage(img)}
                >
                  {isBroken ? (
                    <div className="flex size-full flex-col items-center justify-center gap-1.5 bg-rose-950/25 p-3 text-center text-rose-300">
                      <AlertTriangle className="size-5" />
                      <span className="studio-mono text-[9px] font-bold uppercase">
                        Falha no Link
                      </span>
                    </div>
                  ) : (
                    <img
                      src={img.url}
                      alt={img.entityTitle}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={() => {
                        setBrokenUrls((prev) => ({ ...prev, [img.id]: true }));
                      }}
                    />
                  )}

                  <div className="absolute top-1.5 left-1.5">
                    <span
                      className={cn(
                        "studio-mono rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase",
                        img.type === "cover" &&
                          "border border-violet-500/40 bg-violet-950/85 text-violet-200",
                        img.type === "banner" &&
                          "border border-sky-500/40 bg-sky-950/85 text-sky-200",
                        img.type === "thumbnail" &&
                          "border border-emerald-500/40 bg-emerald-950/85 text-emerald-200",
                        img.type === "avatar" &&
                          "border border-amber-500/40 bg-amber-950/85 text-amber-200",
                      )}
                    >
                      {img.type === "cover"
                        ? "Capa"
                        : img.type === "banner"
                          ? "Banner"
                          : img.type === "thumbnail"
                            ? "Miniatura"
                            : "Avatar"}
                    </span>
                  </div>

                  <div className="absolute top-1.5 right-1.5">
                    <span className="studio-mono rounded bg-black/75 px-1.5 py-0.5 text-[8px] font-medium text-[var(--color-muted)] uppercase backdrop-blur-sm">
                      {img.provider}
                    </span>
                  </div>
                </div>

                <div className="flex flex-1 flex-col justify-between space-y-2 p-2.5 text-xs">
                  <div>
                    <h3
                      className="truncate text-[11px] font-semibold text-[var(--color-fg)]"
                      title={img.entityTitle}
                    >
                      {img.entityTitle}
                    </h3>
                    {img.subTitle && (
                      <p
                        className="studio-mono truncate text-[10px] text-[var(--color-subtle)]"
                        title={img.subTitle}
                      >
                        {img.subTitle}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-[var(--studio-line)] pt-1.5">
                    <button
                      type="button"
                      onClick={() => void handleCopyUrl(img)}
                      className="flex size-7 items-center justify-center rounded text-[var(--color-muted)] hover:bg-white/10 hover:text-white"
                      title="Copiar URL direta"
                    >
                      {copiedId === img.id ? (
                        <Check className="size-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </button>

                    <a
                      href={img.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex size-7 items-center justify-center rounded text-[var(--color-muted)] hover:bg-white/10 hover:text-white"
                      title="Abrir imagem original"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>

                    {img.type !== "avatar" ? (
                      <Link
                        to="/admin/$id"
                        params={{ id: img.entityId }}
                        className="flex size-7 items-center justify-center rounded text-violet-300 hover:bg-violet-500/20 hover:text-violet-200"
                        title="Editar anime no catálogo"
                      >
                        <Film className="size-3.5" />
                      </Link>
                    ) : (
                      <Link
                        to="/admin/users"
                        className="flex size-7 items-center justify-center rounded text-violet-300 hover:bg-violet-500/20 hover:text-violet-200"
                        title="Ver usuário"
                      >
                        <User className="size-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="studio-panel flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 text-xs text-[var(--color-muted)]">
          <span className="studio-tabular">
            Mostrando <strong className="text-white">{images.length}</strong> de{" "}
            <strong className="text-white">{totalCount}</strong> imagens
          </span>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="size-8 border-[var(--studio-line)] bg-[var(--studio-panel-alt)] p-0 text-xs hover:bg-white/[0.08]"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="studio-mono px-2 text-xs">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="size-8 border-[var(--studio-line)] bg-[var(--studio-panel-alt)] p-0 text-xs hover:bg-white/[0.08]"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Modal Lightbox de Preview Ampliado */}
      {previewImage && (
        <div
          className="hikari-studio-dialog fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
        >
          <div className="studio-scroll relative flex max-h-[88dvh] w-full max-w-4xl flex-col space-y-3 overflow-y-auto rounded-2xl border border-[var(--studio-line-strong)] bg-[var(--studio-panel)] p-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--studio-line)] pb-3">
              <div className="min-w-0 pr-4">
                <h3 className="truncate text-sm font-semibold text-white">
                  {previewImage.entityTitle}
                </h3>
                <p className="studio-mono text-xs text-[var(--color-subtle)]">
                  Tipo: {previewImage.type.toUpperCase()} · ID: {previewImage.entityId}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="rounded-lg p-1.5 text-[var(--color-subtle)] hover:bg-white/10 hover:text-white"
                aria-label="Fechar pré-visualização"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex max-h-[58dvh] items-center justify-center overflow-hidden rounded-xl bg-black/60 p-2">
              <img
                src={previewImage.url}
                alt={previewImage.entityTitle}
                className="max-h-[55dvh] max-w-full rounded-lg object-contain"
              />
            </div>

            <div className="flex flex-col gap-2 border-t border-[var(--studio-line)] pt-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
              <span className="studio-mono max-w-md truncate text-[11px] text-[var(--color-subtle)] select-all">
                {previewImage.url}
              </span>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleCopyUrl(previewImage)}
                  className="border-[var(--studio-line)] text-xs"
                >
                  <Copy className="mr-1.5 size-3.5" />
                  Copiar URL
                </Button>
                <a
                  href={previewImage.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--studio-accent-border)] bg-[var(--studio-accent-soft)] px-3 text-xs font-semibold text-violet-200 hover:bg-violet-500/25"
                >
                  <ExternalLink className="size-3.5" />
                  Abrir Original
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminImagesPage;
