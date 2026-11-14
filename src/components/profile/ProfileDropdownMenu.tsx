import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { User, ShieldCheck, LogOut, Loader2 } from "lucide-react";
import { isHikariAdmin } from "@/lib/auth/admin";
import { signOut } from "@/lib/auth/client";
import type { AppUser } from "@/lib/auth/use-current-user";
import { getProfile } from "@/lib/profile.functions";
import { cn } from "@/lib/utils";

interface ProfileDropdownMenuProps {
  user: AppUser;
}

function useDropdownPresence(open: boolean, exitMs = 150) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setVisible(false);
      let raf2 = 0;
      const raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => {
          setVisible(true);
        });
      });
      return () => {
        window.cancelAnimationFrame(raf1);
        window.cancelAnimationFrame(raf2);
      };
    }

    setVisible(false);
    const timer = window.setTimeout(() => {
      setMounted(false);
    }, exitMs);
    return () => window.clearTimeout(timer);
  }, [open, exitMs]);

  return {
    mounted: open || mounted,
    visible,
    closing: !open && mounted,
  };
}

const profileMetaCache = new Map<
  string,
  { image: string | null; nick: string | null }
>();

export function ProfileDropdownMenu({ user }: ProfileDropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [customAvatar, setCustomAvatar] = useState<string | null>(
    () => profileMetaCache.get(user.id)?.image ?? user.profileImageUrl ?? null,
  );
  const [customNick, setCustomNick] = useState<string | null>(
    () => profileMetaCache.get(user.id)?.nick ?? user.profileNick ?? null,
  );
  const [imgError, setImgError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dropdown = useDropdownPresence(open, 150);

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
        const nextImage = data.image ?? null;
        const nextNick = data.nick ?? null;
        profileMetaCache.set(user.id, { image: nextImage, nick: nextNick });
        if (nextImage) {
          setCustomAvatar(nextImage);
          setImgError(false);
        }
        if (nextNick) setCustomNick(nextNick);
      })
      .catch(() => {});

    const handleProfileUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ image?: string | null; nick?: string }>;
      const prev = profileMetaCache.get(user.id) ?? {
        image: customAvatar,
        nick: customNick,
      };
      const nextImage =
        customEvent.detail?.image !== undefined ? customEvent.detail.image : prev.image;
      const nextNick =
        customEvent.detail?.nick !== undefined ? customEvent.detail.nick : prev.nick;
      profileMetaCache.set(user.id, { image: nextImage ?? null, nick: nextNick ?? null });
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

  // Fecha ao clicar fora ou pressionar Escape
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

  const avatarSrc = !imgError ? customAvatar || user.profileImageUrl || null : null;
  const displayName = user.displayName || customNick || "Membro";
  const initial = (user.displayName || customNick || user.primaryEmail || "U")
    .trim()
    .charAt(0)
    .toUpperCase();

  const isProfileActive = pathname.startsWith("/account") || pathname.startsWith("/profile");

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await signOut();
    } catch {
      setIsLoggingOut(false);
    }
  };

  return (
    <div ref={menuRef} className="relative inline-block shrink-0 text-left">
      {/* Botão de Perfil: Avatar Circular Premium com Halo Ametista */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "group relative flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-full select-none cursor-pointer",
          "motion-safe:transition-[transform,box-shadow,ring-color] motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:active:scale-95 motion-reduce:transition-none motion-reduce:transform-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c084fc]",
          open
            ? "ring-2 ring-[#c084fc] shadow-[0_0_20px_rgba(192,132,252,0.45)]"
            : "ring-1 ring-purple-500/30 hover:ring-purple-400/60 hover:shadow-[0_0_16px_rgba(168,85,247,0.25)]",
        )}
        aria-label="Menu de perfil do usuário"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt={displayName}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="size-full rounded-full object-cover motion-safe:transition-transform motion-safe:duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center rounded-full bg-gradient-to-br from-[#261b45] to-[#120f24] text-xs sm:text-sm font-bold text-[#c084fc] shadow-inner ring-1 ring-purple-400/30">
            {initial}
          </div>
        )}
      </button>

      {/* Menu Suspenso Reformulado — Dark Obsidian & Amethyst */}
      {dropdown.mounted && (
        <div
          role="menu"
          aria-label="Opções do perfil"
          className={cn(
            "absolute right-0 top-full mt-2.5 w-60 sm:w-64 origin-top-right overflow-hidden rounded-2xl border border-purple-500/25 bg-[#0b0914]/98 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.85)] backdrop-blur-2xl z-50 font-sans",
            "motion-safe:transition-[opacity,transform] motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none motion-reduce:transform-none",
            dropdown.visible
              ? "opacity-100 translate-y-0 scale-100"
              : "opacity-0 -translate-y-2 scale-[0.95]",
            dropdown.closing && "pointer-events-none",
          )}
        >
          {/* Linha de acento violeta elegante no topo */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-400/60 to-transparent"
          />

          {/* Cabeçalho do Card com Identificação do Usuário */}
          <div className="mb-2 flex items-center gap-3 border-b border-white/[0.08] px-3 py-2.5 bg-white/[0.02] rounded-xl">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="size-9 shrink-0 rounded-full object-cover ring-2 ring-purple-500/40 shadow-md"
              />
            ) : (
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#261b45] to-[#120f24] text-xs font-bold text-[#c084fc] ring-2 ring-purple-500/40 shadow-inner">
                {initial}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold leading-tight tracking-tight text-white">
                {displayName}
              </p>
              {user.primaryEmail && (
                <p className="mt-0.5 truncate text-[11px] leading-snug text-purple-300/80 font-medium">
                  {user.primaryEmail}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            {/* 1. Meu Perfil */}
            <Link
              to="/account"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={cn(
                "group flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs sm:text-[13px] font-medium",
                "motion-safe:transition-[background-color,color,transform,box-shadow] motion-safe:duration-150 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:active:scale-[0.98] motion-reduce:transition-none motion-reduce:transform-none",
                isProfileActive
                  ? "bg-purple-500/20 text-purple-100 font-semibold ring-1 ring-purple-400/35 shadow-[0_0_12px_rgba(168,85,247,0.2)]"
                  : "text-zinc-200 hover:bg-white/[0.08] hover:text-white",
              )}
            >
              <div className="flex size-7 items-center justify-center rounded-lg bg-purple-500/15 text-purple-300 group-hover:bg-purple-500/25 group-hover:text-purple-200 transition-colors">
                <User className="size-4" />
              </div>
              <span className="truncate">Meu Perfil</span>
            </Link>

            {/* 2. Painel Admin (quando autorizado) */}
            {user.primaryEmail && isHikariAdmin(user.primaryEmail) && (
              <Link
                to="/admin"
                role="menuitem"
                onClick={() => setOpen(false)}
                className={cn(
                  "group flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs sm:text-[13px] font-medium text-amber-300/90",
                  "hover:bg-amber-500/12 hover:text-amber-200",
                  "motion-safe:transition-[background-color,color,transform] motion-safe:duration-150 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:active:scale-[0.98] motion-reduce:transition-none motion-reduce:transform-none",
                )}
              >
                <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 group-hover:bg-amber-500/25 group-hover:text-amber-300 transition-colors">
                  <ShieldCheck className="size-4" />
                </div>
                <span className="truncate">Painel Admin</span>
              </Link>
            )}

            {/* Separador sutil */}
            <div aria-hidden="true" className="my-1.5 h-px bg-white/[0.07]" />

            {/* 3. Sair (Logout) */}
            <button
              type="button"
              role="menuitem"
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
              className={cn(
                "group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs sm:text-[13px] font-medium text-rose-300/90",
                "hover:bg-rose-500/12 hover:text-rose-200 cursor-pointer disabled:opacity-50",
                "motion-safe:transition-[background-color,color,transform] motion-safe:duration-150 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:active:scale-[0.98] motion-reduce:transition-none motion-reduce:transform-none",
              )}
            >
              <div className="flex size-7 items-center justify-center rounded-lg bg-rose-500/15 text-rose-400 group-hover:bg-rose-500/25 group-hover:text-rose-300 transition-colors">
                {isLoggingOut ? (
                  <Loader2 className="size-4 animate-spin text-rose-400" />
                ) : (
                  <LogOut className="size-4" />
                )}
              </div>
              <span className="truncate">Sair</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
