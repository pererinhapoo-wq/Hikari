import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  Film,
  History,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  User,
  X,
} from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  type BanModalTargetUser,
  StudioEmptyState,
  StudioLoadingState,
  StudioPageHeader,
  StudioPanel,
  StudioStatStrip,
  UserBanModal,
} from "@/components/admin/studio-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getBearerToken } from "@/lib/auth/client";
import {
  formatBanDateTime,
  formatBanRemaining,
  type ActiveUserBan,
  type BanHistoryEntry,
  type EnrichedActiveUserBan,
} from "@/lib/moderation-ban-types";
import { cn } from "@/lib/utils";
import type {
  AdminCommentItem,
  AdminCommentsSummary,
} from "@/routes/api/admin/comments";
import type { AdminUserListItem } from "@/routes/api/admin/users";

export const Route = createFileRoute("/admin/moderation")({
  component: AdminModeration,
});

type ModerationTab = "comments" | "reports" | "profile_reports" | "bans";
type CommentFilter = "all" | "reported" | "spoilers" | "roots" | "replies";

const INITIAL_SUMMARY: AdminCommentsSummary = {
  totalComments: 0,
  totalRoots: 0,
  totalReplies: 0,
  reportedComments: 0,
  pendingReports: 0,
  spoilersCount: 0,
  activeBansCount: 0,
};

interface AdminCommentsApiResponse {
  ok?: boolean;
  comments?: AdminCommentItem[];
  summary?: AdminCommentsSummary;
  pagination?: { total: number; totalPages: number };
  error?: string;
}

interface AdminBansApiResponse {
  ok?: boolean;
  activeBans?: EnrichedActiveUserBan[];
  history?: BanHistoryEntry[];
  error?: string;
}

const inFlightCommentsRequests = new Map<string, Promise<AdminCommentsApiResponse>>();
let inFlightBansRequest: Promise<AdminBansApiResponse> | null = null;

function AdminModeration() {
  const [activeTab, setActiveTab] = useState<ModerationTab>("comments");

  // Comentários & Denúncias (PostgreSQL real)
  const [comments, setComments] = useState<AdminCommentItem[]>([]);
  const [summary, setSummary] = useState<AdminCommentsSummary>(INITIAL_SUMMARY);
  const [loadingComments, setLoadingComments] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [commentFilter, setCommentFilter] = useState<CommentFilter>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalFiltered, setTotalFiltered] = useState(0);

  // Banimentos & Histórico (carregados sob demanda apenas ao abrir a aba Banimentos)
  const [activeBans, setActiveBans] = useState<EnrichedActiveUserBan[]>([]);
  const [banHistory, setBanHistory] = useState<BanHistoryEntry[]>([]);
  const [loadingBans, setLoadingBans] = useState(false);
  const [hasLoadedBans, setHasLoadedBans] = useState(false);
  const bansDirtyRef = useRef(true);
  const lastCommentsKeyRef = useRef<string | null>(null);
  const commentsDirtyRef = useRef(false);

  // Ações e modais
  const [pendingAction, setPendingAction] = useState<{
    type: "delete" | "resolve_reports" | "toggle_spoiler";
    comment: AdminCommentItem;
  } | null>(null);
  const [processingAction, setProcessingAction] = useState(false);

  const [banTarget, setBanTarget] = useState<BanModalTargetUser | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<{
    userId: string;
    userName: string;
  } | null>(null);
  const [revokingBan, setRevokingBan] = useState(false);

  // Modal de seleção rápida de usuário para banimento na aba Banimentos
  const [userLookupOpen, setUserLookupOpen] = useState(false);
  const [userLookupQuery, setUserLookupQuery] = useState("");
  const [userLookupResults, setUserLookupResults] = useState<AdminUserListItem[]>([]);
  const [userLookupLoading, setUserLookupLoading] = useState(false);

  // Preview ampliado de imagem anexada em comentário
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Denúncias de Perfil
  const [profileReports, setProfileReports] = useState<any[]>([]);
  const [loadingProfileReports, setLoadingProfileReports] = useState(false);
  const [profileReportsError, setProfileReportsError] = useState<string | null>(null);
  const [profileReportStatusFilter, setProfileReportStatusFilter] = useState<string>("pending");
  const [profileReportPage, setProfileReportPage] = useState(1);
  const [profileReportTotal, setProfileReportTotal] = useState(0);
  const [profileReportTotalPages, setProfileReportTotalPages] = useState(1);
  const [pendingProfileReportsCount, setPendingProfileReportsCount] = useState(0);
  const [selectedProfileReport, setSelectedProfileReport] = useState<any | null>(null);
  const [profileReportNotes, setProfileReportNotes] = useState("");
  const [updatingProfileReport, setUpdatingProfileReport] = useState(false);

  const loadProfileReports = useCallback(async () => {
    setLoadingProfileReports(true);
    setProfileReportsError(null);
    try {
      const token = getBearerToken();
      const params = new URLSearchParams({
        status: profileReportStatusFilter,
        page: String(profileReportPage),
      });
      const res = await fetch(`/api/admin/profile-reports?${params.toString()}`, {
        method: "GET",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Falha ao carregar denúncias de perfil.");
      }
      setProfileReports(Array.isArray(data?.reports) ? data.reports : []);
      setProfileReportTotal(Number(data?.pagination?.total || 0));
      setProfileReportTotalPages(Math.max(1, Number(data?.pagination?.totalPages || 1)));
      if (typeof data?.pendingCount === "number") {
        setPendingProfileReportsCount(data.pendingCount);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar denúncias de perfil.";
      setProfileReportsError(msg);
      toast.error(msg);
    } finally {
      setLoadingProfileReports(false);
    }
  }, [profileReportStatusFilter, profileReportPage]);

  // Carrega contagem inicial de denúncias de perfil pendentes ao abrir a Central de Moderação
  useEffect(() => {
    let cancelled = false;
    const loadInitialPendingCount = async () => {
      try {
        const token = getBearerToken();
        const res = await fetch("/api/admin/profile-reports?status=pending&page=1", {
          method: "GET",
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json().catch(() => null);
        if (!cancelled && res.ok && typeof data?.pendingCount === "number") {
          setPendingProfileReportsCount(data.pendingCount);
        }
      } catch {
        // Silencioso na pré-carga do contador; erros detalhados aparecem ao abrir a aba
      }
    };
    void loadInitialPendingCount();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeTab === "profile_reports") {
      void loadProfileReports();
    }
  }, [activeTab, loadProfileReports]);

  const handleUpdateProfileReportStatus = async (reportId: string, status: string, notes?: string) => {
    if (updatingProfileReport) return;
    setUpdatingProfileReport(true);
    try {
      const token = getBearerToken();
      const res = await fetch("/api/admin/profile-reports", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          reportId,
          status,
          adminNotes: notes,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Falha ao atualizar denúncia.");
      }
      toast.success("Denúncia atualizada com sucesso!");
      setSelectedProfileReport(null);
      await loadProfileReports();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar denúncia.");
    } finally {
      setUpdatingProfileReport(false);
    }
  };

  // Debounce da busca de comentários (ignora render inicial com busca vazia)
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === searchTerm) return;

    const timer = setTimeout(() => {
      setSearchTerm(trimmed);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, searchTerm]);

  const effectiveCommentsFilter =
    activeTab === "reports" ? "pending_reports" : commentFilter;
  const currentCommentsQueryKey = `${effectiveCommentsFilter}|${page}|${searchTerm}`;

  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const token = getBearerToken();
      const params = new URLSearchParams({
        filter: effectiveCommentsFilter,
        page: String(page),
        limit: "15",
      });
      if (searchTerm) {
        params.set("search", searchTerm);
      }
      const queryString = params.toString();

      let promise = inFlightCommentsRequests.get(queryString);
      if (!promise) {
        promise = (async () => {
          const res = await fetch(`/api/admin/comments?${queryString}`, {
            method: "GET",
            credentials: "include",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });

          const data = (await res.json().catch(() => null)) as AdminCommentsApiResponse | null;
          if (!res.ok) {
            throw new Error(
              data?.error || "Não foi possível carregar os comentários.",
            );
          }
          return data ?? {};
        })().finally(() => {
          if (inFlightCommentsRequests.get(queryString) === promise) {
            inFlightCommentsRequests.delete(queryString);
          }
        });
        inFlightCommentsRequests.set(queryString, promise);
      }

      const data = await promise;

      setComments(Array.isArray(data?.comments) ? data.comments : []);
      if (data?.summary) {
        setSummary(data.summary);
      }
      setTotalFiltered(Number(data?.pagination?.total || 0));
      setTotalPages(Math.max(1, Number(data?.pagination?.totalPages || 1)));
      lastCommentsKeyRef.current = currentCommentsQueryKey;
      commentsDirtyRef.current = false;
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar os comentários.",
      );
    } finally {
      setLoadingComments(false);
    }
  }, [currentCommentsQueryKey, effectiveCommentsFilter, page, searchTerm]);

  const loadBans = useCallback(async () => {
    setLoadingBans(true);
    try {
      const token = getBearerToken();
      let promise = inFlightBansRequest;
      if (!promise) {
        let flightRef: Promise<AdminBansApiResponse> | null = null;
        promise = (async () => {
          const res = await fetch("/api/admin/bans", {
            method: "GET",
            credentials: "include",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });

          const data = (await res.json().catch(() => null)) as AdminBansApiResponse | null;
          if (!res.ok) {
            throw new Error(
              data?.error || "Não foi possível carregar os banimentos.",
            );
          }
          return data ?? {};
        })().finally(() => {
          if (inFlightBansRequest === flightRef) {
            inFlightBansRequest = null;
          }
        });
        flightRef = promise;
        inFlightBansRequest = promise;
      }

      const data = await promise;

      const nextActiveBans = Array.isArray(data?.activeBans)
        ? data.activeBans
        : [];
      setActiveBans(nextActiveBans);
      setBanHistory(Array.isArray(data?.history) ? data.history : []);
      setHasLoadedBans(true);
      bansDirtyRef.current = false;
      setSummary((prev) => ({
        ...prev,
        activeBansCount: nextActiveBans.length,
      }));
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar os banimentos.",
      );
    } finally {
      setLoadingBans(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== "comments" && activeTab !== "reports") return;
    if (
      !commentsDirtyRef.current &&
      lastCommentsKeyRef.current === currentCommentsQueryKey
    ) {
      return;
    }
    void loadComments();
  }, [activeTab, currentCommentsQueryKey, loadComments]);

  useEffect(() => {
    if (activeTab !== "bans") return;
    if (!bansDirtyRef.current && hasLoadedBans) return;
    void loadBans();
  }, [activeTab, hasLoadedBans, loadBans]);

  // Busca de usuários no modal de novo banimento
  useEffect(() => {
    if (!userLookupOpen) return;
    let cancelled = false;

    const timer = setTimeout(async () => {
      setUserLookupLoading(true);
      try {
        const token = getBearerToken();
        const params = new URLSearchParams({
          search: userLookupQuery.trim(),
          role: "all",
          page: "1",
          limit: "12",
        });
        const res = await fetch(`/api/admin/users?${params.toString()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = (await res.json().catch(() => null)) as {
          users?: AdminUserListItem[];
        } | null;
        if (!cancelled) {
          setUserLookupResults(Array.isArray(data?.users) ? data.users : []);
        }
      } catch {
        if (!cancelled) {
          setUserLookupResults([]);
        }
      } finally {
        if (!cancelled) {
          setUserLookupLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [userLookupOpen, userLookupQuery]);

  const handleRefreshAll = () => {
    if (activeTab === "bans") {
      commentsDirtyRef.current = true;
      void loadBans();
      return;
    }
    if (activeTab === "profile_reports") {
      void loadProfileReports();
      return;
    }
    bansDirtyRef.current = true;
    void loadComments();
  };

  const executeCommentAction = async () => {
    if (!pendingAction || processingAction) return;
    setProcessingAction(true);

    try {
      const token = getBearerToken();
      const res = await fetch("/api/admin/comments", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          commentId: pendingAction.comment.id,
          action: pendingAction.type,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        isSpoiler?: boolean;
        error?: string;
      } | null;

      if (!res.ok) {
        throw new Error(
          data?.error || "Não foi possível concluir a ação no comentário.",
        );
      }

      if (pendingAction.type === "delete") {
        toast.success("Comentário removido permanentemente.");
      } else if (pendingAction.type === "resolve_reports") {
        toast.success("Denúncias marcadas como resolvidas.");
      } else {
        toast.success(
          data?.isSpoiler
            ? "Comentário marcado como spoiler."
            : "Marcação de spoiler removida.",
        );
      }

      setPendingAction(null);
      await loadComments();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Erro ao executar ação de moderação.",
      );
    } finally {
      setProcessingAction(false);
    }
  };

  const handleToggleSpoilerInline = async (comment: AdminCommentItem) => {
    try {
      const token = getBearerToken();
      const res = await fetch("/api/admin/comments", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          commentId: comment.id,
          action: "toggle_spoiler",
          isSpoiler: !comment.isSpoiler,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        isSpoiler?: boolean;
        error?: string;
      } | null;

      if (!res.ok) {
        throw new Error(data?.error || "Falha ao atualizar alerta de spoiler.");
      }

      toast.success(
        data?.isSpoiler
          ? "Spoiler ativado no comentário."
          : "Spoiler removido do comentário.",
      );
      await loadComments();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao alterar spoiler.",
      );
    }
  };

  const handleConfirmRevokeBan = async () => {
    if (!revokeTarget || revokingBan) return;
    setRevokingBan(true);
    try {
      const token = getBearerToken();
      const res = await fetch(
        `/api/admin/bans?userId=${encodeURIComponent(revokeTarget.userId)}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      const data = (await res.json().catch(() => null)) as {
        message?: string;
        error?: string;
      } | null;

      if (!res.ok) {
        throw new Error(data?.error || "Não foi possível revogar o banimento.");
      }

      toast.success(data?.message || "Banimento encerrado antecipadamente.");
      setRevokeTarget(null);
      if (activeTab === "bans") {
        commentsDirtyRef.current = true;
        await loadBans();
      } else {
        bansDirtyRef.current = true;
        await loadComments();
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao revogar banimento.",
      );
    } finally {
      setRevokingBan(false);
    }
  };

  const isRefreshing = loadingComments || loadingBans || loadingProfileReports;
  const displayedActiveBansCount = hasLoadedBans
    ? activeBans.length
    : summary.activeBansCount;

  return (
    <div className="studio-enter space-y-6 pb-8">
      <StudioPageHeader
        kicker="Comunidade & Segurança"
        title="Central de Comentários & Moderação"
        description="Inspecione comentários reais do PostgreSQL, resolva denúncias da comunidade, controle alertas de spoiler e aplique ou revogue banimentos temporários."
        backTo="/admin"
        backLabel="Voltar ao Painel"
        status={
          summary.reportedComments > 0 ? (
            <span className="studio-tabular font-semibold text-amber-400">
              {summary.reportedComments} comentário(s) com denúncia pendente
            </span>
          ) : (
            <span className="font-semibold text-emerald-400">
              Sem denúncias pendentes
            </span>
          )
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setUserLookupOpen(true)}
              className="h-9 gap-1.5 border-rose-500/30 bg-rose-500/15 px-3 text-xs font-semibold text-rose-300 hover:bg-rose-500/25"
            >
              <Ban className="size-3.5" />
              Aplicar Banimento
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleRefreshAll}
              disabled={isRefreshing}
              className="h-9 gap-1.5 border-white/[0.08] bg-[#161226] px-3.5 text-xs font-semibold text-zinc-200 hover:border-purple-500/40 hover:bg-[#1f1a36] hover:text-white"
            >
              <RefreshCw
                className={cn("size-3.5", isRefreshing && "animate-spin")}
              />
              {isRefreshing ? "Atualizando…" : "Atualizar"}
            </Button>
          </div>
        }
      />

      {/* Indicadores Principais */}
      <StudioStatStrip
        columns={4}
        items={[
          {
            label: "Total de Comentários",
            value: summary.totalComments.toLocaleString("pt-BR"),
            detail: `${summary.totalRoots.toLocaleString("pt-BR")} raízes · ${summary.totalReplies.toLocaleString("pt-BR")} respostas`,
            accent: "cobalt",
          },
          {
            label: "Denúncias Pendentes",
            value: summary.pendingReports.toLocaleString("pt-BR"),
            detail: `${summary.reportedComments.toLocaleString("pt-BR")} comentário(s) sinalizado(s)`,
            accent: summary.pendingReports > 0 ? "amber" : "emerald",
          },
          {
            label: "Com Alerta de Spoiler",
            value: summary.spoilersCount.toLocaleString("pt-BR"),
            detail: "Protegidos contra visualização acidental",
            accent: "default",
          },
          {
            label: "Banimentos Ativos",
            value: displayedActiveBansCount.toLocaleString("pt-BR"),
            detail: "Suspensões temporárias em vigor",
            accent: displayedActiveBansCount > 0 ? "rose" : "default",
          },
        ]}
      />

      {/* Navegação por Abas */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
        <div
          role="tablist"
          aria-label="Seções de moderação"
          className="inline-flex flex-wrap gap-1.5 rounded-xl border border-white/[0.08] bg-[#12101e] p-1"
        >
          {(
            [
              {
                id: "comments" as const,
                label: "Todos os Comentários",
                icon: MessageSquare,
                badge: summary.totalComments,
              },
              {
                id: "reports" as const,
                label: "Denúncias Pendentes",
                icon: ShieldAlert,
                badge: summary.reportedComments,
                alert: summary.reportedComments > 0,
              },
              {
                id: "profile_reports" as const,
                label: "Denúncias de Perfil",
                icon: ShieldAlert,
                badge: pendingProfileReportsCount,
                alert: pendingProfileReportsCount > 0,
              },
              {
                id: "bans" as const,
                label: "Banimentos & Histórico",
                icon: Ban,
                badge: displayedActiveBansCount,
                danger: displayedActiveBansCount > 0,
              },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={selected}
                onClick={() => {
                  setActiveTab(tab.id);
                  setPage(1);
                }}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors cursor-pointer",
                  selected
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-zinc-400 hover:bg-[#1a172e] hover:text-zinc-100",
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "studio-tabular rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                    selected
                      ? "bg-white/20 text-white"
                      : "alert" in tab && tab.alert
                        ? "bg-amber-500/20 text-amber-300"
                        : "danger" in tab && tab.danger
                          ? "bg-rose-500/20 text-rose-300"
                          : "bg-white/[0.08] text-zinc-300",
                  )}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Aba 1 & Aba 2: Listagem de Comentários / Denúncias */}
      {(activeTab === "comments" || activeTab === "reports") && (
        <div className="space-y-4">
          <StudioPanel bodyClassName="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Buscar por texto do comentário, autor, @nick, e-mail, anime ou episódio..."
                  aria-label="Buscar comentários"
                  className="studio-input h-10 pl-9 pr-8 text-xs"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => setSearchInput("")}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-zinc-400 hover:bg-white/[0.06] hover:text-white cursor-pointer"
                    aria-label="Limpar busca"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {activeTab === "comments" && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: "all", label: "Todos" },
                      { id: "reported", label: "Denunciados" },
                      { id: "spoilers", label: "Spoilers" },
                      { id: "roots", label: "Principais" },
                      { id: "replies", label: "Respostas" },
                    ] as const
                  ).map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => {
                        setCommentFilter(chip.id);
                        setPage(1);
                      }}
                      className={cn(
                        "h-8 rounded-lg border px-3 text-xs font-semibold transition-colors cursor-pointer",
                        commentFilter === chip.id
                          ? "border-purple-500/40 bg-purple-500/20 text-purple-200"
                          : "border-white/[0.08] bg-[#161226] text-zinc-400 hover:border-purple-500/30 hover:bg-[#1f1a36] hover:text-zinc-100",
                      )}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </StudioPanel>

          {loadingComments ? (
            <StudioLoadingState message="Consultando comentários e denúncias no PostgreSQL..." />
          ) : comments.length === 0 ? (
            <StudioEmptyState
              icon={
                activeTab === "reports" ? (
                  <Check className="size-6 text-emerald-400" />
                ) : (
                  <MessageSquare className="size-6 text-zinc-400" />
                )
              }
              title={
                activeTab === "reports"
                  ? "Nenhuma denúncia pendente na fila"
                  : "Nenhum comentário encontrado"
              }
              description={
                searchTerm
                  ? `Nenhum comentário corresponde ao termo "${searchTerm}".`
                  : activeTab === "reports"
                    ? "Todos os comentários sinalizados pela comunidade já foram analisados."
                    : "Ainda não há comentários registrados para os filtros selecionados."
              }
              action={
                (searchTerm || commentFilter !== "all") && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchInput("");
                      setSearchTerm("");
                      setCommentFilter("all");
                      setPage(1);
                    }}
                    className="h-9 border-white/[0.08] bg-[#161226] text-xs text-zinc-200 hover:border-purple-500/40 hover:bg-[#1f1a36] hover:text-white"
                  >
                    Limpar filtros
                  </Button>
                )
              }
            />
          ) : (
            <>
              <div className="space-y-3">
                {comments.map((comment) => (
                  <CommentModerationCard
                    key={comment.id}
                    comment={comment}
                    onToggleSpoiler={() => void handleToggleSpoilerInline(comment)}
                    onResolveReports={() =>
                      setPendingAction({ type: "resolve_reports", comment })
                    }
                    onDelete={() =>
                      setPendingAction({ type: "delete", comment })
                    }
                    onBanAuthor={() =>
                      setBanTarget({
                        userId: comment.userId,
                        userName: comment.userName,
                        userEmail: comment.userEmail,
                        userNick: comment.userNick,
                      })
                    }
                    onRevokeAuthorBan={() =>
                      setRevokeTarget({
                        userId: comment.userId,
                        userName: comment.userName,
                      })
                    }
                    onPreviewImage={(url) => setPreviewImageUrl(url)}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="studio-panel flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 text-xs text-zinc-400">
                  <span className="studio-tabular">
                    Mostrando <strong className="text-zinc-100">{comments.length}</strong>{" "}
                    de <strong className="text-zinc-100">{totalFiltered}</strong>{" "}
                    comentários
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page <= 1 || loadingComments}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="size-8 border-white/[0.08] bg-[#161226] p-0 text-zinc-200 hover:border-purple-500/40 hover:bg-[#1f1a36] hover:text-white"
                      aria-label="Página anterior"
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <span className="studio-mono px-2 text-xs font-semibold text-zinc-200">
                      {page} / {totalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages || loadingComments}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="size-8 border-white/[0.08] bg-[#161226] p-0 text-zinc-200 hover:border-purple-500/40 hover:bg-[#1f1a36] hover:text-white"
                      aria-label="Próxima página"
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Aba de Denúncias de Perfil */}
      {activeTab === "profile_reports" && (
        <div className="space-y-4">
          <StudioPanel bodyClassName="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: "pending", label: "Pendentes" },
                    { id: "reviewing", label: "Em Análise" },
                    { id: "resolved", label: "Resolvidas" },
                    { id: "rejected", label: "Rejeitadas" },
                    { id: "all", label: "Todas" },
                  ] as const
                ).map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => {
                      setProfileReportStatusFilter(chip.id);
                      setProfileReportPage(1);
                    }}
                    className={cn(
                      "h-8 rounded-lg border px-3 text-xs font-semibold transition-colors cursor-pointer",
                      profileReportStatusFilter === chip.id
                        ? "border-purple-500/40 bg-purple-500/20 text-purple-200"
                        : "border-white/[0.08] bg-[#161226] text-zinc-400 hover:border-purple-500/30 hover:bg-[#1f1a36] hover:text-zinc-100",
                    )}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          </StudioPanel>

          {loadingProfileReports ? (
            <StudioLoadingState message="Consultando denúncias de perfil no PostgreSQL..." />
          ) : profileReportsError ? (
            <StudioEmptyState
              icon={<AlertTriangle className="size-6 text-rose-400" />}
              title="Erro ao carregar denúncias de perfil"
              description={profileReportsError}
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadProfileReports()}
                  className="h-9 border-white/[0.08] bg-[#161226] text-xs text-zinc-200 hover:border-purple-500/40 hover:bg-[#1f1a36] hover:text-white"
                >
                  Tentar novamente
                </Button>
              }
            />
          ) : profileReports.length === 0 ? (
            <StudioEmptyState
              icon={<Check className="size-6 text-emerald-400" />}
              title="Nenhuma denúncia de perfil encontrada"
              description="Não há registros de denúncias para o filtro selecionado."
            />
          ) : (
            <>
              <div className="space-y-3">
                {profileReports.map((report) => (
                  <div
                    key={report.id}
                    className="flex flex-col gap-4 rounded-xl border border-white/[0.08] bg-[#12101e] p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-purple-500/30 bg-purple-500/15 px-2 py-0.5 text-xs font-semibold text-purple-300">
                          {report.reasonLabel}
                        </span>
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[11px] font-bold uppercase",
                            report.status === "pending"
                              ? "bg-amber-500/20 text-amber-300"
                              : report.status === "reviewing"
                                ? "bg-sky-500/20 text-sky-300"
                                : report.status === "resolved"
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : "bg-zinc-500/20 text-zinc-300",
                          )}
                        >
                          {report.status === "pending"
                            ? "Pendente"
                            : report.status === "reviewing"
                              ? "Em Análise"
                              : report.status === "resolved"
                                ? "Resolvida"
                                : "Rejeitada"}
                        </span>
                        <span className="studio-tabular text-[11px] text-zinc-400">
                          {new Date(report.createdAt).toLocaleString("pt-BR")}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 pt-1">
                        {report.reportedUser.image ? (
                          <img
                            src={report.reportedUser.image}
                            alt=""
                            className="size-9 rounded-full object-cover ring-1 ring-purple-500/30"
                          />
                        ) : (
                          <div className="flex size-9 items-center justify-center rounded-full bg-purple-900/40 text-xs font-bold text-purple-300">
                            {(report.reportedUser.name || "U").charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-zinc-100">
                              {report.reportedUser.name}
                            </span>
                            <span className="studio-mono text-xs text-purple-300">
                              @{report.reportedUser.nick}
                            </span>
                          </div>
                          <Link
                            to="/profile/$nick"
                            params={{ nick: report.reportedUser.nick }}
                            className="inline-flex items-center gap-1 text-xs text-[#c084fc] hover:underline"
                          >
                            <span>Ver perfil denunciado</span>
                            <ExternalLink className="size-3" />
                          </Link>
                        </div>
                      </div>

                      {report.description && (
                        <p className="rounded-lg bg-[#161226] p-2.5 text-xs text-zinc-300">
                          <strong className="text-zinc-100">Descrição:</strong> {report.description}
                        </p>
                      )}

                      {report.adminNotes && (
                        <p className="rounded-lg border border-white/[0.06] bg-[#161226]/70 p-2.5 text-xs text-zinc-300">
                          <strong className="text-zinc-100">Notas da equipe:</strong> {report.adminNotes}
                        </p>
                      )}

                      <div className="text-[11px] text-zinc-500">
                        Denunciante: {report.reporterUser?.name || report.reporterUserId} (Sigilo preservado)
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setSelectedProfileReport(report);
                          setProfileReportNotes(report.adminNotes || "");
                        }}
                        className="h-9 gap-1.5 border border-purple-500/30 bg-purple-500/20 px-3 text-xs font-semibold text-purple-200 hover:bg-purple-500/30"
                      >
                        Gerenciar Denúncia
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {profileReportTotalPages > 1 && (
                <div className="studio-panel flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 text-xs text-zinc-400">
                  <span className="studio-tabular">
                    Mostrando <strong className="text-zinc-100">{profileReports.length}</strong>{" "}
                    de <strong className="text-zinc-100">{profileReportTotal}</strong>{" "}
                    denúncias
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={profileReportPage <= 1 || loadingProfileReports}
                      onClick={() => setProfileReportPage((p) => Math.max(1, p - 1))}
                      className="size-8 border-white/[0.08] bg-[#161226] p-0 text-zinc-200 hover:border-purple-500/40 hover:bg-[#1f1a36] hover:text-white"
                      aria-label="Página anterior"
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <span className="studio-mono px-2 text-xs font-semibold text-zinc-200">
                      {profileReportPage} / {profileReportTotalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={profileReportPage >= profileReportTotalPages || loadingProfileReports}
                      onClick={() =>
                        setProfileReportPage((p) => Math.min(profileReportTotalPages, p + 1))
                      }
                      className="size-8 border-white/[0.08] bg-[#161226] p-0 text-zinc-200 hover:border-purple-500/40 hover:bg-[#1f1a36] hover:text-white"
                      aria-label="Próxima página"
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Aba 3: Banimentos Ativos & Histórico Auditável */}
      {activeTab === "bans" && (
        <div className="space-y-6">
          <StudioPanel
            title="Usuários Suspensos Atualmente"
            description="Usuários impedidos de comentar, responder, reagir ou enviar anexos enquanto o prazo não expira."
            icon={<Ban className="size-4" />}
            right={
              <Button
                type="button"
                size="sm"
                onClick={() => setUserLookupOpen(true)}
                className="h-8 gap-1.5 bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-700"
              >
                <Plus className="size-3.5" />
                Novo Banimento
              </Button>
            }
          >
            {loadingBans ? (
              <div className="flex items-center justify-center py-10 text-xs text-zinc-400">
                <Loader2 className="mr-2 size-4 animate-spin text-purple-400" />
                Carregando suspensões ativas...
              </div>
            ) : activeBans.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/[0.12] bg-[#161226] py-10 text-center">
                <ShieldCheck className="size-8 text-emerald-400" />
                <p className="mt-2 text-sm font-semibold text-zinc-100">
                  Nenhum banimento temporário ativo
                </p>
                <p className="mt-1 max-w-md text-xs text-zinc-400">
                  Use "Aplicar Banimento" acima ou o botão de suspensão direto nos
                  cards de comentários para restringir contas temporariamente.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06] overflow-hidden rounded-lg border border-white/[0.08]">
                {activeBans.map((ban) => (
                    <div
                      key={ban.banId}
                      className="flex flex-col gap-4 bg-[#12101e] p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-zinc-100">
                            {ban.userName}
                          </span>
                          {ban.userNick && (
                            <span className="studio-mono text-xs text-zinc-400">
                              @{ban.userNick}
                            </span>
                          )}
                          <ActiveBanRemainingBadge expiresAt={ban.expiresAt} />
                        </div>

                        <p className="text-xs leading-relaxed text-zinc-300">
                          <span className="font-semibold text-zinc-100">
                            Motivo:
                          </span>{" "}
                          {ban.reason}
                        </p>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-400">
                          <span>
                            Duração:{" "}
                            <strong className="text-zinc-200">
                              {ban.durationLabel}
                            </strong>
                          </span>
                          <span>
                            Expira em:{" "}
                            <strong className="studio-tabular text-zinc-200">
                              {formatBanDateTime(ban.expiresAt)}
                            </strong>
                          </span>
                          <span>
                            Aplicado por:{" "}
                            <strong className="text-zinc-200">
                              {ban.bannedByName || ban.bannedBy}
                            </strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setRevokeTarget({
                              userId: ban.userId,
                              userName: ban.userName,
                            })
                          }
                          className="h-9 gap-1.5 border-emerald-500/30 bg-emerald-500/15 px-3 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
                        >
                          <ShieldCheck className="size-3.5" />
                          Remover Banimento
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </StudioPanel>

          <StudioPanel
            title="Histórico Recente de Moderação"
            description="Registro cronológico de banimentos aplicados, encerramentos antecipados e expirações automáticas."
            icon={<History className="size-4" />}
          >
            {banHistory.length === 0 ? (
              <p className="py-6 text-center text-xs text-zinc-400">
                Nenhuma ocorrência de banimento registrada até o momento.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-white/[0.08]">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/[0.08] bg-[#161226] text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                    <tr>
                      <th className="px-4 py-2.5">Evento</th>
                      <th className="px-4 py-2.5">Usuário</th>
                      <th className="px-4 py-2.5">Duração / Motivo</th>
                      <th className="px-4 py-2.5">Moderador</th>
                      <th className="px-4 py-2.5 text-right">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06] bg-[#12101e]">
                    {banHistory.map((entry) => (
                      <tr key={entry.id} className="hover:bg-[#1a172e]/70">
                        <td className="px-4 py-3">
                          {entry.action === "ban" ? (
                            <span className="inline-flex items-center rounded-md border border-rose-500/30 bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300">
                              Banido
                            </span>
                          ) : entry.action === "unban" ? (
                            <span className="inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                              Revogado
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md border border-white/[0.08] bg-[#161226] px-2 py-0.5 text-[11px] font-semibold text-zinc-300">
                              Expirado
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-zinc-100">
                            {entry.userName || entry.userId}
                          </div>
                          {(entry.userNick || entry.userEmail) && (
                            <div className="studio-mono text-[11px] text-zinc-400">
                              {entry.userNick ? `@${entry.userNick}` : entry.userEmail}
                            </div>
                          )}
                        </td>
                        <td className="max-w-sm px-4 py-3 text-zinc-300">
                          {entry.durationLabel && (
                            <span className="mr-1.5 font-semibold text-zinc-100">
                              [{entry.durationLabel}]
                            </span>
                          )}
                          <span>{entry.reason}</span>
                        </td>
                        <td className="px-4 py-3 text-zinc-300">
                          {entry.actorName || entry.actorId}
                        </td>
                        <td className="studio-tabular px-4 py-3 text-right text-zinc-400">
                          {formatBanDateTime(entry.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </StudioPanel>
        </div>
      )}

      {/* Modal de Gestão da Denúncia de Perfil */}
      <Dialog
        open={selectedProfileReport !== null}
        onOpenChange={(open) => {
          if (!open && !updatingProfileReport) {
            setSelectedProfileReport(null);
          }
        }}
      >
        <DialogContent className="hikari-studio-dialog border border-white/[0.08] bg-[#12101e] text-zinc-100 shadow-2xl sm:max-w-lg">
          <DialogTitle className="font-display text-lg font-bold text-zinc-100">
            Gerenciar Denúncia de Perfil
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            Atualize o status ou adicione notas administrativas para o registro de denúncia.
          </DialogDescription>

          {selectedProfileReport && (
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-white/[0.08] bg-[#161226] p-3 text-xs space-y-2">
                <div>
                  <span className="text-zinc-400">Perfil Denunciado:</span>{" "}
                  <strong className="text-zinc-100">
                    {selectedProfileReport.reportedUser.name} (@{selectedProfileReport.reportedUser.nick})
                  </strong>
                </div>
                <div>
                  <span className="text-zinc-400">Motivo:</span>{" "}
                  <strong className="text-purple-300">{selectedProfileReport.reasonLabel}</strong>
                </div>
                {selectedProfileReport.description && (
                  <div>
                    <span className="text-zinc-400">Descrição:</span>{" "}
                    <span className="text-zinc-200">{selectedProfileReport.description}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-200">Notas Administrativas</label>
                <Input
                  value={profileReportNotes}
                  onChange={(e) => setProfileReportNotes(e.target.value)}
                  placeholder="Ex: Analisado, perfil advertido / falso positivo..."
                  className="studio-input h-9 text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={updatingProfileReport}
                  onClick={() =>
                    handleUpdateProfileReportStatus(
                      selectedProfileReport.id,
                      "reviewing",
                      profileReportNotes,
                    )
                  }
                  className="h-9 bg-sky-600 text-xs font-semibold text-white hover:bg-sky-700"
                >
                  Em Análise
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={updatingProfileReport}
                  onClick={() =>
                    handleUpdateProfileReportStatus(
                      selectedProfileReport.id,
                      "resolved",
                      profileReportNotes,
                    )
                  }
                  className="h-9 bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Marcar Resolvida
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={updatingProfileReport}
                  onClick={() =>
                    handleUpdateProfileReportStatus(
                      selectedProfileReport.id,
                      "rejected",
                      profileReportNotes,
                    )
                  }
                  className="h-9 bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700"
                >
                  Rejeitar Denúncia
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Ação em Comentário */}
      <Dialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open && !processingAction) {
            setPendingAction(null);
          }
        }}
      >
        <DialogContent className="hikari-studio-dialog max-h-[88dvh] overflow-y-auto border border-white/[0.08] bg-[#12101e] text-zinc-100 shadow-2xl sm:max-w-md">
          <DialogTitle className="font-display text-lg font-bold text-zinc-100">
            {pendingAction?.type === "delete"
              ? "Excluir comentário permanentemente?"
              : "Marcar denúncias como resolvidas?"}
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-zinc-400">
            {pendingAction?.type === "delete"
              ? "Esta ação removerá o comentário do PostgreSQL juntamente com todas as respostas vinculadas, curtidas e denúncias."
              : "As denúncias pendentes deste comentário serão arquivadas como resolvidas e o comentário permanecerá publicado."}
          </DialogDescription>

          {pendingAction && (
            <div className="mt-3 rounded-lg border border-white/[0.08] bg-[#161226] p-3 text-xs text-zinc-300">
              <p className="font-semibold text-zinc-100">
                {pendingAction.comment.userName}
              </p>
              <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-zinc-300">
                {pendingAction.comment.content}
              </p>
            </div>
          )}

          <div className="mt-5 flex flex-col-reverse gap-2 border-t border-white/[0.08] pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={processingAction}
              onClick={() => setPendingAction(null)}
              className="h-9 border-white/[0.08] bg-[#161226] text-xs text-zinc-200 hover:border-purple-500/40 hover:bg-[#1f1a36] hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={processingAction}
              onClick={() => void executeCommentAction()}
              className={
                pendingAction?.type === "delete"
                  ? "h-9 bg-rose-600 px-4 text-xs font-semibold text-white hover:bg-rose-700"
                  : "h-9 bg-purple-600 px-4 text-xs font-semibold text-white hover:bg-purple-700"
              }
            >
              {processingAction ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Processando…
                </>
              ) : pendingAction?.type === "delete" ? (
                "Excluir Comentário"
              ) : (
                "Resolver Denúncias"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Remoção de Banimento */}
      <Dialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open && !revokingBan) {
            setRevokeTarget(null);
          }
        }}
      >
        <DialogContent className="hikari-studio-dialog border border-white/[0.08] bg-[#12101e] text-zinc-100 shadow-2xl sm:max-w-md">
          <DialogTitle className="font-display text-lg font-bold text-zinc-100">
            Remover banimento antecipadamente?
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-zinc-400">
            O usuário{" "}
            <strong className="text-zinc-100">
              {revokeTarget?.userName}
            </strong>{" "}
            recuperará imediatamente o acesso para publicar comentários,
            respostas e anexar imagens.
          </DialogDescription>
          <div className="mt-4 flex flex-col-reverse gap-2 border-t border-white/[0.08] pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={revokingBan}
              onClick={() => setRevokeTarget(null)}
              className="h-9 border-white/[0.08] bg-[#161226] text-xs text-zinc-200 hover:border-purple-500/40 hover:bg-[#1f1a36] hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={revokingBan}
              onClick={() => void handleConfirmRevokeBan()}
              className="h-9 bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              {revokingBan ? "Removendo…" : "Confirmar Liberação"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Seleção de Usuário para Novo Banimento */}
      <Dialog
        open={userLookupOpen}
        onOpenChange={(open) => setUserLookupOpen(open)}
      >
        <DialogContent className="hikari-studio-dialog max-h-[88dvh] overflow-y-auto border border-white/[0.08] bg-[#12101e] text-zinc-100 shadow-2xl sm:max-w-lg">
          <DialogTitle className="font-display text-lg font-bold text-zinc-100">
            Selecionar Usuário para Banimento
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            Pesquise por nome, @nick ou e-mail para aplicar uma suspensão
            temporária de comentários.
          </DialogDescription>

          <div className="mt-4 space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
              <Input
                value={userLookupQuery}
                onChange={(e) => setUserLookupQuery(e.target.value)}
                placeholder="Digite nome, @nick ou e-mail..."
                className="studio-input h-9 pl-9 text-xs"
              />
            </div>

            <div className="studio-scroll max-h-72 divide-y divide-white/[0.06] overflow-y-auto rounded-lg border border-white/[0.08] bg-[#161226]">
              {userLookupLoading ? (
                <div className="flex items-center justify-center py-8 text-xs text-zinc-400">
                  <Loader2 className="mr-2 size-4 animate-spin text-purple-400" />
                  Buscando contas...
                </div>
              ) : userLookupResults.length === 0 ? (
                <p className="py-8 text-center text-xs text-zinc-400">
                  Nenhuma conta encontrada.
                </p>
              ) : (
                userLookupResults.map((u) => {
                  const protectedUser = u.isCurrentAdmin || u.isSystemAdmin;
                  return (
                    <div
                      key={u.id}
                      className="flex items-center justify-between gap-3 bg-[#12101e] px-3.5 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-zinc-100">
                          {u.displayName || u.name}
                          {u.activeBan && (
                            <span className="ml-2 rounded border border-rose-500/30 bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
                              Já banido
                            </span>
                          )}
                        </p>
                        <p className="studio-mono truncate text-[11px] text-zinc-400">
                          {u.nick ? `@${u.nick} · ` : ""}
                          {u.email}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        disabled={protectedUser}
                        onClick={() => {
                          setUserLookupOpen(false);
                          setBanTarget({
                            userId: u.id,
                            userName: u.displayName || u.name,
                            userEmail: u.email,
                            userNick: u.nick,
                          });
                        }}
                        className="h-8 shrink-0 bg-rose-600 px-3 text-[11px] font-semibold text-white hover:bg-rose-700 disabled:bg-white/[0.08] disabled:text-zinc-500"
                      >
                        {protectedUser ? "Protegido" : "Selecionar"}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Reutilizável de Banimento Temporário */}
      <UserBanModal
        target={banTarget}
        onClose={() => setBanTarget(null)}
        onSuccess={() => {
          if (activeTab === "bans") {
            commentsDirtyRef.current = true;
            void loadBans();
          } else {
            bansDirtyRef.current = true;
            void loadComments();
          }
        }}
      />

      {/* Lightbox de Imagem Anexada ao Comentário */}
      <Dialog
        open={previewImageUrl !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewImageUrl(null);
        }}
      >
        <DialogContent className="hikari-studio-dialog border border-white/[0.08] bg-[#12101e] text-zinc-100 shadow-2xl sm:max-w-2xl">
          <DialogTitle className="font-display text-base font-bold text-zinc-100">
            Imagem Anexada ao Comentário
          </DialogTitle>
          {previewImageUrl && (
            <div className="mt-2 overflow-hidden rounded-lg border border-white/[0.08] bg-[#0b0914]">
              <img
                src={previewImageUrl}
                alt="Anexo do comentário"
                className="max-h-[70dvh] w-full object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function useBanCountdownNowMs(expiresAt: number | null): number {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt || expiresAt <= Date.now()) return;
    const interval = window.setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      if (expiresAt <= now) {
        window.clearInterval(interval);
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt]);

  return nowMs;
}

function ActiveBanRemainingBadge({ expiresAt }: { expiresAt: number }) {
  const nowMs = useBanCountdownNowMs(expiresAt);
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300">
      <Clock className="size-3" />
      Restante: {formatBanRemaining(expiresAt, nowMs)}
    </span>
  );
}

function AuthorBanStatusBadge({ ban }: { ban: ActiveUserBan }) {
  const nowMs = useBanCountdownNowMs(ban.expiresAt);
  if (ban.expiresAt <= nowMs) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
      <Ban className="size-3" />
      Banido · {formatBanRemaining(ban.expiresAt, nowMs)}
    </span>
  );
}

const CommentModerationCard = memo(function CommentModerationCard({
  comment,
  onToggleSpoiler,
  onResolveReports,
  onDelete,
  onBanAuthor,
  onRevokeAuthorBan,
  onPreviewImage,
}: {
  comment: AdminCommentItem;
  onToggleSpoiler: () => void;
  onResolveReports: () => void;
  onDelete: () => void;
  onBanAuthor: () => void;
  onRevokeAuthorBan: () => void;
  onPreviewImage: (url: string) => void;
}) {
  const authorBanned = Boolean(
    comment.authorActiveBan && comment.authorActiveBan.expiresAt > Date.now(),
  );

  return (
    <article
      className={cn(
        "studio-panel overflow-hidden rounded-xl transition-colors",
        comment.pendingReportCount > 0 && "border-amber-500/40",
      )}
    >
      {/* Topo do Card: Autor & Contexto */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.08] bg-[#161226]/70 px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {comment.userImage ? (
            <img
              src={comment.userImage}
              alt={comment.userName}
              className="size-10 shrink-0 rounded-lg border border-white/[0.08] object-cover"
            />
          ) : (
            <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-[#12101e] text-zinc-400">
              <User className="size-5" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-zinc-100">
                {comment.userName}
              </span>
              {comment.userNick && (
                <span className="studio-mono text-xs text-zinc-400">
                  @{comment.userNick}
                </span>
              )}
              {comment.userRole === "admin" && (
                <span className="studio-mono rounded border border-purple-500/30 bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-bold text-purple-300 uppercase">
                  Admin
                </span>
              )}
              {authorBanned && comment.authorActiveBan && (
                <AuthorBanStatusBadge ban={comment.authorActiveBan} />
              )}
              {comment.parentId && (
                <span className="rounded border border-white/[0.08] bg-[#12101e] px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                  Resposta
                </span>
              )}
            </div>

            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-zinc-400">
              <span>{formatDate(comment.createdAt)}</span>
              {comment.userEmail && (
                <span className="studio-mono truncate">{comment.userEmail}</span>
              )}
            </div>
          </div>
        </div>

        {/* Status badges à direita */}
        <div className="flex flex-wrap items-center gap-1.5">
          {comment.isSpoiler && (
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/15 px-2 py-1 text-[11px] font-semibold text-amber-300">
              <AlertTriangle className="size-3.5 text-amber-400" />
              Spoiler
            </span>
          )}
          {comment.pendingReportCount > 0 && (
            <span className="studio-tabular inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/15 px-2.5 py-1 text-[11px] font-semibold text-rose-300">
              <ShieldAlert className="size-3.5 text-rose-400" />
              {comment.pendingReportCount}{" "}
              {comment.pendingReportCount === 1 ? "denúncia" : "denúncias"}
            </span>
          )}
        </div>
      </div>

      {/* Corpo do Comentário */}
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="studio-panel-alt flex-1 rounded-lg p-3.5">
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-200">
              {comment.content || "(Comentário apenas com imagem anexada)"}
            </p>
          </div>

          {comment.imageUrl && (
            <button
              type="button"
              onClick={() => onPreviewImage(comment.imageUrl!)}
              className="group relative h-24 w-32 shrink-0 overflow-hidden rounded-lg border border-white/[0.08] bg-[#161226] text-left cursor-pointer"
              title="Ampliar imagem anexada"
            >
              <img
                src={comment.imageUrl}
                alt="Anexo do comentário"
                className="size-full object-cover transition-transform group-hover:scale-105"
              />
              <span className="absolute right-1.5 bottom-1.5 inline-flex items-center gap-1 rounded border border-white/10 bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-zinc-100">
                <ImageIcon className="size-2.5" />
                Ver
              </span>
            </button>
          )}
        </div>

        {/* Motivos das Denúncias */}
        {comment.pendingReportCount > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold tracking-wide text-amber-300 uppercase">
                Motivos sinalizados
              </span>
              {comment.firstReportedAt && (
                <span className="studio-tabular text-[11px] text-amber-300/80">
                  Primeira denúncia em {formatDate(comment.firstReportedAt)}
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {comment.reportReasons.length > 0 ? (
                comment.reportReasons.map((reason) => (
                  <span
                    key={reason.value}
                    className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-[#161226] px-2 py-0.5 text-xs font-medium text-amber-200"
                  >
                    {reason.label}
                  </span>
                ))
              ) : (
                <span className="text-xs text-amber-200">
                  Motivo não detalhado
                </span>
              )}
            </div>
          </div>
        )}

        {/* Metadados de Anime, Episódio e Engajamento */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-[#161226] px-3.5 py-2.5 text-xs text-zinc-400">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <div className="flex items-center gap-1.5">
              <Film className="size-3.5 text-zinc-500" />
              <span className="font-medium text-zinc-200">
                {comment.animeTitle || comment.animeId}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <MessageCircle className="size-3.5 text-zinc-500" />
              <span className="studio-mono text-[11px]">
                Ep: {comment.episodeId}
              </span>
            </div>
            <div className="studio-tabular flex items-center gap-3 text-[11px] text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <ThumbsUp className="size-3" />
                {comment.likesCount}
              </span>
              <span className="inline-flex items-center gap-1">
                <ThumbsDown className="size-3" />
                {comment.dislikesCount}
              </span>
              <span>{comment.repliesCount} resp.</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/anime/$id"
              params={{ id: comment.animeId }}
              target="_blank"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-400 hover:text-purple-300 hover:underline"
            >
              <ExternalLink className="size-3" />
              Ver página do anime
            </Link>
          </div>
        </div>

        {/* Barra de Ações */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onToggleSpoiler}
              className={cn(
                "h-8 gap-1.5 px-3 text-xs font-medium",
                comment.isSpoiler
                  ? "border-amber-500/30 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
                  : "border-white/[0.08] bg-[#161226] text-zinc-200 hover:border-purple-500/40 hover:bg-[#1f1a36] hover:text-white",
              )}
            >
              <Eye className="size-3.5" />
              {comment.isSpoiler ? "Remover Spoiler" : "Marcar Spoiler"}
            </Button>

            {comment.pendingReportCount > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onResolveReports}
                className="h-8 gap-1.5 border-emerald-500/30 bg-emerald-500/15 px-3 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
              >
                <Check className="size-3.5" />
                Resolver Denúncias
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {authorBanned ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRevokeAuthorBan}
                className="h-8 gap-1.5 border-emerald-500/30 bg-emerald-500/15 px-3 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
              >
                <ShieldCheck className="size-3.5" />
                Remover Ban
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={comment.isSystemAdmin}
                onClick={onBanAuthor}
                title={
                  comment.isSystemAdmin
                    ? "Administrador de infraestrutura protegido"
                    : "Suspender usuário temporariamente de comentar"
                }
                className="h-8 gap-1.5 border-rose-500/30 bg-rose-500/15 px-3 text-xs font-semibold text-rose-300 hover:bg-rose-500/25 disabled:border-white/[0.08] disabled:bg-white/[0.05] disabled:text-zinc-500"
              >
                <Ban className="size-3.5" />
                {comment.isSystemAdmin ? "Conta Protegida" : "Banir Usuário"}
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={onDelete}
              className="h-8 gap-1.5 bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-700"
            >
              <Trash2 className="size-3.5" />
              Excluir
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
});

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
