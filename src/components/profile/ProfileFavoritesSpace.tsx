import { Link, useNavigate } from "@tanstack/react-router";
import {
  Briefcase,
  Building2,
  Film,
  Heart,
  Sparkles,
  Star,
  User,
  Users,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EntityWorksExpansion,
  type SelectedEntityTarget,
} from "@/components/anime/EntityWorksExpansion";
import { ProfileAnimeImage } from "@/components/profile/ProfileAnimeImage";
import { cn } from "@/lib/utils";
import type {
  FavoriteTargetType,
  ProfileFavoriteItem,
  ProfileFavoritesGrouped,
} from "@/types/favorite";

interface ProfileFavoritesSpaceProps {
  grouped: ProfileFavoritesGrouped;
  allItems: ProfileFavoriteItem[];
  loading?: boolean;
}

type CategoryFilter = "all" | FavoriteTargetType;

const CATEGORY_CONFIG: Record<
  FavoriteTargetType,
  { label: string; singular: string; icon: typeof Film; color: string }
> = {
  anime: {
    label: "Animes",
    singular: "Anime",
    icon: Film,
    color: "violet",
  },
  character: {
    label: "Personagens",
    singular: "Personagem",
    icon: Users,
    color: "pink",
  },
  studio: {
    label: "Estúdios",
    singular: "Estúdio",
    icon: Building2,
    color: "amber",
  },
  company: {
    label: "Empresas",
    singular: "Empresa",
    icon: Briefcase,
    color: "sky",
  },
  person: {
    label: "Pessoas",
    singular: "Pessoa",
    icon: User,
    color: "emerald",
  },
};

interface FavoriteGridCardProps {
  item: ProfileFavoriteItem;
  onEntityClick: (item: ProfileFavoriteItem) => void;
}

const FavoriteGridCard = React.memo(function FavoriteGridCard({
  item,
  onEntityClick,
}: FavoriteGridCardProps) {
  const cfg = CATEGORY_CONFIG[item.targetType] || CATEGORY_CONFIG.anime;
  const isAnime = item.targetType === "anime";
  const isStudio = item.targetType === "studio" || item.targetType === "company";
  const isClickableEntity = isStudio || item.targetType === "person";
  const targetLink = isAnime ? `/anime/${item.targetId}` : undefined;

  const handleClick = useCallback(() => {
    onEntityClick(item);
  }, [onEntityClick, item]);

  const cardContent = (
    <article className="group relative flex flex-col min-w-0 active:scale-[0.98] transition-transform duration-100 ease-out">
      {/* Pôster com proporção 2:3 vertical retangular com cantos retos */}
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
        <ProfileAnimeImage
          src={item.image}
          alt=""
          loading="lazy"
          decoding="async"
          fallbackClassName="bg-[#0d0c16]"
          className={cn(
            "size-full motion-reduce:transform-none",
            !isAnime && isStudio
              ? "object-contain p-4 scale-[0.94] [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[0.97]"
              : "object-cover object-center scale-[0.95] [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[0.98] group-active:scale-[0.96]",
          )}
        />

        {/* Camada de sombra/glow acelerada por GPU via opacidade, evitando repaint da box-shadow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-none shadow-[0_0_20px_rgba(168,85,247,0.35)] opacity-0 transition-opacity duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 group-active:opacity-100"
        />

        {/* Indicador de favorito discreto (sem backdrop-blur pesado) */}
        <div className="absolute top-1.5 right-1.5 flex size-5.5 items-center justify-center rounded-none bg-[#0c0a18]/90 border border-rose-500/30 text-rose-500 shadow-sm transition-transform duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105">
          <Heart className="size-3 fill-rose-500 text-rose-500" />
        </div>

        {/* Indicador discreto de nota sobreposto à imagem do anime */}
        {isAnime && typeof item.userScore === "number" && item.userScore > 0 && (
          <div
            className="absolute top-1.5 left-1.5 z-10 flex items-center gap-1 rounded bg-[#0b0914]/90 border border-purple-500/35 px-1.5 py-0.5 text-[10px] font-bold text-purple-200 backdrop-blur-md shadow-sm select-none"
            title={`Nota pessoal: ${item.userScore}/10`}
          >
            <Star className="size-2.5 text-[#c084fc] fill-[#c084fc]/50" />
            <span className="tabular-nums leading-none">
              {Number(item.userScore).toFixed(item.userScore % 1 === 0 ? 0 : 1)}
            </span>
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

        <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] sm:text-xs text-zinc-400 truncate">
          <span className="font-medium shrink-0 text-purple-400">
            {cfg.singular}
          </span>
          {item.subtitle && (
            <>
              <span>·</span>
              <span className="truncate">{item.subtitle}</span>
            </>
          )}
        </div>
      </div>
    </article>
  );

  if (targetLink) {
    return (
      <Link to={targetLink} className="block outline-none">
        {cardContent}
      </Link>
    );
  }

  if (isClickableEntity) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="w-full text-left cursor-pointer outline-none"
      >
        {cardContent}
      </button>
    );
  }

  return <div>{cardContent}</div>;
});

export const ProfileFavoritesSpace = React.memo(function ProfileFavoritesSpace({
  grouped,
  allItems,
  loading = false,
}: ProfileFavoritesSpaceProps) {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [expandedEntity, setExpandedEntity] = useState<SelectedEntityTarget | null>(null);

  // Paginação automática (infinite scroll)
  const PAGE_SIZE = 18;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const favoritesSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeCategory]);

  const displayedItems = useMemo(
    () => (activeCategory === "all" ? allItems : grouped[activeCategory] || []),
    [activeCategory, allItems, grouped],
  );

  const paginatedItems = useMemo(
    () => displayedItems.slice(0, visibleCount),
    [displayedItems, visibleCount],
  );
  const hasMoreToLoad = visibleCount < displayedItems.length;

  useEffect(() => {
    const sentinel = favoritesSentinelRef.current;
    if (!sentinel || !hasMoreToLoad || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, displayedItems.length));
        }
      },
      { rootMargin: "400px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreToLoad, displayedItems.length]);

  const handleEntityClick = useCallback(
    (item: ProfileFavoriteItem) => {
      const narrowStatus = (s: unknown) =>
        s === "watching" ||
        s === "completed" ||
        s === "planning" ||
        s === "on_hold" ||
        s === "dropped"
          ? s
          : undefined;

      if (item.targetType === "studio" || item.targetType === "company") {
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
      } else if (item.targetType === "person") {
        const isVoiceActor =
          (item.subtitle || "").toLowerCase().includes("dublador") ||
          (item.subtitle || "").toLowerCase().includes("voice actor") ||
          (item.description || "").toLowerCase().includes("dublador");

        if (isVoiceActor) {
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
        } else {
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
        }
      }
    },
    [navigate],
  );

  // Se uma entidade estiver selecionada, substitui completamente a seção original
  // pelo padrão Anime Stats, sem cards originais, sem seletores de categoria e sem botões Voltar/Fechar.
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
    <div className="space-y-6">
      {/* Seletor de Categoria dos Favoritos */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        <button
          type="button"
          onClick={() => {
            setActiveCategory("all");
            setExpandedEntity(null);
          }}
          className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer ${
            activeCategory === "all"
              ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)] ring-1 ring-purple-400"
              : "border border-white/[0.06] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.08] hover:text-white"
          }`}
        >
          <span>Todos</span>
        </button>

        {(Object.keys(CATEGORY_CONFIG) as FavoriteTargetType[]).map((catKey) => {
          const cfg = CATEGORY_CONFIG[catKey];
          const Icon = cfg.icon;
          const isActive = activeCategory === catKey;

          return (
            <button
              key={catKey}
              type="button"
              onClick={() => {
                setActiveCategory(catKey);
                setExpandedEntity(null);
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? "bg-white/[0.12] text-white ring-1 ring-white/20 shadow-sm"
                  : "border border-white/[0.06] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.08] hover:text-white"
              }`}
            >
              <Icon className="size-3.5" />
              <span>{cfg.label}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, idx) => (
            <div key={idx} className="min-w-0">
              <div className="aspect-[2/3] w-full rounded-none bg-[#141224] animate-pulse border border-white/5" />
              <div className="mt-2 h-3.5 w-3/4 rounded-none bg-white/5 animate-pulse" />
              <div className="mt-1 h-2.5 w-1/2 rounded-none bg-white/5 animate-pulse" />
            </div>
          ))}
        </div>
      ) : displayedItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 sm:p-14 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400 shadow-inner">
            <Heart className="size-7" />
          </div>

          <h3 className="mt-4 font-display text-base sm:text-lg font-bold text-white">
            Nenhum favorito encontrado
          </h3>

          <p className="mt-1.5 max-w-sm text-xs sm:text-sm text-zinc-400 leading-relaxed">
            {activeCategory === "all"
              ? "Você ainda não favoritou animes, personagens, estúdios ou criadores no Hikari."
              : `Você ainda não adicionou nenhum item à categoria "${CATEGORY_CONFIG[activeCategory].label}".`}
          </p>

          <Link
            to="/browse/$section"
            params={{ section: "popular" }}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all hover:bg-purple-500 active:scale-95"
          >
            <Sparkles className="size-4" />
            <span>Descobrir Obras</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {paginatedItems.map((item) => (
              <FavoriteGridCard
                key={item.id}
                item={item}
                onEntityClick={handleEntityClick}
              />
            ))}
          </div>

          {/* Sentinela de carregamento automático na rolagem (sem botão Carregar mais) */}
          <div ref={favoritesSentinelRef} className="h-6" aria-hidden="true" />
          {hasMoreToLoad && (
            <div className="py-4 flex items-center justify-center gap-2 text-xs text-zinc-400">
              <div className="size-3.5 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
              <span>Carregando mais favoritos...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
