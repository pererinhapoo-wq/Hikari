import { Link } from "@tanstack/react-router";
import {
  Building2,
  Film,
  Heart,
  Search,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { getStudioLogo } from "@/lib/studio-logos";
import { cn } from "@/lib/utils";
import type { ProfileFavoriteItem, ProfileFavoritesGrouped } from "@/types/favorite";

interface ProfileOverviewFavoritesProps {
  grouped: ProfileFavoritesGrouped;
  onRemoveFavorite?: (item: ProfileFavoriteItem) => Promise<void> | void;
}

export function ProfileOverviewFavorites({
  grouped,
  onRemoveFavorite,
}: ProfileOverviewFavoritesProps) {
  const [selectedEntity, setSelectedEntity] = useState<ProfileFavoriteItem | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Exibir no máximo 10 itens por categoria, preservando a ordem canônica real
  const animes = (grouped.anime ?? []).slice(0, 10);
  const characters = (grouped.character ?? []).slice(0, 10);
  const studios = (grouped.studio ?? []).slice(0, 10);
  const people = (grouped.person ?? []).slice(0, 10);

  const handleModalRemove = async (item: ProfileFavoriteItem) => {
    if (!onRemoveFavorite) return;
    setRemovingId(item.id);
    try {
      await onRemoveFavorite(item);
      setSelectedEntity(null);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-10 sm:space-y-12">
      {/* B. Favoritos — Animes (Grade de 3 colunas por linha lado a lado) */}
      <section aria-label="Favoritos — Animes" className="space-y-4">
        <div className="border-b border-white/[0.06] pb-3">
          <h3 className="font-display text-base sm:text-lg font-bold tracking-tight text-white">
            Favoritos — Animes
          </h3>
        </div>

        {animes.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:gap-5">
            {animes.map((item) => (
              <AnimeFavoriteCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <EmptyFavoritesNotice
            title="Nenhum anime favoritado"
            description="Explore o catálogo do Hikari e marque seus animes prediletos para exibi-los em destaque no seu perfil."
          />
        )}
      </section>

      {/* C. Favoritos — Personagens (Grade de 3 colunas por linha lado a lado no celular) */}
      <section aria-label="Favoritos — Personagens" className="space-y-4">
        <div className="border-b border-white/[0.06] pb-3">
          <h3 className="font-display text-base sm:text-lg font-bold tracking-tight text-white">
            Favoritos — Personagens
          </h3>
        </div>

        {characters.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:gap-5">
            {characters.map((item) => (
              <CharacterFavoriteCard
                key={item.id}
                item={item}
                onClick={() => setSelectedEntity(item)}
              />
            ))}
          </div>
        ) : (
          <EmptyFavoritesNotice
            title="Nenhum personagem favoritado"
            description="Seus personagens icônicos favoritos aparecerão aqui com retratos e detalhes canônicos."
          />
        )}
      </section>

      {/* D. Favoritos — Studios (Grade de 3 colunas por linha lado a lado no celular) */}
      <section aria-label="Favoritos — Studios" className="space-y-4">
        <div className="border-b border-white/[0.06] pb-3">
          <h3 className="font-display text-base sm:text-lg font-bold tracking-tight text-white">
            Favoritos — Studios
          </h3>
        </div>

        {studios.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:gap-5">
            {studios.map((item) => (
              <StudioFavoriteCard
                key={item.id}
                item={item}
                onClick={() => setSelectedEntity(item)}
              />
            ))}
          </div>
        ) : (
          <EmptyFavoritesNotice
            title="Nenhum estúdio favoritado"
            description="Acompanhe os estúdios responsáveis pelas suas animações favoritas no Hikari."
          />
        )}
      </section>

      {/* E. Favorites — People (Grade de 3 colunas por linha lado a lado no celular) */}
      <section aria-label="Favorites — People" className="space-y-4">
        <div className="border-b border-white/[0.06] pb-3">
          <h3 className="font-display text-base sm:text-lg font-bold tracking-tight text-white">
            Favorites — People
          </h3>
        </div>

        {people.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:gap-5">
            {people.map((item) => (
              <PersonFavoriteCard
                key={item.id}
                item={item}
                onClick={() => setSelectedEntity(item)}
              />
            ))}
          </div>
        ) : (
          <EmptyFavoritesNotice
            title="Nenhuma pessoa favoritada"
            description="Diretores, dubladores (seiyuus), roteiristas e compositores da indústria que você admira."
          />
        )}
      </section>

      {/* Modal de Detalhes da Entidade Favoritada */}
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
// Subcomponentes visuais de cartões dedicados
// ==========================================

function AnimeFavoriteCard({ item }: { item: ProfileFavoriteItem }) {
  return (
    <Link
      to="/anime/$id"
      params={{ id: item.targetId }}
      className="group relative flex flex-col min-w-0 overflow-hidden rounded-xl sm:rounded-2xl border border-white/[0.07] bg-[#0d0b17] p-1.5 min-[360px]:p-2 sm:p-2.5 transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/40 hover:bg-[#120f21] hover:shadow-[0_12px_30px_rgba(139,92,246,0.18)]"
    >
      {/* Pôster com proporção 3/4 preservada */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg sm:rounded-xl bg-[#151224]">
        {item.image ? (
          <img
            src={item.image}
            alt={item.title}
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center p-2 text-center text-xs text-zinc-500">
            <Film className="size-5 sm:size-6 text-zinc-600" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 flex size-5 sm:size-6 items-center justify-center rounded-full bg-black/60 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity">
          <Heart className="size-2.5 sm:size-3 fill-rose-500 text-rose-500" />
        </div>
      </div>

      {/* Informações: títulos com quebra segura sem sobreposição ou invasão aos cards vizinhos */}
      <div className="mt-1.5 sm:mt-2.5 min-w-0 flex-1 space-y-0.5 sm:space-y-1">
        <h4
          className="line-clamp-2 text-[11px] sm:text-sm font-semibold text-zinc-200 transition-colors group-hover:text-white break-words leading-tight sm:leading-snug"
          title={item.title}
        >
          {item.title}
        </h4>
        {item.subtitle && (
          <p className="truncate text-[10px] sm:text-xs text-zinc-400">
            {item.subtitle}
          </p>
        )}
      </div>
    </Link>
  );
}

function CharacterFavoriteCard({
  item,
  onClick,
}: {
  item: ProfileFavoriteItem;
  onClick: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const initial = (item.title || "?").charAt(0).toUpperCase();

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col min-w-0 overflow-hidden rounded-xl sm:rounded-2xl border border-white/[0.07] bg-[#0d0b17] p-1.5 min-[360px]:p-2 sm:p-2.5 transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/40 hover:bg-[#120f21] hover:shadow-[0_12px_30px_rgba(168,85,247,0.18)] cursor-pointer text-left focus:outline-none"
    >
      {/* Imagem do Personagem com proporção 3/4 preservada */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg sm:rounded-xl bg-[#151224]">
        {item.image && !imgError ? (
          <img
            src={item.image}
            alt={item.title}
            onError={() => setImgError(true)}
            loading="lazy"
            className="size-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center font-display text-xl sm:text-2xl font-bold text-purple-400/80">
            {initial}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 flex size-5 sm:size-6 items-center justify-center rounded-full bg-black/60 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity">
          <Heart className="size-2.5 sm:size-3 fill-rose-500 text-rose-500" />
        </div>
      </div>

      {/* Informações: nome e informações canônicas */}
      <div className="mt-1.5 sm:mt-2.5 min-w-0 flex-1 space-y-0.5 sm:space-y-1">
        <h4
          className="line-clamp-2 text-[11px] sm:text-sm font-semibold text-zinc-200 transition-colors group-hover:text-white break-words leading-tight sm:leading-snug"
          title={item.title}
        >
          {item.title}
        </h4>
        {item.subtitle ? (
          <p className="truncate text-[10px] sm:text-xs text-purple-300/80">
            {item.subtitle}
          </p>
        ) : item.nativeTitle ? (
          <p className="truncate text-[10px] sm:text-xs text-zinc-400 font-mono">
            {item.nativeTitle}
          </p>
        ) : null}
      </div>
    </button>
  );
}

function StudioFavoriteCard({
  item,
  onClick,
}: {
  item: ProfileFavoriteItem;
  onClick: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const logo = (!imgError && item.image) ? item.image : getStudioLogo(item.title);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col min-w-0 overflow-hidden rounded-xl sm:rounded-2xl border border-white/[0.07] bg-[#0d0b17] p-1.5 min-[360px]:p-2 sm:p-2.5 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-500/40 hover:bg-[#120f21] hover:shadow-[0_12px_30px_rgba(99,102,241,0.18)] cursor-pointer text-left focus:outline-none"
    >
      {/* Imagem/Logo do Studio com proporção 3/4 preservada */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg sm:rounded-xl bg-[#151224] flex items-center justify-center p-2.5 sm:p-4">
        {logo ? (
          <img
            src={logo}
            alt={item.title}
            onError={() => setImgError(true)}
            loading="lazy"
            className="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-1 text-center">
            <Building2 className="size-6 sm:size-8 text-indigo-400" />
            <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold">
              Estúdio
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 flex size-5 sm:size-6 items-center justify-center rounded-full bg-black/60 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity">
          <Heart className="size-2.5 sm:size-3 fill-rose-500 text-rose-500" />
        </div>
      </div>

      {/* Informações: nome do estúdio e ano/subtítulo */}
      <div className="mt-1.5 sm:mt-2.5 min-w-0 flex-1 space-y-0.5 sm:space-y-1">
        <h4
          className="line-clamp-2 text-[11px] sm:text-sm font-semibold text-zinc-200 transition-colors group-hover:text-white break-words leading-tight sm:leading-snug"
          title={item.title}
        >
          {item.title}
        </h4>
        <p className="truncate text-[10px] sm:text-xs text-indigo-300/80">
          {item.subtitle || "Estúdio de animação"}
        </p>
      </div>
    </button>
  );
}

function PersonFavoriteCard({
  item,
  onClick,
}: {
  item: ProfileFavoriteItem;
  onClick: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const initial = (item.title || "?").charAt(0).toUpperCase();

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col min-w-0 overflow-hidden rounded-xl sm:rounded-2xl border border-white/[0.07] bg-[#0d0b17] p-1.5 min-[360px]:p-2 sm:p-2.5 transition-all duration-300 hover:-translate-y-1 hover:border-sky-500/40 hover:bg-[#120f21] hover:shadow-[0_12px_30px_rgba(14,165,233,0.18)] cursor-pointer text-left focus:outline-none"
    >
      {/* Foto real da pessoa (diretor, dublador, criador) com proporção 3/4 */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg sm:rounded-xl bg-[#151224]">
        {item.image && !imgError ? (
          <img
            src={item.image}
            alt={item.title}
            onError={() => setImgError(true)}
            loading="lazy"
            className="size-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center font-display text-xl sm:text-2xl font-bold text-sky-400/80">
            {initial}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 flex size-5 sm:size-6 items-center justify-center rounded-full bg-black/60 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity">
          <Heart className="size-2.5 sm:size-3 fill-rose-500 text-rose-500" />
        </div>
      </div>

      {/* Informações: nome e papel/subtítulo */}
      <div className="mt-1.5 sm:mt-2.5 min-w-0 flex-1 space-y-0.5 sm:space-y-1">
        <h4
          className="line-clamp-2 text-[11px] sm:text-sm font-semibold text-zinc-200 transition-colors group-hover:text-white break-words leading-tight sm:leading-snug"
          title={item.title}
        >
          {item.title}
        </h4>
        {item.subtitle ? (
          <p className="truncate text-[10px] sm:text-xs text-sky-300/80">
            {item.subtitle}
          </p>
        ) : item.nativeTitle ? (
          <p className="truncate text-[10px] sm:text-xs text-zinc-400 font-mono">
            {item.nativeTitle}
          </p>
        ) : (
          <p className="truncate text-[10px] sm:text-xs text-zinc-400">
            Produção & Elenco
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
  onRemove?: (item: ProfileFavoriteItem) => void;
  isRemoving?: boolean;
}) {
  const isCharacter = entity.targetType === "character";
  const isStudio = entity.targetType === "studio";
  const isPerson = entity.targetType === "person";

  const typeLabel = isCharacter
    ? "Personagem"
    : isStudio
    ? "Estúdio de Animação"
    : isPerson
    ? "Pessoa da Indústria"
    : "Favorito";

  const TypeIcon = isCharacter ? Users : isStudio ? Building2 : User;
  const displayImage = isStudio
    ? (entity.image || getStudioLogo(entity.title))
    : entity.image;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="border border-white/10 bg-[#0e0c19] text-white p-5 sm:p-6 w-[min(100%-1.5rem,32rem)] rounded-2xl sm:rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.85)]">
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-start">
          {/* Mídia do item */}
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

            <div className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-black/60 backdrop-blur-md">
              <Heart className="size-3 fill-rose-500 text-rose-500" />
            </div>
          </div>

          {/* Dados descritivos */}
          <div className="flex-1 min-w-0 space-y-2 text-left w-full">
            <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider border border-purple-500/30 bg-purple-950/40 text-purple-300">
              <TypeIcon className="size-2.5 text-purple-400" />
              <span>{typeLabel}</span>
            </div>

            <DialogTitle className="text-lg sm:text-xl font-bold font-display text-white leading-tight break-words">
              {entity.title}
            </DialogTitle>

            {entity.nativeTitle && (
              <p className="text-xs font-mono text-purple-300/80">
                {entity.nativeTitle}
              </p>
            )}

            {entity.subtitle && (
              <p className="text-xs text-zinc-400 font-medium">
                {entity.subtitle}
              </p>
            )}

            <DialogDescription className="text-xs text-zinc-300 leading-relaxed max-h-36 overflow-y-auto no-scrollbar pr-1 mt-2">
              {entity.description || "Informações e créditos canônicos registrados no catálogo do Hikari."}
            </DialogDescription>

            <div className="pt-3 flex flex-wrap items-center gap-2">
              <Link
                to="/search"
                search={{ q: entity.title }}
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-purple-500 shadow-[0_4px_16px_rgba(168,85,247,0.3)] active:scale-95"
              >
                <Search className="size-3.5" />
                <span>Ver produções</span>
              </Link>

              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(entity)}
                  disabled={isRemoving}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/20 hover:border-red-500/50 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 className="size-3 text-red-400" />
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

