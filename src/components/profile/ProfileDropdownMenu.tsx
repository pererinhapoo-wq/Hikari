import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, Settings, Settings2, UserCircle } from "lucide-react";
import { isHikariAdmin } from "@/lib/auth/admin";
import { signOut } from "@/lib/auth/client";
import type { AppUser } from "@/lib/auth/use-current-user";
import { getProfile } from "@/lib/profile.functions";
import { cn } from "@/lib/utils";

interface ProfileDropdownMenuProps {
  user: AppUser;
}

export function ProfileDropdownMenu({ user }: ProfileDropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const [customNick, setCustomNick] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });

  // Fecha o menu ao navegar para qualquer página
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Carrega avatar customizado e nick do perfil
  useEffect(() => {
    if (!user.id) return;
    let active = true;

    void getProfile()
      .then((data) => {
        if (!active || !data) return;
        if (data.image) setCustomAvatar(data.image);
        if (data.nick) setCustomNick(data.nick);
      })
      .catch(() => {});

    const handleProfileUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ image?: string | null; nick?: string }>;
      if (customEvent.detail?.image !== undefined) {
        setCustomAvatar(customEvent.detail.image);
        setImgError(false);
      }
      if (customEvent.detail?.nick) {
        setCustomNick(customEvent.detail.nick);
      }
    };

    window.addEventListener("hikari:profile-updated", handleProfileUpdated);
    return () => {
      active = false;
      window.removeEventListener("hikari:profile-updated", handleProfileUpdated);
    };
  }, [user.id]);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleLogout = useCallback(async () => {
    setOpen(false);
    try {
      await signOut();
      window.location.reload();
    } catch (err) {
      console.warn("Erro ao encerrar sessão:", err);
      window.location.reload();
    }
  }, []);

  const handleNavigateToSettings = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    void navigate({ to: "/settings-privacy" });
  };

  const avatarSrc = !imgError ? customAvatar || user.profileImageUrl || null : null;
  const displayName = user.displayName || customNick || "Membro";
  const displayHandle = customNick ? `@${customNick}` : user.primaryEmail || "";
  const initial = (user.displayName || customNick || user.primaryEmail || "U")
    .trim()
    .charAt(0)
    .toUpperCase();

  const isProfileActive = pathname.startsWith("/account");
  const isSettingsActive = pathname.startsWith("/settings-privacy");
  const isProfileRoute =
    pathname.startsWith("/account") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/settings-privacy");

  return (
    <div ref={menuRef} className="relative inline-block text-left">
      {/* Botão de Perfil: Avatar Circular Elegante e Discreto */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "group relative flex size-9 sm:size-10 items-center justify-center rounded-full transition-all duration-200 select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a855f7]",
          open
            ? "ring-2 ring-[#a855f7]/70 shadow-[0_0_16px_rgba(168,85,247,0.3)]"
            : "ring-1 ring-white/15 hover:ring-white/30 hover:shadow-[0_0_12px_rgba(255,255,255,0.1)] active:scale-95",
        )}
        aria-label="Menu de perfil do usuário"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt={displayName}
            onError={() => setImgError(true)}
            className="size-full rounded-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center rounded-full bg-gradient-to-br from-[#1d1730] to-[#120f22] text-xs sm:text-sm font-bold text-[#c084fc] shadow-inner">
            {initial}
          </div>
        )}
      </button>

      {/* Menu Suspenso */}
      {open && (
        <div
          role="menu"
          aria-label="Opções do perfil"
          className="absolute right-0 top-full mt-2.5 w-60 sm:w-64 origin-top-right overflow-hidden rounded-2xl border border-white/10 bg-[#12101e]/95 p-1.5 shadow-[0_12px_36px_rgba(0,0,0,0.7)] backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Identificação do Usuário */}
          <div className="border-b border-white/[0.08] px-3 py-2.5 mb-1">
            <p className="truncate text-xs font-semibold text-fg">
              {displayName}
            </p>
            {displayHandle && (
              <p className="truncate text-[11px] text-muted font-mono mt-0.5">
                {displayHandle}
              </p>
            )}
          </div>

          <div className="space-y-0.5">
            {/* 1. Meu Perfil */}
            <Link
              to="/account"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium transition-colors",
                isProfileActive
                  ? "bg-[#a855f7]/15 text-[#c084fc] font-semibold"
                  : "text-fg/90 hover:bg-white/[0.06] hover:text-white",
              )}
            >
              <UserCircle className="size-4 text-[#c084fc] shrink-0" />
              <span>Meu Perfil</span>
            </Link>

            {/* 2. Configurações do Perfil (Exibição contextual em rotas de perfil) */}
            {isProfileRoute && (
              <button
                type="button"
                role="menuitem"
                onClick={handleNavigateToSettings}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium transition-colors text-left cursor-pointer",
                  isSettingsActive
                    ? "bg-[#a855f7]/15 text-[#c084fc] font-semibold"
                    : "text-fg/90 hover:bg-white/[0.06] hover:text-white",
                )}
              >
                <Settings className="size-4 text-[#c084fc] shrink-0" />
                <span>Configurações do Perfil</span>
              </button>
            )}

            {/* Opção administrativa se aplicável */}
            {user.primaryEmail && isHikariAdmin(user.primaryEmail) && (
              <Link
                to="/admin"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-amber-300/90 hover:bg-amber-500/10 hover:text-amber-200 transition-colors"
              >
                <Settings2 className="size-4 text-amber-400 shrink-0" />
                <span>Painel Admin</span>
              </Link>
            )}
          </div>

          <div className="my-1 border-t border-white/[0.08]" />

          {/* 3. Sair */}
          <button
            type="button"
            role="menuitem"
            onClick={() => void handleLogout()}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors cursor-pointer text-left"
          >
            <LogOut className="size-4 shrink-0" />
            <span>Sair</span>
          </button>
        </div>
      )}
    </div>
  );
}
