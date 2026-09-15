import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark } from "lucide-react";
import { useHikariStore } from "@/lib/store";
import { localToAnime } from "@/lib/types";
import { AnimeCard } from "@/components/anime-card";

export const Route = createFileRoute("/my-list")({
  component: MyListPage,
});

function MyListPage() {
  const myList = useHikariStore((s) => s.myList);
  const snapshots = useHikariStore((s) => s.snapshots);
  const animes = useHikariStore((s) => s.animes);
  const hydrated = useHikariStore((s) => s.hydrated);

  const items = myList
    .map((id) => {
      if (snapshots[id]) return snapshots[id];
      const local = animes.find((a) => a.id === id);
      return local ? localToAnime(local) : null;
    })
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  return (
    <div className="space-y-6 pt-6">
      <header>
        <p className="text-[11px] tracking-[0.28em] text-muted uppercase">Salvos neste dispositivo</p>
        <h1 className="font-display text-3xl tracking-tight">Minha Lista</h1>
      </header>

      {!hydrated ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="aspect-2/3 animate-pulse rounded-lg bg-elevated" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <Bookmark className="size-8 text-subtle" />
          <p className="mt-4 font-display text-2xl">Sua lista está vazia</p>
          <p className="mt-2 max-w-sm text-sm text-muted">
            Toque no marcador de qualquer capa para guardar títulos e continuar depois.
          </p>
          <Link to="/search" className="mt-6 text-sm text-fg underline">
            Explorar o catálogo
          </Link>
        </div>
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
