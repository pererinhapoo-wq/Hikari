import { Link } from "@tanstack/react-router";
import {
  Briefcase,
  Building2,
  Film,
  Heart,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { useState } from "react";
import {
  EntityWorksExpansion,
  type SelectedEntityTarget,
} from "@/components/anime/EntityWorksExpansion";
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

export function ProfileFavoritesSpace({
  grouped,
  allItems,
  loading = false,
}: ProfileFavoritesSpaceProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [expandedEntity, setExpandedEntity] = useState<SelectedEntityTarget | null>(null);

  const counts: Record<CategoryFilter, number> = {
    all: allItems.length,
    anime: grouped.anime.length,
    character: grouped.character.length,
    studio: grouped.studio.length,
    company: grouped.company.length,
    person: grouped.person.length,
  };

  const displayedItems =
    activeCategory === "all"
      ? allItems
      : grouped[activeCategory] || [];

  const handleEntityClick = (item: ProfileFavoriteItem) => {
    if (item.targetType === "studio" || item.targetType === "company") {
      setExpandedEntity({
        type: "studio",
        id: item.targetId,
        name: item.title,
        image: item.image,
        subtitle: "Estúdio de animação",
      });
    } else if (item.targetType === "person") {
      const isVoiceActor =
        (item.subtitle || "").toLowerCase().includes("dublador") ||
        (item.subtitle || "").toLowerCase().includes("voice actor") ||
        (item.description || "").toLowerCase().includes("dublador");

      setExpandedEntity({
        type: isVoiceActor ? "dublador" : "staff",
        id: item.targetId,
        name: item.title,
        image: item.image,
        subtitle: item.subtitle,
      });
    }
  };

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
          className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
            activeCategory === "all"
              ? "bg-violet-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)] ring-1 ring-violet-400"
              : "border border-white/[0.06] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.08] hover:text-white"
          }`}
        >
          <span>Todos</span>
          <span className="rounded-full bg-white/10 px-1.5 py-0.2 text-[10px] font-bold">
            {counts.all}
          </span>
        </button>

        {(Object.keys(CATEGORY_CONFIG) as FavoriteTargetType[]).map((catKey) => {
          const cfg = CATEGORY_CONFIG[catKey];
          const Icon = cfg.icon;
          const isActive = activeCategory === catKey;
          const count = counts[catKey];

          return (
            <button
              key={catKey}
              type="button"
              onClick={() => {
                setActiveCategory(catKey);
                setExpandedEntity(null);
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                isActive
                  ? "bg-white/[0.12] text-white ring-1 ring-white/20 shadow-sm"
                  : "border border-white/[0.06] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.08] hover:text-white"
              }`}
            >
              <Icon className="size-3.5" />
              <span>{cfg.label}</span>
              <span className="rounded-full bg-white/10 px-1.5 py-0.2 text-[10px] font-bold tabular-nums">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Área expandida integrada como aba interna para consulta dos trabalhos */}
      {expandedEntity && (
        <EntityWorksExpansion
          entity={expandedEntity}
        />
      )}

      {/* Conteúdo: Skeleton, Vazio ou Grade de Favoritos */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 sm:gap-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="aspect-[3/4.2] animate-pulse rounded-2xl bg-white/[0.04]"
            />
          ))}
        </div>
      ) : displayedItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 sm:p-14 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400 shadow-inner">
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
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all hover:bg-violet-500 active:scale-95"
          >
            <Sparkles className="size-4" />
            <span>Descobrir Obras</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 sm:gap-4">
          {displayedItems.map((item) => {
            const cfg = CATEGORY_CONFIG[item.targetType] || CATEGORY_CONFIG.anime;
            const Icon = cfg.icon;

            const isAnime = item.targetType === "anime";
            const isClickableEntity =
              item.targetType === "studio" ||
              item.targetType === "person" ||
              item.targetType === "company";

            const isSelected = expandedEntity?.name === item.title;
            const targetLink = isAnime ? `/anime/${item.targetId}` : undefined;

            const cardContent = (
              <article
                className={cn(
                  "group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d0c16]/80 p-2 transition-all duration-300 hover:border-violet-500/40 hover:bg-[#121020] hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)]",
                  isSelected &&
                    "border-violet-500/90 ring-2 ring-violet-500/90 shadow-[0_0_20px_rgba(168,85,247,0.35)] bg-[#141026]",
                )}
              >
                {/* Mídia: Pôster / Avatar / Logo */}
                <div className="relative aspect-[3/4.2] w-full overflow-hidden rounded-xl bg-[#161422]">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.title}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-zinc-600">
                      <Icon className="size-8" />
                    </div>
                  )}

                  {/* Gradiente escuro protetor */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/30" />

                  {/* Badge da Categoria no Topo */}
                  <div className="absolute left-2 top-2">
                    <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-zinc-300 backdrop-blur-md">
                      <Icon className="size-2.5 text-violet-400" />
                      <span>{cfg.singular}</span>
                    </span>
                  </div>

                  {/* Subtítulo / Ano na base da imagem */}
                  {item.subtitle && (
                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="truncate text-[10px] font-medium text-zinc-300">
                        {item.subtitle}
                      </p>
                    </div>
                  )}
                </div>

                {/* Dados da Entidade */}
                <div className="flex flex-1 flex-col justify-between pt-2.5 pb-1 px-1">
                  <div>
                    <h4
                      className="line-clamp-2 text-xs font-semibold text-zinc-100 transition-colors group-hover:text-violet-300"
                      title={item.title}
                    >
                      {item.title}
                    </h4>

                    {/* Exibir nome nativo somente se NÃO for person (conforme regra: exibir somente o nome principal da pessoa, sem nomes em japonês) */}
                    {item.nativeTitle && item.targetType !== "person" && (
                      <p className="mt-0.5 truncate text-[10px] text-zinc-500">
                        {item.nativeTitle}
                      </p>
                    )}
                  </div>

                  {item.description && (
                    <p className="mt-2 line-clamp-2 text-[11px] leading-tight text-zinc-400/80">
                      {item.description}
                    </p>
                  )}
                </div>
              </article>
            );

            if (targetLink) {
              return (
                <Link key={item.id} to={targetLink} className="block">
                  {cardContent}
                </Link>
              );
            }

            if (isClickableEntity) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleEntityClick(item)}
                  className="w-full text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded-2xl"
                >
                  {cardContent}
                </button>
              );
            }

            return <div key={item.id}>{cardContent}</div>;
          })}
        </div>
      )}
    </div>
  );
}
