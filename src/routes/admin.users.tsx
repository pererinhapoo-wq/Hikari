import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getBearerToken } from "@/lib/auth/client";
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
  });

  // Usuário selecionado para visualização detalhada em modal
  const [selectedUser, setSelectedUser] = useState<AdminUserListItem | null>(null);

  // Modal de confirmação para alteração de papel
  const [roleChangeTarget, setRoleChangeTarget] = useState<{
    user: AdminUserListItem;
    newRole: "admin" | "user";
  } | null>(null);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const fetchUsers = async () => {
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
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || "Falha ao carregar usuários.");
      }

      const data = await res.json();
      setUsers(data.users || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalCount(data.pagination?.total || 0);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error("[admin.users] Erro ao carregar:", err);
      toast.error(
        err instanceof Error ? err.message : "Erro ao carregar lista de usuários.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchUsers();
  }, [page, roleFilter]);

  // Debounce para busca
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      void fetchUsers();
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

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

      // Atualiza usuário no estado local
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

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-fg)]">
              Gerenciamento de Usuários
            </h1>
            <span className="studio-mono rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-xs font-semibold text-purple-300">
              PostgreSQL
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Consulte contas reais registradas no banco de dados, inspecione detalhes e gerencie privilégios administrativos.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => void fetchUsers()}
          disabled={loading}
          className="border-white/10 bg-white/[0.03] text-xs hover:bg-white/[0.08]"
        >
          <RefreshCw className={cn("size-3.5 mr-1.5", loading && "animate-spin")} />
          Atualizar Lista
        </Button>
      </div>

      {/* Cards de Métricas Reais */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/[0.08] bg-[var(--studio-panel)] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--color-muted)]">
              Total de Contas
            </span>
            <div className="grid size-8 place-items-center rounded-lg border border-purple-500/25 bg-purple-500/10 text-purple-400">
              <Users className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="studio-tabular text-2xl font-bold text-[var(--color-fg)]">
              {stats.totalUsers}
            </span>
            <span className="text-[11px] text-[var(--color-subtle)]">registrados</span>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[var(--studio-panel)] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--color-muted)]">
              Administradores
            </span>
            <div className="grid size-8 place-items-center rounded-lg border border-purple-500/35 bg-purple-600/20 text-purple-300">
              <ShieldCheck className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="studio-tabular text-2xl font-bold text-purple-300">
              {stats.totalAdmins}
            </span>
            <span className="text-[11px] text-[var(--color-subtle)]">com acesso ao Studio</span>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[var(--studio-panel)] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--color-muted)]">
              Perfis Verificados
            </span>
            <div className="grid size-8 place-items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <UserCheck className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="studio-tabular text-2xl font-bold text-emerald-400">
              {stats.totalVerified}
            </span>
            <span className="text-[11px] text-[var(--color-subtle)]">selo oficial ativo</span>
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
            placeholder="Buscar por nome, email ou nick..."
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

        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <Filter className="size-3.5 text-[var(--color-subtle)]" />
          <span className="text-[11px] text-[var(--color-muted)] mr-1">Papel:</span>
          <div className="flex rounded-lg border border-white/10 bg-black/25 p-0.5">
            <button
              type="button"
              onClick={() => {
                setRoleFilter("all");
                setPage(1);
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                roleFilter === "all"
                  ? "bg-purple-600/30 text-purple-200 border border-purple-500/40"
                  : "text-[var(--color-muted)] hover:text-white",
              )}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => {
                setRoleFilter("admin");
                setPage(1);
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                roleFilter === "admin"
                  ? "bg-purple-600/30 text-purple-200 border border-purple-500/40"
                  : "text-[var(--color-muted)] hover:text-white",
              )}
            >
              Admins
            </button>
            <button
              type="button"
              onClick={() => {
                setRoleFilter("user");
                setPage(1);
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                roleFilter === "user"
                  ? "bg-purple-600/30 text-purple-200 border border-purple-500/40"
                  : "text-[var(--color-muted)] hover:text-white",
              )}
            >
              Usuários
            </button>
          </div>
        </div>
      </div>

      {/* Tabela de Usuários */}
      <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[var(--studio-panel)]">
        {loading ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center gap-2">
            <Loader2 className="size-7 animate-spin text-purple-400" />
            <p className="studio-mono text-xs text-[var(--color-muted)]">
              Consultando usuários no PostgreSQL...
            </p>
          </div>
        ) : users.length === 0 ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 p-6 text-center">
            <AlertCircle className="size-8 text-[var(--color-subtle)]" />
            <p className="text-sm font-medium text-[var(--color-fg)]">
              Nenhum usuário encontrado
            </p>
            <p className="text-xs text-[var(--color-muted)]">
              {search
                ? `Nenhum resultado corresponde à busca "${search}".`
                : "Ainda não existem usuários registrados para os filtros selecionados."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/[0.08] bg-white/[0.02] text-[11px] font-semibold tracking-wider text-[var(--color-subtle)] uppercase">
                <tr>
                  <th className="px-4 py-3">Usuário</th>
                  <th className="px-4 py-3">E-mail</th>
                  <th className="px-4 py-3">Papel</th>
                  <th className="px-4 py-3">Criado em</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {users.map((u) => {
                  const avatarSrc = u.avatarUrl || u.image;
                  const displayName = u.displayName || u.name;
                  const initial = (displayName || u.email || "?")[0]?.toUpperCase();

                  return (
                    <tr
                      key={u.id}
                      className="group transition-colors hover:bg-white/[0.02]"
                    >
                      {/* Usuário / Nick */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="relative size-9 shrink-0 overflow-hidden rounded-full border border-white/10 bg-purple-900/30">
                            {avatarSrc ? (
                              <img
                                src={avatarSrc}
                                alt={displayName}
                                className="size-full object-cover"
                                onError={(e) => {
                                  // Fallback se URL de imagem falhar
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
                              <span className="font-semibold text-[var(--color-fg)] truncate max-w-[160px] sm:max-w-[220px]">
                                {displayName}
                              </span>
                              {u.isVerified && (
                                <span
                                  title="Perfil Verificado Oficial"
                                  className="inline-flex items-center text-emerald-400"
                                >
                                  <CheckCircle2 className="size-3" />
                                </span>
                              )}
                            </div>
                            <div className="studio-mono text-[11px] text-[var(--color-subtle)] truncate max-w-[160px]">
                              {u.nick ? `@${u.nick}` : `ID: ${u.id.slice(0, 8)}...`}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* E-mail */}
                      <td className="px-4 py-3.5 text-[var(--color-muted)]">
                        <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                          <Mail className="size-3 text-[var(--color-subtle)] shrink-0" />
                          <span className="truncate">{u.email}</span>
                        </div>
                      </td>

                      {/* Papel (Role) */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {u.role === "admin" ? (
                            <span className="studio-mono inline-flex items-center gap-1 rounded-md border border-purple-500/35 bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-purple-300 uppercase">
                              <Shield className="size-3 text-purple-400" />
                              Admin
                            </span>
                          ) : (
                            <span className="studio-mono inline-flex items-center rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-[var(--color-muted)] uppercase">
                              Usuário
                            </span>
                          )}

                          {u.isSystemAdmin && (
                            <span
                              title="Administrador de infraestrutura protegido (Allowlist)"
                              className="studio-mono text-[9px] font-medium text-amber-400/80 uppercase"
                            >
                              [Sistema]
                            </span>
                          )}

                          {u.isCurrentAdmin && (
                            <span
                              title="Sua conta atual em sessão"
                              className="studio-mono text-[9px] font-medium text-purple-400/80 uppercase"
                            >
                              (Você)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Criado em */}
                      <td className="px-4 py-3.5 text-[var(--color-subtle)]">
                        <div className="flex items-center gap-1.5 studio-tabular">
                          <Calendar className="size-3 text-[var(--color-subtle)] shrink-0" />
                          <span>
                            {new Date(u.createdAt).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedUser(u)}
                            className="h-7 px-2 text-[11px] text-[var(--color-muted)] hover:text-white hover:bg-white/[0.06]"
                          >
                            Detalhes
                          </Button>

                          {!u.isCurrentAdmin && !u.isSystemAdmin && (
                            u.role === "admin" ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setRoleChangeTarget({ user: u, newRole: "user" })
                                }
                                className="h-7 px-2 text-[11px] text-rose-300 hover:text-rose-200 hover:bg-rose-500/10"
                                title="Rebaixar para usuário comum"
                              >
                                Rebaixar
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setRoleChangeTarget({ user: u, newRole: "admin" })
                                }
                                className="h-7 px-2 text-[11px] text-purple-300 hover:text-purple-200 hover:bg-purple-500/10"
                                title="Promover a administrador do Hikari Studio"
                              >
                                Promover
                              </Button>
                            )
                          )}
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
          <div className="flex items-center justify-between border-t border-white/[0.08] px-4 py-3 text-xs text-[var(--color-muted)]">
            <span>
              Mostrando <strong className="text-white">{users.length}</strong> de{" "}
              <strong className="text-white">{totalCount}</strong> usuários
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
      </div>

      {/* Modal de Detalhes do Usuário */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-[var(--studio-panel)] p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-full overflow-hidden border border-purple-500/35 bg-purple-900/30">
                  {selectedUser.avatarUrl || selectedUser.image ? (
                    <img
                      src={selectedUser.avatarUrl || selectedUser.image || ""}
                      alt={selectedUser.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="grid size-full place-items-center text-sm font-bold text-purple-200">
                      {(selectedUser.displayName || selectedUser.name)[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-base text-white flex items-center gap-1.5">
                    {selectedUser.displayName || selectedUser.name}
                    {selectedUser.isVerified && (
                      <CheckCircle2 className="size-3.5 text-emerald-400" />
                    )}
                  </h3>
                  <p className="studio-mono text-xs text-[var(--color-subtle)]">
                    {selectedUser.nick ? `@${selectedUser.nick}` : "Sem nick público"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="rounded-lg p-1 text-[var(--color-subtle)] hover:bg-white/10 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/[0.06] bg-black/25 p-3">
                <div>
                  <span className="text-[10px] text-[var(--color-subtle)] uppercase tracking-wider font-semibold">
                    Papel Administrativo
                  </span>
                  <div className="mt-1">
                    <span
                      className={cn(
                        "studio-mono inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase",
                        selectedUser.role === "admin"
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/35"
                          : "bg-white/[0.05] text-[var(--color-muted)] border border-white/10",
                      )}
                    >
                      {selectedUser.role}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-[var(--color-subtle)] uppercase tracking-wider font-semibold">
                    Tipo de Conta
                  </span>
                  <div className="mt-1 studio-mono text-white capitalize">
                    {selectedUser.accountType}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-[var(--color-subtle)] uppercase tracking-wider font-semibold">
                    E-mail
                  </span>
                  <div className="mt-1 text-white truncate" title={selectedUser.email}>
                    {selectedUser.email}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-[var(--color-subtle)] uppercase tracking-wider font-semibold">
                    Cadastro
                  </span>
                  <div className="mt-1 studio-tabular text-white">
                    {new Date(selectedUser.createdAt).toLocaleString("pt-BR")}
                  </div>
                </div>
              </div>

              {selectedUser.bio && (
                <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
                  <span className="text-[10px] text-[var(--color-subtle)] uppercase tracking-wider font-semibold">
                    Biografia
                  </span>
                  <p className="mt-1 text-xs text-[var(--color-muted)] leading-relaxed">
                    {selectedUser.bio}
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
                <span className="text-[10px] text-[var(--color-subtle)] uppercase tracking-wider font-semibold">
                  Identificador Único (ID)
                </span>
                <p className="mt-1 studio-mono text-[11px] text-[var(--color-subtle)] break-all select-all">
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
                  className="inline-flex items-center gap-1.5 text-xs text-purple-300 hover:text-purple-200 hover:underline"
                >
                  <ExternalLink className="size-3" />
                  Abrir perfil público
                </a>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedUser(null)}
                className="border-white/10 text-xs ml-auto"
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[var(--studio-panel)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-purple-300">
              <div className="grid size-9 place-items-center rounded-lg border border-purple-500/35 bg-purple-500/15">
                <ShieldAlert className="size-5" />
              </div>
              <h3 className="font-semibold text-base text-white">
                {roleChangeTarget.newRole === "admin"
                  ? "Promover a Administrador"
                  : "Rebaixar para Usuário Comum"}
              </h3>
            </div>

            <p className="text-xs text-[var(--color-muted)] leading-relaxed">
              Você tem certeza de que deseja alterar o papel da conta{" "}
              <strong className="text-white">
                {roleChangeTarget.user.displayName || roleChangeTarget.user.name}
              </strong>{" "}
              ({roleChangeTarget.user.email}) para{" "}
              <strong className="text-purple-300 uppercase">
                {roleChangeTarget.newRole}
              </strong>
              ?
            </p>

            {roleChangeTarget.newRole === "admin" && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-200">
                Atenção: conceder papel de administrador dá acesso total ao Hikari Studio, edição de catálogo e configurações do sistema.
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isUpdatingRole}
                onClick={() => setRoleChangeTarget(null)}
                className="border-white/10 text-xs"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={isUpdatingRole}
                onClick={() => void handleConfirmRoleChange()}
                className={cn(
                  "text-xs font-semibold",
                  roleChangeTarget.newRole === "admin"
                    ? "bg-purple-600 hover:bg-purple-500 text-white"
                    : "bg-rose-600 hover:bg-rose-500 text-white",
                )}
              >
                {isUpdatingRole && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
                Confirmar Alteração
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminUsersPage;
