import { Link, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  Film,
  Heart,
  Mic,
  Trash2,
  User,
  Users,
} from "lucide-react";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EntityWorksExpansion,
  type SelectedEntityTarget,
} from "@/components/anime/EntityWorksExpansion";
import { ProfileAnimeImage } from "@/components/profile/ProfileAnimeImage";
import { HikariImage } from "@/components/ui/hikari-image";
import { getStudioLogo } from "@/lib/studio-logos";
import { cn } from "@/lib/utils";
import type { ProfileFavoriteItem, ProfileFavoritesGrouped } from "@/types/favorite";

interface ProfileOverviewFavoritesProps {
  grouped: ProfileFavoritesGrouped;
  onRemoveFavorite?: (item: ProfileFavoriteItem) => Promise<void> | void;
  isOwner?: boolean;
}

/**
 * Identifica se um item do tipo "person" corresponde a um dublador (seiyuu/voice actor)
 * a partir de seu papel ou biografia canônica.
 */
function isVoiceActor(item: ProfileFavoriteItem): boolean {
  const sub = (item.subtitle || "").toLowerCase();
  const desc = (item.description || "").toLowerCase();
  return (
    sub.includes("dublador") ||
    sub.includes("voice actor") ||
    sub.includes("seiyuu") ||
    desc.includes("dublador") ||
    desc.includes("voice actor")
  );
}

/**
 * Verifica se um texto é informação redundante ou genérica que deve ser limpa
 * dos detalhes do favorito (conforme solicitado pelo usuário).
 */
function isRedundantInfo(text: string | null | undefined): boolean {
  if (!text) return true;
  const lower = text.trim().toLowerCase();
  return (
    lower === "personagem" ||
    lower === "estúdio" ||
    lower === "estúdio de animação" ||
    lower.includes("estúdio de animação") ||
    lower.startsWith("dublador") ||
    lower.includes("dublador(a)") ||
    lower.includes("informações e créditos canônicos registrados no catálogo do hikari")
  );
}

export const ProfileOverviewFavorites = React.memo(function ProfileOverviewFavorites({
  grouped,
  onRemoveFavorite,
  isOwner = true,
}: ProfileOverviewFavoritesProps) {
  const navigate = useNavigate();
  const [selectedEntity, setSelectedEntity] = useState<ProfileFavoriteItem | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [expandedEntity, setExpandedEntity] = useState<SelectedEntityTarget | null>(null);

  // Exibir no máximo 10 itens por categoria com memoização O(N) única para evitar re-filtros
  const { animes, characters, dubladores, studios, people } = useMemo(() => {
    const rawPerson = grouped.person ?? [];
    const dubList: ProfileFavoriteItem[] = [];
    const peopleList: ProfileFavoriteItem[] = [];

    for (let i = 0; i < rawPerson.length; i++) {
      const p = rawPerson[i];
      if (isVoiceActor(p)) {
        if (dubList.length < 10) dubList.push(p);
      } else {
        if (peopleList.length < 10) peopleList.push(p);
      }
      if (dubList.length >= 10 && peopleList.length >= 10) break;
    }

    return {
      animes: (grouped.anime ?? []).slice(0, 10),
      characters: (grouped.character ?? []).slice(0, 10),
      dubladores: dubList,
      studios: (grouped.studio ?? []).slice(0, 10),
      people: peopleList,
    };
  }, [grouped]);

  const handleModalRemove = useCallback(async (item: ProfileFavoriteItem) => {
    if (!onRemoveFavorite) return;
    setRemovingId(item.id);
    try {
      await onRemoveFavorite(item);
    } catch (err) {
      console.error("Erro ao remover favorito:", err);
    } finally {
      setRemovingId(null);
      setSelectedEntity(null);
    }
  }, [onRemoveFavorite]);

  const handleAnimeClick = useCallback((item: ProfileFavoriteItem) => {
    navigate({
      to: "/anime/$id",
      params: { id: item.targetId },
    });
  }, [navigate]);

  const narrowStatus = (s: unknown) =>
    s === "watching" ||
    s === "completed" ||
    s === "planning" ||
    s === "on_hold" ||
    s === "dropped"
      ? s
      : undefined;

  const handleDubladorClick = useCallback((item: ProfileFavoriteItem) => {
    void navigate({
      to: "/account",
      search: (prev) => ({
        ...prev,
        status: narrowStatus(prev.status),
        dublador: item.title,
        dubladorId: item.targetId,
        studio: undefined,
        studioId: undefined,
        staff: undefined,
        staffId: undefined,
        person: undefined,
        personId: undefined,
      }),
    });
  }, [navigate]);

  const handleStudioClick = useCallback((item: ProfileFavoriteItem) => {
    void navigate({
      to: "/account",
      search: (prev) => ({
        ...prev,
        status: narrowStatus(prev.status),
        studio: item.title,
        studioId: item.targetId,
        dublador: undefined,
        dubladorId: undefined,
        staff: undefined,
        staffId: undefined,
        person: undefined,
        personId: undefined,
      }),
    });
  }, [navigate]);

  const handlePeopleClick = useCallback((item: ProfileFavoriteItem) => {
    void navigate({
      to: "/account",
      search: (prev) => ({
        ...prev,
        status: narrowStatus(prev.status),
        staff: item.title,
        staffId: item.targetId,
        dublador: undefined,
        dubladorId: undefined,
        studio: undefined,
        studioId: undefined,
        person: undefined,
        personId: undefined,
      }),
    });
  }, [navigate]);

  const handleCharacterClick = useCallback((item: ProfileFavoriteItem) => {
    setSelectedEntity(item);
  }, []);

  // Se uma entidade estiver selecionada, substitui completamente a seção original
  // pelo padrão Anime Stats, sem cards originais, sem seletores de outras entidades e sem botões Voltar/Fechar.
  if (expandedEntity) {
    return (
      <div className="relative w-full">
        <EntityWorksExpansion
          entity={expandedEntity}
          onClear={() => setExpandedEntity(null)}
          accentColor={
            expandedEntity.type === "studio"
              ? "indigo"
              : expandedEntity.type === "dublador"
                ? "pink"
                : "purple"
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-10 sm:space-y-12">
      {/* 1. Favoritos — Animes: Grade com 3 animes por linha inclusive em mobile */}
      <FavoritesAnimeGridSection
        title="Favoritos — Animes"
        items={animes}
        emptyTitle="Nenhum anime favoritado"
        emptyDescription="Explore o catálogo do Hikari e marque seus animes prediletos para exibi-los em destaque no seu perfil."
        onCardClick={handleAnimeClick}
        accentColor="violet"
        icon={Film}
        isOwner={isOwner}
      />

      {/* 2. Favoritos — Personagens */}
      <FavoritesCarouselSection
        title="Favoritos — Personagens"
        items={characters}
        emptyTitle="Nenhum personagem favoritado"
        emptyDescription="Seus personagens icônicos favoritos aparecerão aqui com retratos e detalhes canônicos."
        onCardClick={handleCharacterClick}
        accentColor="purple"
        icon={Users}
        isOwner={isOwner}
      />

      {/* 3. Favoritos — Dubladores */}
      <FavoritesCarouselSection
        title="Favoritos — Dubladores"
        items={dubladores}
        emptyTitle="Nenhum dublador favoritado"
        emptyDescription="Os dubladores e seiyuus que dão vida aos seus personagens prediletos aparecerão aqui."
        onCardClick={handleDubladorClick}
        accentColor="pink"
        icon={Mic}
        isOwner={isOwner}
      />

      {/* 4. Favoritos — Studios */}
      <FavoritesCarouselSection
        title="Favoritos — Studios"
        items={studios}
        emptyTitle="Nenhum estúdio favoritado"
        emptyDescription="Acompanhe os estúdios responsáveis pelas suas animações favoritas no Hikari."
        onCardClick={handleStudioClick}
        accentColor="indigo"
        icon={Building2}
        isOwner={isOwner}
      />

      {/* 5. Favoritos — People */}
      <FavoritesCarouselSection
        title="Favoritos — People"
        items={people}
        emptyTitle="Nenhuma pessoa favoritada"
        emptyDescription="Diretores, roteiristas, produtores e compositores da indústria que você admira."
        onCardClick={handlePeopleClick}
        accentColor="sky"
        icon={User}
        isOwner={isOwner}
      />

      {/* Modal de Detalhes da Entidade Favoritada (para Personagens) */}
      {selectedEntity && (
        <EntityDetailModal
          entity={selectedEntity}
          open={Boolean(selectedEntity)}
          onClose={() => setSelectedEntity(null)}
          onRemove={onRemoveFavorite ? handleModalRemove : undefined}
          isRemoving={removingId === selectedEntity.id}
          isOwner={isOwner}
        />
      )}
    </div>
  );
});

// ==========================================
// Seção Exclusiva: Grade de Animes (3 por linha no mobile)
// ==========================================

const FavoritesAnimeGridSection = React.memo(function FavoritesAnimeGridSection({
  title,
  items,
  emptyTitle,
  emptyDescription,
  onCardClick,
  accentColor = "violet",
  icon: Icon,
  isOwner = true,
}: {
  title: string;
  items: ProfileFavoriteItem[];
  emptyTitle: string;
  emptyDescription: string;
  onCardClick: (item: ProfileFavoriteItem) => void;
  accentColor?: "violet" | "purple" | "pink" | "indigo" | "sky";
  icon: typeof Film;
  isOwner?: boolean;
}) {
  const colorClasses = {
    violet: "bg-violet-500",
    purple: "bg-purple-500",
    pink: "bg-pink-500",
    indigo: "bg-indigo-500",
    sky: "bg-sky-500",
  }[accentColor];

  return (
    <section aria-label={title} className="space-y-3.5 sm:space-y-4">
      {/* Cabeçalho da categoria: sem setas, sem números decorativos, sem emojis */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
        <div className="flex items-center gap-2.5">
          <span className={cn("h-5 w-1 rounded-full", colorClasses)} />
          <Icon className="size-4 text-zinc-400" />
          <h3 className="font-display text-base sm:text-lg font-bold tracking-tight text-white">
            {title}
          </h3>
        </div>
      </div>

      {/* Grade de 3 animes por linha inclusive no layout mobile */}
      {items.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 min-[360px]:gap-2.5 sm:gap-3.5 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((item) => (
            <FavoriteAnimeGridCard
              key={item.id}
              item={item}
              onCardClick={onCardClick}
              isOwner={isOwner}
            />
          ))}
        </div>
      ) : (
        <EmptyFavoritesNotice
          title={emptyTitle}
          description={emptyDescription}
        />
      )}
    </section>
  );
});

// ==========================================
// Card individual da grade de animes
// ==========================================

const FavoriteAnimeGridCard = React.memo(function FavoriteAnimeGridCard({
  item,
  onCardClick,
  isOwner = true,
}: {
  item: ProfileFavoriteItem;
  onCardClick: (item: ProfileFavoriteItem) => void;
  isOwner?: boolean;
}) {
  const cardSubtitle = useMemo(() => {
    if (!item.subtitle) return item.nativeTitle || null;
    const lower = item.subtitle.toLowerCase().trim();
    if (lower === "anime" || lower === "obra") {
      return item.nativeTitle || null;
    }
    return item.subtitle;
  }, [item.subtitle, item.nativeTitle]);

  const handleClick = useCallback(() => {
    onCardClick(item);
  }, [onCardClick, item]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group relative flex w-full min-w-0 flex-col text-left focus:outline-none select-none cursor-pointer outline-none active:scale-[0.98] transition-transform duration-100 ease-out"
    >
      {/* Capa com proporção 2:3 vertical retangular com cantos retos */}
      <div className="
        relative
        aspect-[2/3]
        w-full
        overflow-hidden
        rounded-none
        bg-[#0d0c16]
        border
        border-white/10
        shadow-sm
        transition-colors
        duration-200
        ease-out
        [@media(hover:hover)_and_(pointer:fine)]:group-hover:border-purple-500/50
        group-active:border-purple-400
      ">
        <ProfileAnimeImage
          src={item.image}
          alt=""
          loading="lazy"
          decoding="async"
          fallbackClassName="bg-[#0d0c16]"
          className="
            size-full
            object-cover
            object-center
            scale-[0.95]
            [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[0.98]
            group-active:scale-[0.96]
            motion-reduce:transform-none
          "
        />

        {/* Camada de sombra/glow acelerada por GPU via opacidade, evitando repaint contínuo da box-shadow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-none shadow-[0_0_20px_rgba(168,85,247,0.35)] opacity-0 transition-opacity duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 group-active:opacity-100"
        />

        {/* Indicador sutil de favorito no topo direito (exibido apenas para o proprietário) */}
        {isOwner && (
          <div className="absolute top-1.5 right-1.5 flex size-5.5 items-center justify-center rounded-none bg-[#0c0a18]/90 border border-rose-500/30 text-rose-500 shadow-sm transition-transform duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105">
            <Heart className="size-3 fill-rose-500 text-rose-500" />
          </div>
        )}
      </div>

      {/* Informações estritamente FORA do pôster */}
      <div className="mt-2 flex flex-col px-0.5 min-w-0">
        <h4
          className="truncate text-xs sm:text-sm font-medium text-zinc-100 transition-colors duration-150 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-purple-300 group-active:text-purple-200"
          title={item.title}
        >
          {item.title}
        </h4>
        {cardSubtitle && (
          <p className="mt-0.5 truncate text-[10.5px] sm:text-xs text-zinc-400">
            {cardSubtitle}
          </p>
        )}
      </div>
    </button>
  );
});

// ==========================================
// Seção com Carrossel Horizontal (Personagens, Dubladores, Studios, People)
// ==========================================

const FavoritesCarouselSection = React.memo(function FavoritesCarouselSection({
  title,
  items,
  emptyTitle,
  emptyDescription,
  onCardClick,
  selectedItemTitle,
  accentColor = "purple",
  icon: Icon,
  isOwner = true,
}: {
  title: string;
  items: ProfileFavoriteItem[];
  emptyTitle: string;
  emptyDescription: string;
  onCardClick: (item: ProfileFavoriteItem) => void;
  selectedItemTitle?: string | null;
  accentColor?: "violet" | "purple" | "pink" | "indigo" | "sky";
  icon: typeof Film;
  isOwner?: boolean;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const isDownRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollLeftRef = useRef(0);
  const hasDraggedRef = useRef(false);

  // Suporte a mouse drag no desktop sem causar re-renderizações no React
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!railRef.current) return;
    isDownRef.current = true;
    hasDraggedRef.current = false;
    startXRef.current = e.pageX - railRef.current.offsetLeft;
    startScrollLeftRef.current = railRef.current.scrollLeft;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDownRef.current || !railRef.current) return;
    const x = e.pageX - railRef.current.offsetLeft;
    const walk = x - startXRef.current;
    if (Math.abs(walk) > 5) {
      if (!hasDraggedRef.current) {
        hasDraggedRef.current = true;
        railRef.current.classList.add("cursor-grabbing");
        railRef.current.classList.remove("cursor-grab");
      }
      railRef.current.scrollLeft = startScrollLeftRef.current - walk;
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isDownRef.current = false;
    if (railRef.current) {
      railRef.current.classList.remove("cursor-grabbing");
      railRef.current.classList.add("cursor-grab");
    }
    setTimeout(() => {
      hasDraggedRef.current = false;
    }, 60);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (isDownRef.current) {
      isDownRef.current = false;
      if (railRef.current) {
        railRef.current.classList.remove("cursor-grabbing");
        railRef.current.classList.add("cursor-grab");
      }
      setTimeout(() => {
        hasDraggedRef.current = false;
      }, 60);
    }
  }, []);

  const handleClickCapture = useCallback((e: React.MouseEvent) => {
    if (hasDraggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  const colorClasses = {
    violet: "bg-violet-500",
    purple: "bg-purple-500",
    pink: "bg-pink-500",
    indigo: "bg-indigo-500",
    sky: "bg-sky-500",
  }[accentColor];

  return (
    <section
      aria-label={title}
      className="space-y-3.5 sm:space-y-4 [content-visibility:auto] [contain-intrinsic-size:auto_280px]"
    >
      {/* Cabeçalho da categoria: sem setas, sem números decorativos, sem emojis */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
        <div className="flex items-center gap-2.5">
          <span className={cn("h-5 w-1 rounded-full", colorClasses)} />
          <Icon className="size-4 text-zinc-400" />
          <h3 className="font-display text-base sm:text-lg font-bold tracking-tight text-white">
            {title}
          </h3>
        </div>
      </div>

      {/* Conteúdo: Carrossel com Arraste (Desktop) e Deslize/Gesto (Mobile) com touch-action: pan-y */}
      {items.length > 0 ? (
        <div
          ref={railRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onClickCapture={handleClickCapture}
          className="rail -mx-4 flex gap-2.5 sm:gap-3.5 overflow-x-auto px-4 sm:-mx-6 sm:px-6 pb-2 pt-1 select-none cursor-grab touch-pan-y"
        >
          {items.map((item) => (
            <FavoriteCarouselCard
              key={item.id}
              item={item}
              isSelected={selectedItemTitle === item.title}
              onCardClick={onCardClick}
              isOwner={isOwner}
            />
          ))}
        </div>
      ) : (
        <EmptyFavoritesNotice
          title={emptyTitle}
          description={emptyDescription}
        />
      )}
    </section>
  );
});

// ==========================================
// Card individual do carrossel (Personagens, Dubladores, Studios, People)
// ==========================================

const FavoriteCarouselCard = React.memo(function FavoriteCarouselCard({
  item,
  onCardClick,
  isSelected,
  isOwner = true,
}: {
  item: ProfileFavoriteItem;
  onCardClick: (item: ProfileFavoriteItem) => void;
  isSelected?: boolean;
  isOwner?: boolean;
}) {
  const isStudio = item.targetType === "studio";
  const studioFallbackLogo = isStudio ? getStudioLogo(item.title) : null;
  const primaryImage = item.image || studioFallbackLogo;

  // Subtítulo limpo para o card: oculta termos redundantes
  const cardSubtitle = useMemo(() => {
    if (!item.subtitle) return item.nativeTitle || (isStudio ? "Estúdio" : null);
    const lower = item.subtitle.toLowerCase().trim();
    if (
      lower === "personagem" ||
      lower === "estúdio" ||
      lower === "estúdio de animação" ||
      lower.includes("estúdio de animação")
    ) {
      return item.nativeTitle || (isStudio ? "Estúdio" : null);
    }
    return item.subtitle;
  }, [item.subtitle, item.nativeTitle, isStudio]);

  const handleClick = useCallback(() => {
    onCardClick(item);
  }, [onCardClick, item]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "group relative flex w-[108px] min-[380px]:w-[122px] sm:w-[138px] md:w-[150px] lg:w-[162px] shrink-0 flex-col min-w-0 text-left outline-none cursor-pointer select-none active:scale-[0.98] transition-transform duration-100 ease-out",
        isSelected && "ring-2 ring-purple-500",
      )}
    >
      {/* Imagem com proporção 2:3 vertical retangular com cantos retos */}
      <div className="
        relative
        aspect-[2/3]
        w-full
        overflow-hidden
        rounded-none
        bg-[#0d0c16]
        border
        border-white/10
        shadow-sm
        transition-colors
        duration-200
        ease-out
        [@media(hover:hover)_and_(pointer:fine)]:group-hover:border-purple-500/50
        group-active:border-purple-400
        flex
        items-center
        justify-center
      ">
        <HikariImage
          src={primaryImage}
          fallbackSrc={studioFallbackLogo}
          alt=""
          loading="lazy"
          decoding="async"
          fallbackClassName="bg-[#0d0c16]"
          className={cn(
            "size-full motion-reduce:transform-none",
            isStudio
              ? "object-contain p-4 scale-[0.94] [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[0.97]"
              : "object-cover object-center scale-[0.95] [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[0.98] group-active:scale-[0.96]",
          )}
        />

        {/* Camada de sombra/glow acelerada por GPU via opacidade, evitando repaint contínuo da box-shadow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-none shadow-[0_0_20px_rgba(168,85,247,0.35)] opacity-0 transition-opacity duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 group-active:opacity-100"
        />

        {/* Indicador sutil de favorito no topo direito (exibido apenas para o proprietário) */}
        {isOwner && (
          <div className="absolute top-1.5 right-1.5 flex size-5.5 items-center justify-center rounded-none bg-[#0c0a18]/90 border border-rose-500/30 text-rose-500 shadow-sm transition-transform duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105">
            <Heart className="size-3 fill-rose-500 text-rose-500" />
          </div>
        )}
      </div>

      {/* Informações estritamente FORA do pôster: Título e Subtítulo */}
      <div className="mt-2 flex flex-col px-0.5 min-w-0">
        <h4
          className="truncate text-xs sm:text-sm font-medium text-zinc-100 transition-colors duration-150 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-purple-300 group-active:text-purple-200"
          title={item.title}
        >
          {item.title}
        </h4>
        {cardSubtitle && (
          <p className="mt-0.5 truncate text-[10.5px] sm:text-xs text-zinc-400">
            {cardSubtitle}
          </p>
        )}
      </div>
    </button>
  );
});

function EmptyFavoritesNotice({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.05] bg-[#0c0a15]/60 p-6 sm:p-8 text-center backdrop-blur-md">
      <h4 className="text-sm font-semibold text-zinc-300 mb-1">
        {title}
      </h4>
      <p className="mx-auto max-w-md text-xs text-zinc-500">
        {description}
      </p>
    </div>
  );
}

// ==========================================
// Modal de Detalhes da Entidade Favoritada
// ==========================================

function EntityDetailModal({
  entity,
  open,
  onClose,
  onRemove,
  isRemoving = false,
  isOwner = true,
}: {
  entity: ProfileFavoriteItem;
  open: boolean;
  onClose: () => void;
  onRemove?: (item: ProfileFavoriteItem) => Promise<void> | void;
  isRemoving?: boolean;
  isOwner?: boolean;
}) {
  const isStudio = entity.targetType === "studio";
  const isAnime = entity.targetType === "anime";

  const displayImage = isStudio
    ? (entity.image || getStudioLogo(entity.title))
    : entity.image;

  // Filtragem de textos e descrições redundantes conforme solicitado pelo usuário
  const cleanDescription = !isRedundantInfo(entity.description)
    ? entity.description
    : null;

  const handleRemoveClick = async () => {
    if (!onRemove) return;
    try {
      await onRemove(entity);
    } catch (err) {
      console.error("Erro ao remover favorito:", err);
    } finally {
      // Fecha automaticamente o modal de detalhes após a remoção
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="border border-white/10 bg-[#0e0c19] text-white p-5 sm:p-6 w-[min(100%-1.5rem,30rem)] rounded-2xl sm:rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.85)]">
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-start">
          {/* Mídia do item com proporção 3/4 */}
          <div className="relative aspect-[3/4] w-28 sm:w-36 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#151224] shadow-md mx-auto sm:mx-0 flex items-center justify-center">
            {isAnime ? (
              <ProfileAnimeImage
                src={displayImage}
                alt={entity.title}
                loading="lazy"
                decoding="async"
                fallbackClassName="bg-[#151224]"
                className="size-full object-cover object-top"
              />
            ) : (
              <HikariImage
                src={displayImage}
                fallbackSrc={isStudio ? getStudioLogo(entity.title) : undefined}
                alt={entity.title}
                loading="lazy"
                decoding="async"
                fallbackClassName="bg-[#151224]"
                className={cn(
                  "size-full",
                  isStudio ? "object-contain p-2.5" : "object-cover object-top",
                )}
              />
            )}

            {isOwner && (
              <div className="absolute top-2 right-2 z-10 flex size-6 items-center justify-center rounded-full bg-[#0c0a18]/90 border border-rose-500/40 shadow-sm">
                <Heart className="size-3 fill-rose-500 text-rose-500" />
              </div>
            )}
          </div>

          {/* Dados descritivos: limpos de redundâncias */}
          <div className="flex-1 min-w-0 space-y-2 text-left w-full">
            <DialogTitle className="text-lg sm:text-xl font-bold font-display text-white leading-tight break-words">
              {entity.title}
            </DialogTitle>

            {entity.nativeTitle && entity.nativeTitle !== entity.title && (
              <p className="text-xs font-mono text-purple-300/80">
                {entity.nativeTitle}
              </p>
            )}

            {cleanDescription && (
              <DialogDescription className="text-xs text-zinc-300 leading-relaxed max-h-36 overflow-y-auto no-scrollbar pr-1 mt-2">
                {cleanDescription}
              </DialogDescription>
            )}

            {/* Ações preservadas: Remover favorito e, para animes, link para a página */}
            <div className="pt-3 flex flex-wrap items-center gap-2">
              {isAnime && (
                <Link
                  to="/anime/$id"
                  params={{ id: entity.targetId }}
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-purple-500 shadow-[0_4px_16px_rgba(168,85,247,0.3)] active:scale-95"
                >
                  <Film className="size-3.5" />
                  <span>Ver anime</span>
                </Link>
              )}

              {onRemove && (
                <button
                  type="button"
                  onClick={handleRemoveClick}
                  disabled={isRemoving}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-medium text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/50 transition-colors disabled:opacity-50 cursor-pointer shadow-sm active:scale-95"
                >
                  <Trash2 className="size-3 text-rose-400" />
                  <span>{isRemoving ? "Removendo..." : "Remover favorito"}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
