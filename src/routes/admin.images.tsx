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
  Loader2,
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

  // Rastreamento de URLs com falha de carregamento no navegador
  const [brokenUrls, setBrokenUrls] = useState<Record<string, boolean>>({});

  // Imagem em preview ampliado
  const [previewImage, setPreviewImage] = useState<AdminImageItem | null>(null);

  // Copiado recentemente
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
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-fg)]">
              Central de Imagens
            </h1>
            <span className="studio-mono rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-xs font-semibold text-purple-300">
              Galeria do Catálogo
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Supervisione capas, banners panorâmicos, miniaturas de episódios e avatares reais cadastrados na plataforma.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => void fetchImages()}
          disabled={loading}
          className="border-white/10 bg-white/[0.03] text-xs hover:bg-white/[0.08]"
        >
          <RefreshCw className={cn("size-3.5 mr-1.5", loading && "animate-spin")} />
          Atualizar Galeria
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-white/[0.08] bg-[var(--studio-panel)] p-3.5">
          <span className="text-[10px] text-[var(--color-subtle)] uppercase tracking-wider font-semibold">
            Total Geral
          </span>
          <div className="mt-1.5 studio-tabular text-xl font-bold text-white">
            {stats.totalAll.toLocaleString("pt-BR")}
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[var(--studio-panel)] p-3.5">
          <span className="text-[10px] text-purple-300/80 uppercase tracking-wider font-semibold">
            Capas de Anime
          </span>
          <div className="mt-1.5 studio-tabular text-xl font-bold text-purple-300">
            {stats.totalCovers.toLocaleString("pt-BR")}
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[var(--studio-panel)] p-3.5">
          <span className="text-[10px] text-blue-300/80 uppercase tracking-wider font-semibold">
            Banners Panorâmicos
          </span>
          <div className="mt-1.5 studio-tabular text-xl font-bold text-blue-300">
            {stats.totalBanners.toLocaleString("pt-BR")}
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[var(--studio-panel)] p-3.5">
          <span className="text-[10px] text-emerald-300/80 uppercase tracking-wider font-semibold">
            Miniaturas de Ep.
          </span>
          <div className="mt-1.5 studio-tabular text-xl font-bold text-emerald-300">
            {stats.totalThumbnails.toLocaleString("pt-BR")}
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[var(--studio-panel)] p-3.5 col-span-2 sm:col-span-1">
          <span className="text-[10px] text-amber-300/80 uppercase tracking-wider font-semibold">
            Avatares de Conta
          </span>
          <div className="mt-1.5 studio-tabular text-xl font-bold text-amber-300">
            {stats.totalAvatars.toLocaleString("pt-BR")}
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-[var(--studio-panel)] p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-subtle)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por anime, episódio, usuário ou URL..."
            className="h-9 border-white/10 bg-black/30 pl-9 text-xs focus-visible:ring-purple-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-subtle)] hover:text-white"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Abas de Tipo */}
        <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-white/10 bg-black/25 p-0.5">
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
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                activeType === tab.id
                  ? "bg-purple-600/30 text-purple-200 border border-purple-500/40"
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
        <div className="flex min-h-[350px] flex-col items-center justify-center gap-3 rounded-xl border border-white/[0.08] bg-[var(--studio-panel)]">
          <Loader2 className="size-8 animate-spin text-purple-400" />
          <p className="studio-mono text-xs text-[var(--color-muted)]">
            Consultando catálogo de imagens no PostgreSQL...
          </p>
        </div>
      ) : images.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-[var(--studio-panel)] p-6 text-center">
          <ImageIcon className="size-8 text-[var(--color-subtle)]" />
          <p className="text-sm font-medium text-[var(--color-fg)]">
            Nenhuma imagem encontrada
          </p>
          <p className="text-xs text-[var(--color-muted)]">
            {search
              ? `Nenhum resultado para "${search}".`
              : "Não há imagens cadastradas para este filtro."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {images.map((img) => {
            const isBroken = brokenUrls[img.id] || img.isBlobOrInvalid;

            return (
              <div
                key={img.id}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[var(--studio-panel)] transition-all hover:border-purple-500/40 hover:shadow-lg"
              >
                {/* Visual da Imagem */}
                <div
                  className={cn(
                    "relative w-full overflow-hidden bg-black/40 cursor-pointer",
                    img.type === "cover"
                      ? "aspect-[3/4]"
                      : img.type === "avatar"
                        ? "aspect-square"
                        : "aspect-[16/9]",
                  )}
                  onClick={() => setPreviewImage(img)}
                >
                  {isBroken ? (
                    <div className="flex size-full flex-col items-center justify-center gap-1.5 p-3 text-center bg-rose-950/20 text-rose-300">
                      <AlertTriangle className="size-5" />
                      <span className="studio-mono text-[9px] uppercase font-bold">
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

                  {/* Badge de Tipo */}
                  <div className="absolute left-1.5 top-1.5">
                    <span
                      className={cn(
                        "studio-mono rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow-sm",
                        img.type === "cover" &&
                          "bg-purple-950/80 text-purple-200 border border-purple-500/40",
                        img.type === "banner" &&
                          "bg-blue-950/80 text-blue-200 border border-blue-500/40",
                        img.type === "thumbnail" &&
                          "bg-emerald-950/80 text-emerald-200 border border-emerald-500/40",
                        img.type === "avatar" &&
                          "bg-amber-950/80 text-amber-200 border border-amber-500/40",
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

                  {/* Provedor */}
                  <div className="absolute right-1.5 top-1.5">
                    <span className="studio-mono rounded bg-black/70 px-1.5 py-0.5 text-[8px] font-medium text-[var(--color-subtle)] uppercase backdrop-blur-sm">
                      {img.provider}
                    </span>
                  </div>
                </div>

                {/* Detalhes da Entidade */}
                <div className="flex flex-1 flex-col justify-between p-2.5 space-y-2 text-xs">
                  <div>
                    <h3
                      className="font-semibold text-[11px] text-[var(--color-fg)] truncate"
                      title={img.entityTitle}
                    >
                      {img.entityTitle}
                    </h3>
                    {img.subTitle && (
                      <p
                        className="studio-mono text-[10px] text-[var(--color-subtle)] truncate"
                        title={img.subTitle}
                      >
                        {img.subTitle}
                      </p>
                    )}
                  </div>

                  {/* Barra de Ações Rápidas */}
                  <div className="flex items-center justify-between border-t border-white/[0.06] pt-1.5">
                    <button
                      type="button"
                      onClick={() => void handleCopyUrl(img)}
                      className="flex size-6 items-center justify-center rounded text-[var(--color-muted)] hover:bg-white/10 hover:text-white"
                      title="Copiar URL direta"
                    >
                      {copiedId === img.id ? (
                        <Check className="size-3 text-emerald-400" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </button>

                    <a
                      href={img.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex size-6 items-center justify-center rounded text-[var(--color-muted)] hover:bg-white/10 hover:text-white"
                      title="Abrir imagem original"
                    >
                      <ExternalLink className="size-3" />
                    </a>

                    {img.type !== "avatar" ? (
                      <Link
                        to="/admin/$id"
                        params={{ id: img.entityId }}
                        className="flex size-6 items-center justify-center rounded text-purple-400 hover:bg-purple-500/20 hover:text-purple-300"
                        title="Editar anime no catálogo"
                      >
                        <Film className="size-3" />
                      </Link>
                    ) : (
                      <Link
                        to="/admin/users"
                        className="flex size-6 items-center justify-center rounded text-purple-400 hover:bg-purple-500/20 hover:text-purple-300"
                        title="Ver usuário"
                      >
                        <User className="size-3" />
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
        <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-[var(--studio-panel)] px-4 py-3 text-xs text-[var(--color-muted)]">
          <span>
            Mostrando <strong className="text-white">{images.length}</strong> de{" "}
            <strong className="text-white">{totalCount}</strong> imagens
          </span>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="size-7 p-0 border-white/10 bg-white/[0.02] text-xs hover:bg-white/[0.08]"
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
              className="size-7 p-0 border-white/10 bg-white/[0.02] text-xs hover:bg-white/[0.08]"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Modal Lightbox de Preview Ampliado */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative max-h-[90vh] max-w-4xl w-full flex flex-col rounded-2xl border border-white/15 bg-[var(--studio-panel)] p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div>
                <h3 className="font-semibold text-sm text-white">
                  {previewImage.entityTitle}
                </h3>
                <p className="studio-mono text-xs text-[var(--color-subtle)]">
                  Tipo: {previewImage.type.toUpperCase()} • ID: {previewImage.entityId}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="rounded-lg p-1 text-[var(--color-subtle)] hover:bg-white/10 hover:text-white"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex max-h-[65vh] items-center justify-center overflow-hidden rounded-xl bg-black/60 p-2">
              <img
                src={previewImage.url}
                alt={previewImage.entityTitle}
                className="max-h-[60vh] max-w-full object-contain rounded-lg"
              />
            </div>

            <div className="flex items-center justify-between border-t border-white/[0.08] pt-2 text-xs">
              <span className="studio-mono text-[11px] text-[var(--color-subtle)] truncate max-w-md select-all">
                {previewImage.url}
              </span>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleCopyUrl(previewImage)}
                  className="border-white/10 text-xs"
                >
                  <Copy className="size-3.5 mr-1.5" />
                  Copiar URL
                </Button>
                <a
                  href={previewImage.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-purple-500/35 bg-purple-500/15 px-3 text-xs font-semibold text-purple-200 hover:bg-purple-500/25"
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
