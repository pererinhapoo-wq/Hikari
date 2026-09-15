import { createFileRoute, Link } from "@tanstack/react-router";
import { fetchBrowse } from "@/lib/api";
import { overlayList } from "@/lib/overlay";
import { useHikariStore } from "@/lib/store";
import { AnimeCard, AnimeCardSkeleton } from "@/components/anime-card";

const TITLES: Record<string, string> = {
  popular: "Populares",
  season: "Temporada atual",
  top: "Mais bem avaliados",
  trending: "Em alta",
};

export const Route = createFileRoute("/browse/$section")({
  loader: async ({ params }) => {
    const section = ["popular", "season", "top", "trending"].includes(params.section)
      ? (params.section as "popular" | "season" | "top" | "trending")
      : "popular";
    const result = await fetchBrowse({ data: { section, page: 1 } });
    return { result, section };
  },
  pendingComponent: () => (
    <div className="grid grid-cols-2 gap-3 pt-20 sm:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: 12 }, (_, i) => (
        <AnimeCardSkeleton key={i} />
      ))}
    </div>
  ),
  component: BrowsePage,
});

function BrowsePage() {
  const { result, section } = Route.useLoaderData();
  const locals = useHikariStore((s) => s.animes);
  const items = overlayList(result.items, locals);
  const title = TITLES[section] ?? "Catálogo";

  return (
    <div className="space-y-6 pt-6">
      <header>
        <p className="text-[11px] tracking-[0.28em] text-muted uppercase">Explorar</p>
        <h1 className="font-display text-3xl tracking-tight">{title}</h1>
      </header>
      {items.length === 0 ? (
        <p className="py-16 text-center text-muted">
          Nada por aqui.{" "}
          <Link to="/" className="text-fg underline">
            Voltar
          </Link>
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((a) => (
            <AnimeCard key={a.id} anime={a} />
          ))}
        </div>
      )}
    </div>
  );
}
