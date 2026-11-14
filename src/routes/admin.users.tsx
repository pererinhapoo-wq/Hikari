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

  const [selectedUser, setSelectedUser] = useState<AdminUserListItem | null>(null);

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
    <div className="studio-enter space-y-6">
      <StudioPageHeader
        kicker="Comunidade & Acessos"
        title="Gerenciamento de Usuários"
        description="Consulte contas reais registradas no banco de dados, inspecione detalhes e gerencie privilégios administrativos."
        backTo="/admin"
        backLabel="Voltar à Central"
        status={<span className="studio-mono font-semibold text-violet-300">PostgreSQL</span>}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchUsers()}
            disabled={loading}
            className="h-9 border-[var(--studio-line)] bg-[var(--studio-panel)] text-xs hover:bg-white/[0.06]"
          >
            <RefreshCw className={cn("mr-1.5 size-3.5", loading && "animate-spin")} />
            Atualizar Lista
          </Button>
        }
      />

      {/* Faixa de Métricas Reais */}
      <StudioStatStrip
        columns={3}
        items={[
          {
            label: "Total de Contas",
            value: stats.totalUsers.toLocaleString("pt-BR"),
            detail: "Contas registradas no Neon PostgreSQL",
          },
          {
            label: "Administradores",
            value: stats.totalAdmins.toLocaleString("pt-BR"),
            detail: "Com acesso ao Hikari Studio",
            accent: "violet",
          },
          {
            label: "Perfis Verificados",
            value: stats.totalVerified.toLocaleString("pt-BR"),
            detail: "Selo oficial ativo",
            accent: "emerald",
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
            placeholder="Buscar por nome, email ou nick..."
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

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Filter className="size-3.5 text-[var(--color-subtle)]" />
          <span className="text-[11px] text-[var(--color-muted)]">Papel:</span>
          <div className="flex rounded-lg border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] p-0.5">
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
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  roleFilter === tab.id
                    ? "border border-[var(--studio-accent-border)] bg-[var(--studio-accent-soft)] text-violet-200"
                    : "text-[var(--color-muted)] hover:text-white",
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
          <div className="divide-y divide-[var(--studio-line)] md:hidden">
            {users.map((u) => {
              const avatarSrc = u.avatarUrl || u.image;
              const displayName = u.displayName || u.name;
              const initial = (displayName || u.email || "?")[0]?.toUpperCase();

              return (
                <div key={u.id} className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative size-10 shrink-0 overflow-hidden rounded-lg border border-[var(--studio-line)] bg-violet-950/30">
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
                          <div className="grid size-full place-items-center text-xs font-bold text-violet-300">
                            {initial}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-[var(--color-fg)]">
                            {displayName}
                          </span>
                          {u.isVerified && (
                            <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />
                          )}
                        </div>
                        <p className="studio-mono truncate text-[11px] text-[var(--color-subtle)]">
                          {u.email}
                        </p>
                      </div>
                    </div>

                    <span
                      className={cn(
                        "studio-mono shrink-0 text-[10px] font-bold uppercase",
                        u.role === "admin" ? "text-violet-300" : "text-[var(--color-muted)]",
                      )}
                    >
                      {u.role === "admin" ? "Admin" : "Usuário"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-[var(--studio-line-soft)] pt-2.5 text-xs">
                    <span className="studio-tabular text-[11px] text-[var(--color-subtle)]">
                      {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                      {u.isSystemAdmin ? " · Sistema" : ""}
                      {u.isCurrentAdmin ? " · Você" : ""}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedUser(u)}
                        className="h-8 border-[var(--studio-line)] px-2.5 text-[11px]"
                      >
                        Detalhes
                      </Button>

                      {!u.isCurrentAdmin &&
                        !u.isSystemAdmin &&
                        (u.role === "admin" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setRoleChangeTarget({ user: u, newRole: "user" })
                            }
                            className="h-8 px-2.5 text-[11px] text-rose-300 hover:bg-rose-500/10"
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
                            className="h-8 px-2.5 text-[11px] text-violet-300 hover:bg-violet-500/10"
                          >
                            Promover
                          </Button>
                        ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tabela Desktop */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--studio-line)] bg-white/[0.02] text-[11px] font-semibold tracking-wider text-[var(--color-subtle)] uppercase">
                <tr>
                  <th className="px-4 py-3">Usuário</th>
                  <th className="px-4 py-3">E-mail</th>
                  <th className="px-4 py-3">Papel</th>
                  <th className="px-4 py-3">Criado em</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--studio-line)]">
                {users.map((u) => {
                  const avatarSrc = u.avatarUrl || u.image;
                  const displayName = u.displayName || u.name;
                  const initial = (displayName || u.email || "?")[0]?.toUpperCase();

                  return (
                    <tr
                      key={u.id}
                      className="group transition-colors hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="relative size-9 shrink-0 overflow-hidden rounded-lg border border-[var(--studio-line)] bg-violet-950/30">
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
                              <div className="grid size-full place-items-center text-xs font-bold text-violet-300">
                                {initial}
                              </div>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="max-w-[200px] truncate font-semibold text-[var(--color-fg)]">
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
                            <div className="studio-mono max-w-[180px] truncate text-[11px] text-[var(--color-subtle)]">
                              {u.nick ? `@${u.nick}` : `ID: ${u.id.slice(0, 8)}...`}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-[var(--color-muted)]">
                        <div className="flex max-w-[220px] items-center gap-1.5 truncate">
                          <Mail className="size-3 shrink-0 text-[var(--color-subtle)]" />
                          <span className="truncate">{u.email}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {u.role === "admin" ? (
                            <span className="studio-mono inline-flex items-center gap-1 rounded border border-[var(--studio-accent-border)] bg-[var(--studio-accent-soft)] px-2 py-0.5 text-[10px] font-bold tracking-wider text-violet-200 uppercase">
                              <Shield className="size-3 text-violet-300" />
                              Admin
                            </span>
                          ) : (
                            <span className="studio-mono inline-flex items-center rounded border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-muted)] uppercase">
                              Usuário
                            </span>
                          )}

                          {u.isSystemAdmin && (
                            <span
                              title="Administrador de infraestrutura protegido (Allowlist)"
                              className="studio-mono text-[10px] font-medium text-amber-300 uppercase"
                            >
                              [Sistema]
                            </span>
                          )}

                          {u.isCurrentAdmin && (
                            <span
                              title="Sua conta atual em sessão"
                              className="studio-mono text-[10px] font-medium text-violet-300 uppercase"
                            >
                              (Você)
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-[var(--color-subtle)]">
                        <div className="studio-tabular flex items-center gap-1.5">
                          <Calendar className="size-3 shrink-0 text-[var(--color-subtle)]" />
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
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedUser(u)}
                            className="h-8 px-2.5 text-[11px] text-[var(--color-muted)] hover:bg-white/[0.06] hover:text-white"
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
                                className="h-8 px-2.5 text-[11px] text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
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
                                className="h-8 px-2.5 text-[11px] text-violet-300 hover:bg-violet-500/10 hover:text-violet-200"
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

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--studio-line)] px-4 py-3 text-xs text-[var(--color-muted)]">
              <span className="studio-tabular">
                Mostrando <strong className="text-white">{users.length}</strong> de{" "}
                <strong className="text-white">{totalCount}</strong> usuários
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
        </div>
      )}

      {/* Modal de Detalhes do Usuário */}
      {selectedUser && (
        <div
          className="hikari-studio-dialog fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="studio-scroll max-h-[88dvh] w-full max-w-lg space-y-5 overflow-y-auto rounded-2xl border border-[var(--studio-line-strong)] bg-[var(--studio-panel)] p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[var(--studio-line)] pb-4">
              <div className="flex items-center gap-3">
                <div className="size-12 shrink-0 overflow-hidden rounded-xl border border-[var(--studio-accent-border)] bg-violet-950/30">
                  {selectedUser.avatarUrl || selectedUser.image ? (
                    <img
                      src={selectedUser.avatarUrl || selectedUser.image || ""}
                      alt={selectedUser.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="grid size-full place-items-center text-sm font-bold text-violet-200">
                      {(selectedUser.displayName || selectedUser.name)[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="flex items-center gap-1.5 text-base font-semibold text-white">
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
                className="rounded-lg p-1.5 text-[var(--color-subtle)] hover:bg-white/10 hover:text-white"
                aria-label="Fechar detalhes"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] p-3.5 sm:grid-cols-2">
                <div>
                  <span className="studio-label">Papel Administrativo</span>
                  <div className="mt-1">
                    <span
                      className={cn(
                        "studio-mono inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase",
                        selectedUser.role === "admin"
                          ? "border border-[var(--studio-accent-border)] bg-[var(--studio-accent-soft)] text-violet-200"
                          : "border border-[var(--studio-line)] bg-white/[0.04] text-[var(--color-muted)]",
                      )}
                    >
                      {selectedUser.role}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="studio-label">Tipo de Conta</span>
                  <div className="studio-mono mt-1 text-white capitalize">
                    {selectedUser.accountType}
                  </div>
                </div>

                <div>
                  <span className="studio-label">E-mail</span>
                  <div className="mt-1 truncate text-white" title={selectedUser.email}>
                    {selectedUser.email}
                  </div>
                </div>

                <div>
                  <span className="studio-label">Cadastro</span>
                  <div className="studio-tabular mt-1 text-white">
                    {new Date(selectedUser.createdAt).toLocaleString("pt-BR")}
                  </div>
                </div>
              </div>

              {selectedUser.bio && (
                <div className="rounded-xl border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] p-3.5">
                  <span className="studio-label">Biografia</span>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">
                    {selectedUser.bio}
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] p-3.5">
                <span className="studio-label">Identificador Único (ID)</span>
                <p className="studio-mono mt-1 break-all text-[11px] text-[var(--color-subtle)] select-all">
                  {selectedUser.id}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[var(--studio-line)] pt-4">
              {selectedUser.nick && (
                <a
                  href={`/profile/${selectedUser.nick}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-violet-300 hover:text-violet-200 hover:underline"
                >
                  <ExternalLink className="size-3" />
                  Abrir perfil público
                </a>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedUser(null)}
                className="ml-auto border-[var(--studio-line)] text-xs"
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
          className="hikari-studio-dialog fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="studio-scroll max-h-[88dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl border border-[var(--studio-line-strong)] bg-[var(--studio-panel)] p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-violet-300">
              <div className="grid size-9 place-items-center rounded-lg border border-[var(--studio-accent-border)] bg-[var(--studio-accent-soft)]">
                <ShieldAlert className="size-5" />
              </div>
              <h3 className="text-base font-semibold text-white">
                {roleChangeTarget.newRole === "admin"
                  ? "Promover a Administrador"
                  : "Rebaixar para Usuário Comum"}
              </h3>
            </div>

            <p className="text-xs leading-relaxed text-[var(--color-muted)]">
              Você tem certeza de que deseja alterar o papel da conta{" "}
              <strong className="text-white">
                {roleChangeTarget.user.displayName || roleChangeTarget.user.name}
              </strong>{" "}
              ({roleChangeTarget.user.email}) para{" "}
              <strong className="text-violet-300 uppercase">
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
                className="border-[var(--studio-line)] text-xs"
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
                    ? "bg-violet-600 text-white hover:bg-violet-500"
                    : "bg-rose-600 text-white hover:bg-rose-500",
                )}
              >
                {isUpdatingRole && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
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
