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
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
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
  statusTone?: "default" | "emerald" | "amber" | "rose" | "cobalt";
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
        title: "Catálogo & Acervo",
        items: [
          {
            id: "overview",
            label: "Visão Geral",
            description: "Resumo operacional, métricas e fila",
            icon: LayoutDashboard,
            to: "/admin",
            keywords: "dashboard inicio home resumo controle",
          },
          {
            id: "catalog",
            label: "Acervo de Animes",
            description: "Listagem, filtros e edição de títulos",
            icon: Film,
            to: "/admin",
            keywords: "animes catalogo titulos temporadas episodios",
          },
          {
            id: "new-anime",
            label: "Novo Título",
            description: "Cadastrar anime manualmente",
            icon: Plus,
            to: "/admin/new",
            keywords: "criar adicionar novo anime",
          },
          {
            id: "quick-update",
            label: "Atualização Rápida",
            description: "Trocar links dos Players 1 a 5",
            icon: Zap,
            to: "/admin/quick-update",
            keywords: "player video url link mp4 hls",
            statusTag: "Players",
            statusTone: "cobalt",
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
        title: "Comunidade & Moderação",
        items: [
          {
            id: "moderation",
            label: "Comentários & Moderação",
            description: "Comentários, denúncias e banimentos",
            icon: MessageSquare,
            to: "/admin/moderation",
            keywords: "denuncias comentarios reports moderacao banimentos ban",
            statusTag: "Central",
            statusTone: "cobalt",
          },
          {
            id: "users",
            label: "Usuários & Acessos",
            description: "Contas, cargos admin e suspensões",
            icon: Users,
            to: "/admin/users",
            keywords: "contas usuarios admins permissoes perfis banir",
          },
          {
            id: "hikari-ai",
            label: "Hikari AI",
            description: "Testes de revisão editorial Gemini e Groq",
            icon: Sparkles,
            to: "/admin/hikari-ai",
            keywords: "ia gemini groq noticias teste",
          },
        ],
      },
      {
        title: "Sistema & Infraestrutura",
        items: [
          {
            id: "settings",
            label: "Configurações Gerais",
            description: "Marca, preferências, avisos e módulos",
            icon: SlidersHorizontal,
            to: "/admin/settings",
            keywords: "configuracoes marca slogan avisos modulos",
          },
          {
            id: "maintenance",
            label: "Manutenção & Cache",
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
            label: "Backup & Dados",
            description: "Exportação e restauração segura em JSON",
            icon: HardDriveDownload,
            to: "/admin/backup",
            keywords: "backup exportar importar restaurar json",
          },
          {
            id: "database-sync",
            label: "PostgreSQL & Outbox",
            description: "Sincronização local com o banco",
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

  const isAnimeEditorRoute =
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
    !pathname.startsWith("/admin/backup");

  const isItemActive = (item: NavItem) => {
    if (item.id === "overview") {
      return pathname === "/admin" || pathname === "/admin/";
    }
    if (item.id === "catalog") {
      return isAnimeEditorRoute;
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
      return { section: "Catálogo & Acervo", current: "Visão Geral" };
    }
    if (pathname.startsWith("/admin/quick-update")) {
      return { section: "Catálogo & Acervo", current: "Atualização Rápida" };
    }
    if (pathname.startsWith("/admin/images")) {
      return { section: "Catálogo & Acervo", current: "Central de Imagens" };
    }
    if (pathname.startsWith("/admin/users")) {
      return {
        section: "Comunidade & Moderação",
        current: "Usuários & Acessos",
      };
    }
    if (pathname.startsWith("/admin/moderation")) {
      return {
        section: "Comunidade & Moderação",
        current: "Comentários & Moderação",
      };
    }
    if (pathname.startsWith("/admin/hikari-ai")) {
      return { section: "Comunidade & Moderação", current: "Hikari AI" };
    }
    if (pathname.startsWith("/admin/health")) {
      return { section: "Sistema & Infra", current: "Saúde do Sistema" };
    }
    if (pathname.startsWith("/admin/maintenance")) {
      return { section: "Sistema & Infra", current: "Manutenção & Cache" };
    }
    if (pathname.startsWith("/admin/backup")) {
      return { section: "Sistema & Infra", current: "Backup & Dados" };
    }
    if (pathname.startsWith("/admin/settings")) {
      return { section: "Sistema & Infra", current: "Configurações Gerais" };
    }
    if (pathname.startsWith("/admin/")) {
      const parts = pathname.split("/");
      if (parts[2] === "new") {
        return { section: "Catálogo & Acervo", current: "Novo Título" };
      }
      return { section: "Catálogo & Acervo", current: "Editor de Anime" };
    }
    return { section: "Console", current: "Hikari Console" };
  }, [pathname]);

  const handleNavigateItem = (item: NavItem) => {
    setMobileDrawerOpen(false);
    setQuickJumpOpen(false);
    if (item.id === "catalog") {
      setTimeout(() => {
        document
          .getElementById("catalog")
          ?.scrollIntoView({ behavior: "smooth" });
      }, 90);
    } else if (item.id === "database-sync") {
      setTimeout(() => {
        document
          .getElementById("system-status")
          ?.scrollIntoView({ behavior: "smooth" });
      }, 90);
    }
  };

  const renderNavContent = (isDrawer = false) => (
    <div className="flex h-full flex-col justify-between gap-5">
      <div className="space-y-5">
        {/* Marca Exclusiva — Hikari Architectural Console */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <Link
            to="/admin"
            className="group flex items-center gap-3 transition-opacity hover:opacity-90"
            onClick={() => setMobileDrawerOpen(false)}
          >
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-700 font-display text-base font-bold text-white shadow-sm">
              光
            </div>
            <div className="flex flex-col leading-none">
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-[15px] font-bold tracking-tight text-slate-900">
                  Hikari
                </span>
                <span className="studio-mono rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 border border-blue-200">
                  Admin
                </span>
              </div>
              <span className="mt-1 text-[10px] font-medium tracking-wider text-slate-500 uppercase">
                Console Editorial
              </span>
            </div>
          </Link>

          {isDrawer && (
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(false)}
              className="flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
              aria-label="Fechar menu de navegação"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Estado Rápido de Operação & Manutenção */}
        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 text-xs">
            <span className="text-[11px] font-medium text-slate-600">
              PostgreSQL
            </span>
            <span
              className={cn(
                "studio-mono inline-flex items-center gap-1.5 text-[11px] font-semibold",
                conflictCount > 0
                  ? "text-rose-700"
                  : pendingCount > 0
                    ? "text-amber-700"
                    : "text-emerald-700",
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
              className="flex items-center justify-between gap-2 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-100"
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
                className="flex min-h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-50"
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
        <nav className="space-y-5" aria-label="Navegação do Console Admin">
          {navCategories.map((category) => (
            <div key={category.title} className="space-y-1">
              <p className="px-2.5 pb-0.5 text-[10px] font-bold tracking-[0.14em] text-slate-400 uppercase">
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
                        "group relative flex min-h-9 items-center justify-between rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                        active
                          ? "border border-blue-200 bg-blue-50 text-blue-800 font-semibold"
                          : "border border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Icon
                          className={cn(
                            "size-4 shrink-0 transition-colors",
                            active
                              ? "text-blue-700"
                              : "text-slate-400 group-hover:text-slate-700",
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {item.statusTag && (
                        <span
                          className={cn(
                            "studio-mono shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold",
                            item.statusTone === "emerald" &&
                              "bg-emerald-50 text-emerald-700",
                            item.statusTone === "amber" &&
                              "bg-amber-50 text-amber-700",
                            item.statusTone === "rose" &&
                              "bg-rose-50 text-rose-700",
                            item.statusTone === "cobalt" &&
                              "bg-blue-100/80 text-blue-700",
                            (!item.statusTone ||
                              item.statusTone === "default") &&
                              "text-slate-500",
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
      <div className="space-y-2.5 border-t border-slate-200 pt-4">
        <Link
          to="/"
          className="group flex min-h-9 w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-800"
        >
          <div className="flex items-center gap-2">
            <ArrowLeft className="size-3.5 text-blue-600 transition-transform group-hover:-translate-x-0.5" />
            <span className="font-medium">Abrir Hikari Público</span>
          </div>
          <ExternalLink className="size-3 opacity-60 group-hover:text-blue-600 group-hover:opacity-100" />
        </Link>

        <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid size-8 shrink-0 place-items-center rounded-md border border-blue-200 bg-blue-50 text-xs font-bold text-blue-700">
              {user?.displayName
                ? user.displayName.charAt(0).toUpperCase()
                : user?.primaryEmail
                  ? user.primaryEmail.charAt(0).toUpperCase()
                  : "A"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-900">
                {user?.displayName || "Administrador"}
              </p>
              <p className="studio-mono truncate text-[10px] text-slate-500">
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
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-700"
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
    <div className="hikari-studio-root antialiased selection:bg-blue-600 selection:text-white">
      {/* Rail Desktop Fixa */}
      <aside className="studio-scroll fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col overflow-y-auto border-r border-slate-200 bg-white p-4 lg:flex">
        {renderNavContent(false)}
      </aside>

      {/* Drawer Mobile */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navegação do Console Administrativo"
        >
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
            aria-hidden="true"
          />

          <div className="studio-scroll fixed inset-y-0 left-0 w-72 max-w-[86vw] overflow-y-auto border-r border-slate-200 bg-white p-4 shadow-2xl">
            {renderNavContent(true)}
          </div>
        </div>
      )}

      {/* Quick Module Switcher (Ctrl+K / ⌘K) */}
      {quickJumpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 p-4 pt-16 backdrop-blur-xs sm:pt-24"
          role="dialog"
          aria-modal="true"
          aria-label="Alternar módulo administrativo"
        >
          <div
            className="fixed inset-0"
            onClick={() => setQuickJumpOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center gap-2.5 border-b border-slate-200 px-4 py-3">
              <Search className="size-4 shrink-0 text-blue-600" />
              <input
                type="text"
                autoFocus
                value={quickJumpQuery}
                onChange={(e) => setQuickJumpQuery(e.target.value)}
                placeholder="Ir para módulo administrativo..."
                className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setQuickJumpOpen(false)}
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                aria-label="Fechar busca de módulos"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="studio-scroll max-h-[60dvh] divide-y divide-slate-100 overflow-y-auto p-2">
              {filteredQuickJump.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-500">
                  Nenhum módulo corresponde a &quot;{quickJumpQuery}&quot;.
                </p>
              ) : (
                filteredQuickJump.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.id}
                      to={item.to}
                      onClick={() => handleNavigateItem(item)}
                      className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-blue-50"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid size-8 shrink-0 place-items-center rounded-md border border-slate-200 bg-slate-50 text-blue-700">
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-900">
                            {item.label}
                          </p>
                          <p className="truncate text-[11px] text-slate-500">
                            {item.description}
                          </p>
                        </div>
                      </div>
                      <span className="studio-mono shrink-0 text-[10px] text-slate-400">
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
      <div className="flex min-h-dvh w-full flex-1 flex-col overflow-x-hidden lg:pl-[264px]">
        {/* Topbar Sticky */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md sm:h-16 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 lg:hidden"
              aria-label="Abrir menu lateral"
            >
              <Menu className="size-4" />
            </button>

            <div className="flex min-w-0 items-center gap-2 text-xs">
              <Link
                to="/admin"
                className="shrink-0 font-semibold text-slate-500 transition-colors hover:text-slate-900"
              >
                Hikari Console
              </Link>
              <span className="text-slate-300">/</span>
              <span className="hidden truncate text-slate-500 sm:inline">
                {breadcrumb.section}
              </span>
              <span className="hidden text-slate-300 sm:inline">/</span>
              <span className="truncate font-semibold text-blue-700">
                {breadcrumb.current}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* Atalho rápido de módulos */}
            <button
              type="button"
              onClick={() => setQuickJumpOpen(true)}
              className="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-600 transition-colors hover:border-blue-300 hover:bg-white hover:text-slate-900"
              title="Alternar módulo (Ctrl+K)"
            >
              <Command className="size-3.5 text-blue-600" />
              <span className="hidden md:inline">Módulos</span>
              <kbd className="studio-mono hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-500 lg:inline">
                Ctrl+K
              </kbd>
            </button>

            {maintenanceActive && (
              <Link
                to="/admin/maintenance"
                className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                title="Modo de manutenção ativo no site público"
              >
                <Wrench className="size-3.5" />
                <span className="hidden sm:inline">Manutenção Ativa</span>
              </Link>
            )}

            {conflictCount > 0 ? (
              <Link
                to="/admin"
                className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-100"
              >
                <AlertTriangle className="size-3.5 text-rose-600" />
                <span className="studio-tabular">{conflictCount} conflito(s)</span>
              </Link>
            ) : pendingCount > 0 ? (
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncing}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-[11px] font-semibold text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-50"
                title="Clique para sincronizar com o PostgreSQL"
              >
                <RefreshCw
                  className={cn(
                    "size-3.5 text-amber-600",
                    isSyncing && "animate-spin",
                  )}
                />
                <span className="studio-tabular">{pendingCount} pendente(s)</span>
              </button>
            ) : null}

            <Link
              to="/admin/$id"
              params={{ id: "new" }}
              className="hidden h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-700 px-3 text-xs font-semibold text-white transition-colors hover:bg-blue-800 md:inline-flex"
            >
              <Plus className="size-3.5" />
              <span>Novo Anime</span>
            </Link>

            <Link
              to="/"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-700"
              title="Abrir o site público do Hikari"
            >
              <ExternalLink className="size-3.5" />
              <span className="hidden sm:inline">Ver Site</span>
            </Link>
          </div>
        </header>

        {/* Conteúdo das Rotas Administrativas */}
        <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-12">
          {children}
        </main>
      </div>

      {/* Dock Mobile Inferior (oculto no editor de anime que já possui EditorMobileBar) */}
      {!isAnimeEditorRoute && (
        <nav
          aria-label="Acesso rápido mobile"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 py-1.5 backdrop-blur-md lg:hidden"
        >
          <div className="grid grid-cols-5 gap-1">
            {[
              {
                label: "Central",
                to: "/admin",
                icon: LayoutDashboard,
                active: pathname === "/admin" || pathname === "/admin/",
              },
              {
                label: "Comentários",
                to: "/admin/moderation",
                icon: MessageSquare,
                active: pathname.startsWith("/admin/moderation"),
              },
              {
                label: "Usuários",
                to: "/admin/users",
                icon: Users,
                active: pathname.startsWith("/admin/users"),
              },
              {
                label: "Players",
                to: "/admin/quick-update",
                icon: Zap,
                active: pathname.startsWith("/admin/quick-update"),
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-[10px] font-semibold transition-colors",
                    item.active
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  <Icon className="size-4" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-[10px] font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <Menu className="size-4" />
              <span>Menu</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

export default HikariStudioLayout;
