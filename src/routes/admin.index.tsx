import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Database,
  Download,
  Eye,
  EyeOff,
  Film,
  Filter,
  Grid,
  List,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { toast } from "sonner";

import { searchCatalog } from "@/lib/api";
import {
  animeToLocal,
  displayTitle,
  type LocalAnime,
  type SlimAnime,
} from "@/lib/types";
import { ensureCatalogLoaded, useHikariStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  dismissOutboxOperation,
  flushOutbox,
  hasPendingWrites,
  readOutbox,
  type OutboxOperation,
} from "@/lib/episode-writer";
import {
  importCatalogInBatches,
  retryFailedBatches,
  type BatchImportProgress,
  type FailedBatchItem,
} from "@/lib/catalog-import-client";
import {
  getAdminSystemStatus,
  type AdminSystemStatus,
} from "@/lib/admin-dashboard.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/")({
  component: AdminIndex,
});

type SortOption =
  | "updated-desc"
  | "updated-asc"
  | "title-asc"
  | "title-desc"
  | "episodes-desc"
  | "episodes-asc"
  | "year-desc"
  | "year-asc";

type VisibilityFilter = "all" | "visible" | "hidden";
type VersionFilter = "all" | "dubbed" | "subbed" | "anilist";

function AdminIndex() {
  const animes = useHikariStore((s) => s.animes);
  const hydrated = useHikariStore((s) => s.hydrated);
  const removeAnime = useHikariStore((s) => s.removeAnime);
  const upsertAnime = useHikariStore((s) => s.upsertAnime);
  const toggleHidden = useHikariStore((s) => s.toggleHidden);
  const importAll = useHikariStore((s) => s.importAll);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [formatFilter, setFormatFilter] = useState<string>("all");
  const [visibilityFilter, setVisibilityFilter] =
    useState<VisibilityFilter>("all");
  const [versionFilter, setVersionFilter] = useState<VersionFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("updated-desc");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(24);

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const [toolsOpen, setToolsOpen] = useState(false);
  const [toolsTab, setToolsTab] = useState<"anilist" | "json">("anilist");

  const [importQ, setImportQ] = useState("");
  const [hits, setHits] = useState<SlimAnime[]>([]);
  const [searchingAniList, setSearchingAniList] = useState(false);

  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] =
    useState<BatchImportProgress | null>(null);
  const [failedBatches, setFailedBatches] = useState<FailedBatchItem[]>([]);

  const [outboxOps, setOutboxOps] = useState<OutboxOperation[]>([]);
  const [isSyncingOutbox, setIsSyncingOutbox] = useState(false);
  const [systemStatus, setSystemStatus] = useState<AdminSystemStatus | null>(
    null,
  );
  const [isCheckingSystem, setIsCheckingSystem] = useState(false);

  const refreshOutbox = useCallback(() => {
    if (typeof window !== "undefined") {
      setOutboxOps(readOutbox());
    }
  }, []);

  const checkSystem = useCallback(async () => {
    setIsCheckingSystem(true);
    try {
      const res = await getAdminSystemStatus();
      setSystemStatus(res);
    } catch (err: any) {
      setSystemStatus({
        connected: false,
        dbSource: "unknown",
        checkedAt: Date.now(),
        error: err?.message || String(err),
      });
    } finally {
      setIsCheckingSystem(false);
    }
  }, []);

  useEffect(() => {
    refreshOutbox();
    void checkSystem();

    const handleSync = () => refreshOutbox();
    window.addEventListener("online", handleSync);
    window.addEventListener("storage", handleSync);

    const timer = window.setInterval(refreshOutbox, 8000);
    return () => {
      window.removeEventListener("online", handleSync);
      window.removeEventListener("storage", handleSync);
      window.clearInterval(timer);
    };
  }, [refreshOutbox, checkSystem]);

  const handleManualSync = async () => {
    if (isSyncingOutbox) return;
    if (!hasPendingWrites()) {
      toast.info("Nenhuma operação pendente no Outbox.");
      return;
    }

    setIsSyncingOutbox(true);
    toast.info("Sincronizando operações do Outbox com o PostgreSQL...");

    try {
      const res = await flushOutbox();
      refreshOutbox();
      void checkSystem();
      if (res.processed > 0) {
        toast.success(
          `${res.processed} operação(ões) sincronizada(s) com o servidor!`,
        );
      }
      if (res.error) {
        toast.error(`Atenção: ${res.error}`);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Falha na sincronização.",
      );
    } finally {
      setIsSyncingOutbox(false);
    }
  };

  const catalogStats = useMemo(() => {
    const totalAnimes = animes.length;
    let totalSeasons = 0;
    let totalEpisodes = 0;
    let totalPublishedEpisodes = 0;
    let visibleAnimes = 0;
    let hiddenAnimes = 0;
    let anilistLinkedAnimes = 0;
    let dubbedAnimes = 0;

    for (const a of animes) {
      if (a.hidden) hiddenAnimes++;
      else visibleAnimes++;

      if (a.anilistId) anilistLinkedAnimes++;

      const isDub = /\b(dub|dublado|dublada)\b/i.test(
        `${a.titleRomaji} ${a.titleEnglish} ${a.titleNative}`,
      );
      if (isDub) dubbedAnimes++;

      const seasons = a.seasons || [];
      totalSeasons += seasons.length;

      for (const s of seasons) {
        const episodes = s.episodes || [];
        totalEpisodes += episodes.length;

        for (const ep of episodes) {
          const hasPlayableSource = Boolean(
            ep.videoUrl ||
              ep.videoUrl2 ||
              ep.videoUrl3 ||
              ep.videoUrl4 ||
              ep.videoUrl5,
          );
          const isPub = ep.published === true && hasPlayableSource;
          if (isPub) {
            totalPublishedEpisodes++;
          }
        }
      }
    }

    return {
      totalAnimes,
      totalSeasons,
      totalEpisodes,
      totalPublishedEpisodes,
      visibleAnimes,
      hiddenAnimes,
      anilistLinkedAnimes,
      dubbedAnimes,
    };
  }, [animes]);

  const conflictOps = useMemo(
    () => outboxOps.filter((o) => o.status === "conflict"),
    [outboxOps],
  );
  const pendingCount = outboxOps.filter((o) => o.status !== "conflict").length;
  const conflictCount = conflictOps.length;

  const recentActivities = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      type: "update" | "create" | "outbox-pending" | "outbox-conflict";
      timestamp: number;
      cover?: string;
      details?: string;
    }> = [];

    for (const op of outboxOps.slice(0, 3)) {
      const targetAnime = animes.find((a) => a.id === op.animeId);
      const animeName = targetAnime ? displayTitle(targetAnime) : op.animeId;
      list.push({
        id: `outbox-${op.id}`,
        title: animeName,
        type: op.status === "conflict" ? "outbox-conflict" : "outbox-pending",
        timestamp: op.createdAt || Date.now(),
        cover: targetAnime?.cover,
        details:
          op.type === "delete"
            ? `Exclusão de episódio na fila (Temporada ${op.seasonNumber})`
            : `Salvamento de episódio na fila (Ep. ${op.episodeNumber || "—"})`,
      });
    }

    const animesWithTimestamps = animes
      .filter((a) => (a.updatedAt && a.updatedAt > 0) || (a.createdAt && a.createdAt > 0))
      .sort((a, b) => {
        const timeA = a.updatedAt || a.createdAt || 0;
        const timeB = b.updatedAt || b.createdAt || 0;
        return timeB - timeA;
      })
      .slice(0, 6);

    for (const a of animesWithTimestamps) {
      const isUpdate = a.updatedAt && a.createdAt && a.updatedAt > a.createdAt;
      const timestamp = a.updatedAt || a.createdAt || Date.now();
      list.push({
        id: `anime-${a.id}-${timestamp}`,
        title: displayTitle(a),
        type: isUpdate ? "update" : "create",
        timestamp,
        cover: a.cover,
        details: isUpdate
          ? `Metadados ou episódios atualizados (${a.seasons?.reduce((n, s) => n + s.episodes.length, 0)} eps)`
          : `Novo título cadastrado (${a.seasons?.length || 1} temp.)`,
      });
    }

    return list.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
  }, [animes, outboxOps]);

  const availableFormats = useMemo(() => {
    const set = new Set<string>();
    for (const a of animes) {
      if (a.format?.trim()) set.add(a.format.trim());
    }
    return Array.from(set).sort();
  }, [animes]);

  const availableStatuses = useMemo(() => {
    const set = new Set<string>();
    for (const a of animes) {
      if (a.status?.trim()) set.add(a.status.trim());
    }
    return Array.from(set).sort();
  }, [animes]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    return animes
      .filter((a) => {
        if (query) {
          const fullText = `${a.titleRomaji} ${a.titleEnglish} ${a.titleNative} ${a.id}`.toLowerCase();
          if (!fullText.includes(query)) return false;
        }

        if (visibilityFilter === "visible" && a.hidden) return false;
        if (visibilityFilter === "hidden" && !a.hidden) return false;

        if (formatFilter !== "all" && a.format?.toLowerCase() !== formatFilter.toLowerCase()) {
          return false;
        }

        if (statusFilter !== "all" && a.status?.toLowerCase() !== statusFilter.toLowerCase()) {
          return false;
        }

        if (versionFilter === "dubbed") {
          const isDub = /\b(dub|dublado|dublada)\b/i.test(
            `${a.titleRomaji} ${a.titleEnglish} ${a.titleNative}`,
          );
          if (!isDub) return false;
        } else if (versionFilter === "subbed") {
          const isDub = /\b(dub|dublado|dublada)\b/i.test(
            `${a.titleRomaji} ${a.titleEnglish} ${a.titleNative}`,
          );
          if (isDub) return false;
        } else if (versionFilter === "anilist") {
          if (!a.anilistId) return false;
        }

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "title-asc":
            return displayTitle(a).localeCompare(displayTitle(b));
          case "title-desc":
            return displayTitle(b).localeCompare(displayTitle(a));
          case "episodes-desc": {
            const countA = a.seasons.reduce((n, s) => n + s.episodes.length, 0);
            const countB = b.seasons.reduce((n, s) => n + s.episodes.length, 0);
            return countB - countA;
          }
          case "episodes-asc": {
            const countA = a.seasons.reduce((n, s) => n + s.episodes.length, 0);
            const countB = b.seasons.reduce((n, s) => n + s.episodes.length, 0);
            return countA - countB;
          }
          case "year-desc":
            return (b.year || 0) - (a.year || 0);
          case "year-asc":
            return (a.year || 0) - (b.year || 0);
          case "updated-asc": {
            const timeA = a.updatedAt || a.createdAt || 0;
            const timeB = b.updatedAt || b.createdAt || 0;
            return timeA - timeB;
          }
          case "updated-desc":
          default: {
            const timeA = a.updatedAt || a.createdAt || 0;
            const timeB = b.updatedAt || b.createdAt || 0;
            return timeB - timeA;
          }
        }
      });
  }, [
    animes,
    q,
    visibilityFilter,
    formatFilter,
    statusFilter,
    versionFilter,
    sortBy,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginatedAnimes = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filtered.slice(startIndex, startIndex + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [q, visibilityFilter, formatFilter, statusFilter, versionFilter, sortBy, itemsPerPage]);

  async function runImportSearch(e: FormEvent) {
    e.preventDefault();
    if (!importQ.trim()) return;

    setSearchingAniList(true);
    try {
      const res = await searchCatalog({
        data: {
          q: importQ.trim(),
          page: 1,
        },
      });
      setHits(res.items);
    } catch {
      toast.error("Não foi possível buscar no AniList.");
    } finally {
      setSearchingAniList(false);
    }
  }

  function importHit(hit: SlimAnime, asNew = false) {
    const existing = asNew
      ? undefined
      : animes.find((a) => a.id === hit.id || a.anilistId === hit.anilistId);

    const local = animeToLocal(hit, existing);
    upsertAnime(local);

    toast.success(
      asNew
        ? `${displayTitle(hit)} importado como novo cadastro independente!`
        : `${displayTitle(hit)} importado com sucesso.`,
    );
  }

  function duplicateAsDubbed(target: LocalAnime) {
    const newId = `local-${crypto.randomUUID()}`;
    const baseTitleRomaji = target.titleRomaji ? `${target.titleRomaji} Dublado` : "";
    const baseTitleEnglish = target.titleEnglish ? `${target.titleEnglish} Dublado` : "";

    const clonedSeasons = target.seasons.map((s) => ({
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
      ...target,
      id: newId,
      titleRomaji: baseTitleRomaji || target.titleRomaji,
      titleEnglish: baseTitleEnglish || target.titleEnglish,
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
    toast.success("Versão dublada criada como cadastro independente!");
  }

  async function exportJson() {
    if (!hydrated) {
      toast.info("Aguardando hidratação completa do catálogo antes da exportação...");
      await ensureCatalogLoaded();
    }

    const currentAnimes = useHikariStore.getState().animes;
    if (currentAnimes.length === 0) {
      toast.warning("O catálogo está vazio. Nenhum dado para exportar.");
      return;
    }

    const blob = new Blob([JSON.stringify({ animes: currentAnimes }, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hikari-catalogo-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success(`Backup de ${currentAnimes.length} animes exportado com sucesso!`);
  }

  function onImportFile(file: File) {
    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as {
          animes?: LocalAnime[];
        };

        if (!Array.isArray(parsed.animes)) {
          throw new Error("Formato inválido: o arquivo deve conter a propriedade 'animes'.");
        }

        importAll(parsed.animes);
        toast.success(`Catálogo local restaurado com ${parsed.animes.length} animes.`);

        setIsImporting(true);
        setFailedBatches([]);
        toast.info(
          `Iniciando sincronização de ${parsed.animes.length} animes no banco em lotes de 100...`,
        );

        try {
          const res = await importCatalogInBatches(parsed.animes, (progress) => {
            setImportProgress(progress);
          });

          if (res.abortedDueToAuth) {
            toast.error(
              "Falha de autorização: faça login com conta de administrador para importar no banco.",
            );
          } else if (res.ok) {
            toast.success(
              `Importação no banco concluída! ${res.importedAnimes} animes e ${res.importedEpisodes} episódios sincronizados.`,
            );
            setFailedBatches([]);
            void checkSystem();
          } else {
            setFailedBatches(res.failedBatches);
            toast.warning(
              `Importação parcialmente concluída. ${res.failedBatches.length} lote(s) pendente(s) de reenvio.`,
            );
          }
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Falha na sincronização remota.",
          );
        } finally {
          setIsImporting(false);
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Arquivo JSON inválido.",
        );
      }
    };

    reader.readAsText(file);
  }

  function formatTime(timestamp: number): string {
    if (!timestamp) return "—";
    try {
      return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(timestamp));
    } catch {
      return "—";
    }
  }

  const hasActiveFilters =
    q.trim() !== "" ||
    statusFilter !== "all" ||
    formatFilter !== "all" ||
    visibilityFilter !== "all" ||
    versionFilter !== "all";

  const clearFilters = () => {
    setQ("");
    setStatusFilter("all");
    setFormatFilter("all");
    setVisibilityFilter("all");
    setVersionFilter("all");
    setSortBy("updated-desc");
  };

  return (
    <div className="studio-enter space-y-8">
      {/* Banners de Progresso e Reenvio em Lotes */}
      {isImporting && importProgress && (
        <div className="studio-panel rounded-2xl border-purple-500/35 p-4 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-purple-300">
              Sincronizando catálogo no PostgreSQL…
            </span>
            <span className="studio-mono text-xs text-[var(--color-muted)]">
              Lote {importProgress.currentBatchIndex} de {importProgress.totalBatches}
            </span>
          </div>
          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full bg-purple-500 transition-all duration-300"
              style={{
                width: `${Math.round(
                  ((importProgress.completedBatches + importProgress.failedBatches) /
                    importProgress.totalBatches) *
                    100,
                )}%`,
              }}
            />
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-[var(--color-muted)]">
            <span className="studio-tabular">
              {importProgress.processedAnimes} de {importProgress.totalAnimes} animes processados
            </span>
            <span className="studio-tabular">
              {importProgress.importedEpisodes} episódios importados
            </span>
          </div>
        </div>
      )}

      {failedBatches.length > 0 && !isImporting && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 text-sm text-amber-200">
          <div className="space-y-0.5">
            <p className="font-semibold text-amber-300">
              Importação parcialmente concluída
            </p>
            <p className="text-xs text-amber-200/80">
              {failedBatches.length} lote(s) apresentaram erros e foram mantidos para reenvio seguro.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isImporting}
            onClick={async () => {
              setIsImporting(true);
              toast.info(`Reenviando ${failedBatches.length} lote(s) pendente(s)...`);
              try {
                const res = await retryFailedBatches(failedBatches, (p) =>
                  setImportProgress(p),
                );
                if (res.ok) {
                  setFailedBatches([]);
                  toast.success("Todos os lotes pendentes foram sincronizados com sucesso!");
                  void checkSystem();
                } else {
                  setFailedBatches(res.failedBatches);
                  toast.warning(
                    `Ainda restam ${res.failedBatches.length} lote(s) com erro.`,
                  );
                }
              } catch {
                toast.error("Falha ao reenviar lotes.");
              } finally {
                setIsImporting(false);
              }
            }}
            className="h-9 border-amber-500/40 text-amber-200 hover:bg-amber-500/20"
          >
            Reenviar lotes pendentes ({failedBatches.length})
          </Button>
        </div>
      )}

      {/* Cabeçalho da Visão Geral & Ações */}
      <header className="flex flex-col gap-5 border-b border-white/[0.075] pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="studio-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-purple-400">
            Console Administrativo
          </p>

          <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-[var(--color-fg)] sm:text-3xl">
            Visão Geral &amp; Catálogo
          </h1>

          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-[var(--color-muted)] sm:text-sm">
            Monitore a integridade do acervo, a conectividade com o PostgreSQL e a fila do Outbox
            com controle completo sobre cada título.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            asChild
            className="h-10 bg-purple-600 px-4 text-xs font-semibold text-white hover:bg-purple-500"
          >
            <Link to="/admin/$id" params={{ id: "new" }}>
              <Plus className="size-4" />
              <span>Novo Anime</span>
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={exportJson}
            className="h-10 border-white/10 bg-[var(--studio-panel)] px-3 text-xs text-[var(--color-muted)] hover:bg-white/[0.05] hover:text-[var(--color-fg)]"
            title="Exportar backup completo em arquivo JSON"
          >
            <Download className="size-4 text-purple-400" />
            <span className="hidden sm:inline">Exportar</span>
          </Button>

          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-[var(--studio-panel)] px-3 text-xs font-medium text-[var(--color-muted)] transition-colors hover:bg-white/[0.05] hover:text-[var(--color-fg)]">
            <Upload className="size-4 text-purple-400" />
            <span className="hidden sm:inline">Importar JSON</span>
            <input
              type="file"
              accept="application/json"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImportFile(f);
                e.target.value = "";
              }}
            />
          </label>

          <Button
            type="button"
            variant="outline"
            onClick={() => setToolsOpen(!toolsOpen)}
            className={cn(
              "h-10 border-white/10 bg-[var(--studio-panel)] px-3.5 text-xs text-[var(--color-muted)] hover:bg-white/[0.05] hover:text-[var(--color-fg)]",
              toolsOpen && "border-purple-500/45 bg-purple-500/12 text-purple-200",
            )}
            title="Abrir ferramentas de importação e sincronização"
          >
            <Sparkles className="size-4 text-purple-400" />
            <span>Ferramentas</span>
          </Button>
        </div>
      </header>

      {/* Painel Expansível: Ferramentas do Catálogo */}
      {toolsOpen && (
        <section className="studio-panel rounded-2xl border-purple-500/30 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.075] pb-4">
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-lg border border-purple-500/30 bg-purple-500/12 text-purple-300">
                <Sparkles className="size-4" />
              </div>
              <div>
                <h3 className="font-display text-base font-semibold text-[var(--color-fg)]">
                  Ferramentas do Catálogo
                </h3>
                <p className="text-xs text-[var(--color-muted)]">
                  Importe metadados oficiais do AniList ou gerencie backups em JSON.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setToolsTab("anilist")}
                className={cn(
                  "h-9 rounded-lg px-3 text-xs font-medium transition-colors",
                  toolsTab === "anilist"
                    ? "border border-purple-500/35 bg-purple-500/18 text-purple-200"
                    : "text-[var(--color-muted)] hover:bg-white/[0.04] hover:text-[var(--color-fg)]",
                )}
              >
                AniList
              </button>
              <button
                type="button"
                onClick={() => setToolsTab("json")}
                className={cn(
                  "h-9 rounded-lg px-3 text-xs font-medium transition-colors",
                  toolsTab === "json"
                    ? "border border-purple-500/35 bg-purple-500/18 text-purple-200"
                    : "text-[var(--color-muted)] hover:bg-white/[0.04] hover:text-[var(--color-fg)]",
                )}
              >
                Backup &amp; JSON
              </button>
              <button
                type="button"
                onClick={() => setToolsOpen(false)}
                className="ml-1 flex size-9 items-center justify-center rounded-lg text-[var(--color-muted)] hover:bg-white/10 hover:text-[var(--color-fg)]"
                aria-label="Fechar ferramentas"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {toolsTab === "anilist" ? (
            <div className="space-y-4 pt-4">
              <p className="text-xs leading-relaxed text-[var(--color-muted)]">
                Pesquise na base pública do AniList para importar capa, banner, sinopse, gêneros e
                identificadores externos.
              </p>

              <form onSubmit={runImportSearch} className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-subtle)]" />
                  <Input
                    value={importQ}
                    onChange={(e) => setImportQ(e.target.value)}
                    placeholder="Ex.: Frieren, Jujutsu Kaisen, Solo Leveling, One Piece..."
                    className="h-10 border-white/10 bg-[var(--studio-panel-alt)] pl-9 text-sm"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={searchingAniList || !importQ.trim()}
                  className="h-10 shrink-0 bg-purple-600 px-4 text-xs font-semibold text-white hover:bg-purple-500"
                >
                  {searchingAniList ? (
                    <>
                      <RefreshCw className="mr-1.5 size-3.5 animate-spin" />
                      Buscando…
                    </>
                  ) : (
                    "Buscar AniList"
                  )}
                </Button>
              </form>

              {hits.length > 0 && (
                <div className="studio-scroll max-h-80 divide-y divide-white/[0.06] overflow-y-auto rounded-xl border border-white/[0.07] bg-[var(--studio-panel-alt)]">
                  {hits.slice(0, 10).map((hit) => {
                    const alreadyInCatalog = animes.some(
                      (a) => a.id === hit.id || a.anilistId === hit.anilistId,
                    );
                    return (
                      <div
                        key={hit.id}
                        className="flex flex-wrap items-center justify-between gap-3 p-3 transition-colors hover:bg-white/[0.025]"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="h-14 w-10 shrink-0 overflow-hidden rounded border border-white/10 bg-black/40">
                            {hit.cover ? (
                              <img
                                src={hit.cover}
                                alt=""
                                className="size-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="grid size-full place-items-center text-[10px] text-[var(--color-subtle)]">
                                —
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[var(--color-fg)]">
                              {displayTitle(hit)}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-[var(--color-muted)]">
                              {hit.year || "—"} · {hit.format || "TV"} ·{" "}
                              {(hit.genres || []).slice(0, 3).join(", ") || "Sem gênero"}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => importHit(hit)}
                            className={cn(
                              "h-9 text-xs",
                              alreadyInCatalog
                                ? "border-amber-500/35 text-amber-300 hover:bg-amber-500/12"
                                : "border-purple-500/35 text-purple-200 hover:bg-purple-500/12",
                            )}
                          >
                            {alreadyInCatalog ? "Atualizar" : "Importar"}
                          </Button>

                          {alreadyInCatalog && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => importHit(hit, true)}
                              title="Importar como novo cadastro independente (ex: versão dublada)"
                              className="h-9 border-white/10 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                            >
                              Novo cadastro
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 pt-4">
              <p className="text-xs leading-relaxed text-[var(--color-muted)]">
                Gere um arquivo JSON completo com todas as temporadas, episódios e metadados ou
                restaure um backup sincronizando em lotes de 100 com o PostgreSQL.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={exportJson}
                  className="h-10 bg-purple-600 px-4 text-xs font-semibold text-white hover:bg-purple-500"
                >
                  <Download className="mr-1.5 size-4" />
                  Baixar hikari-catalogo.json ({animes.length} animes)
                </Button>

                <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-[var(--studio-panel-alt)] px-4 text-xs font-medium text-[var(--color-fg)] transition-colors hover:bg-white/[0.06]">
                  <Upload className="size-4 text-purple-400" />
                  <span>Selecionar arquivo JSON para restaurar</span>
                  <input
                    type="file"
                    accept="application/json"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onImportFile(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Grade Executiva do Painel (3 Painéis de Dados Reais) */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {/* 1. RESUMO DO CATÁLOGO */}
        <section className="studio-panel flex flex-col justify-between rounded-2xl p-5">
          <div>
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="grid size-8 place-items-center rounded-lg border border-purple-500/30 bg-purple-500/12 text-purple-300">
                  <Film className="size-4" />
                </div>
                <div>
                  <h2 className="font-display text-base font-semibold text-[var(--color-fg)]">
                    Resumo do Catálogo
                  </h2>
                  <p className="text-[11px] text-[var(--color-subtle)]">
                    Inventário local e publicado
                  </p>
                </div>
              </div>
              <span className="studio-mono text-xs font-semibold text-purple-300">
                {catalogStats.totalAnimes} títulos
              </span>
            </div>

            <div className="grid grid-cols-2 divide-x divide-y divide-white/[0.06] border-b border-white/[0.06]">
              <div className="py-4 pr-3">
                <span className="block text-[11px] font-medium uppercase tracking-wider text-[var(--color-subtle)]">
                  Animes
                </span>
                <span className="studio-tabular mt-1 block font-display text-2xl font-bold text-[var(--color-fg)]">
                  {catalogStats.totalAnimes}
                </span>
                <span className="studio-tabular mt-1 block text-[11px] text-[var(--color-muted)]">
                  {catalogStats.visibleAnimes} visíveis · {catalogStats.hiddenAnimes} ocultos
                </span>
              </div>

              <div className="py-4 pl-4">
                <span className="block text-[11px] font-medium uppercase tracking-wider text-[var(--color-subtle)]">
                  Temporadas
                </span>
                <span className="studio-tabular mt-1 block font-display text-2xl font-bold text-[var(--color-fg)]">
                  {catalogStats.totalSeasons}
                </span>
                <span className="mt-1 block text-[11px] text-[var(--color-muted)]">
                  Estruturadas no acervo
                </span>
              </div>

              <div className="py-4 pr-3">
                <span className="block text-[11px] font-medium uppercase tracking-wider text-[var(--color-subtle)]">
                  Episódios
                </span>
                <span className="studio-tabular mt-1 block font-display text-2xl font-bold text-[var(--color-fg)]">
                  {catalogStats.totalEpisodes}
                </span>
                <span className="mt-1 block text-[11px] text-[var(--color-muted)]">
                  Cadastrados no total
                </span>
              </div>

              <div className="py-4 pl-4">
                <span className="block text-[11px] font-medium uppercase tracking-wider text-purple-300">
                  Publicados
                </span>
                <span className="studio-tabular mt-1 block font-display text-2xl font-bold text-purple-300">
                  {catalogStats.totalPublishedEpisodes}
                </span>
                <span className="mt-1 block text-[11px] text-[var(--color-muted)]">
                  Com player válido ativo
                </span>
              </div>
            </div>
          </div>

          <div className="studio-tabular flex flex-wrap items-center justify-between gap-2 pt-3.5 text-xs text-[var(--color-muted)]">
            <span>AniList: {catalogStats.anilistLinkedAnimes}</span>
            <span>Dublados: {catalogStats.dubbedAnimes}</span>
          </div>
        </section>

        {/* 2. ESTADO DO SISTEMA & OUTBOX */}
        <section
          id="system-status"
          className="studio-panel flex flex-col justify-between rounded-2xl p-5 scroll-mt-20"
        >
          <div>
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="grid size-8 place-items-center rounded-lg border border-emerald-500/30 bg-emerald-500/12 text-emerald-300">
                  <Database className="size-4" />
                </div>
                <div>
                  <h2 className="font-display text-base font-semibold text-[var(--color-fg)]">
                    Estado do Sistema
                  </h2>
                  <p className="text-[11px] text-[var(--color-subtle)]">
                    PostgreSQL &amp; Fila Outbox
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={checkSystem}
                disabled={isCheckingSystem}
                className="flex size-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[var(--color-muted)] transition-colors hover:bg-white/[0.08] hover:text-[var(--color-fg)]"
                title="Verificar conectividade agora"
                aria-label="Atualizar estado do sistema"
              >
                <RefreshCw
                  className={cn("size-3.5", isCheckingSystem && "animate-spin")}
                />
              </button>
            </div>

            <div className="divide-y divide-white/[0.06] pt-1">
              {/* PostgreSQL */}
              <div className="flex items-center justify-between gap-3 py-3.5">
                <div className="min-w-0">
                  <span className="block text-xs font-semibold text-[var(--color-fg)]">
                    Conexão PostgreSQL
                  </span>
                  <span className="studio-mono mt-0.5 block truncate text-[11px] text-[var(--color-subtle)]">
                    {systemStatus?.dbSource === "neon"
                      ? "Neon Cloud Database (Pooled)"
                      : "PGLite Embedded (WASM)"}
                  </span>
                </div>
                <span
                  className={cn(
                    "studio-mono inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold",
                    systemStatus?.connected ? "text-emerald-400" : "text-rose-400",
                  )}
                >
                  {systemStatus?.connected ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : (
                    <AlertTriangle className="size-3.5" />
                  )}
                  <span>{systemStatus?.connected ? "Conectado" : "Offline"}</span>
                </span>
              </div>

              {/* Contagens Reais no Servidor */}
              {systemStatus?.connected &&
                typeof systemStatus.serverAnimesCount === "number" && (
                  <div className="flex items-center justify-between gap-3 py-3 text-xs">
                    <span className="text-[var(--color-muted)]">
                      Registros no Servidor
                    </span>
                    <span className="studio-mono text-[11px] text-[var(--color-fg)]">
                      {systemStatus.serverAnimesCount} animes ·{" "}
                      {systemStatus.serverPublishedEpisodesCount ?? 0}/
                      {systemStatus.serverEpisodesCount ?? 0} eps pub.
                    </span>
                  </div>
                )}

              {/* Fila do Outbox */}
              <div className="flex items-center justify-between gap-3 py-3.5">
                <div>
                  <span className="block text-xs font-semibold text-[var(--color-fg)]">
                    Fila do Outbox
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[var(--color-subtle)]">
                    Alterações locais pendentes
                  </span>
                </div>
                <span
                  className={cn(
                    "studio-mono text-xs font-semibold",
                    pendingCount > 0 ? "text-amber-300" : "text-emerald-400",
                  )}
                >
                  {pendingCount} pendência(s)
                </span>
              </div>

              {/* Conflitos */}
              <div className="flex items-center justify-between gap-3 py-3.5">
                <div>
                  <span className="block text-xs font-semibold text-[var(--color-fg)]">
                    Conflitos de Sincronização
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[var(--color-subtle)]">
                    Rejeições de validação do servidor
                  </span>
                </div>
                <span
                  className={cn(
                    "studio-mono text-xs font-semibold",
                    conflictCount > 0 ? "text-rose-400" : "text-[var(--color-muted)]",
                  )}
                >
                  {conflictCount} conflito(s)
                </span>
              </div>
            </div>

            {conflictOps.length > 0 && (
              <div className="mt-2 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-xs">
                <p className="font-semibold text-rose-300">
                  Operações em conflito
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {conflictOps.slice(0, 2).map((op) => (
                    <li
                      key={op.id}
                      className="flex items-center justify-between gap-2 text-[11px] text-rose-200/90"
                    >
                      <span className="truncate">
                        {op.animeId} · T{op.seasonNumber} E{op.episodeNumber ?? "?"}:{" "}
                        {op.lastError || "Erro de validação"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          dismissOutboxOperation(op.id);
                          refreshOutbox();
                          toast.info("Conflito descartado da fila local.");
                        }}
                        className="shrink-0 text-[11px] font-semibold text-rose-300 underline hover:text-white"
                      >
                        Descartar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="border-t border-white/[0.06] pt-3.5">
            {pendingCount > 0 ? (
              <Button
                type="button"
                size="sm"
                disabled={isSyncingOutbox}
                onClick={handleManualSync}
                className="h-9 w-full border border-amber-500/35 bg-amber-500/15 text-xs font-semibold text-amber-200 hover:bg-amber-500/25"
              >
                <RefreshCw
                  className={cn("mr-1.5 size-3.5", isSyncingOutbox && "animate-spin")}
                />
                <span>
                  {isSyncingOutbox
                    ? "Sincronizando..."
                    : `Sincronizar ${pendingCount} operação(ões)`}
                </span>
              </Button>
            ) : (
              <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="size-3.5" />
                  <span>Catálogo 100% sincronizado</span>
                </span>
                <span className="studio-mono text-[11px] text-[var(--color-subtle)]">
                  IndexedDB
                </span>
              </div>
            )}
          </div>
        </section>

        {/* 3. ATIVIDADES RECENTES */}
        <section className="studio-panel flex flex-col justify-between rounded-2xl p-5 md:col-span-2 xl:col-span-1">
          <div>
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="grid size-8 place-items-center rounded-lg border border-purple-500/30 bg-purple-500/12 text-purple-300">
                  <Clock className="size-4" />
                </div>
                <div>
                  <h2 className="font-display text-base font-semibold text-[var(--color-fg)]">
                    Atividades Recentes
                  </h2>
                  <p className="text-[11px] text-[var(--color-subtle)]">
                    Histórico real de edições
                  </p>
                </div>
              </div>
              <span className="studio-mono text-xs text-[var(--color-muted)]">
                {recentActivities.length > 0
                  ? `${recentActivities.length} registros`
                  : "Vazio"}
              </span>
            </div>

            {recentActivities.length === 0 ? (
              <div className="space-y-2.5 py-10 text-center">
                <div className="mx-auto grid size-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-[var(--color-subtle)]">
                  <Activity className="size-5" />
                </div>
                <p className="text-xs font-semibold text-[var(--color-fg)]">
                  Nenhuma atividade recente registrada
                </p>
                <p className="mx-auto max-w-xs text-xs leading-relaxed text-[var(--color-muted)]">
                  As atualizações de animes, episódios e operações de sincronização aparecerão aqui
                  conforme forem realizadas.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.06] pt-1">
                {recentActivities.map((act) => (
                  <li key={act.id} className="flex items-center gap-3 py-3">
                    <div className="h-11 w-8 shrink-0 overflow-hidden rounded border border-white/10 bg-black/40">
                      {act.cover ? (
                        <img
                          src={act.cover}
                          alt=""
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="grid size-full place-items-center text-[10px] text-[var(--color-subtle)]">
                          光
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold leading-snug text-[var(--color-fg)]">
                        {act.title}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-[var(--color-muted)]">
                        {act.details}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="studio-mono block text-[10px] text-[var(--color-subtle)]">
                        {formatTime(act.timestamp)}
                      </span>
                      {act.type === "outbox-conflict" ? (
                        <span className="studio-mono inline-block text-[10px] font-semibold text-rose-400">
                          Conflito
                        </span>
                      ) : act.type === "outbox-pending" ? (
                        <span className="studio-mono inline-block text-[10px] font-semibold text-amber-300">
                          Na fila
                        </span>
                      ) : (
                        <span className="studio-mono inline-block text-[10px] font-semibold text-purple-300">
                          Salvo
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-white/[0.06] pt-3.5 text-[11px] text-[var(--color-subtle)]">
            <span>Fonte: IndexedDB &amp; Outbox</span>
            <Link
              to="/admin/quick-update"
              className="font-medium text-purple-300 hover:text-purple-200"
            >
              Atualização Rápida →
            </Link>
          </div>
        </section>
      </div>

      {/* Catálogo de Títulos */}
      <section id="catalog" className="scroll-mt-20 space-y-4 pt-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-baseline gap-3">
            <h2 className="font-display text-xl font-bold tracking-tight text-[var(--color-fg)] sm:text-2xl">
              Catálogo de Títulos
            </h2>
            <span className="studio-mono text-xs font-medium text-[var(--color-muted)]">
              {filtered.length} de {animes.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
              <span className="hidden sm:inline">Exibir:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                aria-label="Itens por página"
                className="h-9 rounded-lg border border-white/10 bg-[var(--studio-panel)] px-2.5 text-xs text-[var(--color-fg)] focus:border-purple-500/50 focus:outline-none"
              >
                <option value={12}>12 por pág.</option>
                <option value={24}>24 por pág.</option>
                <option value={48}>48 por pág.</option>
              </select>
            </div>

            <div className="flex items-center rounded-lg border border-white/10 bg-[var(--studio-panel)] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md transition-colors",
                  viewMode === "grid"
                    ? "bg-purple-600/30 text-purple-200"
                    : "text-[var(--color-muted)] hover:text-[var(--color-fg)]",
                )}
                title="Visualização em grade de cards"
                aria-label="Ver em grade"
              >
                <Grid className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md transition-colors",
                  viewMode === "table"
                    ? "bg-purple-600/30 text-purple-200"
                    : "text-[var(--color-muted)] hover:text-[var(--color-fg)]",
                )}
                title="Visualização em tabela detalhada"
                aria-label="Ver em tabela"
              >
                <List className="size-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Barra Unificada de Busca e Filtros */}
        <div className="studio-panel space-y-3 rounded-2xl p-4">
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-subtle)]" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Pesquisar por título em inglês, romaji ou nativo..."
                className="h-10 border-white/10 bg-[var(--studio-panel-alt)] pl-9 pr-9 text-sm"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 p-1 text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                  aria-label="Limpar pesquisa"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <ArrowUpDown className="hidden size-4 shrink-0 text-purple-400 sm:block" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Ordenar catálogo"
                className="h-10 w-full rounded-md border border-white/10 bg-[var(--studio-panel-alt)] px-3 text-xs text-[var(--color-fg)] focus:border-purple-500/50 focus:outline-none sm:w-auto"
              >
                <option value="updated-desc">Mais recentes primeiro</option>
                <option value="updated-asc">Mais antigos primeiro</option>
                <option value="title-asc">Título (A — Z)</option>
                <option value="title-desc">Título (Z — A)</option>
                <option value="episodes-desc">Mais episódios</option>
                <option value="episodes-asc">Menos episódios</option>
                <option value="year-desc">Ano (Mais recente)</option>
                <option value="year-asc">Ano (Mais antigo)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
            <span className="mr-1 flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-subtle)]">
              <Filter className="size-3" />
              Filtros:
            </span>

            <select
              value={visibilityFilter}
              onChange={(e) => setVisibilityFilter(e.target.value as VisibilityFilter)}
              aria-label="Filtrar por visibilidade"
              className="h-9 rounded-md border border-white/10 bg-[var(--studio-panel-alt)] px-2.5 text-xs text-[var(--color-fg)] focus:border-purple-500/50 focus:outline-none"
            >
              <option value="all">Visibilidade: Todas</option>
              <option value="visible">Apenas Visíveis</option>
              <option value="hidden">Apenas Ocultos</option>
            </select>

            <select
              value={versionFilter}
              onChange={(e) => setVersionFilter(e.target.value as VersionFilter)}
              aria-label="Filtrar por versão"
              className="h-9 rounded-md border border-white/10 bg-[var(--studio-panel-alt)] px-2.5 text-xs text-[var(--color-fg)] focus:border-purple-500/50 focus:outline-none"
            >
              <option value="all">Versões: Todas</option>
              <option value="dubbed">Apenas Dublados</option>
              <option value="subbed">Apenas Legendados / Originais</option>
              <option value="anilist">Com vínculo AniList</option>
            </select>

            {availableFormats.length > 0 && (
              <select
                value={formatFilter}
                onChange={(e) => setFormatFilter(e.target.value)}
                aria-label="Filtrar por formato"
                className="h-9 rounded-md border border-white/10 bg-[var(--studio-panel-alt)] px-2.5 text-xs text-[var(--color-fg)] focus:border-purple-500/50 focus:outline-none"
              >
                <option value="all">Formato: Todos</option>
                {availableFormats.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            )}

            {availableStatuses.length > 0 && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filtrar por status"
                className="h-9 rounded-md border border-white/10 bg-[var(--studio-panel-alt)] px-2.5 text-xs text-[var(--color-fg)] focus:border-purple-500/50 focus:outline-none"
              >
                <option value="all">Status: Todos</option>
                {availableStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-auto flex h-9 items-center gap-1 rounded-md px-2.5 text-xs font-medium text-purple-300 hover:bg-purple-500/10 hover:text-purple-200"
              >
                <X className="size-3.5" />
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {/* Listagem */}
        {!hydrated ? (
          <div className="grid grid-cols-1 gap-4 pt-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="studio-panel h-44 animate-pulse rounded-xl p-3.5"
              >
                <div className="flex gap-3">
                  <div className="h-28 w-20 rounded-lg bg-white/[0.05]" />
                  <div className="flex-1 space-y-2.5 py-1">
                    <div className="h-4 w-3/4 rounded bg-white/[0.06]" />
                    <div className="h-3 w-1/2 rounded bg-white/[0.04]" />
                    <div className="h-3 w-1/3 rounded bg-white/[0.04]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : animes.length === 0 ? (
          <div className="studio-panel space-y-4 rounded-2xl p-10 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-purple-500/25 bg-purple-500/10 text-purple-300">
              <Film className="size-7" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-lg font-semibold text-[var(--color-fg)]">
                Nenhum título no catálogo local
              </h3>
              <p className="mx-auto max-w-md text-xs leading-relaxed text-[var(--color-muted)]">
                Seu catálogo ainda está vazio neste navegador. Você pode cadastrar um título novo,
                importar do AniList ou restaurar um backup JSON.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <Button
                asChild
                className="h-10 bg-purple-600 px-4 text-xs font-semibold text-white hover:bg-purple-500"
              >
                <Link to="/admin/$id" params={{ id: "new" }}>
                  <Plus className="mr-1.5 size-3.5" />
                  Criar primeiro anime
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setToolsOpen(true);
                  setToolsTab("anilist");
                }}
                className="h-10 border-white/10 text-xs"
              >
                <Sparkles className="mr-1.5 size-3.5 text-purple-400" />
                Importar do AniList
              </Button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="studio-panel space-y-3 rounded-2xl p-10 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-[var(--color-subtle)]">
              <Search className="size-5" />
            </div>
            <p className="text-sm font-semibold text-[var(--color-fg)]">
              Nenhum anime encontrado com os filtros aplicados
            </p>
            <p className="mx-auto max-w-sm text-xs text-[var(--color-muted)]">
              Tente pesquisar com outro termo ou limpe os filtros ativos para ver todos os títulos.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="h-9 border-purple-500/35 text-xs text-purple-300"
            >
              Limpar busca e filtros
            </Button>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {paginatedAnimes.map((a) => {
              const episodesCount = a.seasons.reduce(
                (n, s) => n + s.episodes.length,
                0,
              );
              const isDub = /\b(dub|dublado|dublada)\b/i.test(
                `${a.titleRomaji} ${a.titleEnglish} ${a.titleNative}`,
              );

              return (
                <article
                  key={a.id}
                  className="studio-panel group flex flex-col justify-between rounded-xl p-3.5 transition-colors hover:border-purple-500/40"
                >
                  <div className="flex gap-3.5">
                    <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/40">
                      {a.cover ? (
                        <img
                          src={a.cover}
                          alt={displayTitle(a)}
                          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="grid size-full place-items-center bg-purple-950/30 font-display text-sm font-bold text-purple-300">
                          {displayTitle(a).slice(0, 2).toUpperCase()}
                        </div>
                      )}

                      <span className="studio-mono absolute right-1 bottom-1 rounded bg-black/85 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {episodesCount} ep
                      </span>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col justify-between">
                      <div>
                        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-semibold uppercase tracking-wider">
                          {a.hidden && (
                            <span className="text-rose-400">Oculto</span>
                          )}
                          {isDub && (
                            <span className="text-purple-300">Dublado</span>
                          )}
                          <span className="studio-mono text-[var(--color-subtle)]">
                            {a.format || "TV"}
                          </span>
                        </div>

                        <h3
                          className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--color-fg)] transition-colors group-hover:text-purple-300"
                          title={displayTitle(a)}
                        >
                          {displayTitle(a)}
                        </h3>

                        {a.titleRomaji && a.titleEnglish && (
                          <p className="mt-0.5 truncate text-[11px] text-[var(--color-muted)]">
                            {a.titleRomaji}
                          </p>
                        )}
                      </div>

                      <p className="studio-tabular pt-2 text-[11px] text-[var(--color-subtle)]">
                        {a.year || "—"} · {a.seasons.length} temp.
                        {a.anilistId ? ` · #${a.anilistId}` : " · Original"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3.5 flex items-center gap-1.5 border-t border-white/[0.06] pt-2.5">
                    <Button
                      asChild
                      size="sm"
                      className="h-9 flex-1 border border-purple-500/35 bg-purple-600/20 text-xs font-medium text-purple-200 hover:bg-purple-600/35 hover:text-white"
                    >
                      <Link to="/admin/$id" params={{ id: a.id }}>
                        Editar
                      </Link>
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => duplicateAsDubbed(a)}
                      title="Criar cadastro independente para a versão dublada deste anime"
                      className="size-9 border-white/10 p-0 text-[var(--color-muted)] hover:bg-white/[0.06] hover:text-[var(--color-fg)]"
                    >
                      <Copy className="size-3.5" />
                      <span className="sr-only">Versão Dublada</span>
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        toggleHidden(a.id);
                        toast.success(
                          a.hidden
                            ? `${displayTitle(a)} agora está visível no catálogo.`
                            : `${displayTitle(a)} agora está oculto.`,
                        );
                      }}
                      title={a.hidden ? "Tornar anime visível" : "Ocultar do site público"}
                      className="size-9 border-white/10 p-0 text-[var(--color-muted)] hover:bg-white/[0.06] hover:text-[var(--color-fg)]"
                    >
                      {a.hidden ? (
                        <EyeOff className="size-3.5 text-amber-400" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                      <span className="sr-only">Alternar visibilidade</span>
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setPendingDelete(a.id)}
                      title="Excluir anime"
                      className="size-9 p-0 text-[var(--color-muted)] hover:bg-rose-500/12 hover:text-rose-400"
                    >
                      <Trash2 className="size-3.5" />
                      <span className="sr-only">Excluir</span>
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="studio-panel overflow-x-auto rounded-2xl">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.02] text-[11px] font-semibold uppercase tracking-wider text-[var(--color-subtle)]">
                  <th className="w-14 px-4 py-3">Capa</th>
                  <th className="px-4 py-3">Título</th>
                  <th className="hidden px-4 py-3 sm:table-cell">Ano / Formato</th>
                  <th className="hidden px-4 py-3 md:table-cell">Temporadas / Episódios</th>
                  <th className="hidden px-4 py-3 lg:table-cell">Origem</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {paginatedAnimes.map((a) => {
                  const episodesCount = a.seasons.reduce(
                    (n, s) => n + s.episodes.length,
                    0,
                  );
                  const isDub = /\b(dub|dublado|dublada)\b/i.test(
                    `${a.titleRomaji} ${a.titleEnglish} ${a.titleNative}`,
                  );

                  return (
                    <tr
                      key={a.id}
                      className="transition-colors hover:bg-white/[0.025]"
                    >
                      <td className="px-4 py-2.5">
                        <div className="h-12 w-9 shrink-0 overflow-hidden rounded border border-white/10 bg-black/40">
                          {a.cover ? (
                            <img
                              src={a.cover}
                              alt=""
                              className="size-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="grid size-full place-items-center text-[10px] text-[var(--color-subtle)]">
                              —
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="min-w-44 px-4 py-2.5">
                        <p className="line-clamp-1 font-semibold text-[var(--color-fg)]">
                          {displayTitle(a)}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          {isDub && (
                            <span className="studio-mono text-[10px] font-medium text-purple-300">
                              [Dublado]
                            </span>
                          )}
                          {a.titleRomaji && (
                            <span className="max-w-xs truncate text-[11px] text-[var(--color-muted)]">
                              {a.titleRomaji}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="studio-tabular hidden px-4 py-2.5 text-[var(--color-muted)] sm:table-cell">
                        {a.year || "—"} · {a.format || "TV"}
                      </td>

                      <td className="studio-tabular hidden px-4 py-2.5 text-[var(--color-muted)] md:table-cell">
                        {a.seasons.length} temp. ·{" "}
                        <span className="font-semibold text-[var(--color-fg)]">
                          {episodesCount} eps
                        </span>
                      </td>

                      <td className="studio-mono hidden px-4 py-2.5 text-[11px] text-[var(--color-muted)] lg:table-cell">
                        {a.anilistId ? `AniList #${a.anilistId}` : "Original local"}
                      </td>

                      <td className="px-4 py-2.5 text-center">
                        {a.hidden ? (
                          <span className="studio-mono text-[11px] font-semibold text-rose-400">
                            Oculto
                          </span>
                        ) : (
                          <span className="studio-mono text-[11px] font-semibold text-emerald-400">
                            Ativo
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            asChild
                            size="sm"
                            className="h-8 border border-purple-500/30 bg-purple-600/20 px-3 text-xs text-purple-200 hover:bg-purple-600/35"
                          >
                            <Link to="/admin/$id" params={{ id: a.id }}>
                              Editar
                            </Link>
                          </Button>

                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => duplicateAsDubbed(a)}
                            title="Versão Dublada"
                            className="size-8 text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                          >
                            <Copy className="size-3.5" />
                          </Button>

                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => toggleHidden(a.id)}
                            title={a.hidden ? "Exibir" : "Ocultar"}
                            className="size-8 text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                          >
                            {a.hidden ? (
                              <EyeOff className="size-3.5 text-amber-400" />
                            ) : (
                              <Eye className="size-3.5" />
                            )}
                          </Button>

                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => setPendingDelete(a.id)}
                            title="Excluir anime"
                            className="size-8 text-[var(--color-muted)] hover:text-rose-400"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-white/[0.07] pt-4 text-xs text-[var(--color-muted)] sm:flex-row">
            <span className="studio-tabular">
              Página <strong className="text-[var(--color-fg)]">{currentPage}</strong> de{" "}
              <strong className="text-[var(--color-fg)]">{totalPages}</strong> ({filtered.length}{" "}
              animes filtrados)
            </span>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-9 border-white/10 text-xs"
              >
                <ChevronLeft className="mr-1 size-3.5" />
                Anterior
              </Button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                  let pageNum = idx + 1;
                  if (totalPages > 5 && currentPage > 3) {
                    pageNum = Math.min(totalPages, currentPage - 2 + idx);
                  }
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={cn(
                        "studio-mono size-9 rounded-md text-xs font-medium transition-colors",
                        currentPage === pageNum
                          ? "bg-purple-600 text-white"
                          : "border border-white/10 bg-[var(--studio-panel)] text-[var(--color-muted)] hover:bg-white/[0.06] hover:text-[var(--color-fg)]",
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-9 border-white/10 text-xs"
              >
                Próxima
                <ChevronRight className="ml-1 size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Modal de Confirmação de Exclusão */}
      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={() => setPendingDelete(null)}
      >
        <DialogContent className="hikari-studio-dialog max-h-[88dvh] overflow-y-auto border border-white/10 bg-[#0e0c17] text-[var(--color-fg)] sm:max-w-md">
          <div className="flex items-start gap-3.5">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-rose-500/25 bg-rose-500/12 text-rose-400">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg font-semibold text-[var(--color-fg)]">
                Excluir título do catálogo?
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-xs leading-relaxed text-[var(--color-muted)]">
                Todas as temporadas e episódios associados a este anime serão removidos do catálogo
                deste dispositivo. A base pública do AniList continuará inalterada.
              </DialogDescription>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2 border-t border-white/[0.07] pt-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPendingDelete(null)}
              className="h-9 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
            >
              Cancelar
            </Button>

            <Button
              type="button"
              variant="danger"
              onClick={() => {
                if (pendingDelete) {
                  removeAnime(pendingDelete);
                  toast.success("Anime removido com sucesso.");
                }
                setPendingDelete(null);
              }}
              className="h-9 bg-rose-600 text-xs font-semibold text-white hover:bg-rose-500"
            >
              Confirmar Exclusão
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
