import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
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
  HardDriveDownload,
  Image as ImageIcon,
  List,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  Users,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { toast } from "sonner";
import { getBearerToken } from "@/lib/auth/client";
import { searchCatalog } from "@/lib/api";
import {
  animeToLocal,
  areAnimeRecentBadgesEqual,
  displayTitle,
  normalizeAnimeRecentBadges,
  type LocalAnime,
  type SlimAnime,
} from "@/lib/types";
import { ensureCatalogLoaded, useHikariStore } from "@/lib/store";
import { shouldPreferRemoteMedia } from "@/lib/overlay";
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
  getAdminCatalogSyncMeta,
  getAdminSystemStatus,
  type AdminSystemStatus,
} from "@/lib/admin-dashboard.functions";
import {
  StudioEmptyState,
  StudioPageHeader,
  StudioPanel,
  StudioStatStrip,
} from "@/components/admin/studio-ui";
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

const STUDIO_SHORTCUTS = [
  {
    title: "Atualização Rápida",
    description: "Links dos Players 1 a 5",
    to: "/admin/quick-update",
    icon: Zap,
  },
  {
    title: "Central de Imagens",
    description: "Capas, banners e miniaturas",
    to: "/admin/images",
    icon: ImageIcon,
  },
  {
    title: "Usuários & Acessos",
    description: "Contas e permissões admin",
    to: "/admin/users",
    icon: Users,
  },
  {
    title: "Moderação",
    description: "Fila de comentários",
    to: "/admin/moderation",
    icon: ShieldAlert,
  },
  {
    title: "Configurações Gerais",
    description: "Marca, avisos e módulos",
    to: "/admin/settings",
    icon: SlidersHorizontal,
  },
  {
    title: "Manutenção & Cache",
    description: "Modo manutenção e ping",
    to: "/admin/maintenance",
    icon: Wrench,
  },
  {
    title: "Saúde do Sistema",
    description: "Latência e runtime Node",
    to: "/admin/health",
    icon: Activity,
  },
  {
    title: "Backup & Dados",
    description: "Exportar/restaurar JSON",
    to: "/admin/backup",
    icon: HardDriveDownload,
  },
] as const;

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

  const hasSyncedServerMetaRef = useRef(false);

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

  useEffect(() => {
    if (!hydrated || hasSyncedServerMetaRef.current) return;
    hasSyncedServerMetaRef.current = true;

    const isDubbedTitle = (text: string) => /\b(dub|dublado|dublada)\b/i.test(text);

    void getAdminCatalogSyncMeta().then((rows) => {
      if (!rows || rows.length === 0) return;

      const byId = new Map(rows.map((r) => [r.id, r]));
      const byAni = new Map<number, (typeof rows)[number]>();
      const byMal = new Map<number, (typeof rows)[number]>();
      const byKitsu = new Map<number, (typeof rows)[number]>();

      for (const row of rows) {
        if (isDubbedTitle(`${row.title} ${row.titleRomaji ?? ""} ${row.titleEnglish ?? ""}`)) {
          continue;
        }
        if (row.anilistId && !byAni.has(row.anilistId)) byAni.set(row.anilistId, row);
        if (row.malId && !byMal.has(row.malId)) byMal.set(row.malId, row);
        if (row.kitsuId && !byKitsu.has(row.kitsuId)) byKitsu.set(row.kitsuId, row);
      }

      const currentAnimes = useHikariStore.getState().animes;
      for (const local of currentAnimes) {
        const localIsDub = isDubbedTitle(
          `${local.titleRomaji} ${local.titleEnglish} ${local.titleNative}`,
        );
        const match =
          byId.get(local.id) ??
          (!localIsDub && local.anilistId ? byAni.get(local.anilistId) : undefined) ??
          (!localIsDub && local.malId ? byMal.get(local.malId) : undefined) ??
          (!localIsDub && local.kitsuId ? byKitsu.get(local.kitsuId) : undefined);

        if (!match) continue;

        const useServerCover = shouldPreferRemoteMedia(
          local.cover,
          match.cover ?? undefined,
          local,
          match.updatedAt,
        );
        const useServerBanner = shouldPreferRemoteMedia(
          local.banner,
          match.banner ?? undefined,
          local,
          match.updatedAt,
        );

        const hasUnsyncedLocalEdits = Boolean(
          local.syncedAt && (local.updatedAt ?? 0) > local.syncedAt,
        );
        const normalizedRemoteBadges = match.recentBadges
          ? normalizeAnimeRecentBadges(match.recentBadges)
          : undefined;
        const useServerBadges = Boolean(
          normalizedRemoteBadges &&
            (!hasUnsyncedLocalEdits || !local.recentBadges) &&
            !areAnimeRecentBadgesEqual(local.recentBadges, normalizedRemoteBadges),
        );

        if (useServerCover || useServerBanner || useServerBadges) {
          const nextUpdatedAt =
            Math.max(local.updatedAt ?? 0, match.updatedAt || 0) || local.updatedAt;
          const nextSyncedAt =
            Math.max(local.syncedAt ?? 0, match.updatedAt || 0) || local.syncedAt;
          upsertAnime({
            ...local,
            cover: useServerCover && match.cover ? match.cover : local.cover,
            banner: useServerBanner && match.banner ? match.banner : local.banner,
            recentBadges: useServerBadges ? normalizedRemoteBadges : local.recentBadges,
            updatedAt: nextUpdatedAt,
            syncedAt: nextSyncedAt,
          });
        }
      }
    });
  }, [hydrated, upsertAnime]);

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
            ? `Exclusão na fila (Temporada ${op.seasonNumber})`
            : `Salvamento na fila (Ep. ${op.episodeNumber || "—"})`,
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
          ? `Atualizado (${a.seasons?.reduce((n, s) => n + s.episodes.length, 0)} eps)`
          : `Novo título (${a.seasons?.length || 1} temp.)`,
      });
    }

    return list.sort((a, b) => b.timestamp - a.timestamp).slice(0, 6);
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

  async function duplicateAsDubbed(target: LocalAnime) {
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
          id: duplicated.id,
          titleRomaji: duplicated.titleRomaji,
          titleEnglish: duplicated.titleEnglish,
          titleNative: duplicated.titleNative,
          cover: duplicated.cover,
          banner: duplicated.banner,
          coverExplicitlyEdited: Boolean(duplicated.cover),
          bannerExplicitlyEdited: Boolean(duplicated.banner),
          synopsis: duplicated.synopsis,
          score: duplicated.score,
          genres: duplicated.genres,
          format: duplicated.format,
          status: duplicated.status,
          episodesCount: duplicated.episodesCount,
          season: duplicated.season,
          year: duplicated.year,
          trailerId: duplicated.trailerId,
          hidden: duplicated.hidden,
          seasons: duplicated.seasons.map((s) => ({
            number: s.number,
            title: s.title,
          })),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || "Falha ao persistir duplicação no servidor.");
      }

      const json = await res.json().catch(() => null);
      if (json?.animeId) {
        duplicated.id = json.animeId;
      }

      upsertAnime(duplicated);
      toast.success("Versão dublada criada e persistida com sucesso no servidor!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao duplicar anime.");
    }
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
    <div className="studio-enter space-y-7 pb-8">
      {/* Banners de Progresso e Reenvio em Lotes */}
      {isImporting && importProgress && (
        <div className="studio-panel rounded-xl border-purple-500/30 bg-[#161226]/80 p-4 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-purple-300">
              Sincronizando catálogo no PostgreSQL…
            </span>
            <span className="studio-mono text-xs text-zinc-400">
              Lote {importProgress.currentBatchIndex} de{" "}
              {importProgress.totalBatches}
            </span>
          </div>
          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-purple-600 transition-all duration-300"
              style={{
                width: `${Math.round(
                  ((importProgress.completedBatches +
                    importProgress.failedBatches) /
                    importProgress.totalBatches) *
                    100,
                )}%`,
              }}
            />
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-zinc-400">
            <span className="studio-tabular">
              {importProgress.processedAnimes} de {importProgress.totalAnimes}{" "}
              animes processados
            </span>
            <span className="studio-tabular">
              {importProgress.importedEpisodes} episódios importados
            </span>
          </div>
        </div>
      )}

      {failedBatches.length > 0 && !isImporting && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/15 p-4 text-sm text-amber-200">
          <div className="space-y-0.5">
            <p className="font-semibold text-amber-300">
              Importação parcialmente concluída
            </p>
            <p className="text-xs text-amber-400">
              {failedBatches.length} lote(s) apresentaram erros e foram mantidos
              para reenvio seguro.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isImporting}
            onClick={async () => {
              setIsImporting(true);
              toast.info(
                `Reenviando ${failedBatches.length} lote(s) pendente(s)...`,
              );
              try {
                const res = await retryFailedBatches(failedBatches, (p) =>
                  setImportProgress(p),
                );
                if (res.ok) {
                  setFailedBatches([]);
                  toast.success(
                    "Todos os lotes pendentes foram sincronizados com sucesso!",
                  );
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
            className="h-9 border-amber-500/30 bg-[#161226] text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
          >
            Reenviar lotes pendentes ({failedBatches.length})
          </Button>
        </div>
      )}

      {/* Cabeçalho Principal — Central de Controle */}
      <StudioPageHeader
        kicker="Console Editorial"
        title="Painel Administrativo"
        description="Gerencie o catálogo do Hikari, sincronize episódios via PostgreSQL/Outbox, acompanhe comentários e suspensões da comunidade."
        status={
          <span
            className={cn(
              "studio-mono inline-flex items-center gap-1.5 font-semibold",
              systemStatus?.connected ? "text-emerald-400" : "text-amber-400",
            )}
          >
            {systemStatus?.connected
              ? "PostgreSQL Conectado"
              : "Verificando banco..."}
          </span>
        }
        actions={
          <>
            <Button
              asChild
              className="h-10 bg-purple-600 px-4 text-xs font-semibold text-white shadow-md shadow-purple-600/25 hover:bg-purple-700"
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
              className="h-10 border-white/[0.08] bg-[#161226] px-3 text-xs font-semibold text-zinc-300 hover:border-purple-500/40 hover:bg-[#1f1a36] hover:text-white"
              title="Exportar backup completo em arquivo JSON"
            >
              <Download className="size-4 text-purple-400" />
              <span className="hidden sm:inline">Exportar</span>
            </Button>

            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-white/[0.08] bg-[#161226] px-3 text-xs font-semibold text-zinc-300 transition-colors hover:border-purple-500/40 hover:bg-[#1f1a36] hover:text-white">
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
                "h-10 px-3.5 text-xs font-semibold transition-colors",
                toolsOpen
                  ? "border-purple-500/30 bg-purple-500/15 text-purple-300"
                  : "border-white/[0.08] bg-[#161226] text-zinc-300 hover:border-purple-500/40 hover:bg-[#1f1a36] hover:text-white",
              )}
              title="Abrir ferramentas de importação AniList e backup"
            >
              <Sparkles className="size-4 text-purple-400" />
              <span>AniList &amp; Ferramentas</span>
            </Button>
          </>
        }
      />

      {/* Painel Expansível: Ferramentas do Catálogo */}
      {toolsOpen && (
        <StudioPanel
          title="Ferramentas de Importação & Backup"
          description="Importe metadados oficiais do AniList ou gerencie backups locais em JSON."
          icon={<Sparkles className="size-4" />}
          right={
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setToolsTab("anilist")}
                className={cn(
                  "h-9 rounded-lg px-3 text-xs font-semibold transition-colors cursor-pointer",
                  toolsTab === "anilist"
                    ? "border border-purple-500/30 bg-purple-500/15 text-purple-300"
                    : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100",
                )}
              >
                AniList
              </button>
              <button
                type="button"
                onClick={() => setToolsTab("json")}
                className={cn(
                  "h-9 rounded-lg px-3 text-xs font-semibold transition-colors cursor-pointer",
                  toolsTab === "json"
                    ? "border border-purple-500/30 bg-purple-500/15 text-purple-300"
                    : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100",
                )}
              >
                Backup &amp; JSON
              </button>
              <button
                type="button"
                onClick={() => setToolsOpen(false)}
                className="ml-1 flex size-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/[0.08] hover:text-white cursor-pointer"
                aria-label="Fechar ferramentas"
              >
                <X className="size-4" />
              </button>
            </div>
          }
        >
          {toolsTab === "anilist" ? (
            <div className="space-y-4">
              <p className="text-xs leading-relaxed text-zinc-400">
                Pesquise na base pública do AniList para importar capa, banner,
                sinopse, gêneros e identificadores externos.
              </p>

              <form
                onSubmit={runImportSearch}
                className="flex flex-col gap-2 sm:flex-row"
              >
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={importQ}
                    onChange={(e) => setImportQ(e.target.value)}
                    placeholder="Ex.: Frieren, Jujutsu Kaisen, Solo Leveling, One Piece..."
                    className="studio-input h-10 pl-9 text-sm"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={searchingAniList || !importQ.trim()}
                  className="h-10 shrink-0 bg-blue-700 px-4 text-xs font-semibold text-white hover:bg-blue-800"
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
                <div className="studio-scroll max-h-80 divide-y divide-slate-200 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50">
                  {hits.slice(0, 10).map((hit) => {
                    const alreadyInCatalog = animes.some(
                      (a) => a.id === hit.id || a.anilistId === hit.anilistId,
                    );
                    return (
                      <div
                        key={hit.id}
                        className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 transition-colors hover:bg-slate-50"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="h-14 w-10 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-100">
                            {hit.cover ? (
                              <img
                                src={hit.cover}
                                alt=""
                                className="size-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="grid size-full place-items-center text-[10px] text-slate-400">
                                —
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {displayTitle(hit)}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-slate-500">
                              {hit.year || "—"} · {hit.format || "TV"} ·{" "}
                              {(hit.genres || []).slice(0, 3).join(", ") ||
                                "Sem gênero"}
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
                              "h-9 text-xs font-semibold",
                              alreadyInCatalog
                                ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                                : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100",
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
                              className="h-9 border-slate-300 bg-white text-xs text-slate-700 hover:bg-slate-50"
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
            <div className="space-y-4">
              <p className="text-xs leading-relaxed text-slate-600">
                Gere um arquivo JSON completo com todas as temporadas, episódios e
                metadados ou restaure um backup sincronizando em lotes de 100
                com o PostgreSQL.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={exportJson}
                  className="h-10 bg-blue-700 px-4 text-xs font-semibold text-white hover:bg-blue-800"
                >
                  <Download className="mr-1.5 size-4" />
                  Baixar hikari-catalogo.json ({animes.length} animes)
                </Button>

                <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50">
                  <Upload className="size-4 text-blue-700" />
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
        </StudioPanel>
      )}

      {/* Faixa Unificada de KPIs Reais */}
      <StudioStatStrip
        columns={5}
        items={[
          {
            label: "Títulos no Catálogo",
            value: catalogStats.totalAnimes.toLocaleString("pt-BR"),
            detail: `${catalogStats.visibleAnimes} visíveis · ${catalogStats.hiddenAnimes} ocultos`,
            accent: "cobalt",
          },
          {
            label: "Episódios Publicados",
            value: catalogStats.totalPublishedEpisodes.toLocaleString("pt-BR"),
            detail: `${catalogStats.totalEpisodes} total · ${catalogStats.totalSeasons} temporadas`,
          },
          {
            label: "Usuários Registrados",
            value: systemStatus?.connected
              ? (systemStatus.serverUsersCount ?? 0).toLocaleString("pt-BR")
              : "—",
            detail: systemStatus?.connected
              ? `${systemStatus.serverAdminsCount ?? 0} admin(s) · ${systemStatus.serverActiveBansCount ?? 0} banido(s)`
              : "Consultando PostgreSQL...",
            href: "/admin/users",
          },
          {
            label: "Comentários & Denúncias",
            value: systemStatus?.connected
              ? (systemStatus.serverCommentsCount ?? 0).toLocaleString("pt-BR")
              : "—",
            detail:
              (systemStatus?.serverPendingReportsCount ?? 0) > 0
                ? `${systemStatus?.serverPendingReportsCount} denúncia(s) pendente(s)`
                : "Fila de denúncias limpa",
            accent:
              (systemStatus?.serverPendingReportsCount ?? 0) > 0
                ? "amber"
                : "emerald",
            href: "/admin/moderation",
          },
          {
            label: "Operação do Site",
            value: systemStatus?.maintenanceMode ? "Manutenção" : "Online",
            detail: `${
              systemStatus?.dbSource === "neon" ? "Neon Cloud" : "PostgreSQL"
            } · Outbox: ${pendingCount}`,
            accent: systemStatus?.maintenanceMode ? "rose" : "emerald",
            href: "/admin/maintenance",
          },
        ]}
      />

      {/* Grade Operacional: Atalhos + Estado do Sistema & Atividades Reais */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-7">
          {/* Acesso Rápido aos Módulos */}
          <StudioPanel
            title="Módulos Administrativos"
            description="Acesso direto às áreas operacionais, moderação de comunidade e infraestrutura."
            icon={<Sparkles className="size-4" />}
          >
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {STUDIO_SHORTCUTS.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="group flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 transition-colors hover:border-blue-300 hover:bg-blue-50/60"
                  >
                    <div className="grid size-8 shrink-0 place-items-center rounded-md border border-slate-200 bg-white text-blue-700 transition-colors group-hover:border-blue-300 group-hover:bg-blue-700 group-hover:text-white">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-900">
                        {item.title}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        {item.description}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </StudioPanel>

          {/* Estado do Sistema & Outbox */}
          <StudioPanel
            title="Infraestrutura PostgreSQL & Fila Outbox"
            description="Sincronização em tempo real entre catálogo local e banco remoto."
            icon={<Database className="size-4" />}
            right={
              <button
                type="button"
                onClick={checkSystem}
                disabled={isCheckingSystem}
                className="flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"
                title="Verificar conectividade agora"
                aria-label="Atualizar estado do sistema"
              >
                <RefreshCw
                  className={cn(
                    "size-3.5",
                    isCheckingSystem && "animate-spin",
                  )}
                />
              </button>
            }
          >
            <div
              id="system-status"
              className="scroll-mt-24 divide-y divide-slate-200"
            >
              <div className="flex items-center justify-between gap-3 pb-3">
                <div className="min-w-0">
                  <span className="block text-xs font-semibold text-slate-900">
                    Conexão PostgreSQL
                  </span>
                  <span className="studio-mono mt-0.5 block truncate text-[11px] text-slate-500">
                    {systemStatus?.dbSource === "neon"
                      ? "Neon Cloud Database (Pooled)"
                      : "PostgreSQL Ativo"}
                  </span>
                </div>
                <span
                  className={cn(
                    "studio-mono inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold",
                    systemStatus?.connected
                      ? "text-emerald-700"
                      : "text-rose-700",
                  )}
                >
                  {systemStatus?.connected ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : (
                    <AlertTriangle className="size-3.5" />
                  )}
                  <span>
                    {systemStatus?.connected ? "Conectado" : "Offline"}
                  </span>
                </span>
              </div>

              {systemStatus?.connected &&
                typeof systemStatus.serverAnimesCount === "number" && (
                  <div className="flex items-center justify-between gap-3 py-3 text-xs">
                    <span className="text-slate-600">
                      Registros persistidos no servidor
                    </span>
                    <span className="studio-mono text-[11px] font-semibold text-slate-900">
                      {systemStatus.serverAnimesCount} animes ·{" "}
                      {systemStatus.serverPublishedEpisodesCount ?? 0}/
                      {systemStatus.serverEpisodesCount ?? 0} eps pub.
                    </span>
                  </div>
                )}

              <div className="flex items-center justify-between gap-3 py-3 text-xs">
                <div>
                  <span className="block font-semibold text-slate-900">
                    Fila Outbox (Escritas Pendentes)
                  </span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">
                    Alterações locais aguardando confirmação remota
                  </span>
                </div>
                <span
                  className={cn(
                    "studio-mono font-semibold",
                    pendingCount > 0 ? "text-amber-700" : "text-emerald-700",
                  )}
                >
                  {pendingCount} pendência(s)
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 pt-3 text-xs">
                <div>
                  <span className="block font-semibold text-slate-900">
                    Conflitos de Sincronização
                  </span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">
                    Operações rejeitadas por validação no servidor
                  </span>
                </div>
                <span
                  className={cn(
                    "studio-mono font-semibold",
                    conflictCount > 0 ? "text-rose-700" : "text-slate-500",
                  )}
                >
                  {conflictCount} conflito(s)
                </span>
              </div>
            </div>

            {conflictOps.length > 0 && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs">
                <p className="font-semibold text-rose-800">
                  Operações em conflito
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {conflictOps.slice(0, 3).map((op) => (
                    <li
                      key={op.id}
                      className="flex items-center justify-between gap-2 text-[11px] text-rose-700"
                    >
                      <span className="truncate">
                        {op.animeId} · T{op.seasonNumber} E
                        {op.episodeNumber ?? "?"}:{" "}
                        {op.lastError || "Erro de validação"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          dismissOutboxOperation(op.id);
                          refreshOutbox();
                          toast.info("Conflito descartado da fila local.");
                        }}
                        className="shrink-0 text-[11px] font-semibold text-rose-800 underline hover:text-rose-950"
                      >
                        Descartar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 border-t border-slate-200 pt-3.5">
              {pendingCount > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={isSyncingOutbox}
                  onClick={handleManualSync}
                  className="h-9 w-full border border-amber-300 bg-amber-50 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                >
                  <RefreshCw
                    className={cn(
                      "mr-1.5 size-3.5",
                      isSyncingOutbox && "animate-spin",
                    )}
                  />
                  <span>
                    {isSyncingOutbox
                      ? "Sincronizando..."
                      : `Sincronizar ${pendingCount} operação(ões) agora`}
                  </span>
                </Button>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                    <CheckCircle2 className="size-3.5" />
                    <span>Catálogo 100% sincronizado</span>
                  </span>
                  <span className="studio-mono text-[11px] text-slate-500">
                    AniList: {catalogStats.anilistLinkedAnimes} · Dublados:{" "}
                    {catalogStats.dubbedAnimes}
                  </span>
                </div>
              )}
            </div>
          </StudioPanel>
        </div>

        {/* Coluna Direita: Atividades Recentes Reais */}
        <StudioPanel
          className="flex flex-col xl:col-span-5"
          bodyClassName="flex flex-1 flex-col justify-between"
          title="Atividades Recentes"
          description="Histórico real de alterações no acervo e fila local."
          icon={<Clock className="size-4" />}
          right={
            <span className="studio-mono text-xs text-slate-500">
              {recentActivities.length > 0
                ? `${recentActivities.length} registros`
                : "Vazio"}
            </span>
          }
        >
          {recentActivities.length === 0 ? (
            <div className="space-y-2.5 py-12 text-center">
              <div className="mx-auto grid size-10 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400">
                <Activity className="size-5" />
              </div>
              <p className="text-xs font-semibold text-slate-900">
                Nenhuma atividade recente registrada
              </p>
              <p className="mx-auto max-w-xs text-xs leading-relaxed text-slate-500">
                As atualizações de animes, episódios e operações de sincronização
                aparecerão aqui conforme forem realizadas.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {recentActivities.map((act) => (
                <li
                  key={act.id}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="h-11 w-8 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-100">
                    {act.cover ? (
                      <img
                        src={act.cover}
                        alt=""
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="grid size-full place-items-center text-[10px] font-bold text-slate-400">
                        光
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold leading-snug text-slate-900">
                      {act.title}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">
                      {act.details}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="studio-mono block text-[10px] text-slate-500">
                      {formatTime(act.timestamp)}
                    </span>
                    {act.type === "outbox-conflict" ? (
                      <span className="studio-mono inline-block text-[10px] font-semibold text-rose-700">
                        Conflito
                      </span>
                    ) : act.type === "outbox-pending" ? (
                      <span className="studio-mono inline-block text-[10px] font-semibold text-amber-700">
                        Na fila
                      </span>
                    ) : (
                      <span className="studio-mono inline-block text-[10px] font-semibold text-blue-700">
                        Salvo
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3.5 text-[11px] text-slate-500">
            <span>Fonte: IndexedDB &amp; Outbox</span>
            <Link
              to="/admin/quick-update"
              className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline"
            >
              <span>Atualização Rápida</span>
              <ArrowRight className="size-3" />
            </Link>
          </div>
        </StudioPanel>
      </div>

      {/* Catálogo de Títulos */}
      <section id="catalog" className="scroll-mt-20 space-y-4 pt-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-baseline gap-3">
            <h2 className="font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Catálogo de Títulos
            </h2>
            <span className="studio-mono text-xs font-semibold text-slate-500">
              {filtered.length} de {animes.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="hidden sm:inline">Exibir:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                aria-label="Itens por página"
                className="studio-input h-9 rounded-lg px-2.5 text-xs"
              >
                <option value={12}>12 por pág.</option>
                <option value={24}>24 por pág.</option>
                <option value={48}>48 por pág.</option>
              </select>
            </div>

            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md transition-colors",
                  viewMode === "grid"
                    ? "bg-blue-700 text-white"
                    : "text-slate-500 hover:text-slate-900",
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
                    ? "bg-blue-700 text-white"
                    : "text-slate-500 hover:text-slate-900",
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
        <div className="studio-panel space-y-3 rounded-xl p-4">
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Pesquisar por título em inglês, romaji ou nativo..."
                className="studio-input h-10 pl-9 pr-9 text-sm"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                  aria-label="Limpar pesquisa"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <ArrowUpDown className="hidden size-4 shrink-0 text-blue-700 sm:block" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Ordenar catálogo"
                className="studio-input h-10 w-full rounded-md px-3 text-xs sm:w-auto"
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

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
            <span className="mr-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
              <Filter className="size-3" />
              Filtros:
            </span>

            <select
              value={visibilityFilter}
              onChange={(e) =>
                setVisibilityFilter(e.target.value as VisibilityFilter)
              }
              aria-label="Filtrar por visibilidade"
              className="studio-input h-9 rounded-md px-2.5 text-xs"
            >
              <option value="all">Visibilidade: Todas</option>
              <option value="visible">Apenas Visíveis</option>
              <option value="hidden">Apenas Ocultos</option>
            </select>

            <select
              value={versionFilter}
              onChange={(e) =>
                setVersionFilter(e.target.value as VersionFilter)
              }
              aria-label="Filtrar por versão"
              className="studio-input h-9 rounded-md px-2.5 text-xs"
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
                className="studio-input h-9 rounded-md px-2.5 text-xs"
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
                className="studio-input h-9 rounded-md px-2.5 text-xs"
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
                className="ml-auto flex h-9 items-center gap-1 rounded-md px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
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
                  <div className="h-28 w-20 rounded-lg bg-slate-200" />
                  <div className="flex-1 space-y-2.5 py-1">
                    <div className="h-4 w-3/4 rounded bg-slate-200" />
                    <div className="h-3 w-1/2 rounded bg-slate-100" />
                    <div className="h-3 w-1/3 rounded bg-slate-100" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : animes.length === 0 ? (
          <StudioEmptyState
            icon={<Film className="size-6 text-blue-700" />}
            title="Nenhum título no catálogo local"
            description="Seu catálogo ainda está vazio neste navegador. Você pode cadastrar um título novo, importar do AniList ou restaurar um backup JSON."
            action={
              <>
                <Button
                  asChild
                  className="h-10 bg-blue-700 px-4 text-xs font-semibold text-white hover:bg-blue-800"
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
                  className="h-10 border-slate-300 bg-white text-xs text-slate-700 hover:bg-slate-50"
                >
                  <Sparkles className="mr-1.5 size-3.5 text-blue-700" />
                  Importar do AniList
                </Button>
              </>
            }
          />
        ) : filtered.length === 0 ? (
          <StudioEmptyState
            icon={<Search className="size-5" />}
            title="Nenhum anime encontrado com os filtros aplicados"
            description="Tente pesquisar com outro termo ou limpe os filtros ativos para visualizar todos os títulos."
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="h-9 border-blue-200 bg-blue-50 text-xs font-semibold text-blue-700 hover:bg-blue-100"
              >
                Limpar busca e filtros
              </Button>
            }
          />
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
                  className="studio-panel group flex flex-col justify-between rounded-xl p-3.5 transition-colors hover:border-blue-300"
                >
                  <div className="flex gap-3.5">
                    <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                      {a.cover ? (
                        <img
                          src={a.cover}
                          alt={displayTitle(a)}
                          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="grid size-full place-items-center bg-blue-50 font-display text-sm font-bold text-blue-700">
                          {displayTitle(a).slice(0, 2).toUpperCase()}
                        </div>
                      )}

                      <span className="studio-mono absolute right-1 bottom-1 rounded bg-slate-900/85 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {episodesCount} ep
                      </span>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col justify-between">
                      <div>
                        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-bold tracking-wider uppercase">
                          {a.hidden && (
                            <span className="text-rose-700">Oculto</span>
                          )}
                          {isDub && (
                            <span className="text-teal-700">Dublado</span>
                          )}
                          <span className="studio-mono text-slate-500">
                            {a.format || "TV"}
                          </span>
                        </div>

                        <h3
                          className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 transition-colors group-hover:text-blue-700"
                          title={displayTitle(a)}
                        >
                          {displayTitle(a)}
                        </h3>

                        {a.titleRomaji && a.titleEnglish && (
                          <p className="mt-0.5 truncate text-[11px] text-slate-500">
                            {a.titleRomaji}
                          </p>
                        )}
                      </div>

                      <p className="studio-tabular pt-2 text-[11px] text-slate-500">
                        {a.year || "—"} · {a.seasons.length} temp.
                        {a.anilistId ? ` · #${a.anilistId}` : " · Original"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3.5 flex items-center gap-1.5 border-t border-slate-200 pt-2.5">
                    <Button
                      asChild
                      size="sm"
                      className="h-9 flex-1 border border-blue-200 bg-blue-50 text-xs font-semibold text-blue-700 hover:bg-blue-700 hover:text-white"
                    >
                      <Link
                        to="/admin/$id"
                        params={{ id: a.id }}
                        search={{
                          importId: a.anilistId
                            ? String(a.anilistId)
                            : a.malId
                              ? `mal-${a.malId}`
                              : a.kitsuId
                                ? `kitsu-${a.kitsuId}`
                                : undefined,
                        }}
                      >
                        Editar
                      </Link>
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => duplicateAsDubbed(a)}
                      title="Criar cadastro independente para a versão dublada deste anime"
                      className="size-9 border-slate-200 bg-white p-0 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
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
                      title={
                        a.hidden
                          ? "Tornar anime visível"
                          : "Ocultar do site público"
                      }
                      className="size-9 border-slate-200 bg-white p-0 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    >
                      {a.hidden ? (
                        <EyeOff className="size-3.5 text-amber-600" />
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
                      className="size-9 p-0 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
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
          <div className="studio-panel overflow-x-auto rounded-xl">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                  <th className="w-14 px-4 py-3">Capa</th>
                  <th className="px-4 py-3">Título</th>
                  <th className="hidden px-4 py-3 sm:table-cell">
                    Ano / Formato
                  </th>
                  <th className="hidden px-4 py-3 md:table-cell">
                    Temporadas / Episódios
                  </th>
                  <th className="hidden px-4 py-3 lg:table-cell">Origem</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
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
                      className="transition-colors hover:bg-slate-50/80"
                    >
                      <td className="px-4 py-2.5">
                        <div className="h-12 w-9 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-100">
                          {a.cover ? (
                            <img
                              src={a.cover}
                              alt=""
                              className="size-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="grid size-full place-items-center text-[10px] text-slate-400">
                              —
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="min-w-44 px-4 py-2.5">
                        <p className="line-clamp-1 font-semibold text-slate-900">
                          {displayTitle(a)}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          {isDub && (
                            <span className="studio-mono text-[10px] font-semibold text-teal-700">
                              [Dublado]
                            </span>
                          )}
                          {a.titleRomaji && (
                            <span className="max-w-xs truncate text-[11px] text-slate-500">
                              {a.titleRomaji}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="studio-tabular hidden px-4 py-2.5 text-slate-600 sm:table-cell">
                        {a.year || "—"} · {a.format || "TV"}
                      </td>

                      <td className="studio-tabular hidden px-4 py-2.5 text-slate-600 md:table-cell">
                        {a.seasons.length} temp. ·{" "}
                        <span className="font-semibold text-slate-900">
                          {episodesCount} eps
                        </span>
                      </td>

                      <td className="studio-mono hidden px-4 py-2.5 text-[11px] text-slate-500 lg:table-cell">
                        {a.anilistId
                          ? `AniList #${a.anilistId}`
                          : "Original local"}
                      </td>

                      <td className="px-4 py-2.5 text-center">
                        {a.hidden ? (
                          <span className="studio-mono inline-flex rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                            Oculto
                          </span>
                        ) : (
                          <span className="studio-mono inline-flex rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            Ativo
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            asChild
                            size="sm"
                            className="h-8 border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-700 hover:text-white"
                          >
                            <Link
                              to="/admin/$id"
                              params={{ id: a.id }}
                              search={{
                                importId: a.anilistId
                                  ? String(a.anilistId)
                                  : a.malId
                                    ? `mal-${a.malId}`
                                    : a.kitsuId
                                      ? `kitsu-${a.kitsuId}`
                                      : undefined,
                              }}
                            >
                              Editar
                            </Link>
                          </Button>

                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => duplicateAsDubbed(a)}
                            title="Versão Dublada"
                            className="size-8 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Copy className="size-3.5" />
                          </Button>

                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => toggleHidden(a.id)}
                            title={a.hidden ? "Exibir" : "Ocultar"}
                            className="size-8 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          >
                            {a.hidden ? (
                              <EyeOff className="size-3.5 text-amber-600" />
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
                            className="size-8 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
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
          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-4 text-xs text-slate-600 sm:flex-row">
            <span className="studio-tabular">
              Página <strong className="text-slate-900">{currentPage}</strong>{" "}
              de <strong className="text-slate-900">{totalPages}</strong> (
              {filtered.length} animes filtrados)
            </span>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-9 border-slate-300 bg-white text-xs text-slate-700 hover:bg-slate-50"
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
                        "studio-mono size-9 rounded-md text-xs font-semibold transition-colors",
                        currentPage === pageNum
                          ? "bg-blue-700 text-white"
                          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900",
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
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                className="h-9 border-slate-300 bg-white text-xs text-slate-700 hover:bg-slate-50"
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
        <DialogContent className="hikari-studio-dialog max-h-[88dvh] overflow-y-auto border border-slate-200 bg-white text-slate-900 shadow-2xl sm:max-w-md">
          <div className="flex items-start gap-3.5">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg font-bold text-slate-900">
                Excluir título do catálogo?
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-xs leading-relaxed text-slate-600">
                Todas as temporadas e episódios associados a este anime serão
                removidos do catálogo no servidor e neste dispositivo. A base
                pública do AniList continuará inalterada.
              </DialogDescription>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingDelete(null)}
              className="h-9 border-slate-300 bg-white text-xs text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </Button>

            <Button
              type="button"
              variant="danger"
              onClick={async () => {
                if (pendingDelete) {
                  try {
                    const token = getBearerToken();
                    const res = await fetch(
                      `/api/admin/catalog-anime?id=${encodeURIComponent(pendingDelete)}`,
                      {
                        method: "DELETE",
                        headers: token
                          ? { Authorization: `Bearer ${token}` }
                          : {},
                        credentials: "include",
                      },
                    );

                    if (!res.ok) {
                      const errJson = await res.json().catch(() => null);
                      throw new Error(
                        errJson?.error || "Falha ao excluir anime no servidor.",
                      );
                    }

                    removeAnime(pendingDelete);
                    toast.success(
                      "Anime excluído com sucesso do servidor e do dispositivo.",
                    );
                    void checkSystem();
                  } catch (err) {
                    toast.error(
                      err instanceof Error
                        ? err.message
                        : "Erro ao excluir anime.",
                    );
                  }
                }
                setPendingDelete(null);
              }}
              className="h-9 bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700"
            >
              Confirmar Exclusão
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
