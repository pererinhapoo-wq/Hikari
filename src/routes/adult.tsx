import {
  createFileRoute,
  type ErrorComponentProps,
} from "@tanstack/react-router";

import { AnimeCard, AnimeCardSkeleton } from "@/components/anime-card";
import { fetchAdultCatalog } from "@/lib/api";
import { overlayList } from "@/lib/overlay";
import { useHikariStore } from "@/lib/store";

export const Route = createFileRoute("/adult")({
  loader: () => fetchAdultCatalog(),
  pendingComponent: AdultPending,
  errorComponent: AdultError,
  component: AdultPage,
});

function AdultPending() {
  return (
    <div className="space-y-5 pb-8">
      <div>
        <p className="text-[11px] tracking-[0.28em] text-muted uppercase">
          Área restrita
        </p>

        <h1 className="mt-2 font-display text-3xl tracking-tight">
          🔞 +18
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 12 }, (_, i) => (
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

  return (
    <div className="space-y-5 pb-8 sm:space-y-8">
      <header>
        <p className="text-[11px] tracking-[0.28em] text-muted uppercase">
          Área restrita
        </p>

        <h1 className="mt-2 font-display text-3xl tracking-tight">
          🔞 +18
        </h1>

        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          Conteúdo adulto separado do catálogo principal.
        </p>
      </header>

      {items.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((anime) => (
            <AnimeCard
              key={anime.id}
              anime={anime}
            />
          ))}
        </div>
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
