import {
  createFileRoute,
  Link,
  type ErrorComponentProps,
} from "@tanstack/react-router";

import { fetchAdultCatalog } from "@/lib/api";
import { overlayList } from "@/lib/overlay";
import { useHikariStore } from "@/lib/store";

import {
  AnimeCard,
  AnimeCardSkeleton,
} from "@/components/anime-card";

export const Route = createFileRoute("/adult/all")({
  loader: () => fetchAdultCatalog(),
  pendingComponent: AdultAllPending,
  errorComponent: AdultAllError,
  component: AdultAllPage,
});

function AdultAllPending() {
  return (
    <div className="space-y-5 pb-5 sm:space-y-8">
      <div>
        <div className="h-8 w-52 animate-pulse rounded bg-elevated" />

        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-elevated" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 12 }, (_, i) => (
          <AnimeCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

function AdultAllError({ error }: ErrorComponentProps) {
  const message =
    error instanceof Error && error.message
      ? error.message
      : typeof error === "string"
        ? error
        : "Tente recarregar.";

  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <p className="font-display text-2xl">
        Conteúdo +18 indisponível
      </p>

      <p className="mt-2 text-sm text-muted">
        {message}
      </p>

      <Link
        to="/adult"
        className="mt-6 inline-flex rounded-lg bg-elevated px-4 py-2 text-sm text-fg transition hover:bg-surface"
      >
        Voltar
      </Link>
    </div>
  );
}

function AdultAllPage() {
  const data = Route.useLoaderData();

  const locals = useHikariStore((s) => s.animes);

  const items = overlayList(
    data.items ?? [],
    locals,
  );

  return (
    <div className="space-y-5 pb-5 sm:space-y-8">
      <section>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl tracking-tight sm:text-3xl">
              🔞 +18
            </h1>

            <p className="mt-1 text-sm text-muted">
              Confira todo o conteúdo adulto disponível.
            </p>
          </div>

          <Link
            to="/adult"
            className="shrink-0 text-sm font-semibold text-muted transition hover:text-fg"
          >
            Voltar
          </Link>
        </div>
      </section>

      {items.length === 0 ? (
        <div className="rounded-xl bg-surface p-8 text-center shadow-[var(--shadow-border)]">
          <p className="font-display text-xl">
            Nenhum anime encontrado
          </p>

          <p className="mt-2 text-sm text-muted">
            A lista de conteúdo +18 está vazia.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((anime) => (
            <AnimeCard
              key={anime.id}
              anime={anime}
              size="lg"
            />
          ))}
        </div>
      )}
    </div>
  );
            }
