import { Link, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Film,
  Heart,
  Mic,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { useRef, useState } from "react";
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
import { getStudioLogo } from "@/lib/studio-logos";
import { cn } from "@/lib/utils";
import type { ProfileFavoriteItem, ProfileFavoritesGrouped } from "@/types/favorite";

interface ProfileOverviewFavoritesProps {
  grouped: ProfileFavoritesGrouped;
  onRemoveFavorite?: (item: ProfileFavoriteItem) => Promise<void> | void;
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

export function ProfileOverviewFavorites({
  grouped,
  onRemoveFavorite,
}: ProfileOverviewFavoritesProps) {
  const navigate = useNavigate();
  const [selectedEntity, setSelectedEntity] = useState<ProfileFavoriteItem | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [expandedEntity, setExpandedEntity] = useState<SelectedEntityTarget | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<"dubladores" | "studios" | "people" | null>(null);

  // Exibir no máximo 10 itens por categoria (Animes, Personagens, Dubladores, Studios, People)
  const animes = (grouped.anime ?? []).slice(0, 10);
  const characters = (grouped.character ?? []).slice(0, 10);
  const dubladores = (grouped.person ?? []).filter(isVoiceActor).slice(0, 10);
  const studios = (grouped.studio ?? []).slice(0, 10);
  const people = (grouped.person ?? []).filter((item) => !isVoiceActor(item)).slice(0, 10);

  const handleModalRemove = async (item: ProfileFavoriteItem) => {
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
  };

  const handleAnimeClick = (item: ProfileFavoriteItem) => {
    navigate({
      to: "/anime/$id",
      params: { id: item.targetId },
    });
  };

  const handleDubladorClick = (item: ProfileFavoriteItem) => {
    setExpandedEntity({
      type: "dublador",
      id: item.targetId,
      name: item.title,
      image: item.image,
    });
    setExpandedCategory("dubladores");
  };

  const handleStudioClick = (item: ProfileFavoriteItem) => {
    setExpandedEntity({
      type: "studio",
      id: item.targetId,
      name: item.title,
      image: item.image,
    });
    setExpandedCategory("studios");
  };

  const handlePeopleClick = (item: ProfileFavoriteItem) => {
    setExpandedEntity({
      type: "staff",
      id: item.targetId,
      name: item.title,
      image: item.image,
    });
    setExpandedCategory("people");
  };

  return (
    <div className="space-y-10 sm:space-y-12">
      {/* 1. Favoritos — Animes */}
      <FavoritesCarouselSection
        title="Favoritos — Animes"
        items={animes}
        emptyTitle="Nenhum anime favoritado"
        emptyDescription="Explore o catálogo do Hikari e marque seus animes prediletos para exibi-los em destaque no seu perfil."
        onCardClick={handleAnimeClick}
        accentColor="violet"
        icon={Film}
      />

      {/* 2. Favoritos — Personagens */}
      <FavoritesCarouselSection
        title="Favoritos — Personagens"
        items={characters}
        emptyTitle="Nenhum personagem favoritado"
        emptyDescription="Seus personagens icônicos favoritos aparecerão aqui com retratos e detalhes canônicos."
        onCardClick={(item) => setSelectedEntity(item)}
        accentColor="purple"
        icon={Users}
      />

      {/* 3. Favoritos — Dubladores */}
      <div className="space-y-4">
        <FavoritesCarouselSection
          title="Favoritos — Dubladores"
          items={dubladores}
          emptyTitle="Nenhum dublador favoritado"
          emptyDescription="Os dubladores e seiyuus que dão vida aos seus personagens prediletos aparecerão aqui."
          onCardClick={handleDubladorClick}
          selectedItemTitle={expandedCategory === "dubladores" ? expandedEntity?.name : null}
          accentColor="pink"
          icon={Mic}
        />
        {expandedEntity && expandedCategory === "dubladores" && (
          <EntityWorksExpansion
            entity={expandedEntity}
          />
        )}
      </div>

      {/* 4. Favoritos — Studios */}
      <div className="space-y-4">
        <FavoritesCarouselSection
          title="Favoritos — Studios"
          items={studios}
          emptyTitle="Nenhum estúdio favoritado"
          emptyDescription="Acompanhe os estúdios responsáveis pelas suas animações favoritas no Hikari."
          onCardClick={handleStudioClick}
          selectedItemTitle={expandedCategory === "studios" ? expandedEntity?.name : null}
          accentColor="indigo"
          icon={Building2}
        />
        {expandedEntity && expandedCategory === "studios" && (
          <EntityWorksExpansion
            entity={expandedEntity}
          />
        )}
      </div>

      {/* 5. Favoritos — People */}
      <div className="space-y-4">
        <FavoritesCarouselSection
          title="Favoritos — People"
          items={people}
          emptyTitle="Nenhuma pessoa favoritada"
          emptyDescription="Diretores, roteiristas, produtores e compositores da indústria que você admira."
          onCardClick={handlePeopleClick}
          selectedItemTitle={expandedCategory === "people" ? expandedEntity?.name : null}
          accentColor="sky"
          icon={User}
        />
        {expandedEntity && expandedCategory === "people" && (
          <EntityWorksExpansion
            entity={expandedEntity}
          />
        )}
      </div>

      {/* Modal de Detalhes da Entidade Favoritada (para Personagens) */}
      {selectedEntity && (
        <EntityDetailModal
          entity={selectedEntity}
          open={Boolean(selectedEntity)}
          onClose={() => setSelectedEntity(null)}
          onRemove={onRemoveFavorite ? handleModalRemove : undefined}
          isRemoving={removingId === selectedEntity.id}
        />
      )}
    </div>
  );
}

// ==========================================
// Seção com Carrossel Horizontal
// ==========================================

function FavoritesCarouselSection({
  title,
  items,
  emptyTitle,
  emptyDescription,
  onCardClick,
  selectedItemTitle,
  accentColor = "purple",
  icon: Icon,
}: {
  title: string;
  items: ProfileFavoriteItem[];
  emptyTitle: string;
  emptyDescription: string;
  onCardClick: (item: ProfileFavoriteItem) => void;
  selectedItemTitle?: string | null;
  accentColor?: "violet" | "purple" | "pink" | "indigo" | "sky";
  icon: typeof Film;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const isDownRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollLeftRef = useRef(0);
  const hasDraggedRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const scroll = (direction: "left" | "right") => {
    if (!railRef.current) return;
    const distance = railRef.current.clientWidth * 0.75;
    railRef.current.scrollBy({
      left: direction === "left" ? -distance : distance,
      behavior: "smooth",
    });
  };

  // Suporte a mouse drag no desktop
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!railRef.current) return;
    isDownRef.current = true;
    hasDraggedRef.current = false;
    startXRef.current = e.pageX - railRef.current.offsetLeft;
    startScrollLeftRef.current = railRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDownRef.current || !railRef.current) return;
    const x = e.pageX - railRef.current.offsetLeft;
    const walk = x - startXRef.current;
    if (Math.abs(walk) > 5) {
      if (!hasDraggedRef.current) {
        hasDraggedRef.current = true;
        setIsDragging(true);
      }
      railRef.current.scrollLeft = startScrollLeftRef.current - walk;
    }
  };

  const handleMouseUp = () => {
    isDownRef.current = false;
    setIsDragging(false);
    setTimeout(() => {
      hasDraggedRef.current = false;
    }, 60);
  };

  const handleMouseLeave = () => {
    if (isDownRef.current) {
      isDownRef.current = false;
      setIsDragging(false);
      setTimeout(() => {
        hasDraggedRef.current = false;
      }, 60);
    }
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    if (hasDraggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const colorClasses = {
    violet: "bg-violet-500",
    purple: "bg-purple-500",
    pink: "bg-pink-500",
    indigo: "bg-indigo-500",
    sky: "bg-sky-500",
  }[accentColor];

  return (
    <section aria-label={title} className="space-y-3.5 sm:space-y-4">
      {/* Cabeçalho da categoria com controles de navegação */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
        <div className="flex items-center gap-2.5">
          <span className={cn("h-5 w-1 rounded-full", colorClasses)} />
          <Icon className="size-4 text-zinc-400" />
          <h3 className="font-display text-base sm:text-lg font-bold tracking-tight text-white">
            {title}
          </h3>
          {items.length > 0 && (
            <span className="text-xs text-zinc-500 font-mono">
              ({items.length})
            </span>
          )}
        </div>

        {items.length > 2 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scroll("left")}
              aria-label={`Rolar ${title} para a esquerda`}
              className="flex size-7 sm:size-8 items-center justify-center rounded-lg border border-white/10 bg-[#0f0d18] text-zinc-400 hover:text-white hover:border-white/20 transition-colors cursor-pointer"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              aria-label={`Rolar ${title} para a direita`}
              className="flex size-7 sm:size-8 items-center justify-center rounded-lg border border-white/10 bg-[#0f0d18] text-zinc-400 hover:text-white hover:border-white/20 transition-colors cursor-pointer"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </div>

      {/* Conteúdo: Carrossel com Arraste (Desktop) e Deslize (Mobile) */}
      {items.length > 0 ? (
        <div
          ref={railRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onClickCapture={handleClickCapture}
          className={cn(
            "rail -mx-4 flex gap-2.5 sm:gap-3.5 overflow-x-auto px-4 sm:-mx-6 sm:px-6 pb-2 pt-1 select-none",
            isDragging ? "cursor-grabbing" : "cursor-grab",
          )}
        >
          {items.map((item) => (
            <FavoriteCarouselCard
              key={item.id}
              item={item}
              isSelected={selectedItemTitle === item.title}
              onClick={() => onCardClick(item)}
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
}

// ==========================================
// Card individual do carrossel
// ==========================================

function FavoriteCarouselCard({
  item,
  onClick,
  isSelected,
}: {
  item: ProfileFavoriteItem;
  onClick: () => void;
  isSelected?: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const isStudio = item.targetType === "studio";

  const displayImage = isStudio
    ? (!imgError && item.image ? item.image : getStudioLogo(item.title))
    : (!imgError ? item.image : null);

  const initial = (item.title || "?").charAt(0).toUpperCase();

  // Subtítulo limpo para o card: oculta termos redundantes ("Personagem", "Estúdio de animação", etc.)
  const cardSubtitle = (() => {
    if (!item.subtitle) return item.nativeTitle || null;
    const lower = item.subtitle.toLowerCase().trim();
    if (
      lower === "personagem" ||
      lower === "estúdio" ||
      lower === "estúdio de animação" ||
      lower.includes("estúdio de animação")
    ) {
      return item.nativeTitle || null;
    }
    return item.subtitle;
  })();

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex w-[112px] min-[380px]:w-[126px] sm:w-[145px] md:w-[160px] lg:w-[172px] shrink-0 flex-col min-w-0 overflow-hidden rounded-xl sm:rounded-2xl border border-white/[0.07] bg-[#0d0b17] p-1.5 min-[360px]:p-2 sm:p-2.5 transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/40 hover:bg-[#120f21] hover:shadow-[0_12px_30px_rgba(168,85,247,0.18)] cursor-pointer text-left focus:outline-none select-none",
        isSelected &&
          "border-purple-500/80 ring-2 ring-purple-500/90 shadow-[0_0_20px_rgba(168,85,247,0.35)] bg-[#151128]",
      )}
    >
      {/* Imagem com proporção 3/4 */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg sm:rounded-xl bg-[#151224] flex items-center justify-center">
        {displayImage ? (
          <img
            src={displayImage}
            alt={item.title}
            onError={() => setImgError(true)}
            loading="lazy"
            className={cn(
              "size-full transition-transform duration-500 group-hover:scale-105",
              isStudio ? "object-contain p-2.5" : "object-cover object-top",
            )}
          />
        ) : isStudio ? (
          <div className="flex flex-col items-center justify-center gap-1 text-center">
            <Building2 className="size-6 sm:size-8 text-indigo-400" />
          </div>
        ) : (
          <div className="flex size-full items-center justify-center font-display text-xl sm:text-2xl font-bold text-purple-400/80">
            {initial}
          </div>
        )}

        {/* Gradiente escuro no hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {/* Coração animado ativo no topo direito */}
        <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 flex size-5 sm:size-6 items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-rose-500/40 text-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.35)] transition-transform duration-300 group-hover:scale-110">
          <Heart className="size-2.5 sm:size-3 fill-rose-500 text-rose-500" />
        </div>
      </div>

      {/* Informações: Título e Subtítulo */}
      <div className="mt-1.5 sm:mt-2.5 min-w-0 flex-1 space-y-0.5 sm:space-y-1">
        <h4
          className="line-clamp-2 text-[11px] sm:text-xs md:text-sm font-semibold text-zinc-200 transition-colors group-hover:text-white break-words leading-tight sm:leading-snug"
          title={item.title}
        >
          {item.title}
        </h4>
        {cardSubtitle && (
          <p className="truncate text-[10px] sm:text-xs text-zinc-400">
            {cardSubtitle}
          </p>
        )}
      </div>
    </button>
  );
}

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
}: {
  entity: ProfileFavoriteItem;
  open: boolean;
  onClose: () => void;
  onRemove?: (item: ProfileFavoriteItem) => Promise<void> | void;
  isRemoving?: boolean;
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
            {displayImage ? (
              <img
                src={displayImage}
                alt={entity.title}
                className={cn(
                  "size-full",
                  isStudio ? "object-contain p-2.5" : "object-cover object-top"
                )}
              />
            ) : (
              <div className="flex size-full items-center justify-center font-display text-3xl font-bold text-purple-400">
                {(entity.title || "?").charAt(0).toUpperCase()}
              </div>
            )}

            <div className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-rose-500/40 shadow-sm">
              <Heart className="size-3 fill-rose-500 text-rose-500" />
            </div>
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
