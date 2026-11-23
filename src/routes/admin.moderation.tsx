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

type ModerationTab = "comments" | "reports" | "bans";
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

  const isRefreshing = loadingComments || loadingBans;
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
            <span className="studio-tabular font-semibold text-amber-700">
              {summary.reportedComments} comentário(s) com denúncia pendente
            </span>
          ) : (
            <span className="font-semibold text-emerald-700">
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
              className="h-9 gap-1.5 border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100"
            >
              <Ban className="size-3.5" />
              Aplicar Banimento
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleRefreshAll}
              disabled={isRefreshing}
              className="h-9 gap-1.5 border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div
          role="tablist"
          aria-label="Seções de moderação"
          className="inline-flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1"
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
                  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
                  selected
                    ? "bg-blue-700 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
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
                        ? "bg-amber-100 text-amber-800"
                        : "danger" in tab && tab.danger
                          ? "bg-rose-100 text-rose-800"
                          : "bg-slate-100 text-slate-600",
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
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
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
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
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
                        "h-8 rounded-lg border px-3 text-xs font-semibold transition-colors",
                        commentFilter === chip.id
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900",
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
                  <Check className="size-6 text-emerald-600" />
                ) : (
                  <MessageSquare className="size-6 text-slate-400" />
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
                    className="h-9 border-slate-300 bg-white text-xs text-slate-700"
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
                <div className="studio-panel flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 text-xs text-slate-600">
                  <span className="studio-tabular">
                    Mostrando <strong className="text-slate-900">{comments.length}</strong>{" "}
                    de <strong className="text-slate-900">{totalFiltered}</strong>{" "}
                    comentários
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page <= 1 || loadingComments}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="size-8 border-slate-300 bg-white p-0 text-slate-700 hover:bg-slate-50"
                      aria-label="Página anterior"
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <span className="studio-mono px-2 text-xs font-semibold text-slate-700">
                      {page} / {totalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages || loadingComments}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="size-8 border-slate-300 bg-white p-0 text-slate-700 hover:bg-slate-50"
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
              <div className="flex items-center justify-center py-10 text-xs text-slate-500">
                <Loader2 className="mr-2 size-4 animate-spin text-blue-600" />
                Carregando suspensões ativas...
              </div>
            ) : activeBans.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 py-10 text-center">
                <ShieldCheck className="size-8 text-emerald-600" />
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  Nenhum banimento temporário ativo
                </p>
                <p className="mt-1 max-w-md text-xs text-slate-500">
                  Use "Aplicar Banimento" acima ou o botão de suspensão direto nos
                  cards de comentários para restringir contas temporariamente.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200">
                {activeBans.map((ban) => (
                    <div
                      key={ban.banId}
                      className="flex flex-col gap-4 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            {ban.userName}
                          </span>
                          {ban.userNick && (
                            <span className="studio-mono text-xs text-slate-500">
                              @{ban.userNick}
                            </span>
                          )}
                          <ActiveBanRemainingBadge expiresAt={ban.expiresAt} />
                        </div>

                        <p className="text-xs leading-relaxed text-slate-700">
                          <span className="font-semibold text-slate-900">
                            Motivo:
                          </span>{" "}
                          {ban.reason}
                        </p>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                          <span>
                            Duração:{" "}
                            <strong className="text-slate-700">
                              {ban.durationLabel}
                            </strong>
                          </span>
                          <span>
                            Expira em:{" "}
                            <strong className="studio-tabular text-slate-700">
                              {formatBanDateTime(ban.expiresAt)}
                            </strong>
                          </span>
                          <span>
                            Aplicado por:{" "}
                            <strong className="text-slate-700">
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
                          className="h-9 gap-1.5 border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
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
              <p className="py-6 text-center text-xs text-slate-500">
                Nenhuma ocorrência de banimento registrada até o momento.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-2.5">Evento</th>
                      <th className="px-4 py-2.5">Usuário</th>
                      <th className="px-4 py-2.5">Duração / Motivo</th>
                      <th className="px-4 py-2.5">Moderador</th>
                      <th className="px-4 py-2.5 text-right">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {banHistory.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          {entry.action === "ban" ? (
                            <span className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                              Banido
                            </span>
                          ) : entry.action === "unban" ? (
                            <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              Revogado
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                              Expirado
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">
                            {entry.userName || entry.userId}
                          </div>
                          {(entry.userNick || entry.userEmail) && (
                            <div className="studio-mono text-[11px] text-slate-500">
                              {entry.userNick ? `@${entry.userNick}` : entry.userEmail}
                            </div>
                          )}
                        </td>
                        <td className="max-w-sm px-4 py-3 text-slate-700">
                          {entry.durationLabel && (
                            <span className="mr-1.5 font-semibold text-slate-900">
                              [{entry.durationLabel}]
                            </span>
                          )}
                          <span>{entry.reason}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {entry.actorName || entry.actorId}
                        </td>
                        <td className="studio-tabular px-4 py-3 text-right text-slate-500">
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

      {/* Modal de Confirmação de Ação em Comentário */}
      <Dialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open && !processingAction) {
            setPendingAction(null);
          }
        }}
      >
        <DialogContent className="hikari-studio-dialog max-h-[88dvh] overflow-y-auto border border-slate-200 bg-white text-slate-900 shadow-2xl sm:max-w-md">
          <DialogTitle className="font-display text-lg font-bold text-slate-900">
            {pendingAction?.type === "delete"
              ? "Excluir comentário permanentemente?"
              : "Marcar denúncias como resolvidas?"}
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-slate-600">
            {pendingAction?.type === "delete"
              ? "Esta ação removerá o comentário do PostgreSQL juntamente com todas as respostas vinculadas, curtidas e denúncias."
              : "As denúncias pendentes deste comentário serão arquivadas como resolvidas e o comentário permanecerá publicado."}
          </DialogDescription>

          {pendingAction && (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <p className="font-semibold text-slate-900">
                {pendingAction.comment.userName}
              </p>
              <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-slate-600">
                {pendingAction.comment.content}
              </p>
            </div>
          )}

          <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={processingAction}
              onClick={() => setPendingAction(null)}
              className="h-9 border-slate-300 bg-white text-xs text-slate-700 hover:bg-slate-50"
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
                  : "h-9 bg-blue-700 px-4 text-xs font-semibold text-white hover:bg-blue-800"
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
        <DialogContent className="hikari-studio-dialog border border-slate-200 bg-white text-slate-900 shadow-2xl sm:max-w-md">
          <DialogTitle className="font-display text-lg font-bold text-slate-900">
            Remover banimento antecipadamente?
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-slate-600">
            O usuário{" "}
            <strong className="text-slate-900">
              {revokeTarget?.userName}
            </strong>{" "}
            recuperará imediatamente o acesso para publicar comentários,
            respostas e anexar imagens.
          </DialogDescription>
          <div className="mt-4 flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={revokingBan}
              onClick={() => setRevokeTarget(null)}
              className="h-9 border-slate-300 bg-white text-xs text-slate-700 hover:bg-slate-50"
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
        <DialogContent className="hikari-studio-dialog max-h-[88dvh] overflow-y-auto border border-slate-200 bg-white text-slate-900 shadow-2xl sm:max-w-lg">
          <DialogTitle className="font-display text-lg font-bold text-slate-900">
            Selecionar Usuário para Banimento
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-600">
            Pesquise por nome, @nick ou e-mail para aplicar uma suspensão
            temporária de comentários.
          </DialogDescription>

          <div className="mt-4 space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={userLookupQuery}
                onChange={(e) => setUserLookupQuery(e.target.value)}
                placeholder="Digite nome, @nick ou e-mail..."
                className="studio-input h-9 pl-9 text-xs"
              />
            </div>

            <div className="max-h-72 divide-y divide-slate-200 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50">
              {userLookupLoading ? (
                <div className="flex items-center justify-center py-8 text-xs text-slate-500">
                  <Loader2 className="mr-2 size-4 animate-spin text-blue-600" />
                  Buscando contas...
                </div>
              ) : userLookupResults.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-500">
                  Nenhuma conta encontrada.
                </p>
              ) : (
                userLookupResults.map((u) => {
                  const protectedUser = u.isCurrentAdmin || u.isSystemAdmin;
                  return (
                    <div
                      key={u.id}
                      className="flex items-center justify-between gap-3 bg-white px-3.5 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-900">
                          {u.displayName || u.name}
                          {u.activeBan && (
                            <span className="ml-2 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                              Já banido
                            </span>
                          )}
                        </p>
                        <p className="studio-mono truncate text-[11px] text-slate-500">
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
                        className="h-8 shrink-0 bg-rose-600 px-3 text-[11px] font-semibold text-white hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-500"
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
        <DialogContent className="hikari-studio-dialog border border-slate-200 bg-white text-slate-900 shadow-2xl sm:max-w-2xl">
          <DialogTitle className="font-display text-base font-bold text-slate-900">
            Imagem Anexada ao Comentário
          </DialogTitle>
          {previewImageUrl && (
            <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
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
    <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
      <Clock className="size-3" />
      Restante: {formatBanRemaining(expiresAt, nowMs)}
    </span>
  );
}

function AuthorBanStatusBadge({ ban }: { ban: ActiveUserBan }) {
  const nowMs = useBanCountdownNowMs(ban.expiresAt);
  if (ban.expiresAt <= nowMs) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
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
        comment.pendingReportCount > 0 && "border-amber-300",
      )}
    >
      {/* Topo do Card: Autor & Contexto */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {comment.userImage ? (
            <img
              src={comment.userImage}
              alt={comment.userName}
              className="size-10 shrink-0 rounded-lg border border-slate-200 object-cover"
            />
          ) : (
            <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500">
              <User className="size-5" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-slate-900">
                {comment.userName}
              </span>
              {comment.userNick && (
                <span className="studio-mono text-xs text-slate-500">
                  @{comment.userNick}
                </span>
              )}
              {comment.userRole === "admin" && (
                <span className="studio-mono rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 uppercase">
                  Admin
                </span>
              )}
              {authorBanned && comment.authorActiveBan && (
                <AuthorBanStatusBadge ban={comment.authorActiveBan} />
              )}
              {comment.parentId && (
                <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                  Resposta
                </span>
              )}
            </div>

            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
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
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800">
              <AlertTriangle className="size-3.5 text-amber-600" />
              Spoiler
            </span>
          )}
          {comment.pendingReportCount > 0 && (
            <span className="studio-tabular inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
              <ShieldAlert className="size-3.5 text-rose-600" />
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
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">
              {comment.content || "(Comentário apenas com imagem anexada)"}
            </p>
          </div>

          {comment.imageUrl && (
            <button
              type="button"
              onClick={() => onPreviewImage(comment.imageUrl!)}
              className="group relative h-24 w-32 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 text-left"
              title="Ampliar imagem anexada"
            >
              <img
                src={comment.imageUrl}
                alt="Anexo do comentário"
                className="size-full object-cover transition-transform group-hover:scale-105"
              />
              <span className="absolute right-1.5 bottom-1.5 inline-flex items-center gap-1 rounded bg-slate-900/75 px-1.5 py-0.5 text-[10px] font-medium text-white">
                <ImageIcon className="size-2.5" />
                Ver
              </span>
            </button>
          )}
        </div>

        {/* Motivos das Denúncias */}
        {comment.pendingReportCount > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold tracking-wide text-amber-800 uppercase">
                Motivos sinalizados
              </span>
              {comment.firstReportedAt && (
                <span className="studio-tabular text-[11px] text-amber-700">
                  Primeira denúncia em {formatDate(comment.firstReportedAt)}
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {comment.reportReasons.length > 0 ? (
                comment.reportReasons.map((reason) => (
                  <span
                    key={reason.value}
                    className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-white px-2 py-0.5 text-xs font-medium text-amber-900"
                  >
                    {reason.label}
                  </span>
                ))
              ) : (
                <span className="text-xs text-amber-800">
                  Motivo não detalhado
                </span>
              )}
            </div>
          </div>
        )}

        {/* Metadados de Anime, Episódio e Engajamento */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <div className="flex items-center gap-1.5">
              <Film className="size-3.5 text-slate-400" />
              <span className="font-medium text-slate-800">
                {comment.animeTitle || comment.animeId}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <MessageCircle className="size-3.5 text-slate-400" />
              <span className="studio-mono text-[11px]">
                Ep: {comment.episodeId}
              </span>
            </div>
            <div className="studio-tabular flex items-center gap-3 text-[11px] text-slate-500">
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
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:underline"
            >
              <ExternalLink className="size-3" />
              Ver página do anime
            </Link>
          </div>
        </div>

        {/* Barra de Ações */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onToggleSpoiler}
              className={cn(
                "h-8 gap-1.5 px-3 text-xs font-medium",
                comment.isSpoiler
                  ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
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
                className="h-8 gap-1.5 border-emerald-300 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
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
                className="h-8 gap-1.5 border-emerald-300 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
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
                className="h-8 gap-1.5 border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
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
