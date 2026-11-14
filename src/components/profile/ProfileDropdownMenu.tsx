import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Settings2 } from "lucide-react";
import { isHikariAdmin } from "@/lib/auth/admin";
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

  return (
    <div ref={menuRef} className="relative inline-block shrink-0 text-left">
      {/* Botão de Perfil: Avatar Circular Elegante e Discreto */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "group relative flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-full select-none",
          "motion-safe:transition-[transform,box-shadow,ring-color] motion-safe:duration-150 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:active:scale-95 motion-reduce:transition-none motion-reduce:transform-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a855f7]",
          open
            ? "ring-2 ring-[#a855f7]/75 shadow-[0_0_16px_rgba(168,85,247,0.32)]"
            : "ring-1 ring-white/15 hover:ring-white/30 hover:shadow-[0_0_12px_rgba(255,255,255,0.1)]",
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
            className="size-full rounded-full object-cover motion-safe:transition-transform motion-safe:duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center rounded-full bg-gradient-to-br from-[#1d1730] to-[#120f22] text-xs sm:text-sm font-bold text-[#c084fc] shadow-inner">
            {initial}
          </div>
        )}
      </button>

      {/* Menu Suspenso Compacto */}
      {dropdown.mounted && (
        <div
          role="menu"
          aria-label="Opções do perfil"
          className={cn(
            "absolute right-0 top-full mt-2 w-48 sm:w-52 origin-top-right overflow-hidden rounded-xl border border-purple-500/20 bg-[#0c0a17]/98 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.7)] backdrop-blur-2xl z-50 font-sans",
            "motion-safe:transition-[opacity,transform] motion-safe:duration-150 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none motion-reduce:transform-none",
            dropdown.visible
              ? "opacity-100 translate-y-0 scale-100"
              : "opacity-0 -translate-y-1.5 scale-[0.96]",
            dropdown.closing && "pointer-events-none",
          )}
        >
          {/* Linha de acento violeta sutil */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-400/40 to-transparent"
          />

          {/* Identificação do Usuário */}
          <div className="mb-1 border-b border-white/[0.07] px-2.5 py-2">
            <p className="truncate text-[12px] font-semibold leading-snug tracking-tight text-zinc-100">
              {displayName}
            </p>
            {user.primaryEmail && (
              <p className="mt-0.5 truncate text-[11px] leading-snug text-purple-300/90 font-medium">
                {user.primaryEmail}
              </p>
            )}
          </div>

          <div className="space-y-0.5">
            {/* 1. Meu Perfil com avatar circular da conta */}
            <Link
              to="/account"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={cn(
                "group flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs sm:text-[13px] font-medium",
                "motion-safe:transition-[background-color,color,transform,box-shadow] motion-safe:duration-150 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:active:scale-[0.97] motion-reduce:transition-none motion-reduce:transform-none",
                isProfileActive
                  ? "bg-purple-500/15 text-purple-200 font-semibold ring-1 ring-purple-400/25"
                  : "text-zinc-200 hover:bg-white/[0.06] hover:text-white",
              )}
            >
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt=""
                  aria-hidden="true"
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="size-5 shrink-0 rounded-full object-cover bg-[#171326] ring-1 ring-purple-400/35"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex size-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#231942] to-[#120f22] text-[10px] font-bold text-[#c084fc] ring-1 ring-purple-400/30 select-none"
                >
                  {initial}
                </span>
              )}
              <span className="truncate">Meu Perfil</span>
            </Link>

            {/* Opção administrativa se aplicável */}
            {user.primaryEmail && isHikariAdmin(user.primaryEmail) && (
              <Link
                to="/admin"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs sm:text-[13px] font-medium text-amber-300/90 hover:bg-amber-500/10 hover:text-amber-200 motion-safe:transition-[background-color,color,transform] motion-safe:duration-150 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:active:scale-[0.97] motion-reduce:transition-none motion-reduce:transform-none"
              >
                <Settings2 className="size-3.5 text-amber-400 shrink-0" />
                <span className="truncate">Painel Admin</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
