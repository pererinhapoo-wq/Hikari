import {
  BadgeCheck,
  Check,
  Copy,
  ExternalLink,
  Pencil,
  Settings,
  Share2,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

interface ProfileIdentityHeaderProps {
  name: string;
  nick: string;
  bio: string;
  image: string | null;
  followersCount: number;
  followingCount: number;
  commentCount: number;
  totalTrackingCount: number;
  favorites: string[];
  onOpenEdit: () => void;
  onOpenFollowers: () => void;
  onOpenFollowing: () => void;
}

export function ProfileIdentityHeader({
  name,
  nick,
  bio,
  image,
  followersCount,
  followingCount,
  commentCount,
  totalTrackingCount,
  favorites,
  onOpenEdit,
  onOpenFollowers,
  onOpenFollowing,
}: ProfileIdentityHeaderProps) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const displayHandle = nick ? `@${nick}` : "@hikari_membro";
  const initial = (nick || name || "U").charAt(0).toUpperCase();

  const handleCopyHandle = async () => {
    try {
      await navigator.clipboard.writeText(displayHandle);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleShare = async () => {
    try {
      const shareUrl = nick
        ? `${window.location.origin}/profile/${encodeURIComponent(nick)}`
        : window.location.href;

      if (navigator.share) {
        await navigator.share({
          title: `Perfil de ${name || nick || "Membro"} no Hikari`,
          text: `Confira meu perfil e coleção de animes no Hikari!`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {
      // User cancelled
    }
  };

  return (
    <header className="relative z-10 w-full overflow-hidden rounded-3xl border border-white/[0.09] bg-[#090812] shadow-[0_16px_50px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
      {/* 1. Banner Panorâmico do Perfil */}
      <div className="relative h-32 sm:h-44 md:h-52 w-full overflow-hidden border-b border-white/[0.07] bg-gradient-to-r from-[#170e2e] via-[#20103b] to-[#0d0918]">
        {/* Luzes dinâmicas e texturas no banner */}
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

        {/* Indicador de Privacidade Flutuante no Banner */}
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-3 py-1 text-[11px] font-medium text-emerald-300 backdrop-blur-md shadow-md">
          <Shield className="size-3 text-emerald-400" />
          <span>Perfil Protegido</span>
        </div>
      </div>

      {/* 2. Conteúdo de Identidade com Avatar Sobreposto ao Banner */}
      <div className="relative p-5 sm:p-7 pt-0 sm:pt-0">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between -mt-14 sm:-mt-16 md:-mt-20">
          {/* Avatar com moldura geométrica e iluminação */}
          <div className="relative shrink-0">
            <div className="group relative size-24 sm:size-28 md:size-32 overflow-hidden rounded-2xl bg-gradient-to-br from-[#1c1830] to-[#0c0a17] p-1 shadow-[0_10px_35px_rgba(0,0,0,0.8)] ring-2 ring-[#090812]">
              <div className="relative size-full overflow-hidden rounded-[14px] bg-[#141220]">
                {image ? (
                  <img
                    src={image}
                    alt={name || nick || "Foto de perfil"}
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center font-display text-4xl sm:text-5xl font-bold text-violet-300 select-none">
                    {initial}
                  </div>
                )}
              </div>
            </div>

            {/* Sinalizador ativo da comunidade */}
            <span
              className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-[#090812] ring-2 ring-[#090812]"
              title="Membro ativo da comunidade"
            >
              <span className="size-3 rounded-full bg-emerald-400 ring-2 ring-emerald-400/40 animate-pulse" />
            </span>
          </div>

          {/* Botões de Ações Rápidas */}
          <div className="flex flex-wrap items-center gap-2 sm:self-end">
            <button
              type="button"
              onClick={onOpenEdit}
              className="inline-flex items-center gap-2 rounded-xl border border-violet-500/40 bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-[0_0_20px_rgba(168,85,247,0.35)] transition-all hover:brightness-110 active:scale-98"
            >
              <Pencil className="size-3.5" />
              <span>Personalizar Perfil</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2 text-xs sm:text-sm font-medium text-zinc-200 transition-all hover:bg-white/[0.1] hover:text-white"
              title="Compartilhar link do perfil"
            >
              {shared ? (
                <>
                  <Check className="size-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Link copiado!</span>
                </>
              ) : (
                <>
                  <Share2 className="size-3.5" />
                  <span className="hidden sm:inline">Compartilhar</span>
                </>
              )}
            </button>

            <Link
              to="/settings"
              className="inline-flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-zinc-300 transition-all hover:bg-white/[0.1] hover:text-white"
              title="Configurações da conta"
            >
              <Settings className="size-4" />
            </Link>
          </div>
        </div>

        {/* 3. Nome, Username, Biografia e Destaques */}
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="truncate font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyHandle}
              className="group inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-300 transition-all hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white"
              title="Clique para copiar seu @username"
            >
              <span className="font-mono text-violet-300/90 group-hover:text-violet-200">
                {displayHandle}
              </span>
              {copied ? (
                <Check className="size-3 text-emerald-400" />
              ) : (
                <Copy className="size-3 text-zinc-500 transition-transform group-hover:scale-110 group-hover:text-zinc-300" />
              )}
            </button>

            {copied && (
              <span className="text-[11px] font-medium text-emerald-400 animate-in fade-in duration-150">
                Copiado!
              </span>
            )}

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

          {/* Biografia */}
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
