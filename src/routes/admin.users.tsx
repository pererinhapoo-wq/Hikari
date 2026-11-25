import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  Ban,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Filter,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  type BanModalTargetUser,
  StudioEmptyState,
  StudioLoadingState,
  StudioPageHeader,
  StudioStatStrip,
  UserBanModal,
} from "@/components/admin/studio-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getBearerToken } from "@/lib/auth/client";
import {
  formatBanRemaining,
  isBanActiveAt,
  isPermanentBan,
} from "@/lib/moderation-ban-types";
import { cn } from "@/lib/utils";
import type { AdminUserListItem } from "@/routes/api/admin/users";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalAdmins: 0,
    totalVerified: 0,
    activeBansCount: 0,
  });

  const [selectedUser, setSelectedUser] = useState<AdminUserListItem | null>(
    null,
  );
  const [roleChangeTarget, setRoleChangeTarget] = useState<{
    user: AdminUserListItem;
    newRole: "admin" | "user";
  } | null>(null);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const [banTarget, setBanTarget] = useState<BanModalTargetUser | null>(null);
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null);

  const fetchAbortRef = useRef<AbortController | null>(null);
  const fetchSeqRef = useRef(0);
  const prevSearchRef = useRef(search);

  const fetchUsers = useCallback(async () => {
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    const seq = ++fetchSeqRef.current;

    setLoading(true);
    try {
      const token = getBearerToken();
      const params = new URLSearchParams({
        search,
        role: roleFilter,
        page: page.toString(),
        limit: "15",
      });

      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: controller.signal,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || "Falha ao carregar usuários.");
      }

      const data = await res.json();
      if (seq !== fetchSeqRef.current || controller.signal.aborted) return;

      setUsers(data.users || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalCount(data.pagination?.total || 0);
      if (data.stats) {
        setStats({
          totalUsers: Number(data.stats.totalUsers || 0),
          totalAdmins: Number(data.stats.totalAdmins || 0),
          totalVerified: Number(data.stats.totalVerified || 0),
          activeBansCount: Number(data.stats.activeBansCount || 0),
        });
      }
    } catch (err) {
      if (
        controller.signal.aborted ||
        (err instanceof DOMException && err.name === "AbortError")
      ) {
        return;
      }
      console.error("[admin.users] Erro ao carregar:", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Erro ao carregar lista de usuários.",
      );
    } finally {
      if (seq === fetchSeqRef.current && !controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [page, roleFilter, search]);

  useEffect(() => {
    const searchChanged = prevSearchRef.current !== search;
    prevSearchRef.current = search;

    if (!searchChanged) {
      void fetchUsers();
      return () => {
        fetchAbortRef.current?.abort();
      };
    }

    const timer = window.setTimeout(() => {
      void fetchUsers();
    }, 250);
    return () => {
      window.clearTimeout(timer);
      fetchAbortRef.current?.abort();
    };
  }, [fetchUsers, search]);

  const handleConfirmRoleChange = async () => {
    if (!roleChangeTarget || isUpdatingRole) return;
    setIsUpdatingRole(true);

    try {
      const token = getBearerToken();
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId: roleChangeTarget.user.id,
          role: roleChangeTarget.newRole,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Falha ao alterar papel do usuário.");
      }

      toast.success(data.message || "Papel atualizado com sucesso!");
      setRoleChangeTarget(null);

      setUsers((prev) =>
        prev.map((u) =>
          u.id === roleChangeTarget.user.id
            ? { ...u, role: roleChangeTarget.newRole }
            : u,
        ),
      );

      if (selectedUser?.id === roleChangeTarget.user.id) {
        setSelectedUser((prev) =>
          prev ? { ...prev, role: roleChangeTarget.newRole } : null,
        );
      }

      void fetchUsers();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao atualizar permissão.",
      );
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const handleRevokeBan = useCallback(async (user: AdminUserListItem) => {
    if (revokingUserId) return;
    setRevokingUserId(user.id);
    try {
      const token = getBearerToken();
      const res = await fetch(
        `/api/admin/bans?userId=${encodeURIComponent(user.id)}`,
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
        throw new Error(data?.error || "Falha ao remover banimento.");
      }

      toast.success(data?.message || "Banimento encerrado antecipadamente.");
      await fetchUsers();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao remover banimento.",
      );
    } finally {
      setRevokingUserId(null);
    }
  }, [fetchUsers, revokingUserId]);

  const handleOpenRoleChange = useCallback(
    (user: AdminUserListItem, newRole: "admin" | "user") => {
      setRoleChangeTarget({ user, newRole });
    },
    [],
  );

  const handleOpenBanModal = useCallback((target: BanModalTargetUser) => {
    setBanTarget(target);
  }, []);

  return (
    <div className="studio-enter space-y-6 pb-8">
      <StudioPageHeader
        kicker="Comunidade & Acessos"
        title="Usuários, Papéis & Suspensões"
        description="Consulte contas registradas no PostgreSQL, gerencie privilégios administrativos e aplique ou revogue banimentos temporários de comentários."
        backTo="/admin"
        backLabel="Voltar ao Painel"
        status={
          <span className="studio-mono font-semibold text-purple-400">
            PostgreSQL Ativo
          </span>
        }
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void fetchUsers()}
            disabled={loading}
            className="h-9 border-white/[0.08] bg-[#161226] text-xs font-semibold text-zinc-200 hover:border-purple-500/40 hover:bg-[#1f1a36] hover:text-white"
          >
            <RefreshCw
              className={cn("mr-1.5 size-3.5", loading && "animate-spin")}
            />
            Atualizar Lista
          </Button>
        }
      />

      {/* Faixa de Métricas Reais */}
      <StudioStatStrip
        columns={4}
        items={[
          {
            label: "Total de Contas",
            value: stats.totalUsers.toLocaleString("pt-BR"),
            detail: "Contas registradas no banco",
            accent: "default",
          },
          {
            label: "Administradores",
            value: stats.totalAdmins.toLocaleString("pt-BR"),
            detail: "Com acesso ao Hikari Admin",
            accent: "cobalt",
          },
          {
            label: "Perfis Verificados",
            value: stats.totalVerified.toLocaleString("pt-BR"),
            detail: "Selo oficial ativo",
            accent: "emerald",
          },
          {
            label: "Banidos Ativos",
            value: stats.activeBansCount.toLocaleString("pt-BR"),
            detail: "Suspensos de comentar",
            accent: stats.activeBansCount > 0 ? "rose" : "default",
          },
        ]}
      />

      {/* Barra de Filtros e Busca */}
      <div className="studio-panel flex flex-col gap-3 rounded-xl p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nome, e-mail ou @nick..."
            className="studio-input h-9 pl-9 pr-8 text-xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-zinc-400 hover:bg-white/[0.06] hover:text-white cursor-pointer"
              aria-label="Limpar busca"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Filter className="size-3.5 text-zinc-400" />
          <span className="text-[11px] font-medium text-zinc-400">Papel:</span>
          <div className="flex rounded-lg border border-white/[0.08] bg-[#161226] p-0.5">
            {[
              { id: "all" as const, label: "Todos" },
              { id: "admin" as const, label: "Admins" },
              { id: "user" as const, label: "Usuários" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setRoleFilter(tab.id);
                  setPage(1);
                }}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer",
                  roleFilter === tab.id
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-100",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Listagem de Usuários */}
      {loading ? (
        <StudioLoadingState message="Consultando usuários no PostgreSQL..." />
      ) : users.length === 0 ? (
        <StudioEmptyState
          icon={<AlertCircle className="size-6" />}
          title="Nenhum usuário encontrado"
          description={
            search
              ? `Nenhum resultado corresponde à busca "${search}".`
              : "Ainda não existem usuários registrados para os filtros selecionados."
          }
        />
      ) : (
        <div className="studio-panel overflow-hidden rounded-xl">
          {/* Cartões responsivos em telas pequenas */}
          <div className="divide-y divide-white/[0.06] md:hidden">
            {users.map((u) => (
              <AdminUserMobileCard
                key={u.id}
                user={u}
                isRevoking={revokingUserId === u.id}
                onSelectUser={setSelectedUser}
                onRevokeBan={handleRevokeBan}
                onOpenBanModal={handleOpenBanModal}
                onRequestRoleChange={handleOpenRoleChange}
              />
            ))}
          </div>

          {/* Tabela Desktop */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/[0.08] bg-[#161226] text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                <tr>
                  <th className="px-4 py-3">Usuário</th>
                  <th className="px-4 py-3">E-mail</th>
                  <th className="px-4 py-3">Papel</th>
                  <th className="px-4 py-3">Status Comentários</th>
                  <th className="px-4 py-3">Criado em</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] bg-[#12101e]">
                {users.map((u) => (
                  <AdminUserDesktopRow
                    key={u.id}
                    user={u}
                    isRevoking={revokingUserId === u.id}
                    onSelectUser={setSelectedUser}
                    onRevokeBan={handleRevokeBan}
                    onOpenBanModal={handleOpenBanModal}
                    onRequestRoleChange={handleOpenRoleChange}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] bg-[#161226]/70 px-4 py-3 text-xs text-zinc-400">
              <span className="studio-tabular">
                Mostrando <strong className="text-zinc-100">{users.length}</strong>{" "}
                de <strong className="text-zinc-100">{totalCount}</strong>{" "}
                usuários
              </span>

              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="size-8 border-white/[0.08] bg-[#161226] p-0 text-zinc-200 hover:border-purple-500/40 hover:bg-[#1f1a36] hover:text-white"
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
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  className="size-8 border-white/[0.08] bg-[#161226] p-0 text-zinc-200 hover:border-purple-500/40 hover:bg-[#1f1a36] hover:text-white"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de Detalhes do Usuário */}
      {selectedUser && (
        <div
          className="hikari-studio-dialog fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="studio-scroll max-h-[88dvh] w-full max-w-lg space-y-5 overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#12101e] p-6 text-zinc-100 shadow-2xl">
            <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <div className="size-12 shrink-0 overflow-hidden rounded-xl border border-purple-500/30 bg-purple-500/15">
                  {selectedUser.avatarUrl || selectedUser.image ? (
                    <img
                      src={selectedUser.avatarUrl || selectedUser.image || ""}
                      alt={selectedUser.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="grid size-full place-items-center text-sm font-bold text-purple-300">
                      {(selectedUser.displayName ||
                        selectedUser.name)[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="flex items-center gap-1.5 text-base font-bold text-zinc-100">
                    {selectedUser.displayName || selectedUser.name}
                    {selectedUser.isVerified && (
                      <CheckCircle2 className="size-4 text-emerald-400" />
                    )}
                  </h3>
                  <p className="studio-mono text-xs text-zinc-400">
                    {selectedUser.nick
                      ? `@${selectedUser.nick}`
                      : "Sem nick público"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-white cursor-pointer"
                aria-label="Fechar detalhes"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-white/[0.08] bg-[#161226] p-3.5 sm:grid-cols-2">
                <div>
                  <span className="studio-label">Papel Administrativo</span>
                  <div className="mt-1">
                    <span
                      className={cn(
                        "studio-mono inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase",
                        selectedUser.role === "admin"
                          ? "border border-purple-500/30 bg-purple-500/15 text-purple-300"
                          : "border border-white/[0.08] bg-[#12101e] text-zinc-300",
                      )}
                    >
                      {selectedUser.role}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="studio-label">Tipo de Conta</span>
                  <div className="studio-mono mt-1 font-medium text-zinc-100 capitalize">
                    {selectedUser.accountType}
                  </div>
                </div>

                <div>
                  <span className="studio-label">E-mail</span>
                  <div
                    className="mt-1 truncate font-medium text-zinc-100"
                    title={selectedUser.email}
                  >
                    {selectedUser.email}
                  </div>
                </div>

                <div>
                  <span className="studio-label">Cadastro</span>
                  <div className="studio-tabular mt-1 font-medium text-zinc-100">
                    {new Date(selectedUser.createdAt).toLocaleString("pt-BR")}
                  </div>
                </div>
              </div>

              {selectedUser.activeBan && (
                <UserDetailsBanAlert ban={selectedUser.activeBan} />
              )}

              {selectedUser.bio && (
                <div className="rounded-xl border border-white/[0.08] bg-[#161226] p-3.5">
                  <span className="studio-label">Biografia</span>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-300">
                    {selectedUser.bio}
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-white/[0.08] bg-[#161226] p-3.5">
                <span className="studio-label">Identificador Único (ID)</span>
                <p className="studio-mono mt-1 break-all text-[11px] text-zinc-300 select-all">
                  {selectedUser.id}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/[0.08] pt-4">
              {selectedUser.nick && (
                <a
                  href={`/profile/${selectedUser.nick}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-400 hover:text-purple-300 hover:underline"
                >
                  <ExternalLink className="size-3.5" />
                  Abrir perfil público
                </a>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedUser(null)}
                className="ml-auto border-white/[0.08] bg-[#161226] text-xs text-zinc-200 hover:border-purple-500/40 hover:bg-[#1f1a36] hover:text-white"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Alteração de Papel */}
      {roleChangeTarget && (
        <div
          className="hikari-studio-dialog fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="studio-scroll max-h-[88dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#12101e] p-6 text-zinc-100 shadow-2xl">
            <div className="flex items-center gap-3 text-purple-400">
              <div className="grid size-9 place-items-center rounded-lg border border-purple-500/30 bg-purple-500/15">
                <ShieldAlert className="size-5" />
              </div>
              <h3 className="font-display text-base font-bold text-zinc-100">
                {roleChangeTarget.newRole === "admin"
                  ? "Promover a Administrador"
                  : "Rebaixar para Usuário Comum"}
              </h3>
            </div>

            <p className="text-xs leading-relaxed text-zinc-300">
              Você tem certeza de que deseja alterar o papel da conta{" "}
              <strong className="text-white">
                {roleChangeTarget.user.displayName ||
                  roleChangeTarget.user.name}
              </strong>{" "}
              ({roleChangeTarget.user.email}) para{" "}
              <strong className="text-purple-300 uppercase">
                {roleChangeTarget.newRole}
              </strong>
              ?
            </p>

            {roleChangeTarget.newRole === "admin" && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-200">
                Atenção: conceder papel de administrador dá acesso total ao
                Hikari Admin, edição de catálogo, moderação e configurações do
                sistema.
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 border-t border-white/[0.08] pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUpdatingRole}
                onClick={() => setRoleChangeTarget(null)}
                className="border-white/[0.08] bg-[#161226] text-xs text-zinc-200 hover:border-purple-500/40 hover:bg-[#1f1a36] hover:text-white"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isUpdatingRole}
                onClick={() => void handleConfirmRoleChange()}
                className={cn(
                  "text-xs font-semibold text-white",
                  roleChangeTarget.newRole === "admin"
                    ? "bg-purple-600 hover:bg-purple-700"
                    : "bg-rose-600 hover:bg-rose-700",
                )}
              >
                {isUpdatingRole && (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                )}
                Confirmar Alteração
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reutilizável de Banimento Temporário */}
      <UserBanModal
        target={banTarget}
        onClose={() => setBanTarget(null)}
        onSuccess={() => {
          void fetchUsers();
        }}
      />
    </div>
  );
}

function useUserBanNowMs(ban: AdminUserListItem["activeBan"]): number | null {
  const expiresAt = ban?.expiresAt ?? null;
  const permanent = isPermanentBan(ban);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    if (permanent || !expiresAt || expiresAt <= Date.now()) return;
    const interval = window.setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      if (expiresAt <= now) {
        window.clearInterval(interval);
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt, permanent]);

  if (!ban || !isBanActiveAt(ban, nowMs)) return null;
  return nowMs;
}

function UserBanDesktopCell({
  ban,
}: {
  ban: AdminUserListItem["activeBan"];
}) {
  const nowMs = useUserBanNowMs(ban);
  if (!ban || nowMs === null) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
        <ShieldCheck className="size-3.5" />
        Liberado
      </span>
    );
  }

  return (
    <span
      title={`Motivo: ${ban.reason}`}
      className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-rose-300"
    >
      <Clock className="size-3" />
      Banido · {formatBanRemaining(ban.expiresAt, nowMs)}
    </span>
  );
}

function UserBanMobileBanner({
  ban,
}: {
  ban: NonNullable<AdminUserListItem["activeBan"]>;
}) {
  const nowMs = useUserBanNowMs(ban);
  if (nowMs === null) return null;

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-rose-500/30 bg-rose-500/15 px-3 py-1.5 text-[11px] text-rose-200">
      <span className="inline-flex items-center gap-1 font-semibold text-rose-300">
        <Ban className="size-3.5 text-rose-400" />
        Banido ({formatBanRemaining(ban.expiresAt, nowMs)})
      </span>
      <span className="truncate text-rose-200/80">{ban.reason}</span>
    </div>
  );
}

function UserDetailsBanAlert({
  ban,
}: {
  ban: NonNullable<AdminUserListItem["activeBan"]>;
}) {
  const nowMs = useUserBanNowMs(ban);
  if (nowMs === null) return null;
  const permanent = isPermanentBan(ban);

  return (
    <div className="rounded-xl border border-rose-500/30 bg-rose-500/15 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-rose-200">
          {permanent ? "Banimento Permanente Ativo" : "Suspensão Temporária Ativa"}
        </span>
        <span className="studio-tabular text-[11px] font-semibold text-rose-300">
          {permanent
            ? "Permanente"
            : `Restante: ${formatBanRemaining(ban.expiresAt, nowMs)}`}
        </span>
      </div>
      <p className="mt-1 text-xs text-rose-200/90">Motivo: {ban.reason}</p>
    </div>
  );
}

interface AdminUserRowProps {
  user: AdminUserListItem;
  isRevoking: boolean;
  onSelectUser: (user: AdminUserListItem) => void;
  onRevokeBan: (user: AdminUserListItem) => Promise<void>;
  onOpenBanModal: (target: BanModalTargetUser) => void;
  onRequestRoleChange: (user: AdminUserListItem, newRole: "admin" | "user") => void;
}

const AdminUserMobileCard = memo(function AdminUserMobileCard({
  user: u,
  isRevoking,
  onSelectUser,
  onRevokeBan,
  onOpenBanModal,
  onRequestRoleChange,
}: AdminUserRowProps) {
  const avatarSrc = u.avatarUrl || u.image;
  const displayName = u.displayName || u.name;
  const initial = (displayName || u.email || "?")[0]?.toUpperCase();
  const hasPotentialBan = isBanActiveAt(u.activeBan);

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative size-10 shrink-0 overflow-hidden rounded-lg border border-white/[0.08] bg-purple-500/15">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={displayName}
                className="size-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div className="grid size-full place-items-center text-xs font-bold text-purple-300">
                {initial}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-zinc-100">
                {displayName}
              </span>
              {u.isVerified && (
                <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />
              )}
            </div>
            <p className="studio-mono truncate text-[11px] text-zinc-400">
              {u.email}
            </p>
          </div>
        </div>

        <span
          className={cn(
            "studio-mono shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase",
            u.role === "admin"
              ? "border border-purple-500/30 bg-purple-500/15 text-purple-300"
              : "border border-white/[0.08] bg-[#161226] text-zinc-300",
          )}
        >
          {u.role === "admin" ? "Admin" : "Usuário"}
        </span>
      </div>

      {u.activeBan && <UserBanMobileBanner ban={u.activeBan} />}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5 text-xs">
        <span className="studio-tabular text-[11px] text-zinc-400">
          {new Date(u.createdAt).toLocaleDateString("pt-BR")}
          {u.isSystemAdmin ? " · Sistema" : ""}
          {u.isCurrentAdmin ? " · Você" : ""}
        </span>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSelectUser(u)}
            className="h-8 border-white/[0.08] bg-[#161226] px-2.5 text-[11px] text-zinc-200 hover:border-purple-500/40 hover:bg-[#1f1a36] hover:text-white"
          >
            Detalhes
          </Button>

          {!u.isCurrentAdmin && !u.isSystemAdmin && (
            <>
              {hasPotentialBan ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isRevoking}
                  onClick={() => void onRevokeBan(u)}
                  className="h-8 border-emerald-500/30 bg-emerald-500/15 px-2.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/25"
                >
                  Desbanir
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onOpenBanModal({
                      userId: u.id,
                      userName: displayName,
                      userEmail: u.email,
                      userNick: u.nick,
                    })
                  }
                  className="h-8 border-rose-500/30 bg-rose-500/15 px-2.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/25"
                >
                  Banir
                </Button>
              )}

              {u.role === "admin" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRequestRoleChange(u, "user")}
                  className="h-8 px-2.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/15"
                >
                  Rebaixar
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRequestRoleChange(u, "admin")}
                  className="h-8 px-2.5 text-[11px] font-semibold text-purple-300 hover:bg-purple-500/15"
                >
                  Promover
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
});

const AdminUserDesktopRow = memo(function AdminUserDesktopRow({
  user: u,
  isRevoking,
  onSelectUser,
  onRevokeBan,
  onOpenBanModal,
  onRequestRoleChange,
}: AdminUserRowProps) {
  const avatarSrc = u.avatarUrl || u.image;
  const displayName = u.displayName || u.name;
  const initial = (displayName || u.email || "?")[0]?.toUpperCase();
  const hasPotentialBan = isBanActiveAt(u.activeBan);

  return (
    <tr className="group transition-colors hover:bg-[#1a172e]/70">
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="relative size-9 shrink-0 overflow-hidden rounded-lg border border-white/[0.08] bg-purple-500/15">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={displayName}
                className="size-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div className="grid size-full place-items-center text-xs font-bold text-purple-300">
                {initial}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="max-w-[190px] truncate font-semibold text-zinc-100">
                {displayName}
              </span>
              {u.isVerified && (
                <span
                  title="Perfil Verificado Oficial"
                  className="inline-flex items-center text-emerald-400"
                >
                  <CheckCircle2 className="size-3.5" />
                </span>
              )}
            </div>
            <div className="studio-mono max-w-[180px] truncate text-[11px] text-zinc-400">
              {u.nick ? `@${u.nick}` : `ID: ${u.id.slice(0, 8)}...`}
            </div>
          </div>
        </div>
      </td>

      <td className="px-4 py-3.5 text-zinc-300">
        <div className="flex max-w-[210px] items-center gap-1.5 truncate">
          <Mail className="size-3.5 shrink-0 text-zinc-500" />
          <span className="truncate">{u.email}</span>
        </div>
      </td>

      <td className="px-4 py-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {u.role === "admin" ? (
            <span className="studio-mono inline-flex items-center gap-1 rounded border border-purple-500/30 bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-purple-300 uppercase">
              <Shield className="size-3 text-purple-400" />
              Admin
            </span>
          ) : (
            <span className="studio-mono inline-flex items-center rounded border border-white/[0.08] bg-[#161226] px-2 py-0.5 text-[10px] font-semibold text-zinc-300 uppercase">
              Usuário
            </span>
          )}

          {u.isSystemAdmin && (
            <span
              title="Administrador de infraestrutura protegido (Allowlist)"
              className="studio-mono text-[10px] font-semibold text-amber-400 uppercase"
            >
              [Sistema]
            </span>
          )}

          {u.isCurrentAdmin && (
            <span
              title="Sua conta atual em sessão"
              className="studio-mono text-[10px] font-semibold text-purple-400 uppercase"
            >
              (Você)
            </span>
          )}
        </div>
      </td>

      <td className="px-4 py-3.5">
        <UserBanDesktopCell ban={u.activeBan} />
      </td>

      <td className="px-4 py-3.5 text-zinc-400">
        <div className="studio-tabular flex items-center gap-1.5">
          <Calendar className="size-3 shrink-0 text-zinc-500" />
          <span>
            {new Date(u.createdAt).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </span>
        </div>
      </td>

      <td className="px-4 py-3.5 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onSelectUser(u)}
            className="h-8 px-2.5 text-[11px] font-medium text-zinc-300 hover:bg-white/[0.06] hover:text-white"
          >
            Detalhes
          </Button>

          {!u.isCurrentAdmin && !u.isSystemAdmin && (
            <>
              {hasPotentialBan ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isRevoking}
                  onClick={() => void onRevokeBan(u)}
                  className="h-8 px-2.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/15"
                >
                  Remover Ban
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onOpenBanModal({
                      userId: u.id,
                      userName: displayName,
                      userEmail: u.email,
                      userNick: u.nick,
                    })
                  }
                  className="h-8 px-2.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/15"
                >
                  Banir
                </Button>
              )}

              {u.role === "admin" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRequestRoleChange(u, "user")}
                  className="h-8 px-2.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/15"
                  title="Rebaixar para usuário comum"
                >
                  Rebaixar
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRequestRoleChange(u, "admin")}
                  className="h-8 px-2.5 text-[11px] font-semibold text-purple-300 hover:bg-purple-500/15"
                  title="Promover a administrador do Hikari Console"
                >
                  Promover
                </Button>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
});

export default AdminUsersPage;
