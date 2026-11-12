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

  // Estados de Busca e Filtros
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [formatFilter, setFormatFilter] = useState<string>("all");
  const [visibilityFilter, setVisibilityFilter] =
    useState<VisibilityFilter>("all");
  const [versionFilter, setVersionFilter] = useState<VersionFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("updated-desc");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(24);

  // Diálogo de Exclusão
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  // Painel de Ferramentas (Importar AniList / JSON)
  const [toolsOpen, setToolsOpen] = useState(false);
  const [toolsTab, setToolsTab] = useState<"anilist" | "json">("anilist");

  // Busca no AniList
  const [importQ, setImportQ] = useState("");
  const [hits, setHits] = useState<SlimAnime[]>([]);
  const [searchingAniList, setSearchingAniList] = useState(false);

  // Importação e Progresso em Lotes
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] =
    useState<BatchImportProgress | null>(null);
  const [failedBatches, setFailedBatches] = useState<FailedBatchItem[]>([]);

  // Outbox e Estado do Sistema
  const [outboxOps, setOutboxOps] = useState<OutboxOperation[]>([]);
  const [isSyncingOutbox, setIsSyncingOutbox] = useState(false);
  const [systemStatus, setSystemStatus] = useState<AdminSystemStatus | null>(
    null,
  );
  const [isCheckingSystem, setIsCheckingSystem] = useState(false);

  // Sincroniza dados do Outbox local
  const refreshOutbox = useCallback(() => {
    if (typeof window !== "undefined") {
      setOutboxOps(readOutbox());
    }
  }, []);

  // Consulta status real do servidor (PostgreSQL)
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

  // Sincronização manual do Outbox
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

  // =========================================================
  // 1. CÁLCULO DOS INDICADORES REAIS (RESUMO DO CATÁLOGO)
  // Todos os dados derivam estritamente do catálogo real carregado
  // =========================================================
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
          const isPub =
            ep.published === true ||
            (ep.published !== false && hasPlayableSource);
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

  const pendingCount = outboxOps.filter((o) => o.status !== "conflict").length;
  const conflictCount = outboxOps.filter((o) => o.status === "conflict").length;

  // =========================================================
  // 2. ATIVIDADES RECENTES (DERIVADAS DE DADOS REAIS)
  // Sem registros fictícios ou históricos simulados
  // =========================================================
  const recentActivities = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      type: "update" | "create" | "outbox-pending" | "outbox-conflict";
      timestamp: number;
      cover?: string;
      details?: string;
    }> = [];

    // Inclui operações recentes do Outbox que aguardam resolução
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

    // Inclui animes com carimbo de alteração real no banco/local
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

    // Ordena temporalmente as atividades reais combinadas
    return list.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
  }, [animes, outboxOps]);

  // Lista dinâmica de formatos e status presentes nos animes
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

  // =========================================================
  // 3. FILTRAGEM E ORDENAÇÃO DO CATÁLOGO
  // =========================================================
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    return animes
      .filter((a) => {
        // Busca textual
        if (query) {
          const fullText = `${a.titleRomaji} ${a.titleEnglish} ${a.titleNative} ${a.id}`.toLowerCase();
          if (!fullText.includes(query)) return false;
        }

        // Filtro de visibilidade
        if (visibilityFilter === "visible" && a.hidden) return false;
        if (visibilityFilter === "hidden" && !a.hidden) return false;

        // Filtro de formato
        if (formatFilter !== "all" && a.format?.toLowerCase() !== formatFilter.toLowerCase()) {
          return false;
        }

        // Filtro de status
        if (statusFilter !== "all" && a.status?.toLowerCase() !== statusFilter.toLowerCase()) {
          return false;
        }

        // Filtro de versão / origem
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

  // Paginação dos resultados filtrados
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginatedAnimes = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filtered.slice(startIndex, startIndex + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  // Reinicia página para 1 em alterações de filtro
  useEffect(() => {
    setCurrentPage(1);
  }, [q, visibilityFilter, formatFilter, statusFilter, versionFilter, sortBy, itemsPerPage]);

  // =========================================================
  // 4. IMPORTAÇÃO E EXPORTAÇÃO PRESERVADAS
  // =========================================================
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

  /**
   * Exporta o catálogo JSON aguardando expressamente a hidratação
   * para prevenir geração de backups acidentalmente vazios.
   */
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

        // 1. Restauração local prioritária (preserva IndexedDB)
        importAll(parsed.animes);
        toast.success(`Catálogo local restaurado com ${parsed.animes.length} animes.`);

        // 2. Inicia sincronização no servidor por lotes de 100
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
    <div className="space-y-8 animate-fade-in">
      {/* =========================================================
          BANNER DE PROGRESSO / REENVIO DE LOTES DE IMPORTAÇÃO
      ========================================================== */}
      {isImporting && importProgress && (
        <div className="rounded-xl border border-purple-500/30 bg-purple-950/40 p-4 text-sm text-fg shadow-lg">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-purple-300">
              Sincronizando catálogo no PostgreSQL...
            </span>
            <span className="font-mono text-xs text-muted">
              Lote {importProgress.currentBatchIndex} de {importProgress.totalBatches}
            </span>
          </div>
          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-surface">
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
          <div className="mt-2 flex flex-wrap justify-between text-xs text-muted">
            <span>
              {importProgress.processedAnimes} de {importProgress.totalAnimes} animes processados
            </span>
            <span>{importProgress.importedEpisodes} episódios importados</span>
          </div>
        </div>
      )}

      {failedBatches.length > 0 && !isImporting && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
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
            className="border-amber-500/40 text-amber-200 hover:bg-amber-500/20"
          >
            Reenviar lotes pendentes ({failedBatches.length})
          </Button>
        </div>
      )}

      {/* =========================================================
          CABEÇALHO DA VISÃO GERAL & AÇÕES RÁPIDAS
      ========================================================== */}
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between border-b border-white/[0.08] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-purple-400">
              Console Administrativo
            </span>
            <span className="rounded bg-purple-500/20 border border-purple-500/30 px-2 py-0.5 font-mono text-[10px] text-purple-300">
              Etapa B
            </span>
          </div>

          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight text-fg">
            Visão Geral & Catálogo
          </h1>

          <p className="mt-1 text-xs sm:text-sm text-muted max-w-2xl">
            Acompanhe o estado do catálogo, conectividade do PostgreSQL, fila de
            sincronização do Outbox e administre seus animes com rapidez.
          </p>
        </div>

        {/* Barra de Ações Rápidas */}
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild className="bg-purple-600 hover:bg-purple-500 text-white shadow-md">
            <Link to="/admin/$id" params={{ id: "new" }}>
              <Plus className="size-4" />
              <span>Novo Anime</span>
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={exportJson}
            className="border-white/10 bg-elevated/40 hover:bg-elevated hover:text-fg text-muted"
            title="Exportar backup completo em arquivo JSON"
          >
            <Download className="size-4 text-purple-400" />
            <span className="hidden sm:inline">Exportar</span>
          </Button>

          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-elevated/40 px-3 text-xs font-medium text-muted transition-colors hover:bg-elevated hover:text-fg">
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
              "border-white/10 bg-elevated/40 text-muted hover:bg-elevated hover:text-fg",
              toolsOpen && "border-purple-500/40 bg-purple-500/10 text-purple-300",
            )}
            title="Abrir ferramentas de importação e sincronização"
          >
            <Sparkles className="size-4 text-purple-400" />
            <span>Ferramentas</span>
          </Button>
        </div>
      </header>

      {/* =========================================================
          PAINEL DE FERRAMENTAS DO CATÁLOGO (EXPANSÍVEL)
      ========================================================== */}
      {toolsOpen && (
        <section className="rounded-2xl border border-purple-500/25 bg-[#0f0d18] p-5 shadow-xl transition-all">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-md bg-purple-600/20 text-purple-300">
                <Sparkles className="size-4" />
              </span>
              <div>
                <h3 className="font-display text-sm font-semibold text-fg">
                  Ferramentas do Catálogo
                </h3>
                <p className="text-[11px] text-muted">
                  Importe títulos oficiais do AniList ou gerencie backups locais e remotos.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setToolsTab("anilist")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  toolsTab === "anilist"
                    ? "bg-purple-600/30 text-purple-200 border border-purple-500/30"
                    : "text-muted hover:bg-white/[0.04] hover:text-fg",
                )}
              >
                AniList
              </button>
              <button
                type="button"
                onClick={() => setToolsTab("json")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  toolsTab === "json"
                    ? "bg-purple-600/30 text-purple-200 border border-purple-500/30"
                    : "text-muted hover:bg-white/[0.04] hover:text-fg",
                )}
              >
                Backup & JSON
              </button>
              <button
                type="button"
                onClick={() => setToolsOpen(false)}
                className="ml-2 flex size-6 items-center justify-center rounded text-muted hover:bg-white/10 hover:text-fg"
                aria-label="Fechar ferramentas"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {toolsTab === "anilist" ? (
            <div className="pt-4 space-y-4">
              <p className="text-xs text-muted">
                Busque um anime pelo nome oficial na base do AniList para importar capas em alta
                definição, sinopse, gêneros e metadados oficiais.
              </p>

              <form onSubmit={runImportSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
                  <Input
                    value={importQ}
                    onChange={(e) => setImportQ(e.target.value)}
                    placeholder="Ex.: Frieren, Jujutsu Kaisen, Solo Leveling, One Piece..."
                    className="pl-9 bg-elevated/60 border-white/10 focus:border-purple-500/50"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={searchingAniList || !importQ.trim()}
                  className="bg-purple-600 hover:bg-purple-500 text-white shrink-0"
                >
                  {searchingAniList ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin mr-1.5" />
                      Buscando…
                    </>
                  ) : (
                    "Buscar AniList"
                  )}
                </Button>
              </form>

              {hits.length > 0 && (
                <div className="mt-4 max-h-80 overflow-y-auto rounded-xl border border-white/[0.06] bg-elevated/40 p-2 divide-y divide-white/[0.05]">
                  {hits.slice(0, 10).map((hit) => {
                    const alreadyInCatalog = animes.some(
                      (a) => a.id === hit.id || a.anilistId === hit.anilistId,
                    );
                    return (
                      <div
                        key={hit.id}
                        className="flex items-center gap-3 p-2.5 hover:bg-white/[0.03] rounded-lg transition-colors"
                      >
                        <div className="h-14 w-10 shrink-0 overflow-hidden rounded bg-surface border border-white/10">
                          {hit.cover ? (
                            <img
                              src={hit.cover}
                              alt=""
                              className="size-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="grid size-full place-items-center text-[10px] text-muted">
                              —
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs sm:text-sm font-semibold text-fg">
                            {displayTitle(hit)}
                          </p>
                          <p className="truncate text-[11px] text-muted">
                            {hit.year || "—"} · {hit.format || "TV"} ·{" "}
                            {(hit.genres || []).slice(0, 3).join(", ") || "Sem gênero"}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => importHit(hit)}
                            className={cn(
                              "text-xs h-8",
                              alreadyInCatalog
                                ? "border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                                : "border-purple-500/30 text-purple-300 hover:bg-purple-500/10",
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
                              className="text-xs h-8 border-white/10 text-muted hover:text-fg"
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
            <div className="pt-4 space-y-3">
              <p className="text-xs text-muted">
                Gerencie o arquivo completo de animes em JSON. A exportação gera um backup íntegro com
                todas as temporadas, episódios e metadados. A importação atualiza o IndexedDB e
                sincroniza em lotes de 100 com o PostgreSQL.
              </p>
              <div className="flex flex-wrap gap-2.5 pt-1">
                <Button
                  type="button"
                  onClick={exportJson}
                  className="bg-purple-600 hover:bg-purple-500 text-white text-xs h-9"
                >
                  <Download className="size-3.5 mr-1.5" />
                  Baixar hikari-catalogo.json ({animes.length} animes)
                </Button>

                <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-elevated px-3 text-xs font-medium text-fg hover:bg-white/[0.08]">
                  <Upload className="size-3.5 text-purple-400" />
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

      {/* =========================================================
          NOVA VISÃO GERAL: DASHBOARD COM DADOS REAIS
          1. Resumo do Catálogo
          2. Estado do Sistema & Conexão
          3. Atividades Recentes
      ========================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* CARD 1: RESUMO DO CATÁLOGO */}
        <section className="rounded-2xl border border-white/[0.08] bg-[#0c0a14] p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="grid size-8 place-items-center rounded-lg bg-purple-600/20 text-purple-300 border border-purple-500/25">
                  <Film className="size-4" />
                </div>
                <div>
                  <h2 className="font-display text-sm font-semibold text-fg">
                    Resumo do Catálogo
                  </h2>
                  <p className="text-[10px] text-muted">Métricas canônicas</p>
                </div>
              </div>
              <span className="rounded-full bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 font-mono text-[10px] text-purple-300">
                {catalogStats.totalAnimes} títulos
              </span>
            </div>

            {/* Grid de Métricas Numéricas Reais */}
            <div className="grid grid-cols-2 gap-3 pt-4">
              <div className="rounded-xl border border-white/[0.04] bg-surface/60 p-3">
                <span className="text-[10px] font-medium text-muted uppercase tracking-wider block">
                  Animes Cadastrados
                </span>
                <span className="font-display text-2xl font-bold text-fg block mt-0.5">
                  {catalogStats.totalAnimes}
                </span>
                <span className="text-[10px] text-muted mt-1 block">
                  {catalogStats.visibleAnimes} visíveis · {catalogStats.hiddenAnimes} ocultos
                </span>
              </div>

              <div className="rounded-xl border border-white/[0.04] bg-surface/60 p-3">
                <span className="text-[10px] font-medium text-muted uppercase tracking-wider block">
                  Temporadas
                </span>
                <span className="font-display text-2xl font-bold text-fg block mt-0.5">
                  {catalogStats.totalSeasons}
                </span>
                <span className="text-[10px] text-muted mt-1 block">
                  Organizadas por anime
                </span>
              </div>

              <div className="rounded-xl border border-white/[0.04] bg-surface/60 p-3">
                <span className="text-[10px] font-medium text-muted uppercase tracking-wider block">
                  Total de Episódios
                </span>
                <span className="font-display text-2xl font-bold text-fg block mt-0.5">
                  {catalogStats.totalEpisodes}
                </span>
                <span className="text-[10px] text-muted mt-1 block">
                  Em todas as temporadas
                </span>
              </div>

              <div className="rounded-xl border border-white/[0.04] bg-surface/60 p-3">
                <span className="text-[10px] font-medium text-purple-300 uppercase tracking-wider block">
                  Episódios Publicados
                </span>
                <span className="font-display text-2xl font-bold text-purple-400 block mt-0.5">
                  {catalogStats.totalPublishedEpisodes}
                </span>
                <span className="text-[10px] text-muted mt-1 block">
                  Com links de reprodução
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-muted">
            <span>Vinculados ao AniList: {catalogStats.anilistLinkedAnimes}</span>
            <span>Versões Dubladas: {catalogStats.dubbedAnimes}</span>
          </div>
        </section>

        {/* CARD 2: ESTADO DO SISTEMA & OUTBOX */}
        <section className="rounded-2xl border border-white/[0.08] bg-[#0c0a14] p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="grid size-8 place-items-center rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/25">
                  <Database className="size-4" />
                </div>
                <div>
                  <h2 className="font-display text-sm font-semibold text-fg">
                    Estado do Sistema
                  </h2>
                  <p className="text-[10px] text-muted">Conectividade & Fila</p>
                </div>
              </div>

              <button
                type="button"
                onClick={checkSystem}
                disabled={isCheckingSystem}
                className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-white/10 hover:text-fg transition-colors"
                title="Checar conexão agora"
              >
                <RefreshCw
                  className={cn("size-3.5", isCheckingSystem && "animate-spin")}
                />
              </button>
            </div>

            {/* Linhas de Diagnóstico em Tempo Real */}
            <div className="space-y-2.5 pt-4">
              {/* Conexão PostgreSQL */}
              <div className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-surface/60 p-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-fg block">
                    Conexão PostgreSQL
                  </span>
                  <span className="font-mono text-[10px] text-muted block">
                    {systemStatus?.dbSource === "neon"
                      ? "Neon Cloud Database (Pooled)"
                      : "PGLite Embedded (WASM)"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      systemStatus?.connected
                        ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                        : "bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.5)]",
                    )}
                  />
                  <span
                    className={cn(
                      "text-xs font-medium",
                      systemStatus?.connected ? "text-emerald-400" : "text-red-400",
                    )}
                  >
                    {systemStatus?.connected ? "Conectado" : "Offline"}
                  </span>
                </div>
              </div>

              {/* Fila do Outbox */}
              <div className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-surface/60 p-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-fg block">
                    Fila do Outbox
                  </span>
                  <span className="text-[10px] text-muted block">
                    Alterações locais pendentes
                  </span>
                </div>
                <span
                  className={cn(
                    "font-mono text-xs font-semibold px-2 py-0.5 rounded",
                    pendingCount > 0
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                  )}
                >
                  {pendingCount} pendência(s)
                </span>
              </div>

              {/* Conflitos de Sincronização */}
              <div className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-surface/60 p-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-fg block">
                    Conflitos de Sincronização
                  </span>
                  <span className="text-[10px] text-muted block">
                    Rejeições do servidor
                  </span>
                </div>
                <span
                  className={cn(
                    "font-mono text-xs font-semibold px-2 py-0.5 rounded",
                    conflictCount > 0
                      ? "bg-red-500/20 text-red-300 border border-red-500/30"
                      : "bg-white/5 text-muted",
                  )}
                >
                  {conflictCount} conflito(s)
                </span>
              </div>
            </div>
          </div>

          {/* Ação ou Status do Outbox */}
          <div className="mt-4 pt-3 border-t border-white/[0.06]">
            {pendingCount > 0 ? (
              <Button
                type="button"
                size="sm"
                disabled={isSyncingOutbox}
                onClick={handleManualSync}
                className="w-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 text-xs h-8"
              >
                <RefreshCw
                  className={cn("size-3 mr-1.5", isSyncingOutbox && "animate-spin")}
                />
                <span>
                  {isSyncingOutbox ? "Sincronizando..." : `Sincronizar ${pendingCount} operação(ões)`}
                </span>
              </Button>
            ) : (
              <div className="flex items-center justify-between text-[11px] text-muted">
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="size-3" />
                  Catálogo 100% sincronizado
                </span>
                <span>Armazenamento: IndexedDB</span>
              </div>
            )}
          </div>
        </section>

        {/* CARD 3: ATIVIDADES RECENTES */}
        <section className="rounded-2xl border border-white/[0.08] bg-[#0c0a14] p-5 shadow-lg flex flex-col justify-between md:col-span-2 lg:col-span-1">
          <div>
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="grid size-8 place-items-center rounded-lg bg-purple-600/20 text-purple-300 border border-purple-500/25">
                  <Clock className="size-4" />
                </div>
                <div>
                  <h2 className="font-display text-sm font-semibold text-fg">
                    Atividades Recentes
                  </h2>
                  <p className="text-[10px] text-muted">Histórico real de edições</p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-muted">
                {recentActivities.length > 0 ? `${recentActivities.length} registros` : "Vazio"}
              </span>
            </div>

            {/* Lista de Atividades ou Estado Vazio Elegante */}
            {recentActivities.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <div className="mx-auto grid size-10 place-items-center rounded-full bg-white/[0.03] text-muted">
                  <Activity className="size-5 opacity-60" />
                </div>
                <p className="text-xs font-medium text-fg">
                  Nenhuma atividade recente registrada
                </p>
                <p className="text-[11px] text-muted max-w-xs mx-auto leading-relaxed">
                  As atualizações de animes, episódios e operações de sincronização aparecerão
                  aqui conforme forem realizadas.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.05] pt-2">
                {recentActivities.map((act) => (
                  <li key={act.id} className="py-2.5 flex items-center gap-3">
                    <div className="h-10 w-8 shrink-0 overflow-hidden rounded bg-surface border border-white/10">
                      {act.cover ? (
                        <img
                          src={act.cover}
                          alt=""
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="grid size-full place-items-center text-[9px] text-muted">
                          光
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-fg leading-snug">
                        {act.title}
                      </p>
                      <p className="truncate text-[10px] text-muted">
                        {act.details}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="font-mono text-[9px] text-muted block">
                        {formatTime(act.timestamp)}
                      </span>
                      {act.type === "outbox-conflict" ? (
                        <span className="inline-block font-mono text-[9px] text-red-400">
                          Conflito
                        </span>
                      ) : act.type === "outbox-pending" ? (
                        <span className="inline-block font-mono text-[9px] text-amber-300">
                          Na fila
                        </span>
                      ) : (
                        <span className="inline-block font-mono text-[9px] text-purple-400">
                          Salvo
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="pt-3 border-t border-white/[0.06] text-right">
            <span className="text-[10px] text-muted">
              Fonte: IndexedDB & Outbox local
            </span>
          </div>
        </section>
      </div>

      {/* =========================================================
          CATÁLOGO DE ANIMES (REDESIGN COMPLETO DA APRESENTAÇÃO)
      ========================================================== */}
      <section id="catalog" className="space-y-4 scroll-mt-20 pt-2">
        {/* Barra Superior do Catálogo: Título e Controles Rápidos */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-xl font-bold tracking-tight text-fg">
              Catálogo de Títulos
            </h2>
            <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-purple-300">
              {filtered.length} de {animes.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor de Itens por Página */}
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <span className="hidden sm:inline">Exibir:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="h-8 rounded-md border border-white/10 bg-elevated/60 px-2 text-xs text-fg focus:border-purple-500/50"
              >
                <option value={12}>12 por pág.</option>
                <option value={24}>24 por pág.</option>
                <option value={48}>48 por pág.</option>
              </select>
            </div>

            {/* Alternância Grid / Tabela */}
            <div className="flex items-center rounded-lg border border-white/10 bg-elevated/40 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "flex size-7 items-center justify-center rounded text-muted transition-colors",
                  viewMode === "grid"
                    ? "bg-purple-600/30 text-purple-200 shadow-sm"
                    : "hover:text-fg",
                )}
                title="Visualização em grade de cards"
                aria-label="Ver em grade"
              >
                <Grid className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={cn(
                  "flex size-7 items-center justify-center rounded text-muted transition-colors",
                  viewMode === "table"
                    ? "bg-purple-600/30 text-purple-200 shadow-sm"
                    : "hover:text-fg",
                )}
                title="Visualização em tabela detalhada"
                aria-label="Ver em tabela"
              >
                <List className="size-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Barra de Filtros e Busca Responsiva */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0a14] p-4 shadow-md space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5">
            {/* Campo de Busca por Título */}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Pesquisar por título em inglês, romaji ou nativo..."
                className="pl-9 pr-8 bg-elevated/40 border-white/10 text-sm h-10 focus:border-purple-500/50"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted hover:text-fg p-0.5"
                  aria-label="Limpar pesquisa"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Ordenação */}
            <div className="flex items-center gap-1.5 shrink-0">
              <ArrowUpDown className="size-4 text-purple-400 hidden sm:block shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Ordenar catálogo"
                className="h-10 w-full sm:w-auto rounded-md border border-white/10 bg-elevated/40 px-3 text-xs text-fg focus:border-purple-500/50"
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

          {/* Filtros em Linha / Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/[0.05]">
            <span className="text-[11px] font-medium text-muted flex items-center gap-1 mr-1">
              <Filter className="size-3" />
              Filtros:
            </span>

            {/* Filtro de Visibilidade */}
            <select
              value={visibilityFilter}
              onChange={(e) => setVisibilityFilter(e.target.value as VisibilityFilter)}
              aria-label="Filtrar por visibilidade"
              className="h-8 rounded-md border border-white/10 bg-elevated/60 px-2.5 text-xs text-fg focus:border-purple-500/50"
            >
              <option value="all">Visibilidade: Todas</option>
              <option value="visible">Apenas Visíveis</option>
              <option value="hidden">Apenas Ocultos</option>
            </select>

            {/* Filtro de Versão / Origem */}
            <select
              value={versionFilter}
              onChange={(e) => setVersionFilter(e.target.value as VersionFilter)}
              aria-label="Filtrar por versão"
              className="h-8 rounded-md border border-white/10 bg-elevated/60 px-2.5 text-xs text-fg focus:border-purple-500/50"
            >
              <option value="all">Versões: Todas</option>
              <option value="dubbed">Apenas Dublados</option>
              <option value="subbed">Apenas Legendados / Originais</option>
              <option value="anilist">Com vínculo AniList</option>
            </select>

            {/* Filtro de Formato (se houver formatos cadastrados) */}
            {availableFormats.length > 0 && (
              <select
                value={formatFilter}
                onChange={(e) => setFormatFilter(e.target.value)}
                aria-label="Filtrar por formato"
                className="h-8 rounded-md border border-white/10 bg-elevated/60 px-2.5 text-xs text-fg focus:border-purple-500/50"
              >
                <option value="all">Formato: Todos</option>
                {availableFormats.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            )}

            {/* Filtro de Status de Lançamento */}
            {availableStatuses.length > 0 && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filtrar por status"
                className="h-8 rounded-md border border-white/10 bg-elevated/60 px-2.5 text-xs text-fg focus:border-purple-500/50"
              >
                <option value="all">Status: Todos</option>
                {availableStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}

            {/* Botão de Limpar Filtros */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-purple-400 hover:text-purple-300 font-medium ml-auto flex items-center gap-1"
              >
                <X className="size-3" />
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {/* =========================================================
            LISTAGEM: CARDS OU TABELA
        ========================================================== */}
        {!hydrated ? (
          /* Estado de Carregamento / Hidratação */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="h-44 rounded-xl border border-white/[0.06] bg-[#0c0a14] p-3 animate-pulse"
              >
                <div className="flex gap-3">
                  <div className="h-28 w-20 rounded-lg bg-white/5" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-white/5" />
                    <div className="h-3 w-1/2 rounded bg-white/5" />
                    <div className="h-3 w-1/3 rounded bg-white/5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : animes.length === 0 ? (
          /* Catálogo Vazio */
          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0a14] p-10 text-center shadow-lg space-y-4">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-purple-600/10 text-purple-400 border border-purple-500/20">
              <Film className="size-7" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-lg font-semibold text-fg">
                Nenhum título no catálogo local
              </h3>
              <p className="text-xs text-muted max-w-md mx-auto">
                Seu catálogo ainda está vazio neste navegador. Você pode cadastrar um título novo,
                importar do AniList ou restaurar um backup JSON.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <Button asChild className="bg-purple-600 hover:bg-purple-500 text-white text-xs">
                <Link to="/admin/$id" params={{ id: "new" }}>
                  <Plus className="size-3.5 mr-1" />
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
                className="border-white/10 text-xs"
              >
                <Sparkles className="size-3.5 mr-1 text-purple-400" />
                Importar do AniList
              </Button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          /* Busca Sem Resultados */
          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0a14] p-8 text-center shadow-lg space-y-3">
            <div className="mx-auto grid size-12 place-items-center rounded-xl bg-white/[0.03] text-muted">
              <Search className="size-6 opacity-60" />
            </div>
            <p className="text-sm font-semibold text-fg">
              Nenhum anime encontrado com os filtros aplicados
            </p>
            <p className="text-xs text-muted max-w-sm mx-auto">
              Tente pesquisar com outro termo ou limpe os filtros ativos para ver todos os títulos.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="border-purple-500/30 text-purple-300 text-xs"
            >
              Limpar busca e filtros
            </Button>
          </div>
        ) : viewMode === "grid" ? (
          /* =========================================================
             MODO GRADE DE CARDS (RESPONSIVO: 1, 2, 3 OU 4 COLUNAS)
          ========================================================== */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedAnimes.map((a) => {
              const episodesCount = a.seasons.reduce(
                (n, s) => n + s.episodes.length,
                0,
              );
              const isDub = /\b(dub|dublado|dublada)\b/i.test(
                `${a.titleRomaji} ${a.titleEnglish} ${a.titleNative}`,
              );

              return (
                <div
                  key={a.id}
                  className="group relative flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#0c0a14] p-3.5 shadow-md transition-all hover:border-purple-500/30 hover:shadow-[0_4px_20px_rgba(168,85,247,0.1)]"
                >
                  <div className="flex gap-3">
                    {/* Capa com Thumbnail 3:4 e Fallback Elegante */}
                    <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-surface border border-white/10">
                      {a.cover ? (
                        <img
                          src={a.cover}
                          alt={displayTitle(a)}
                          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="grid size-full place-items-center bg-gradient-to-br from-purple-950/40 to-surface font-bold text-sm text-purple-400">
                          {displayTitle(a).slice(0, 2).toUpperCase()}
                        </div>
                      )}

                      {/* Tag de Episódios sobre a capa */}
                      <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 font-mono text-[9px] font-semibold text-white backdrop-blur-xs">
                        {episodesCount} ep
                      </span>
                    </div>

                    {/* Metadados e Títulos */}
                    <div className="min-w-0 flex-1 flex flex-col justify-between">
                      <div>
                        {/* Badges de Versão e Visibilidade */}
                        <div className="flex flex-wrap items-center gap-1 mb-1">
                          {a.hidden && (
                            <span className="rounded bg-red-500/15 border border-red-500/25 px-1.5 py-0.2 font-mono text-[9px] font-semibold text-red-300">
                              Oculto
                            </span>
                          )}
                          {isDub && (
                            <span className="rounded bg-purple-500/15 border border-purple-500/25 px-1.5 py-0.2 font-mono text-[9px] font-semibold text-purple-300">
                              Dublado
                            </span>
                          )}
                          {a.format && (
                            <span className="rounded bg-white/5 border border-white/10 px-1.5 py-0.2 font-mono text-[9px] text-muted">
                              {a.format}
                            </span>
                          )}
                        </div>

                        {/* Título Principal */}
                        <h3
                          className="line-clamp-2 text-xs sm:text-sm font-semibold text-fg leading-snug group-hover:text-purple-300 transition-colors"
                          title={displayTitle(a)}
                        >
                          {displayTitle(a)}
                        </h3>

                        {/* Título Alternativo */}
                        {a.titleRomaji && a.titleEnglish && (
                          <p className="truncate text-[10px] text-muted mt-0.5">
                            {a.titleRomaji}
                          </p>
                        )}
                      </div>

                      <div className="pt-2 text-[10px] text-muted space-y-0.5">
                        <p>
                          {a.year || "—"} · {a.seasons.length} temp.
                          {a.anilistId ? ` · ID ${a.anilistId}` : " · Original"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Barra de Ações do Card */}
                  <div className="mt-3.5 pt-2.5 border-t border-white/[0.06] flex items-center gap-1.5">
                    {/* Botão de Edição Principal */}
                    <Button
                      asChild
                      size="sm"
                      className="flex-1 bg-purple-600/20 hover:bg-purple-600/35 border border-purple-500/30 text-purple-200 text-xs h-8"
                    >
                      <Link to="/admin/$id" params={{ id: a.id }}>
                        Editar
                      </Link>
                    </Button>

                    {/* Botão Versão Dublada (preservado) */}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => duplicateAsDubbed(a)}
                      title="Criar cadastro independente para a versão dublada deste anime"
                      className="border-white/10 text-muted hover:text-fg hover:bg-white/5 h-8 px-2"
                    >
                      <Copy className="size-3.5" />
                      <span className="sr-only">Versão Dublada</span>
                    </Button>

                    {/* Botão Ocultar / Exibir */}
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
                      className="border-white/10 text-muted hover:text-fg hover:bg-white/5 h-8 px-2"
                    >
                      {a.hidden ? (
                        <EyeOff className="size-3.5 text-amber-400" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                      <span className="sr-only">Alternar visibilidade</span>
                    </Button>

                    {/* Botão Excluir */}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setPendingDelete(a.id)}
                      title="Excluir anime"
                      className="h-8 px-2 text-muted hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="size-3.5" />
                      <span className="sr-only">Excluir</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* =========================================================
             MODO TABELA DETALHADA (COMPACTO E PROLONGADO)
          ========================================================== */
          <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0c0a14] shadow-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] bg-surface/50 text-[11px] font-semibold text-muted">
                  <th className="py-3 px-4 w-14">Capa</th>
                  <th className="py-3 px-4">Título</th>
                  <th className="py-3 px-4 hidden sm:table-cell">Ano / Formato</th>
                  <th className="py-3 px-4 hidden md:table-cell">Temporadas / Episódios</th>
                  <th className="py-3 px-4 hidden lg:table-cell">Origem</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
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
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Capa */}
                      <td className="py-2.5 px-4">
                        <div className="h-12 w-9 rounded overflow-hidden bg-surface border border-white/10 shrink-0">
                          {a.cover ? (
                            <img
                              src={a.cover}
                              alt=""
                              className="size-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="grid size-full place-items-center text-[10px] text-muted">
                              —
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Título */}
                      <td className="py-2.5 px-4 min-w-44">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-fg line-clamp-1">
                            {displayTitle(a)}
                          </p>
                          <div className="flex items-center gap-1.5">
                            {isDub && (
                              <span className="font-mono text-[9px] text-purple-300">
                                [Dublado]
                              </span>
                            )}
                            {a.titleRomaji && (
                              <span className="text-[10px] text-muted truncate max-w-xs">
                                {a.titleRomaji}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Ano / Formato */}
                      <td className="py-2.5 px-4 text-muted hidden sm:table-cell">
                        {a.year || "—"} · {a.format || "TV"}
                      </td>

                      {/* Temporadas / Episódios */}
                      <td className="py-2.5 px-4 text-muted hidden md:table-cell">
                        {a.seasons.length} temp. ·{" "}
                        <span className="font-mono font-semibold text-fg">
                          {episodesCount} eps
                        </span>
                      </td>

                      {/* Origem */}
                      <td className="py-2.5 px-4 text-muted hidden lg:table-cell">
                        {a.anilistId ? (
                          <span className="font-mono text-[10px] text-muted">
                            AniList #{a.anilistId}
                          </span>
                        ) : (
                          <span className="font-mono text-[10px] text-muted">
                            Original local
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-4 text-center">
                        {a.hidden ? (
                          <span className="inline-block rounded bg-red-500/15 border border-red-500/25 px-2 py-0.5 font-mono text-[10px] text-red-300">
                            Oculto
                          </span>
                        ) : (
                          <span className="inline-block rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 font-mono text-[10px] text-emerald-400">
                            Ativo
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            asChild
                            size="sm"
                            className="bg-purple-600/20 hover:bg-purple-600/35 border border-purple-500/30 text-purple-200 text-xs h-7 px-2.5"
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
                            className="size-7 text-muted hover:text-fg"
                          >
                            <Copy className="size-3.5" />
                          </Button>

                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => toggleHidden(a.id)}
                            title={a.hidden ? "Exibir" : "Ocultar"}
                            className="size-7 text-muted hover:text-fg"
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
                            title="Excluir"
                            className="size-7 text-muted hover:text-red-400"
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

        {/* =========================================================
            PAGINAÇÃO COMPACTA
        ========================================================== */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-white/[0.06] text-xs text-muted">
            <span>
              Exibindo página{" "}
              <strong className="text-fg">{currentPage}</strong> de{" "}
              <strong className="text-fg">{totalPages}</strong> ({filtered.length} animes filtrados)
            </span>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-8 border-white/10 text-xs"
              >
                <ChevronLeft className="size-3.5 mr-1" />
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
                        "size-8 rounded-md font-mono text-xs font-medium transition-colors",
                        currentPage === pageNum
                          ? "bg-purple-600 text-white shadow-sm"
                          : "border border-white/10 bg-elevated/40 text-muted hover:bg-elevated hover:text-fg",
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
                className="h-8 border-white/10 text-xs"
              >
                Próxima
                <ChevronRight className="size-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* =========================================================
          MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (PRESERVADO)
      ========================================================== */}
      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={() => setPendingDelete(null)}
      >
        <DialogContent className="border border-white/10 bg-[#0f0d18] text-fg sm:max-w-md">
          <div className="flex items-start gap-3.5">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg font-semibold text-fg">
                Excluir título do catálogo?
              </DialogTitle>
              <DialogDescription className="text-xs text-muted mt-1 leading-relaxed">
                Todas as temporadas e episódios associados a este anime serão removidos do
                catálogo deste dispositivo. A base pública do AniList continuará inalterada.
              </DialogDescription>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPendingDelete(null)}
              className="text-xs h-9 text-muted hover:text-fg"
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
              className="text-xs h-9 bg-red-600 hover:bg-red-500 text-white"
            >
              Confirmar Exclusão
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
