import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Camera,
  Clock,
  Lock,
  MoreHorizontal,
  Pencil,
  Shield,
  Trash2,
  Users,
  UserX,
} from "lucide-react";
import { cn } from "@/lib/utils";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

type BannerLoadStatus = "loading" | "loaded" | "error";

export interface ProfileIdentityHeaderProps {
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
  commentCount?: number;
  totalTrackingCount?: number;
  favorites: string[];
  actions?: React.ReactNode;
  onBlockAction?: () => void;
  isBlockedByMe?: boolean;
  onOpenEdit?: () => void;
  onRemoveBanner?: () => void;
  onOpenPrivacy?: () => void;
  onOpenFollowers: () => void;
  onOpenFollowing: () => void;
  onOpenRequests?: () => void;
  isVerified?: boolean;
  canManageVerification?: boolean;
  onToggleVerification?: () => void;
}

export const ProfileIdentityHeader = memo(function ProfileIdentityHeader({
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
  favorites,
  actions,
  onBlockAction,
  isBlockedByMe = false,
  onOpenEdit,
  onRemoveBanner,
  onOpenPrivacy,
  onOpenFollowers,
  onOpenFollowing,
  onOpenRequests,
  isVerified = false,
  canManageVerification = false,
  onToggleVerification,
}: ProfileIdentityHeaderProps) {
  const displayHandle = nick ? `@${nick}` : "@hikari_membro";
  const initial = (nick || name || "U").charAt(0).toUpperCase();

  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const bannerImgRef = useRef<HTMLImageElement | null>(null);
  const [bannerStatus, setBannerStatus] = useState<BannerLoadStatus>(
    bannerUrl ? "loading" : "loaded",
  );

  useIsomorphicLayoutEffect(() => {
    if (!bannerUrl) {
      setBannerStatus("loaded");
      return;
    }

    const img = bannerImgRef.current;
    if (img && img.complete) {
      setBannerStatus(img.naturalWidth > 0 ? "loaded" : "error");
      return;
    }

    setBannerStatus("loading");
  }, [bannerUrl]);

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
    <header className="relative z-10 w-full overflow-hidden rounded-2xl border border-purple-900/30 bg-[#130E24] shadow-[0_16px_50px_rgba(0,0,0,0.7)]">
      {/* 1. Banner Panorâmico do Perfil */}
      <div className="relative h-[192px] sm:h-[256px] md:h-[320px] min-h-[192px] sm:min-h-[256px] md:min-h-[320px] w-full overflow-hidden bg-gradient-to-br from-purple-950 via-[#18112e] to-[#0A0713]">
        {bannerUrl && bannerStatus !== "error" ? (
          <>
            <img
              ref={bannerImgRef}
              src={bannerUrl}
              alt="Banner do perfil"
              decoding="async"
              fetchPriority="high"
              referrerPolicy="no-referrer"
              onLoad={(e) => {
                setBannerStatus(
                  e.currentTarget.naturalWidth > 0 ? "loaded" : "error",
                );
              }}
              onError={() => {
                setBannerStatus("error");
              }}
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
              className="pointer-events-none absolute -left-12 -top-12 size-60 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.25)_0%,rgba(139,92,246,0.12)_45%,transparent_70%)]"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute right-10 top-0 size-72 rounded-full bg-[radial-gradient(circle,rgba(147,51,234,0.20)_0%,rgba(147,51,234,0.08)_45%,transparent_70%)]"
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

        {/* Animação única e discreta na região superior do banner enquanto a imagem carrega */}
        {bannerUrl && bannerStatus === "loading" && (
          <div
            aria-hidden="true"
            data-banner-top-loader="true"
            className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[3px] overflow-hidden"
          >
            <div className="hikari-banner-top-loader" />
          </div>
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

          {accountType === "private" && (
            <button
              type="button"
              onClick={onOpenPrivacy}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium backdrop-blur-md shadow-md transition-all border-amber-500/30 bg-black/60 text-amber-300 hover:border-amber-500/50 hover:bg-black/80 ${
                onOpenPrivacy ? "cursor-pointer" : "cursor-default"
              }`}
              title={onOpenPrivacy ? "Clique para gerenciar a privacidade do seu perfil" : undefined}
            >
              <Lock className="size-3 text-amber-400" />
              <span>Perfil Privado</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Conteúdo de Identidade com Avatar Sobreposto ao Banner */}
      <div className="relative px-4 pb-6 sm:px-8 pt-0 sm:pt-0">
        {/* Linha superior: Avatar à esquerda sobrepondo o banner, e Menu de Três Pontinhos no extremo direito */}
        <div className="flex items-end justify-between -mt-16 sm:-mt-20">
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

          {/* Botões de Ações e Menu de Três Pontinhos no extremo direito */}
          <div className="flex items-center gap-2 mb-1 sm:mb-2">
            {actions}

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
                    {isOwner && onOpenPrivacy && (
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

                    {/* Conceder / Remover Verificação (exclusivo conta pererinha para terceiros) */}
                    {canManageVerification && !isOwner && onToggleVerification && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMoreMenuOpen(false);
                          onToggleVerification();
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-violet-300 hover:bg-violet-500/10 hover:text-white transition-colors text-left cursor-pointer"
                      >
                        <BadgeCheck className="size-4 text-violet-400 shrink-0" />
                        <span>{isVerified ? "Remover Selo de Verificado" : "Conceder Selo de Verificado"}</span>
                      </button>
                    )}

                    {/* Bloquear / Desbloquear Usuário (quando não é dono) */}
                    {!isOwner && onBlockAction && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMoreMenuOpen(false);
                          onBlockAction();
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors text-left cursor-pointer"
                      >
                        <UserX className="size-4 text-rose-400 shrink-0" />
                        <span>{isBlockedByMe ? "Desbloquear Usuário" : "Bloquear Usuário"}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Linha de Nome e Username posicionados ABAIXO da foto de perfil */}
        <div className="mt-3.5 space-y-1">
          {/* Nome de exibição sozinho na linha com tipografia elegante idêntica à referência Ren Amano */}
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-sans text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
              {name || nick || "Membro do Hikari"}
            </h1>

            {isVerified && (
              <span title="Perfil Verificado">
                <BadgeCheck className="size-5 sm:size-5.5 text-violet-400 fill-violet-500/20" />
              </span>
            )}

            {canManageVerification && !isOwner && onToggleVerification && (
              <button
                type="button"
                onClick={onToggleVerification}
                className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-violet-300 hover:bg-violet-500/30 transition-all cursor-pointer"
                title={isVerified ? "Remover selo de verificado" : "Conceder selo de verificado"}
              >
                <BadgeCheck className="size-3 text-violet-400" />
                <span>{isVerified ? "Remover Verificado" : "Verificar"}</span>
              </button>
            )}
          </div>

          {/* Username (@handle) isolado abaixo do nome */}
          <div>
            <span className="font-sans text-xs sm:text-sm font-medium text-violet-400/90">
              {displayHandle}
            </span>
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

          <div className="ml-auto hidden md:inline-flex items-center gap-1.5 text-xs text-zinc-500">
            <Shield className="size-3.5 text-emerald-400/80" />
            <span>Conta Segura Hikari</span>
          </div>
        </div>
      </div>
    </header>
  );
});

ProfileIdentityHeader.displayName = "ProfileIdentityHeader";
