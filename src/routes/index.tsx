import { useMemo } from "react";
import {
  createFileRoute,
  type ErrorComponentProps,
} from "@tanstack/react-router";

import { fetchHomeCatalog } from "@/lib/api";
import { useHikariStore } from "@/lib/store";
import { overlayList } from "@/lib/overlay";
import { localToAnime } from "@/lib/types";

import { Hero } from "@/components/hero";
import { AnimeRow } from "@/components/anime-row";
import { TodayEpisodesSection } from "@/components/today-episodes-section";
import { RecentEpisodesSection } from "@/components/recent-episodes-section";
import { SectionReveal } from "@/components/section-reveal";
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

      <div className="rail -mx-4 gap-3 px-4 sm:-mx-6 sm:gap-3.5 sm:px-6 md:gap-4">
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
  const hydrated = useHikariStore((s) => s.hydrated);

  const trending = overlayList(data.trending, locals);
  const popular = overlayList(data.popular, locals);
  const season = overlayList(data.season, locals);
  const emAltaItems = trending.length > 0 ? trending : popular;

  // Animes Recém-Adicionados: animes incluídos no catálogo próprio do Hikari com data real (createdAt),
  // ordenados do mais recente para o mais antigo
  const { recentlyAddedAnimes, hasLocalWithoutCreationDate } = useMemo(() => {
    const visibleLocals = locals.filter((a) => !a.hidden);
    const withValidCreatedAt = visibleLocals.filter(
      (a) =>
        typeof a.createdAt === "number" &&
        Number.isFinite(a.createdAt) &&
        a.createdAt > 0,
    );

    const sorted = [...withValidCreatedAt]
      .sort(
        (a, b) =>
          b.createdAt - a.createdAt ||
          (b.updatedAt || 0) - (a.updatedAt || 0),
      )
      .slice(0, 18)
      .map(localToAnime);

    return {
      recentlyAddedAnimes: sorted,
      hasLocalWithoutCreationDate:
        visibleLocals.length > 0 && withValidCreatedAt.length === 0,
    };
  }, [locals]);

  const featured = trending[0] ?? popular[0];

  const featuredItems = [
    ...trending,
    ...popular.filter(
      (a) => !trending.some((t) => t.id === a.id),
    ),
  ].slice(0, 8);

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

      {/* 1. Episódios de Hoje */}
      <TodayEpisodesSection initialItems={data.todaySchedule ?? []} />

      {/* 2. Novos Episódios (publicados pelo administrador) */}
      <RecentEpisodesSection />

      {/* 3. Em Alta */}
      <AnimeRow
        title="Em Alta"
        eyebrow="POPULARES NO MOMENTO"
        iconType="flame"
        href="/browse/trending"
        items={emAltaItems}
        showBookmark={false}
        showRank={false}
      />

      {/* 4. Animes Recém-Adicionados */}
      <AnimeRow
        title="Animes Recém-Adicionados"
        eyebrow="NOVOS NO CATÁLOGO"
        iconType="sparkles"
        items={recentlyAddedAnimes}
        loading={!hydrated}
        showBookmark={false}
        showRank={false}
        emptyTitle="Não há dados suficientes de animes recém-adicionados"
        emptyDescription={
          hasLocalWithoutCreationDate
            ? "Os registros encontrados no catálogo local não possuem data de criação ou inclusão válida para ordenação."
            : "Ainda não há animes cadastrados no catálogo próprio do Hikari com data de inclusão registrada, e a fonte externa de catálogo não informa a data de adição à plataforma."
        }
      />

      {/* 5. Animes da Temporada */}
      <AnimeRow
        title="Animes da Temporada"
        eyebrow="SIMULCAST SEMANAL"
        tag={`${data.seasonName} ${data.seasonYear}`}
        iconType="calendar"
        href="/browse/season"
        items={season}
        showBookmark={false}
        showRank={false}
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
