import {
  Link,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Clock,
  Database,
  ExternalLink,
  Film,
  HardDriveDownload,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Users,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { signOut } from "@/lib/auth/client";
import {
  flushOutbox,
  hasPendingWrites,
  readOutbox,
  type OutboxOperation,
} from "@/lib/episode-writer";
import { useScrollLock } from "@/lib/scroll-lock";
import { cn } from "@/lib/utils";
import "@/styles/admin-studio.css";

interface StudioLayoutProps {
  children: ReactNode;
}

interface NavItem {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  to?: string;
  params?: Record<string, string>;
  badge?: string;
  badgeVariant?: "default" | "amber" | "emerald" | "purple" | "red";
  disabled?: boolean;
  comingSoon?: boolean;
}

interface NavCategory {
  title: string;
  items: NavItem[];
}

export function HikariStudioLayout({ children }: StudioLayoutProps) {
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;
  const navigate = useNavigate();
  const { user } = useCurrentUserState();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [roadmapOpen, setRoadmapOpen] = useState(false);
  const [outboxOps, setOutboxOps] = useState<OutboxOperation[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useScrollLock(mobileDrawerOpen);

  const refreshOutbox = useCallback(() => {
    if (typeof window !== "undefined") {
      setOutboxOps(readOutbox());
    }
  }, []);

  useEffect(() => {
    refreshOutbox();

    const handleSyncEvent = () => refreshOutbox();
    window.addEventListener("online", handleSyncEvent);
    window.addEventListener("storage", handleSyncEvent);

    const timer = window.setInterval(refreshOutbox, 8000);
    return () => {
      window.removeEventListener("online", handleSyncEvent);
      window.removeEventListener("storage", handleSyncEvent);
      window.clearInterval(timer);
    };
  }, [refreshOutbox]);

  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileDrawerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileDrawerOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileDrawerOpen]);

  const handleManualSync = async () => {
    if (isSyncing) return;
    if (!hasPendingWrites()) {
      toast.info("Nenhuma operação pendente no Outbox.");
      return;
    }

    setIsSyncing(true);
    toast.info("Sincronizando operações do Outbox com o PostgreSQL...");

    try {
      const res = await flushOutbox();
      refreshOutbox();
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
      setIsSyncing(false);
    }
  };

  const pendingCount = outboxOps.filter((o) => o.status !== "conflict").length;
  const conflictCount = outboxOps.filter((o) => o.status === "conflict").length;
  const totalOutboxCount = outboxOps.length;

  const navCategories: NavCategory[] = useMemo(
    () => [
      {
        title: "Operação",
        items: [
          {
            id: "overview",
            label: "Visão Geral",
            icon: LayoutDashboard,
            to: "/admin",
          },
          {
            id: "catalog",
            label: "Catálogo de Animes",
            icon: Film,
            to: "/admin",
          },
          {
            id: "new-anime",
            label: "Novo Cadastro",
            icon: Plus,
            to: "/admin/new",
          },
          {
            id: "quick-update",
            label: "Atualização Rápida",
            icon: Zap,
            to: "/admin/quick-update",
            badge: "Players",
            badgeVariant: "purple",
          },
        ],
      },
      {
        title: "Comunidade & IA",
        items: [
          {
            id: "moderation",
            label: "Moderação",
            icon: ShieldAlert,
            to: "/admin/moderation",
          },
          {
            id: "hikari-ai",
            label: "Hikari AI",
            icon: Sparkles,
            to: "/admin/hikari-ai",
            badge: "IA",
            badgeVariant: "purple",
          },
        ],
      },
      {
        title: "Infraestrutura",
        items: [
          {
            id: "database-sync",
            label: "Banco & Outbox",
            icon: Database,
            to: "/admin",
            badge:
              conflictCount > 0
                ? `${conflictCount} conflito`
                : pendingCount > 0
                  ? `${pendingCount} fila`
                  : "Ativo",
            badgeVariant:
              conflictCount > 0
                ? "red"
                : pendingCount > 0
                  ? "amber"
                  : "emerald",
          },
        ],
      },
    ],
    [conflictCount, pendingCount],
  );

  const plannedItems: NavItem[] = useMemo(
    () => [
      {
        id: "users",
        label: "Usuários",
        icon: Users,
        comingSoon: true,
        disabled: true,
      },
      {
        id: "maintenance",
        label: "Central de Manutenção",
        icon: Wrench,
        comingSoon: true,
        disabled: true,
      },
      {
        id: "images",
        label: "Central de Imagens",
        icon: ImageIcon,
        comingSoon: true,
        disabled: true,
      },
      {
        id: "health",
        label: "Saúde do Sistema",
        icon: Activity,
        comingSoon: true,
        disabled: true,
      },
      {
        id: "backup",
        label: "Backup e Dados",
        icon: HardDriveDownload,
        comingSoon: true,
        disabled: true,
      },
      {
        id: "settings",
        label: "Configurações",
        icon: SlidersHorizontal,
        comingSoon: true,
        disabled: true,
      },
    ],
    [],
  );

  const isItemActive = (item: NavItem) => {
    if (!item.to) return false;
    if (item.id === "overview") {
      return pathname === "/admin" || pathname === "/admin/";
    }
    if (item.id === "catalog") {
      return (
        pathname.startsWith("/admin/") &&
        pathname !== "/admin/new" &&
        pathname !== "/admin/moderation" &&
        pathname !== "/admin/hikari-ai" &&
        pathname !== "/admin/quick-update"
      );
    }
    if (item.id === "new-anime") {
      return pathname === "/admin/new";
    }
    if (item.id === "quick-update") {
      return pathname.startsWith("/admin/quick-update");
    }
    if (item.id === "moderation") {
      return pathname.startsWith("/admin/moderation");
    }
    if (item.id === "hikari-ai") {
      return pathname.startsWith("/admin/hikari-ai");
    }
    return false;
  };

  const breadcrumb = useMemo(() => {
    if (pathname === "/admin" || pathname === "/admin/") {
      return { section: "Operação", current: "Visão Geral & Catálogo" };
    }
    if (pathname.startsWith("/admin/quick-update")) {
      return { section: "Operação", current: "Atualização Rápida de Players" };
    }
    if (pathname.startsWith("/admin/moderation")) {
      return { section: "Comunidade", current: "Moderação de Denúncias" };
    }
    if (pathname.startsWith("/admin/hikari-ai")) {
      return { section: "Inteligência Artificial", current: "Hikari AI" };
    }
    if (pathname.startsWith("/admin/")) {
      const parts = pathname.split("/");
      const idPart = parts[2];
      if (idPart === "new") {
        return { section: "Catálogo", current: "Novo Anime" };
      }
      return { section: "Catálogo", current: "Editor de Anime" };
    }
    return { section: "Console", current: "Studio" };
  }, [pathname]);

  const renderNavContent = (isDrawer = false) => (
    <div className="flex h-full flex-col justify-between gap-6">
      <div className="space-y-5">
        {/* Identidade HIKARI STUDIO */}
        <div className="flex items-center justify-between px-1.5 pt-1">
          <Link
            to="/admin"
            className="group flex items-center gap-3 transition-opacity hover:opacity-90"
            onClick={() => setMobileDrawerOpen(false)}
          >
            <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-purple-500/35 bg-purple-600/15 font-display text-base font-bold text-purple-200">
              光
            </div>
            <div className="flex flex-col leading-none">
              <div className="flex items-center gap-2">
                <span className="font-display text-base font-semibold tracking-wider text-[var(--color-fg)]">
                  HIKARI
                </span>
                <span className="studio-mono rounded border border-purple-500/35 bg-purple-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-purple-300">
                  STUDIO
                </span>
              </div>
              <span className="mt-1 text-[10px] tracking-[0.18em] text-[var(--color-subtle)] uppercase">
                Controle Editorial
              </span>
            </div>
          </Link>

          {isDrawer && (
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(false)}
              className="flex size-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-[var(--color-muted)] hover:bg-white/10 hover:text-[var(--color-fg)] lg:hidden"
              aria-label="Fechar navegação"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Estado de Persistência & Outbox na Rail */}
        <div className="rounded-xl border border-white/[0.07] bg-[var(--studio-panel)] p-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-[11px] font-medium text-[var(--color-muted)]">
              PostgreSQL
            </span>
            <span
              className={cn(
                "studio-mono inline-flex items-center gap-1.5 text-[11px] font-medium",
                conflictCount > 0
                  ? "text-rose-400"
                  : pendingCount > 0
                    ? "text-amber-300"
                    : "text-emerald-400",
              )}
            >
              {conflictCount > 0 ? (
                <>
                  <AlertTriangle className="size-3" />
                  <span>{conflictCount} conflito(s)</span>
                </>
              ) : pendingCount > 0 ? (
                <>
                  <Clock className="size-3" />
                  <span>{pendingCount} na fila</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3" />
                  <span>Sincronizado</span>
                </>
              )}
            </span>
          </div>

          {totalOutboxCount > 0 && (
            <button
              type="button"
              disabled={isSyncing}
              onClick={handleManualSync}
              className="mt-2.5 flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-200 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
            >
              <RefreshCw
                className={cn("size-3.5", isSyncing && "animate-spin")}
              />
              <span>
                {isSyncing ? "Sincronizando..." : "Sincronizar Outbox"}
              </span>
            </button>
          )}
        </div>

        {/* Navegação Principal */}
        <nav className="space-y-5" aria-label="Navegação Administrativa">
          {navCategories.map((category) => (
            <div key={category.title} className="space-y-1.5">
              <p className="px-2.5 text-[10px] font-bold tracking-[0.22em] text-[var(--color-subtle)] uppercase">
                {category.title}
              </p>
              <div className="space-y-0.5">
                {category.items.map((item) => {
                  const active = isItemActive(item);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.id}
                      to={item.to!}
                      onClick={() => {
                        setMobileDrawerOpen(false);
                        if (item.id === "catalog") {
                          setTimeout(() => {
                            document
                              .getElementById("catalog")
                              ?.scrollIntoView({ behavior: "smooth" });
                          }, 80);
                        } else if (item.id === "database-sync") {
                          setTimeout(() => {
                            document
                              .getElementById("system-status")
                              ?.scrollIntoView({ behavior: "smooth" });
                          }, 80);
                        }
                      }}
                      className={cn(
                        "group relative flex min-h-10 items-center justify-between rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                        active
                          ? "bg-purple-500/14 text-white border border-purple-500/30"
                          : "border border-transparent text-[var(--color-muted)] hover:bg-white/[0.045] hover:text-[var(--color-fg)]",
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={cn(
                            "size-4 shrink-0 transition-colors",
                            active
                              ? "text-purple-400"
                              : "text-[var(--color-subtle)] group-hover:text-[var(--color-fg)]",
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {item.badge && (
                        <span
                          className={cn(
                            "studio-mono shrink-0 text-[10px] font-medium",
                            item.badgeVariant === "emerald" &&
                              "text-emerald-400",
                            item.badgeVariant === "amber" && "text-amber-300",
                            item.badgeVariant === "red" && "text-rose-400",
                            item.badgeVariant === "purple" &&
                              "text-purple-300",
                            (!item.badgeVariant ||
                              item.badgeVariant === "default") &&
                              "text-[var(--color-subtle)]",
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Módulos Planejados (colapsável para manter foco nas ferramentas ativas) */}
          <div className="pt-1 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={() => setRoadmapOpen((prev) => !prev)}
              aria-expanded={roadmapOpen}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-[10px] font-bold tracking-[0.2em] text-[var(--color-subtle)] uppercase transition-colors hover:text-[var(--color-muted)]"
            >
              <span>Expansão ({plannedItems.length})</span>
              <ChevronDown
                className={cn(
                  "size-3.5 transition-transform duration-150",
                  roadmapOpen && "rotate-180",
                )}
              />
            </button>

            {roadmapOpen && (
              <div className="mt-1 space-y-0.5">
                {plannedItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      className="flex cursor-not-allowed items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-[var(--color-subtle)]/70"
                      title="Funcionalidade planejada para etapas futuras"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className="size-3.5 shrink-0 opacity-50" />
                        <span className="truncate">{item.label}</span>
                      </div>
                      <span className="studio-mono text-[9px] uppercase tracking-wider opacity-70">
                        Em breve
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* Rodapé da Sidebar */}
      <div className="space-y-2.5 pt-4 border-t border-white/[0.07]">
        <Link
          to="/"
          className="group flex min-h-10 w-full items-center justify-between rounded-lg border border-white/[0.08] bg-[var(--studio-panel)] px-3 py-2 text-xs text-[var(--color-muted)] transition-colors hover:border-purple-500/35 hover:bg-purple-500/10 hover:text-white"
        >
          <div className="flex items-center gap-2">
            <ArrowLeft className="size-3.5 text-purple-400 transition-transform group-hover:-translate-x-0.5" />
            <span className="font-medium">Voltar ao site público</span>
          </div>
          <ExternalLink className="size-3 opacity-60 group-hover:text-purple-300 group-hover:opacity-100" />
        </Link>

        <div className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-[var(--studio-panel)] p-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid size-8 shrink-0 place-items-center rounded-md border border-purple-500/30 bg-purple-600/20 text-xs font-bold text-purple-200">
              {user?.displayName
                ? user.displayName.charAt(0).toUpperCase()
                : user?.primaryEmail
                  ? user.primaryEmail.charAt(0).toUpperCase()
                  : "A"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-[var(--color-fg)]">
                {user?.displayName || "Administrador"}
              </p>
              <p className="studio-mono truncate text-[10px] text-[var(--color-subtle)]">
                {user?.primaryEmail || "admin@hikari.online"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              try {
                await signOut();
                toast.success("Sessão finalizada.");
                void navigate({ to: "/" });
              } catch {
                toast.error("Erro ao encerrar sessão.");
              }
            }}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-[var(--color-muted)] transition-colors hover:bg-rose-500/15 hover:text-rose-300"
            title="Encerrar sessão administrativa"
            aria-label="Sair da conta"
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="hikari-studio-root antialiased selection:bg-purple-600/30 selection:text-white">
      {/* Sidebar Desktop Fixa */}
      <aside className="studio-scroll fixed inset-y-0 left-0 z-30 hidden w-[272px] flex-col overflow-y-auto border-r border-white/[0.075] bg-[var(--studio-rail)] p-4 lg:flex">
        {renderNavContent(false)}
      </aside>

      {/* Drawer Mobile Acessível */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navegação do Hikari Studio"
        >
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
            aria-hidden="true"
          />

          <div className="studio-scroll fixed inset-y-0 left-0 w-72 max-w-[86vw] overflow-y-auto border-r border-white/10 bg-[var(--studio-rail)] p-4 shadow-2xl">
            {renderNavContent(true)}
          </div>
        </div>
      )}

      {/* Área Principal */}
      <div className="flex min-h-dvh w-full flex-1 flex-col overflow-x-hidden lg:pl-[272px]">
        {/* Topbar Sticky */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-white/[0.075] bg-[var(--studio-canvas)]/90 px-4 backdrop-blur-md sm:h-16 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-[var(--color-fg)] hover:bg-white/[0.08] lg:hidden"
              aria-label="Abrir menu lateral"
            >
              <Menu className="size-4" />
            </button>

            <div className="flex min-w-0 items-center gap-1.5 text-xs">
              <Link
                to="/admin"
                className="shrink-0 font-semibold text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
              >
                Hikari Studio
              </Link>
              <span className="text-white/25">/</span>
              <span className="hidden truncate text-[var(--color-subtle)] sm:inline">
                {breadcrumb.section}
              </span>
              <span className="hidden text-white/25 sm:inline">/</span>
              <span className="truncate font-semibold text-purple-300">
                {breadcrumb.current}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {conflictCount > 0 ? (
              <Link
                to="/admin"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-500/35 bg-rose-500/12 px-2.5 text-[11px] font-semibold text-rose-300 transition-colors hover:bg-rose-500/20"
              >
                <AlertTriangle className="size-3.5 text-rose-400" />
                <span className="studio-tabular">{conflictCount} conflito(s)</span>
              </Link>
            ) : pendingCount > 0 ? (
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncing}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-500/12 px-2.5 text-[11px] font-semibold text-amber-200 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
                title="Clique para sincronizar com o PostgreSQL"
              >
                <RefreshCw
                  className={cn("size-3.5 text-amber-300", isSyncing && "animate-spin")}
                />
                <span className="studio-tabular">{pendingCount} pendente(s)</span>
              </button>
            ) : (
              <span className="hidden items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-medium text-emerald-400 sm:inline-flex">
                <CheckCircle2 className="size-3.5" />
                <span>PostgreSQL Ativo</span>
              </span>
            )}

            <Link
              to="/"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-[var(--color-muted)] transition-colors hover:border-purple-500/35 hover:bg-purple-500/10 hover:text-white"
              title="Abrir o site público do Hikari"
            >
              <ExternalLink className="size-3.5" />
              <span className="hidden sm:inline">Ver Site</span>
            </Link>
          </div>
        </header>

        {/* Conteúdo das Rotas Administrativas */}
        <main className="mx-auto w-full max-w-[1520px] flex-1 px-4 py-6 pb-16 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default HikariStudioLayout;
