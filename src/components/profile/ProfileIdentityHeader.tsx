import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  Camera,
  Clock,
  ExternalLink,
  Lock,
  MoreHorizontal,
  Pencil,
  Shield,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileIdentityHeaderProps {
  name: string;
  nick: string;
  bio: string;
  image: string | null;
  bannerUrl?: string | null;
  accountType?: "public" | "private";
  isOwner?: boolean;
  followersCount: number;
  followingCount: number;
  requestsCount?: number;
  commentCount: number;
  totalTrackingCount: number;
  favorites: string[];
  onOpenEdit?: () => void;
  onRemoveBanner?: () => void;
  onOpenPrivacy?: () => void;
  onOpenFollowers: () => void;
  onOpenFollowing: () => void;
  onOpenRequests?: () => void;
}

export function ProfileIdentityHeader({
  name,
  nick,
  bio,
  image,
  bannerUrl,
  accountType = "public",
  isOwner = true,
  followersCount,
  followingCount,
  requestsCount = 0,
  commentCount,
  totalTrackingCount,
  favorites,
  onOpenEdit,
  onRemoveBanner,
  onOpenPrivacy,
  onOpenFollowers,
  onOpenFollowing,
  onOpenRequests,
}: ProfileIdentityHeaderProps) {
  const displayHandle = nick ? `@${nick}` : "@hikari_membro";
  const initial = (nick || name || "U").charAt(0).toUpperCase();

  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Fecha o menu de três pontinhos ao clicar fora ou pressionar Escape
  useEffect(() => {
    if (!moreMenuOpen) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMoreMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [moreMenuOpen]);

  return (
    <header className="relative z-10 w-full overflow-hidden rounded-2xl border border-purple-900/30 bg-[#130E24] shadow-[0_16px_50px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
      {/* 1. Banner Panorâmico do Perfil */}
      <div className="relative h-[192px] sm:h-[256px] md:h-[320px] min-h-[192px] sm:min-h-[256px] md:min-h-[320px] w-full overflow-hidden bg-gradient-to-br from-purple-950 via-[#18112e] to-[#0A0713]">
        {bannerUrl ? (
          <>
            <img
              src={bannerUrl}
              alt="Banner do perfil"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover object-center"
            />
            {/* Gradiente escurecedor suave para manter legibilidade das badges e contraste do avatar */}
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#130E24] via-[#130E24]/30 to-transparent"
              aria-hidden="true"
            />
          </>
        ) : (
          <>
            {/* Luzes dinâmicas e texturas no banner padrão */}
            <div className="h-full w-full bg-gradient-to-r from-purple-950/70 via-indigo-950/50 to-[#130E24]" />
            <div
              className="pointer-events-none absolute -left-12 -top-12 size-60 rounded-full bg-violet-500/25 blur-[70px]"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute right-10 top-0 size-72 rounded-full bg-purple-600/20 blur-[80px]"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(168,85,247,0.15),transparent_70%)]"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#130E24] via-[#130E24]/30 to-transparent"
              aria-hidden="true"
            />
          </>
        )}

        {/* Controles do Banner (Trocar e Remover Banner) & Indicador de Privacidade */}
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 flex items-center gap-2">
          {isOwner && onOpenEdit && (
            <>
              <button
                type="button"
                onClick={onOpenEdit}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-black/60 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-medium text-white backdrop-blur-md shadow-md transition-all hover:bg-black/80 hover:border-violet-500/50 cursor-pointer"
                title="Trocar banner do perfil"
              >
                <Camera className="size-3.5 text-violet-300" />
                <span>Trocar Banner</span>
              </button>
              {bannerUrl && (
                <button
                  type="button"
                  onClick={onRemoveBanner || onOpenEdit}
                  className="inline-flex size-7 sm:size-8 items-center justify-center rounded-xl border border-white/20 bg-black/60 text-zinc-300 backdrop-blur-md shadow-md transition-all hover:bg-rose-950/80 hover:border-rose-500/50 hover:text-rose-200 cursor-pointer"
                  title="Remover banner"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={onOpenPrivacy}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium backdrop-blur-md shadow-md transition-all ${
              accountType === "private"
                ? "border-amber-500/30 bg-black/60 text-amber-300 hover:border-amber-500/50 hover:bg-black/80"
                : "border-emerald-500/30 bg-black/60 text-emerald-300 hover:border-emerald-500/50 hover:bg-black/80"
            } ${onOpenPrivacy ? "cursor-pointer" : "cursor-default"}`}
            title={onOpenPrivacy ? "Clique para gerenciar a privacidade do seu perfil" : undefined}
          >
            {accountType === "private" ? (
              <>
                <Lock className="size-3 text-amber-400" />
                <span>Perfil Privado</span>
              </>
            ) : (
              <>
                <Shield className="size-3 text-emerald-400" />
                <span>Perfil Público</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Conteúdo de Identidade com Avatar Sobreposto ao Banner */}
      <div className="relative px-4 pb-6 sm:px-8 pt-0 sm:pt-0">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-16 sm:-mt-20">
          {/* Avatar e Identidade Principal (Nome e Username posicionados ao lado do avatar, abaixo do banner) */}
          <div className="flex flex-row items-end gap-3.5 sm:gap-4 min-w-0">
            {/* Avatar Container com dimensões e moldura geométrica da referência */}
            <div className="relative group shrink-0">
              <div
                className={`h-[112px] w-[112px] sm:h-[144px] sm:w-[144px] rounded-2xl overflow-hidden border-4 border-[#130E24] bg-[#1a1333] shadow-xl shadow-black/80 ring-2 ring-purple-600/40 ${isOwner && onOpenEdit ? "cursor-pointer" : ""}`}
                onClick={isOwner ? onOpenEdit : undefined}
                title={isOwner ? "Editar foto e informações do perfil" : name || nick}
              >
                {image ? (
                  <img
                    src={image}
                    alt={name || nick || "Foto de perfil"}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-800 to-indigo-900 text-3xl sm:text-4xl font-bold text-white select-none">
                    {initial}
                  </div>
                )}
              </div>

              {/* Botão de câmera para substituir a foto */}
              {isOwner && onOpenEdit && (
                <button
                  type="button"
                  onClick={onOpenEdit}
                  className="absolute -bottom-1 -right-1 flex size-7 sm:size-8 items-center justify-center rounded-xl border border-white/20 bg-purple-600 text-white shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer z-10"
                  title="Substituir foto de perfil"
                >
                  <Camera className="size-3.5 sm:size-4" />
                </button>
              )}
            </div>

            {/* Nome de Exibição, Selos e Username posicionados ao lado do avatar */}
            <div className="space-y-1 pb-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                <h1 className="truncate font-display text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-white">
                  {name || nick || "Membro do Hikari"}
                </h1>

                {nick && (
                  <span title="Perfil Verificado">
                    <BadgeCheck className="size-5 sm:size-6 text-violet-400 fill-violet-500/20" />
                  </span>
                )}

                <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-violet-300">
                  <Sparkles className="size-3" />
                  <span>Hikari Persona</span>
                </span>
              </div>

              {/* Username (@handle) */}
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs sm:text-sm font-medium text-purple-400">
                  {displayHandle}
                </span>

                {nick && (
                  <Link
                    to="/profile/$nick"
                    params={{ nick }}
                    className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-violet-300 transition-colors"
                    title="Abrir como perfil público"
                  >
                    <ExternalLink className="size-3" />
                    <span className="hidden sm:inline">Página pública</span>
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Botões de Ações Rápidas do Perfil */}
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-end pt-2 sm:pt-0">
            {/* Botão Existente: Personalizar Perfil */}
            {isOwner && onOpenEdit && (
              <button
                type="button"
                onClick={onOpenEdit}
                className="inline-flex items-center gap-2 rounded-xl border border-violet-500/40 bg-gradient-to-r from-violet-600 to-purple-600 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-[0_0_20px_rgba(168,85,247,0.35)] transition-all hover:brightness-110 active:scale-98 cursor-pointer"
              >
                <Pencil className="size-3.5" />
                <span>Personalizar Perfil</span>
              </button>
            )}

            {/* Botão Existente: Privacidade */}
            {onOpenPrivacy && (
              <button
                type="button"
                onClick={onOpenPrivacy}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-medium text-zinc-200 transition-all hover:bg-white/[0.1] hover:text-white cursor-pointer"
                title="Configurações de privacidade do perfil"
              >
                {accountType === "private" ? (
                  <Lock className="size-3.5 text-amber-400" />
                ) : (
                  <Shield className="size-3.5 text-emerald-400" />
                )}
                <span className="hidden sm:inline">Privacidade</span>
              </button>
            )}

            {/* Menu de Três Pontinhos Horizontal (···) no canto direito */}
            <div ref={moreMenuRef} className="relative inline-block text-left">
              <button
                type="button"
                onClick={() => setMoreMenuOpen((prev) => !prev)}
                className={cn(
                  "inline-flex size-9 sm:size-10 items-center justify-center rounded-xl border transition-all duration-200 select-none cursor-pointer",
                  moreMenuOpen
                    ? "border-violet-500/60 bg-violet-600/25 text-white shadow-[0_0_15px_rgba(168,85,247,0.35)]"
                    : "border-white/10 bg-white/[0.05] text-zinc-300 hover:border-white/20 hover:bg-white/[0.1] hover:text-white active:scale-95",
                )}
                aria-label="Mais opções do perfil"
                aria-haspopup="menu"
                aria-expanded={moreMenuOpen}
                title="Mais opções do perfil"
              >
                <MoreHorizontal className="size-4 sm:size-5" />
              </button>

              {/* Menu Suspenso de Três Pontinhos */}
              {moreMenuOpen && (
                <div
                  role="menu"
                  aria-label="Opções do perfil"
                  className="absolute right-0 top-full mt-2 w-56 sm:w-60 origin-top-right overflow-hidden rounded-2xl border border-white/10 bg-[#12101e]/98 p-1.5 shadow-[0_14px_40px_rgba(0,0,0,0.8)] backdrop-blur-2xl z-40 animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="px-3 py-1.5 border-b border-white/[0.08] mb-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                      Ações do Perfil
                    </p>
                  </div>

                  <div className="space-y-0.5">
                    {/* Personalizar Perfil (somente dono) */}
                    {isOwner && onOpenEdit && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMoreMenuOpen(false);
                          onOpenEdit();
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-fg/90 hover:bg-white/[0.08] hover:text-white transition-colors text-left cursor-pointer"
                      >
                        <Pencil className="size-4 text-violet-400 shrink-0" />
                        <span>Personalizar Perfil</span>
                      </button>
                    )}

                    {/* Privacidade do Perfil */}
                    {onOpenPrivacy && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMoreMenuOpen(false);
                          onOpenPrivacy();
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-fg/90 hover:bg-white/[0.08] hover:text-white transition-colors text-left cursor-pointer"
                      >
                        {accountType === "private" ? (
                          <Lock className="size-4 text-amber-400 shrink-0" />
                        ) : (
                          <Shield className="size-4 text-emerald-400 shrink-0" />
                        )}
                        <span>Privacidade do Perfil</span>
                      </button>
                    )}

                    {/* Ver Página Pública */}
                    {nick && (
                      <Link
                        to="/profile/$nick"
                        params={{ nick }}
                        role="menuitem"
                        onClick={() => setMoreMenuOpen(false)}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-fg/90 hover:bg-white/[0.08] hover:text-white transition-colors text-left"
                      >
                        <ExternalLink className="size-4 text-sky-400 shrink-0" />
                        <span>Ver Perfil Público</span>
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. Biografia e Tags de Destaque */}
        <div className="mt-4 space-y-2.5">
          {bio ? (
            <p className="max-w-2xl text-xs sm:text-sm leading-relaxed text-zinc-300/90 whitespace-pre-wrap">
              {bio}
            </p>
          ) : (
            <p className="max-w-xl text-xs sm:text-sm italic text-zinc-500">
              Nenhuma biografia definida ainda. Clique em "Personalizar Perfil" para adicionar sua frase de destaque.
            </p>
          )}

          {/* Tags de Favoritos / Interesses se houver */}
          {favorites.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Destaques:
              </span>
              {favorites.slice(0, 5).map((fav, i) => (
                <span
                  key={i}
                  className="rounded-md border border-white/[0.06] bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-zinc-300"
                >
                  {fav}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 4. Conexões e Métricas Sociais: Seguidores & Seguindo */}
        <div className="mt-5 flex flex-wrap items-center gap-2 sm:gap-3 border-t border-white/[0.06] pt-4">
          <button
            type="button"
            onClick={onOpenFollowers}
            className="group inline-flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2 text-xs transition-all hover:border-violet-500/30 hover:bg-violet-500/10"
          >
            <Users className="size-3.5 text-violet-400 transition-transform group-hover:scale-110" />
            <span className="font-bold text-white tabular-nums">
              {followersCount}
            </span>
            <span className="text-zinc-400 group-hover:text-zinc-200">
              Seguidores
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenFollowing}
            className="group inline-flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2 text-xs transition-all hover:border-violet-500/30 hover:bg-violet-500/10"
          >
            <Users className="size-3.5 text-sky-400 transition-transform group-hover:scale-110" />
            <span className="font-bold text-white tabular-nums">
              {followingCount}
            </span>
            <span className="text-zinc-400 group-hover:text-zinc-200">
              Seguindo
            </span>
          </button>

          {requestsCount > 0 && onOpenRequests && (
            <button
              type="button"
              onClick={onOpenRequests}
              className="group inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs transition-all hover:border-amber-500/50 hover:bg-amber-500/20"
              title="Solicitações de seguidores pendentes de aprovação"
            >
              <Clock className="size-3.5 text-amber-400 transition-transform group-hover:scale-110" />
              <span className="font-bold text-amber-300 tabular-nums">
                {requestsCount}
              </span>
              <span className="text-amber-200/90 group-hover:text-amber-100">
                {requestsCount === 1 ? "Solicitação" : "Solicitações"}
              </span>
            </button>
          )}

          <div className="inline-flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2 text-xs">
            <span className="font-bold text-white tabular-nums">
              {totalTrackingCount}
            </span>
            <span className="text-zinc-400">
              Obras no Catálogo
            </span>
          </div>

          <div className="inline-flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2 text-xs">
            <span className="font-bold text-white tabular-nums">
              {commentCount}
            </span>
            <span className="text-zinc-400">
              Comentários
            </span>
          </div>

          <div className="ml-auto hidden md:inline-flex items-center gap-1.5 text-xs text-zinc-500">
            <Shield className="size-3.5 text-emerald-400/80" />
            <span>Conta Segura Hikari</span>
          </div>
        </div>
      </div>
    </header>
  );
}
