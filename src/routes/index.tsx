import {
  createFileRoute,
  Link,
  type ErrorComponentProps,
} from "@tanstack/react-router";

import { fetchHomeCatalog } from "@/lib/api";
import { useHikariStore } from "@/lib/store";
import { overlayList } from "@/lib/overlay";

import { Hero } from "@/components/hero";
import { AnimeRow } from "@/components/anime-row";
import { AnimeCardSkeleton } from "@/components/anime-card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  staleTime: 1000 * 60 * 10,
  gcTime: 1000 * 60 * 30,
  loader: () => fetchHomeCatalog(),
  pendingComponent: HomePending,
  errorComponent: HomeError,
  component: Home,
});

function HomePending() {
  return (
    <div className="space-y-6 pt-1 sm:space-y-8">
      <div className="-mx-4 h-56 animate-pulse rounded-2xl border border-purple-500/10 bg-elevated/70 sm:-mx-6 sm:h-72 md:mx-0 md:h-[480px] lg:h-[520px]" />

      <div className="rail -mx-4 gap-2.5 px-4 sm:-mx-6 sm:gap-3.5 sm:px-6 md:gap-4">
        {Array.from({ length: 8 }, (_, i) => (
          <AnimeCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

function HomeError({ error }: ErrorComponentProps) {
  const message =
    error instanceof Error && error.message
      ? error.message
      : typeof error === "string"
        ? error
        : "Tente recarregar.";

  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <p className="font-display text-2xl">
        Catálogo indisponível
      </p>

      <p className="mt-2 text-sm text-muted">
        {message}
      </p>

      <div className="mt-5 flex justify-center">
        <Button
          variant="outline"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.location.reload();
            }
          }}
        >
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}

function Home() {
  const data = Route.useLoaderData();

  const locals = useHikariStore((s) => s.animes);

  const trending = overlayList(data.trending, locals);
  const popular = overlayList(data.popular, locals);
  const top = overlayList(data.top, locals);
  const season = overlayList(data.season, locals);

  const featured = trending[0] ?? popular[0];

  const featuredItems = [
    ...trending,
    ...popular.filter(
      (a) => !trending.some((t) => t.id === a.id),
    ),
  ].slice(0, 6);

  return (
    <div className="space-y-8 pb-12 sm:space-y-11 md:space-y-14">
      {featured ? (
        <Hero
          anime={featured}
          animes={featuredItems}
        />
      ) : (
        <HomePending />
      )}

      {/* Barra de Filtros Rápidos com Design Moderno */}
      <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar -mx-4 px-4 sm:-mx-6 sm:px-6 pt-1 pb-1">
        <Link
          to="/browse/trending"
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-purple-950/70 border border-purple-500/35 px-3.5 py-1.5 text-xs font-semibold text-purple-200 transition-all hover:bg-purple-900/70 hover:border-purple-400/60 hover:shadow-[0_0_12px_rgba(168,85,247,0.25)]"
        >
          <span className="size-1.5 rounded-full bg-purple-400 animate-pulse" />
          <span>Em Alta</span>
        </Link>
        <Link
          to="/browse/season"
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/5 border border-white/10 px-3.5 py-1.5 text-xs font-medium text-zinc-300 transition-all hover:bg-white/10 hover:border-purple-500/30 hover:text-white"
        >
          <span>Temporada Atual</span>
        </Link>
        <Link
          to="/browse/popular"
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/5 border border-white/10 px-3.5 py-1.5 text-xs font-medium text-zinc-300 transition-all hover:bg-white/10 hover:border-purple-500/30 hover:text-white"
        >
          <span>Mais Populares</span>
        </Link>
        <Link
          to="/browse/top"
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/5 border border-white/10 px-3.5 py-1.5 text-xs font-medium text-zinc-300 transition-all hover:bg-white/10 hover:border-purple-500/30 hover:text-white"
        >
          <span>Melhores Avaliações</span>
        </Link>
        <Link
          to="/my-list"
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/5 border border-white/10 px-3.5 py-1.5 text-xs font-medium text-zinc-300 transition-all hover:bg-white/10 hover:border-purple-500/30 hover:text-white"
        >
          <span>Minha Lista</span>
        </Link>
      </div>

      {/* Seção 1: Em Alta no Momento (com ranking dinâmico #1, #2, #3...) */}
      <AnimeRow
        title="Em Alta no Hikari"
        eyebrow="TENDÊNCIAS EM TEMPO REAL"
        tag="Top 10 da Semana"
        iconType="flame"
        href="/browse/trending"
        items={trending.slice(1)}
        showRank={true}
      />

      {/* Seção 2: Temporada Atual */}
      <AnimeRow
        title={`Estreias da Temporada`}
        eyebrow="SIMULCAST SEMANAL"
        tag={`${data.seasonName} ${data.seasonYear}`}
        iconType="calendar"
        href="/browse/season"
        items={season}
      />

      {/* Seção 3: Populares */}
      <AnimeRow
        title="Mais Populares"
        eyebrow="FAVORITOS DA COMUNIDADE"
        tag="Grandes Sucessos"
        iconType="sparkles"
        href="/browse/popular"
        items={popular}
      />

      {/* Seção 4: Mais Bem Avaliados */}
      <AnimeRow
        title="Obras-Primas Aclamadas"
        eyebrow="CRÍTICA & CLASSIFICAÇÃO"
        tag="Média Alta ★ 8.0+"
        iconType="trophy"
        href="/browse/top"
        items={top}
      />

      {/* Rodapé Elegante com indicação de catálogo */}
      <div className="pt-6 pb-2 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/5 border border-purple-500/20 px-4 py-1.5 text-xs text-zinc-400 shadow-sm">
          <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
          <span>
            Catálogo atualizado via{" "}
            <strong className="text-zinc-200 font-semibold">
              {data.source === "anilist"
                ? "AniList"
                : data.source === "kitsu"
                  ? "Kitsu"
                  : data.source === "jikan"
                    ? "MyAnimeList"
                    : "Servidor Seguro"}
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
}
