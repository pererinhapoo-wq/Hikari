import { Link } from "@tanstack/react-router";
import {
  Building2,
  Film,
  Heart,
} from "lucide-react";
import type { ProfileFavoriteItem, ProfileFavoritesGrouped } from "@/types/favorite";

interface ProfileOverviewFavoritesProps {
  grouped: ProfileFavoritesGrouped;
}

export function ProfileOverviewFavorites({
  grouped,
}: ProfileOverviewFavoritesProps) {
  // Exibir no máximo 10 animes favoritos, preservando a ordem canônica real
  const animes = (grouped.anime ?? []).slice(0, 10);
  const characters = grouped.character ?? [];
  const studios = grouped.studio ?? [];
  const people = grouped.person ?? [];

  return (
    <div className="space-y-10 sm:space-y-12">
      {/* B. Favoritos — Animes (Grade de 3 colunas por linha em telas com espaço suficiente, sem botão Ver Tudo) */}
      <section aria-label="Favoritos — Animes" className="space-y-4">
        <div className="border-b border-white/[0.06] pb-3">
          <h3 className="font-display text-base sm:text-lg font-bold tracking-tight text-white">
            Favoritos — Animes
          </h3>
        </div>

        {animes.length > 0 ? (
          <div className="grid grid-cols-1 min-[340px]:grid-cols-2 min-[480px]:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
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

      {/* C. Favoritos — Personagens */}
      <section aria-label="Favoritos — Personagens" className="space-y-4">
        <div className="border-b border-white/[0.06] pb-3">
          <h3 className="font-display text-base sm:text-lg font-bold tracking-tight text-white">
            Favoritos — Personagens
          </h3>
        </div>

        {characters.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 sm:gap-4">
            {characters.map((item) => (
              <CharacterFavoriteCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <EmptyFavoritesNotice
            title="Nenhum personagem favoritado"
            description="Seus personagens icônicos favoritos aparecerão aqui com retratos e detalhes canônicos."
          />
        )}
      </section>

      {/* D. Favoritos — Studios */}
      <section aria-label="Favoritos — Studios" className="space-y-4">
        <div className="border-b border-white/[0.06] pb-3">
          <h3 className="font-display text-base sm:text-lg font-bold tracking-tight text-white">
            Favoritos — Studios
          </h3>
        </div>

        {studios.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:gap-4">
            {studios.map((item) => (
              <StudioFavoriteCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <EmptyFavoritesNotice
            title="Nenhum estúdio favoritado"
            description="Acompanhe os estúdios responsáveis pelas suas animações favoritas no Hikari."
          />
        )}
      </section>

      {/* E. Favorites — People */}
      <section aria-label="Favorites — People" className="space-y-4">
        <div className="border-b border-white/[0.06] pb-3">
          <h3 className="font-display text-base sm:text-lg font-bold tracking-tight text-white">
            Favorites — People
          </h3>
        </div>

        {people.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 sm:gap-4">
            {people.map((item) => (
              <PersonFavoriteCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <EmptyFavoritesNotice
            title="Nenhuma pessoa favoritada"
            description="Diretores, dubladores (seiyuus), roteiristas e compositores da indústria que você admira."
          />
        )}
      </section>
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
      className="group relative flex flex-col min-w-0 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d0b17] p-2 sm:p-2.5 transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/40 hover:bg-[#120f21] hover:shadow-[0_12px_30px_rgba(139,92,246,0.18)]"
    >
      {/* Pôster com proporção 3/4 preservada */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-[#151224]">
        {item.image ? (
          <img
            src={item.image}
            alt={item.title}
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center p-3 text-center text-xs text-zinc-500">
            <Film className="size-6 text-zinc-600" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-black/60 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity">
          <Heart className="size-3 fill-rose-500 text-rose-500" />
        </div>
      </div>

      {/* Informações: títulos com quebra segura sem sobreposição ou invasão aos cards vizinhos */}
      <div className="mt-2.5 min-w-0 flex-1 space-y-1">
        <h4
          className="line-clamp-2 text-xs sm:text-sm font-semibold text-zinc-200 transition-colors group-hover:text-white break-words leading-snug"
          title={item.title}
        >
          {item.title}
        </h4>
        {item.subtitle && (
          <p className="truncate text-[11px] sm:text-xs text-zinc-400">
            {item.subtitle}
          </p>
        )}
      </div>
    </Link>
  );
}

function CharacterFavoriteCard({ item }: { item: ProfileFavoriteItem }) {
  const initial = item.title.charAt(0).toUpperCase();

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d0b17] p-2 transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/40 hover:bg-[#120f21] hover:shadow-[0_12px_30px_rgba(168,85,247,0.18)]">
      {/* Imagem do Personagem */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-[#151224]">
        {item.image ? (
          <img
            src={item.image}
            alt={item.title}
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center font-display text-2xl font-bold text-purple-400">
            {initial}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </div>

      {/* Informações */}
      <div className="mt-2.5 space-y-0.5">
        <h4 className="truncate text-xs font-semibold text-zinc-200 transition-colors group-hover:text-white">
          {item.title}
        </h4>
        {item.nativeTitle && (
          <p className="truncate text-[10px] text-purple-300/80 font-mono">
            {item.nativeTitle}
          </p>
        )}
        {item.subtitle && (
          <p className="truncate text-[10px] text-zinc-500">
            {item.subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

function StudioFavoriteCard({ item }: { item: ProfileFavoriteItem }) {
  return (
    <div className="group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d0b17] p-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-500/40 hover:bg-[#120f21] hover:shadow-[0_10px_25px_rgba(99,102,241,0.15)]">
      <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-[#151224] p-1.5">
        {item.image ? (
          <img
            src={item.image}
            alt={item.title}
            loading="lazy"
            className="size-full object-contain"
          />
        ) : (
          <Building2 className="size-6 text-indigo-400" />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-0.5">
        <h4 className="truncate text-xs sm:text-sm font-semibold text-zinc-200 transition-colors group-hover:text-white">
          {item.title}
        </h4>
        {item.subtitle && (
          <p className="truncate text-[11px] text-zinc-500">
            {item.subtitle}
          </p>
        )}
        {item.description && (
          <p className="line-clamp-1 text-[11px] text-zinc-400">
            {item.description}
          </p>
        )}
      </div>
    </div>
  );
}

function PersonFavoriteCard({ item }: { item: ProfileFavoriteItem }) {
  const initial = item.title.charAt(0).toUpperCase();

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d0b17] p-2 transition-all duration-300 hover:-translate-y-1 hover:border-sky-500/40 hover:bg-[#120f21] hover:shadow-[0_12px_30px_rgba(14,165,233,0.18)]">
      {/* Foto da Pessoa */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-[#151224]">
        {item.image ? (
          <img
            src={item.image}
            alt={item.title}
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center font-display text-2xl font-bold text-sky-400">
            {initial}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </div>

      {/* Informações */}
      <div className="mt-2.5 space-y-0.5">
        <h4 className="truncate text-xs font-semibold text-zinc-200 transition-colors group-hover:text-white">
          {item.title}
        </h4>
        {item.nativeTitle && (
          <p className="truncate text-[10px] text-sky-300/80 font-mono">
            {item.nativeTitle}
          </p>
        )}
        {item.subtitle && (
          <p className="truncate text-[10px] text-zinc-500">
            {item.subtitle}
          </p>
        )}
      </div>
    </div>
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
