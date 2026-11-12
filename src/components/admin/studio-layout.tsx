import {
  Link,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Database,
  ExternalLink,
  Film,
  HardDriveDownload,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
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

interface StudioLayoutProps {
  children: ReactNode;
}

interface NavItem {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  to?: string;
  badge?: string;
  badgeVariant?: "default" | "amber" | "emerald" | "purple";
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
  const [outboxOps, setOutboxOps] = useState<OutboxOperation[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Trava a rolagem da página quando o drawer mobile está aberto
  useScrollLock(mobileDrawerOpen);

  // Monitora o estado da Outbox
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

  // Fecha o drawer em mudanças de rota ou tecla Escape
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

  // Sincronização manual do Outbox
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

  const pendingCount = outboxOps.length;
  const conflictCount = outboxOps.filter((o) => o.status === "conflict").length;

  // Definição da estrutura de navegação planejada para o Hikari Studio
  const navCategories: NavCategory[] = useMemo(
    () => [
      {
        title: "Gerenciamento",
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
            id: "quick-update",
            label: "Atualização Rápida",
            icon: Zap,
            to: "/admin",
            badge: "Players",
            badgeVariant: "purple",
          },
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
          {
            id: "users",
            label: "Usuários",
            icon: Users,
            comingSoon: true,
            disabled: true,
          },
        ],
      },
      {
        title: "Sistema",
        items: [
          {
            id: "database-sync",
            label: "Banco & Outbox",
            icon: Database,
            to: "/admin",
            badge: pendingCount > 0 ? `${pendingCount} pendente(s)` : "Ativo",
            badgeVariant: pendingCount > 0 ? "amber" : "emerald",
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
      },
    ],
    [pendingCount],
  );

  // Determina se um item da navegação está ativo com base na rota atual
  const isItemActive = (item: NavItem) => {
    if (!item.to) return false;
    if (item.id === "overview") {
      return pathname === "/admin" || pathname === "/admin/";
    }
    if (item.id === "catalog") {
      return (
        pathname === "/admin" ||
        (pathname.startsWith("/admin/") &&
          pathname !== "/admin/moderation" &&
          pathname !== "/admin/hikari-ai")
      );
    }
    if (item.id === "moderation") {
      return pathname.startsWith("/admin/moderation");
    }
    if (item.id === "hikari-ai") {
      return pathname.startsWith("/admin/hikari-ai");
    }
    return false;
  };

  // Determina o breadcrumb textual atual
  const breadcrumb = useMemo(() => {
    if (pathname === "/admin" || pathname === "/admin/") {
      return { section: "Gerenciamento", current: "Visão Geral & Catálogo" };
    }
    if (pathname.startsWith("/admin/moderation")) {
      return { section: "Comunidade", current: "Moderação de Denúncias" };
    }
    if (pathname.startsWith("/admin/hikari-ai")) {
      return { section: "Inteligência Artificial", current: "Hikari AI Central" };
    }
    if (pathname.startsWith("/admin/")) {
      const parts = pathname.split("/");
      const idPart = parts[2];
      if (idPart === "new") {
        return { section: "Catálogo", current: "Novo Anime" };
      }
      return { section: "Catálogo", current: "Editar Anime" };
    }
    return { section: "Painel", current: "Studio" };
  }, [pathname]);

  // Conteúdo da barra de navegação compartilhada (desktop sidebar + mobile drawer)
  const renderNavContent = (isDrawer = false) => (
    <div className="flex h-full flex-col justify-between">
      <div className="space-y-6">
        {/* Topo da Sidebar: Identidade HIKARI STUDIO */}
        <div className="flex items-center justify-between px-2 pt-1 pb-2">
          <Link
            to="/admin"
            className="group flex items-center gap-3 transition-opacity hover:opacity-90"
            onClick={() => setMobileDrawerOpen(false)}
          >
            <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-purple-500/30 bg-gradient-to-br from-purple-600/30 to-purple-950/60 font-bold text-sm text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
              光
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-display text-base font-semibold tracking-wider text-fg">
                  HIKARI
                </span>
                <span className="rounded border border-purple-500/35 bg-purple-500/15 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-purple-300">
                  STUDIO
                </span>
              </div>
              <span className="text-[10px] tracking-widest text-muted uppercase">
                Console de Controle
              </span>
            </div>
          </Link>

          {/* Botão de fechar (somente no mobile drawer) */}
          {isDrawer && (
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(false)}
              className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-white/5 hover:text-fg lg:hidden"
              aria-label="Fechar navegação"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Indicador de Status do Banco / Conexão */}
        <div className="rounded-lg border border-white/[0.06] bg-elevated/60 p-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-medium text-muted">
              Conexão com PostgreSQL
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "size-2 rounded-full",
                  pendingCount > 0
                    ? "animate-pulse bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                    : "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]",
                )}
              />
              <span
                className={cn(
                  "font-mono text-[10px]",
                  pendingCount > 0 ? "text-amber-300" : "text-emerald-400",
                )}
              >
                {pendingCount > 0 ? `${pendingCount} fila` : "Sincronizado"}
              </span>
            </div>
          </div>

          {pendingCount > 0 && (
            <button
              type="button"
              disabled={isSyncing}
              onClick={handleManualSync}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 py-1 text-[11px] font-medium text-amber-200 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
            >
              <RefreshCw
                className={cn("size-3", isSyncing && "animate-spin")}
              />
              <span>{isSyncing ? "Sincronizando..." : "Sincronizar agora"}</span>
            </button>
          )}
        </div>

        {/* Categorias e Itens de Navegação */}
        <nav className="space-y-5" aria-label="Navegação Administrativa">
          {navCategories.map((category) => (
            <div key={category.title} className="space-y-1">
              <p className="px-2.5 text-[10px] font-bold tracking-[0.2em] text-muted/70 uppercase">
                {category.title}
              </p>
              <div className="space-y-0.5">
                {category.items.map((item) => {
                  const active = isItemActive(item);
                  const Icon = item.icon;

                  if (item.disabled || !item.to) {
                    return (
                      <div
                        key={item.id}
                        className="flex cursor-not-allowed items-center justify-between rounded-lg px-2.5 py-2 text-xs text-muted/40"
                        title="Funcionalidade planejada para etapas futuras"
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="size-4 shrink-0 opacity-40" />
                          <span>{item.label}</span>
                        </div>
                        {item.comingSoon && (
                          <span className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] text-muted/60">
                            Em breve
                          </span>
                        )}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.id}
                      to={item.to}
                      onClick={() => {
                        setMobileDrawerOpen(false);
                        if (item.id === "quick-update") {
                          setTimeout(() => {
                            document
                              .getElementById("quick-update")
                              ?.scrollIntoView({ behavior: "smooth" });
                          }, 60);
                        } else if (item.id === "catalog") {
                          setTimeout(() => {
                            document
                              .getElementById("catalog")
                              ?.scrollIntoView({ behavior: "smooth" });
                          }, 60);
                        }
                      }}
                      className={cn(
                        "group flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-[background-color,color,box-shadow]",
                        active
                          ? "border border-purple-500/30 bg-purple-500/15 text-white shadow-[0_0_12px_rgba(168,85,247,0.15)]"
                          : "text-muted hover:bg-white/[0.05] hover:text-fg",
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={cn(
                            "size-4 shrink-0 transition-colors",
                            active
                              ? "text-purple-400"
                              : "text-muted group-hover:text-fg",
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {item.badge && (
                        <span
                          className={cn(
                            "shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider",
                            item.badgeVariant === "emerald" &&
                              "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
                            item.badgeVariant === "amber" &&
                              "border border-amber-500/30 bg-amber-500/10 text-amber-300",
                            item.badgeVariant === "purple" &&
                              "border border-purple-500/30 bg-purple-500/15 text-purple-300",
                            (!item.badgeVariant ||
                              item.badgeVariant === "default") &&
                              "bg-white/5 text-muted",
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
        </nav>
      </div>

      {/* Rodapé da Sidebar: Perfil + Retorno ao Site Público */}
      <div className="space-y-3 pt-4 border-t border-white/[0.08]">
        {/* Opção para voltar ao site público (Requisito obrigatório) */}
        <Link
          to="/"
          className="group flex w-full items-center justify-between rounded-lg border border-white/[0.08] bg-elevated/40 px-3 py-2 text-xs text-muted transition-colors hover:border-purple-500/30 hover:bg-purple-500/10 hover:text-white"
        >
          <div className="flex items-center gap-2">
            <ArrowLeft className="size-3.5 text-purple-400 transition-transform group-hover:-translate-x-0.5" />
            <span className="font-medium">Voltar ao site público</span>
          </div>
          <ExternalLink className="size-3 text-muted/60 group-hover:text-purple-300" />
        </Link>

        {/* Card do Administrador Atual */}
        <div className="flex items-center justify-between gap-2 rounded-lg bg-surface/80 p-2 border border-white/[0.05]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid size-8 shrink-0 place-items-center rounded-full bg-purple-600/20 border border-purple-500/30 text-xs font-bold text-purple-300">
              {user?.displayName ? (
                user.displayName.charAt(0).toUpperCase()
              ) : user?.primaryEmail ? (
                user.primaryEmail.charAt(0).toUpperCase()
              ) : (
                "A"
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-fg">
                {user?.displayName || "Administrador"}
              </p>
              <p className="truncate font-mono text-[10px] text-muted">
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
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-white/10 hover:text-danger transition-colors"
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
    <div className="min-h-screen bg-[#08070d] text-[#f4f4f1] antialiased selection:bg-purple-600/30 selection:text-white">
      {/* =========================================================
          1. SIDEBAR FIXA DESKTOP (Aparece a partir de lg: 1024px)
      ========================================================== */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:w-72 flex-col border-r border-white/[0.08] bg-[#0c0a14] p-4 lg:flex shadow-xl overflow-y-auto">
        {renderNavContent(false)}
      </aside>

      {/* =========================================================
          2. DRAWER MOBILE ACESSÍVEL (Para telas menores que lg)
      ========================================================== */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          {/* Backdrop escuro com blur */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Painel lateral deslizante */}
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] border-r border-white/10 bg-[#0c0a14] p-4 shadow-2xl overflow-y-auto">
            {renderNavContent(true)}
          </div>
        </div>
      )}

      {/* =========================================================
          3. ÁREA DE CONTEÚDO PRINCIPAL (COM MARGEM DA SIDEBAR)
      ========================================================== */}
      <div className="flex flex-1 flex-col lg:pl-72 w-full overflow-x-hidden min-h-screen">
        {/* Barra Superior / Header do Studio */}
        <header className="sticky top-0 z-20 flex h-14 sm:h-16 items-center justify-between border-b border-white/[0.08] bg-[#08070d]/90 px-4 sm:px-6 backdrop-blur-md">
          {/* Lado Esquerdo: Botão Mobile + Breadcrumbs */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="flex size-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-fg hover:bg-white/[0.08] lg:hidden"
              aria-label="Abrir menu lateral"
            >
              <Menu className="size-4" />
            </button>

            {/* Breadcrumb visual hierárquico */}
            <div className="flex items-center gap-1.5 text-xs">
              <Link
                to="/admin"
                className="font-medium text-muted hover:text-fg transition-colors"
              >
                Hikari Studio
              </Link>
              <span className="text-muted/40">/</span>
              <span className="text-muted/80">{breadcrumb.section}</span>
              <span className="text-muted/40">/</span>
              <span className="font-semibold text-purple-300">
                {breadcrumb.current}
              </span>
            </div>
          </div>

          {/* Lado Direito: Status e Ações Rápidas */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Chip de Status do Outbox no Topbar */}
            {conflictCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-300">
                <span className="size-1.5 rounded-full bg-red-400 animate-ping" />
                {conflictCount} conflito(s)
              </span>
            ) : pendingCount > 0 ? (
              <button
                type="button"
                onClick={handleManualSync}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-200 transition-colors hover:bg-amber-500/20"
                title="Clique para sincronizar com o PostgreSQL"
              >
                <span className="size-1.5 rounded-full bg-amber-400" />
                <span>{pendingCount} pendente(s)</span>
              </button>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
                <CheckCircle2 className="size-3 text-emerald-400" />
                PostgreSQL Ativo
              </span>
            )}

            {/* Botão de Atalho para o Site Público no Topbar */}
            <Link
              to="/"
              className="inline-flex h-8 sm:h-9 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 text-xs font-medium text-muted hover:border-purple-500/30 hover:bg-purple-500/10 hover:text-white transition-colors"
              title="Abrir o site público do Hikari"
            >
              <ExternalLink className="size-3.5" />
              <span className="hidden sm:inline">Ver Site</span>
            </Link>
          </div>
        </header>

        {/* Contêiner de Conteúdo das Páginas Administrativas */}
        <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-12">
          {children}
        </main>
      </div>
    </div>
  );
}

export default HikariStudioLayout;
