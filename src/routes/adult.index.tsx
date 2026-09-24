import {
  createFileRoute,
  type ErrorComponentProps,
} from "@tanstack/react-router";

import { fetchAdultCatalog } from "@/lib/api";
import { overlayList } from "@/lib/overlay";
import { useHikariStore } from "@/lib/store";

import { Hero } from "@/components/hero";
import { AnimeRow } from "@/components/anime-row";
import { AnimeCardSkeleton } from "@/components/anime-card";

export const Route = createFileRoute("/adult/")({
  loader: () => fetchAdultCatalog(),
  pendingComponent: AdultPending,
  errorComponent: AdultError,
  component: AdultPage,
});

function AdultPending() {
  return (
    <div className="space-y-6 pt-3">
      <div className="-mx-4 h-[20rem] animate-pulse bg-elevated sm:-mx-6 sm:h-[27rem]" />

      <div className="rail">
        {Array.from({ length: 8 }, (_, i) => (
          <AnimeCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

function AdultError({
  error,
}: ErrorComponentProps) {
  const message =
    error instanceof Error && error.message
      ? error.message
      : typeof error === "string"
        ? error
        : "Tente recarregar.";

  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <p className="font-display text-2xl">
        Área +18 indisponível
      </p>

      <p className="mt-2 text-sm text-muted">
        {message}
      </p>
    </div>
  );
}

function AdultPage() {
  const data = Route.useLoaderData();

  const locals = useHikariStore(
    (s) => s.animes,
  );

  const items = overlayList(
    data.items,
    locals,
  );

  const recentItems = overlayList(
    data.recentItems ?? [],
    locals,
  );

  const featured = items[0];

  const featuredItems = items.slice(0, 6);

  return (
    <div className="space-y-5 pb-5 sm:space-y-8">
      {featured ? (
        <Hero
          anime={featured}
          animes={featuredItems}
        />
      ) : (
        <AdultPending />
      )}

      {items.length > 0 ? (
        <>
          <AnimeRow
            title="Novos episódios"
            href="/adult/recent"
            items={recentItems}
          />

          <AnimeRow
            title="Hentai"
            href="/adult/hentai"
            items={items}
          />
        </>
      ) : (
        <div className="rounded-xl bg-surface p-8 text-center shadow-[var(--shadow-border)]">
          <p className="font-display text-xl">
            Nenhum anime encontrado
          </p>

          <p className="mt-2 text-sm text-muted">
            A lista de conteúdo +18 está vazia.
          </p>
        </div>
      )}
    </div>
  );
      }
