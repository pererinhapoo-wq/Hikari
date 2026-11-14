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
  Clock,
  Command,
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
  Search,
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
import { usePublicSettings } from "@/lib/settings/use-public-settings";
import { useScrollLock } from "@/lib/scroll-lock";
import { cn } from "@/lib/utils";
import "@/styles/admin-studio.css";

interface StudioLayoutProps {
  children: ReactNode;
}

interface NavItem {
  id: string;
  label: string;
  description: string;
  icon: typeof LayoutDashboard;
  to: string;
  keywords?: string;
  statusTag?: string;
  statusTone?: "default" | "emerald" | "amber" | "rose" | "violet";
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
  const { settings: publicSettings } = usePublicSettings();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [quickJumpOpen, setQuickJumpOpen] = useState(false);
  const [quickJumpQuery, setQuickJumpQuery] = useState("");
  const [outboxOps, setOutboxOps] = useState<OutboxOperation[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useScrollLock(mobileDrawerOpen || quickJumpOpen);

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
    setQuickJumpOpen(false);
    setQuickJumpQuery("");
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuickJumpOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        if (quickJumpOpen) setQuickJumpOpen(false);
        if (mobileDrawerOpen) setMobileDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileDrawerOpen, quickJumpOpen]);

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
  const maintenanceActive = Boolean(publicSettings.maintenance?.active);

  const navCategories: NavCategory[] = useMemo(
    () => [
      {
        title: "Central",
        items: [
          {
            id: "overview",
            label: "Central de Controle",
            description: "Resumo operacional, status e atalhos",
            icon: LayoutDashboard,
            to: "/admin",
            keywords: "dashboard inicio home resumo controle",
          },
          {
            id: "catalog",
            label: "Catálogo de Animes",
            description: "Listagem, busca, filtros e edição de títulos",
            icon: Film,
            to: "/admin",
            keywords: "animes catalogo titulos temporadas episodios",
          },
          {
            id: "new-anime",
            label: "Novo Cadastro",
            description: "Criar novo título manualmente",
            icon: Plus,
            to: "/admin/new",
            keywords: "criar adicionar novo anime",
          },
        ],
      },
      {
        title: "Mídia & Players",
        items: [
          {
            id: "quick-update",
            label: "Atualização Rápida",
            description: "Trocar links de players 1 a 5",
            icon: Zap,
            to: "/admin/quick-update",
            keywords: "player video url link mp4 hls",
            statusTag: "Players",
            statusTone: "violet",
          },
          {
            id: "images",
            label: "Central de Imagens",
            description: "Capas, banners, miniaturas e avatares",
            icon: ImageIcon,
            to: "/admin/images",
            keywords: "imagens galeria capas banners thumbnails",
          },
        ],
      },
      {
        title: "Comunidade & IA",
        items: [
          {
            id: "users",
            label: "Usuários & Acessos",
            description: "Contas registradas e permissões admin",
            icon: Users,
            to: "/admin/users",
            keywords: "contas usuarios admins permissoes perfis",
          },
          {
            id: "moderation",
            label: "Moderação",
            description: "Comentários denunciados e resoluções",
            icon: ShieldAlert,
            to: "/admin/moderation",
            keywords: "denuncias comentarios reports moderacao",
          },
          {
            id: "hikari-ai",
            label: "Hikari AI",
            description: "Testes de revisão editorial Gemini e Groq",
            icon: Sparkles,
            to: "/admin/hikari-ai",
            keywords: "ia gemini groq noticias teste",
            statusTag: "IA",
            statusTone: "violet",
          },
        ],
      },
      {
        title: "Sistema & Infra",
        items: [
          {
            id: "settings",
            label: "Configurações Gerais",
            description: "Identidade, preferências, avisos e módulos",
            icon: SlidersHorizontal,
            to: "/admin/settings",
            keywords: "configuracoes marca slogan avisos modulos",
          },
          {
            id: "maintenance",
            label: "Manutenção",
            description: "Modo manutenção, caches e diagnóstico DB",
            icon: Wrench,
            to: "/admin/maintenance",
            keywords: "manutencao cache postgres tabelas",
            statusTag: maintenanceActive ? "Ativa" : undefined,
            statusTone: maintenanceActive ? "rose" : "default",
          },
          {
            id: "health",
            label: "Saúde do Sistema",
            description: "Latência, volume de tabelas e runtime",
            icon: Activity,
            to: "/admin/health",
            keywords: "saude diagnostico latencia uptime node",
          },
          {
            id: "backup",
            label: "Backup e Dados",
            description: "Exportação e restauração segura em JSON",
            icon: HardDriveDownload,
            to: "/admin/backup",
            keywords: "backup exportar importar restaurar json",
          },
          {
            id: "database-sync",
            label: "Banco & Outbox",
            description: "Sincronização local com PostgreSQL",
            icon: Database,
            to: "/admin",
            keywords: "outbox sync postgresql fila conflitos",
            statusTag:
              conflictCount > 0
                ? `${conflictCount} conflito`
                : pendingCount > 0
                  ? `${pendingCount} fila`
                  : "OK",
            statusTone:
              conflictCount > 0
                ? "rose"
                : pendingCount > 0
                  ? "amber"
                  : "emerald",
          },
        ],
      },
    ],
    [conflictCount, pendingCount, maintenanceActive],
  );

  const allNavItems = useMemo(
    () =>
      navCategories.flatMap((cat) =>
        cat.items.map((item) => ({ ...item, category: cat.title })),
      ),
    [navCategories],
  );

  const filteredQuickJump = useMemo(() => {
    const q = quickJumpQuery.trim().toLowerCase();
    if (!q) return allNavItems;
    return allNavItems.filter((item) =>
      `${item.label} ${item.description} ${item.category} ${item.keywords ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [allNavItems, quickJumpQuery]);

  const isItemActive = (item: NavItem) => {
    if (item.id === "overview") {
      return pathname === "/admin" || pathname === "/admin/";
    }
    if (item.id === "catalog") {
      return (
        pathname.startsWith("/admin/") &&
        pathname !== "/admin/new" &&
        pathname !== "/admin/moderation" &&
        pathname !== "/admin/hikari-ai" &&
        pathname !== "/admin/quick-update" &&
        pathname !== "/admin/settings" &&
        !pathname.startsWith("/admin/users") &&
        !pathname.startsWith("/admin/maintenance") &&
        !pathname.startsWith("/admin/images") &&
        !pathname.startsWith("/admin/health") &&
        !pathname.startsWith("/admin/backup")
      );
    }
    if (item.id === "new-anime") {
      return pathname === "/admin/new";
    }
    if (item.id === "database-sync") {
      return false;
    }
    return pathname.startsWith(item.to);
  };

  const breadcrumb = useMemo(() => {
    if (pathname === "/admin" || pathname === "/admin/") {
      return { section: "Central", current: "Visão Geral & Catálogo" };
    }
    if (pathname.startsWith("/admin/quick-update")) {
      return { section: "Mídia & Players", current: "Atualização Rápida" };
    }
    if (pathname.startsWith("/admin/images")) {
      return { section: "Mídia & Players", current: "Central de Imagens" };
    }
    if (pathname.startsWith("/admin/users")) {
      return { section: "Comunidade & IA", current: "Usuários & Acessos" };
    }
    if (pathname.startsWith("/admin/moderation")) {
      return { section: "Comunidade & IA", current: "Moderação" };
    }
    if (pathname.startsWith("/admin/hikari-ai")) {
      return { section: "Comunidade & IA", current: "Hikari AI" };
    }
    if (pathname.startsWith("/admin/health")) {
      return { section: "Sistema & Infra", current: "Saúde do Sistema" };
    }
    if (pathname.startsWith("/admin/maintenance")) {
      return { section: "Sistema & Infra", current: "Manutenção" };
    }
    if (pathname.startsWith("/admin/backup")) {
      return { section: "Sistema & Infra", current: "Backup e Dados" };
    }
    if (pathname.startsWith("/admin/settings")) {
      return { section: "Sistema & Infra", current: "Configurações Gerais" };
    }
    if (pathname.startsWith("/admin/")) {
      const parts = pathname.split("/");
      if (parts[2] === "new") {
        return { section: "Central", current: "Novo Cadastro" };
      }
      return { section: "Catálogo", current: "Editor de Anime" };
    }
    return { section: "Console", current: "Hikari Studio" };
  }, [pathname]);

  const handleNavigateItem = (item: NavItem) => {
    setMobileDrawerOpen(false);
    setQuickJumpOpen(false);
    if (item.id === "catalog") {
      setTimeout(() => {
        document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" });
      }, 90);
    } else if (item.id === "database-sync") {
      setTimeout(() => {
        document.getElementById("system-status")?.scrollIntoView({ behavior: "smooth" });
      }, 90);
    }
  };

  const renderNavContent = (isDrawer = false) => (
    <div className="flex h-full flex-col justify-between gap-5">
      <div className="space-y-5">
        {/* Marca Exclusiva Hikari Studio */}
        <div className="flex items-center justify-between border-b border-[var(--studio-line)] pb-4">
          <Link
            to="/admin"
            className="group flex items-center gap-3 transition-opacity hover:opacity-90"
            onClick={() => setMobileDrawerOpen(false)}
          >
            <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-violet-500/40 bg-violet-500/15 font-display text-base font-bold text-violet-200">
              光
            </div>
            <div className="flex flex-col leading-none">
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-[15px] font-bold tracking-wide text-[var(--color-fg)]">
                  Hikari
                </span>
                <span className="studio-mono text-[10px] font-bold uppercase tracking-[0.16em] text-violet-300">
                  Studio
                </span>
              </div>
              <span className="mt-1 text-[10px] tracking-[0.12em] text-[var(--color-subtle)] uppercase">
                Console Editorial
              </span>
            </div>
          </Link>

          {isDrawer && (
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(false)}
              className="flex size-10 items-center justify-center rounded-lg border border-[var(--studio-line)] bg-[var(--studio-panel)] text-[var(--color-muted)] hover:text-[var(--color-fg)] lg:hidden"
              aria-label="Fechar menu de navegação"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Estado Rápido de Operação & Manutenção */}
        <div className="rounded-xl border border-[var(--studio-line)] bg-[var(--studio-panel)] divide-y divide-[var(--studio-line)]">
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 text-xs">
            <span className="text-[11px] font-medium text-[var(--color-muted)]">
              PostgreSQL
            </span>
            <span
              className={cn(
                "studio-mono inline-flex items-center gap-1.5 text-[11px] font-semibold",
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

          {maintenanceActive && (
            <Link
              to="/admin/maintenance"
              onClick={() => setMobileDrawerOpen(false)}
              className="flex items-center justify-between gap-2 bg-rose-500/10 px-3 py-2 text-[11px] font-semibold text-rose-300 transition-colors hover:bg-rose-500/15"
            >
              <span className="inline-flex items-center gap-1.5">
                <Wrench className="size-3" />
                Modo Manutenção
              </span>
              <span className="studio-mono uppercase">Ativo</span>
            </Link>
          )}

          {totalOutboxCount > 0 && (
            <div className="p-2">
              <button
                type="button"
                disabled={isSyncing}
                onClick={handleManualSync}
                className="flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-200 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
              >
                <RefreshCw
                  className={cn("size-3.5", isSyncing && "animate-spin")}
                />
                <span>
                  {isSyncing ? "Sincronizando..." : "Sincronizar Outbox"}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Navegação Agrupada */}
        <nav className="space-y-5" aria-label="Navegação do Hikari Studio">
          {navCategories.map((category) => (
            <div key={category.title} className="space-y-1">
              <p className="px-2.5 pb-0.5 text-[10px] font-bold tracking-[0.18em] text-[var(--color-subtle)] uppercase">
                {category.title}
              </p>
              <div className="space-y-0.5">
                {category.items.map((item) => {
                  const active = isItemActive(item);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.id}
                      to={item.to}
                      onClick={() => handleNavigateItem(item)}
                      className={cn(
                        "group relative flex min-h-10 items-center justify-between rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                        active
                          ? "bg-[var(--studio-accent-soft)] text-white border border-[var(--studio-accent-border)]"
                          : "border border-transparent text-[var(--color-muted)] hover:bg-white/[0.04] hover:text-[var(--color-fg)]",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Icon
                          className={cn(
                            "size-4 shrink-0 transition-colors",
                            active
                              ? "text-violet-300"
                              : "text-[var(--color-subtle)] group-hover:text-[var(--color-fg)]",
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {item.statusTag && (
                        <span
                          className={cn(
                            "studio-mono shrink-0 text-[10px] font-semibold",
                            item.statusTone === "emerald" && "text-emerald-400",
                            item.statusTone === "amber" && "text-amber-300",
                            item.statusTone === "rose" && "text-rose-400",
                            item.statusTone === "violet" && "text-violet-300",
                            (!item.statusTone || item.statusTone === "default") &&
                              "text-[var(--color-subtle)]",
                          )}
                        >
                          {item.statusTag}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Rodapé da Sidebar */}
      <div className="space-y-2.5 border-t border-[var(--studio-line)] pt-4">
        <Link
          to="/"
          className="group flex min-h-10 w-full items-center justify-between rounded-lg border border-[var(--studio-line)] bg-[var(--studio-panel)] px-3 py-2 text-xs text-[var(--color-muted)] transition-colors hover:border-[var(--studio-accent-border)] hover:text-white"
        >
          <div className="flex items-center gap-2">
            <ArrowLeft className="size-3.5 text-violet-400 transition-transform group-hover:-translate-x-0.5" />
            <span className="font-medium">Abrir Hikari Público</span>
          </div>
          <ExternalLink className="size-3 opacity-60 group-hover:text-violet-300 group-hover:opacity-100" />
        </Link>

        <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--studio-line)] bg-[var(--studio-panel)] p-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid size-8 shrink-0 place-items-center rounded-md border border-violet-500/35 bg-violet-500/15 text-xs font-bold text-violet-200">
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
                {user?.primaryEmail || "admin@hikari"}
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
            className="flex size-9 shrink-0 items-center justify-center rounded-md text-[var(--color-muted)] transition-colors hover:bg-rose-500/15 hover:text-rose-300"
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
    <div className="hikari-studio-root antialiased selection:bg-violet-600/30 selection:text-white">
      {/* Sidebar Desktop Fixa */}
      <aside className="studio-scroll fixed inset-y-0 left-0 z-30 hidden w-[268px] flex-col overflow-y-auto border-r border-[var(--studio-line)] bg-[var(--studio-rail)] p-4 lg:flex">
        {renderNavContent(false)}
      </aside>

      {/* Drawer Mobile */}
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

          <div className="studio-scroll fixed inset-y-0 left-0 w-72 max-w-[86vw] overflow-y-auto border-r border-[var(--studio-line-strong)] bg-[var(--studio-rail)] p-4 shadow-2xl">
            {renderNavContent(true)}
          </div>
        </div>
      )}

      {/* Quick Module Switcher (Ctrl+K / ⌘K) */}
      {quickJumpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 p-4 pt-16 backdrop-blur-sm sm:pt-24"
          role="dialog"
          aria-modal="true"
          aria-label="Alternar módulo do Hikari Studio"
        >
          <div
            className="fixed inset-0"
            onClick={() => setQuickJumpOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-[var(--studio-line-strong)] bg-[var(--studio-panel)] shadow-2xl">
            <div className="flex items-center gap-2.5 border-b border-[var(--studio-line)] px-4 py-3">
              <Search className="size-4 shrink-0 text-violet-300" />
              <input
                type="text"
                autoFocus
                value={quickJumpQuery}
                onChange={(e) => setQuickJumpQuery(e.target.value)}
                placeholder="Ir para módulo administrativo..."
                className="w-full bg-transparent text-sm text-[var(--color-fg)] placeholder:text-[var(--color-subtle)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setQuickJumpOpen(false)}
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-[var(--color-muted)] hover:bg-white/[0.06] hover:text-white"
                aria-label="Fechar busca de módulos"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="studio-scroll max-h-[60dvh] divide-y divide-[var(--studio-line-soft)] overflow-y-auto p-2">
              {filteredQuickJump.length === 0 ? (
                <p className="py-8 text-center text-xs text-[var(--color-muted)]">
                  Nenhum módulo corresponde a "{quickJumpQuery}".
                </p>
              ) : (
                filteredQuickJump.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.id}
                      to={item.to}
                      onClick={() => handleNavigateItem(item)}
                      className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-[var(--studio-accent-soft)]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid size-8 shrink-0 place-items-center rounded-md border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] text-violet-300">
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-[var(--color-fg)]">
                            {item.label}
                          </p>
                          <p className="truncate text-[11px] text-[var(--color-muted)]">
                            {item.description}
                          </p>
                        </div>
                      </div>
                      <span className="studio-mono shrink-0 text-[10px] text-[var(--color-subtle)]">
                        {item.category}
                      </span>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Área Principal */}
      <div className="flex min-h-dvh w-full flex-1 flex-col overflow-x-hidden lg:pl-[268px]">
        {/* Topbar Sticky */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-[var(--studio-line)] bg-[var(--studio-canvas)]/92 px-4 backdrop-blur-md sm:h-16 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--studio-line)] bg-[var(--studio-panel)] text-[var(--color-fg)] hover:border-[var(--studio-line-strong)] lg:hidden"
              aria-label="Abrir menu lateral"
            >
              <Menu className="size-4" />
            </button>

            <div className="flex min-w-0 items-center gap-2 text-xs">
              <Link
                to="/admin"
                className="shrink-0 font-semibold text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
              >
                Hikari Studio
              </Link>
              <span className="text-white/20">/</span>
              <span className="hidden truncate text-[var(--color-subtle)] sm:inline">
                {breadcrumb.section}
              </span>
              <span className="hidden text-white/20 sm:inline">/</span>
              <span className="truncate font-semibold text-violet-300">
                {breadcrumb.current}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* Atalho rápido de módulos */}
            <button
              type="button"
              onClick={() => setQuickJumpOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--studio-line)] bg-[var(--studio-panel)] px-2.5 text-xs text-[var(--color-muted)] transition-colors hover:border-[var(--studio-accent-border)] hover:text-[var(--color-fg)] whitespace-nowrap shrink-0"
              title="Alternar módulo (Ctrl+K)"
            >
              <Command className="size-3.5 text-violet-400" />
              <span className="hidden md:inline">Módulos</span>
              <kbd className="studio-mono hidden rounded border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] px-1.5 py-0.5 text-[10px] text-[var(--color-subtle)] lg:inline">
                Ctrl+K
              </kbd>
            </button>

            {maintenanceActive && (
              <Link
                to="/admin/maintenance"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-500/35 bg-rose-500/12 px-2.5 text-[11px] font-semibold text-rose-300 transition-colors hover:bg-rose-500/20 whitespace-nowrap shrink-0"
                title="Modo de manutenção ativo no site público"
              >
                <Wrench className="size-3.5" />
                <span className="hidden sm:inline">Manutenção Ativa</span>
              </Link>
            )}

            {conflictCount > 0 ? (
              <Link
                to="/admin"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-500/35 bg-rose-500/12 px-2.5 text-[11px] font-semibold text-rose-300 transition-colors hover:bg-rose-500/20 whitespace-nowrap shrink-0"
              >
                <AlertTriangle className="size-3.5 text-rose-400" />
                <span className="studio-tabular">{conflictCount} conflito(s)</span>
              </Link>
            ) : pendingCount > 0 ? (
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncing}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-500/12 px-2.5 text-[11px] font-semibold text-amber-200 transition-colors hover:bg-amber-500/20 disabled:opacity-50 whitespace-nowrap shrink-0"
                title="Clique para sincronizar com o PostgreSQL"
              >
                <RefreshCw
                  className={cn("size-3.5 text-amber-300", isSyncing && "animate-spin")}
                />
                <span className="studio-tabular">{pendingCount} pendente(s)</span>
              </button>
            ) : null}

            <Link
              to="/"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--studio-line)] bg-[var(--studio-panel)] px-3 text-xs font-medium text-[var(--color-muted)] transition-colors hover:border-[var(--studio-accent-border)] hover:text-white whitespace-nowrap shrink-0"
              title="Abrir o site público do Hikari"
            >
              <ExternalLink className="size-3.5" />
              <span className="hidden sm:inline">Ver Site</span>
            </Link>
          </div>
        </header>

        {/* Conteúdo das Rotas Administrativas */}
        <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-6 pb-16 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default HikariStudioLayout;
