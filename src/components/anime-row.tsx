import { createFileRoute, Link } from "@tanstack/react-router";

import { Search as SearchIcon, SlidersHorizontal } from "lucide-react";

import { useMemo, useState, type ReactNode } from "react";

import { fetchHomeCatalog, searchCatalog } from "@/lib/api";

import { FORMAT_PT, GENRE_PT, SORT_OPTIONS, STATUS_PT } from "@/lib/labels";

import { overlayList } from "@/lib/overlay";
import { useHikariStore } from "@/lib/store";

import { AnimeCard, AnimeCardSkeleton } from "@/components/anime-card";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import { NativeSelect } from "@/components/ui/native-select";

const YEARS = Array.from({ length: 37 }, (_, i) => String(2026 - i));

type Search = {
  q?: string;
  genre?: string;
  year?: string;
  format?: string;
  status?: string;
  sort?: string;
};

export const Route = createFileRoute("/search")({
  validateSearch: (raw: Record<string, unknown>): Search => ({
    q: typeof raw.q === "string" && raw.q ? raw.q : undefined,
    genre: typeof raw.genre === "string" && raw.genre ? raw.genre : undefined,
    year: typeof raw.year === "string" && raw.year ? raw.year : undefined,
    format: typeof raw.format === "string" && raw.format ? raw.format : undefined,
    status: typeof raw.status === "string" && raw.status ? raw.status : undefined,
    sort: typeof raw.sort === "string" && raw.sort ? raw.sort : undefined,
  }),

  loaderDeps: ({ search }) => search,

  loader: async ({ deps }) => {
    const [result, home] = await Promise.all([
      searchCatalog({ data: { ...deps, page: 1 } }),
      fetchHomeCatalog(),
    ]);

    return { result, genres: home.genres };
  },

  pendingComponent: SearchPending,

  component: SearchPage,
});

function SearchPending() {
  return (
    <div className="grid grid-cols-2 gap-3 pt-8 sm:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: 12 }, (_, i) => (
        <AnimeCardSkeleton key={i} />
      ))}
    </div>
  );
}

function SearchPage() {
  const search = Route.useSearch();

  const navigate = Route.useNavigate();

  const { result, genres } = Route.useLoaderData();

  const locals = useHikariStore((s) => s.animes);

  const [draft, setDraft] = useState(search.q ?? "");

  const [filtersOpen, setFiltersOpen] = useState(false);

  const items = useMemo(() => {
    const q = (search.q ?? "").trim().toLowerCase();

    const localHits = overlayList([], locals).filter((a) => {
      if (
        q &&
        !`${a.titles.romaji} ${a.titles.english} ${a.titles.native}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }

      if (search.genre && !a.genres.includes(search.genre)) return false;

      return true;
    });

    const remote = overlayList(result.items, locals);

    const seen = new Set(localHits.map((a) => a.id));

    return [
      ...localHits,
      ...remote.filter((a) => !seen.has(a.id)),
    ];
  }, [result.items, locals, search.q, search.genre]);

  function apply(next: Partial<Search>) {
    void navigate({
      search: { ...search, ...next },
    });
  }

  const genreOptions = genres.length ? genres : Object.keys(GENRE_PT);

  return (
    <div className="space-y-6 pt-5 sm:pt-6">
      <header className="space-y-1">
        <p className="text-[10px] tracking-[0.28em] text-muted uppercase sm:text-[11px]">
          Catálogo
        </p>

        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
          Buscar
        </h1>

        <p className="max-w-xl pt-1 text-xs text-muted sm:text-sm">
          Encontre seu próximo anime por título, gênero, ano ou formato.
        </p>
      </header>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q: draft || undefined });
        }}
      >
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />

          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Título, estúdio, personagem…"
            className="h-11 pl-10"
            aria-label="Buscar animes"
          />
        </div>

        <Button type="submit" className="h-11 shrink-0 px-3 sm:px-4">
          <SearchIcon className="size-4 sm:hidden" />
          <span className="hidden sm:inline">Buscar</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 shrink-0"
          aria-label="Filtros"
          onClick={() => setFiltersOpen((v) => !v)}
        >
          <SlidersHorizontal className="size-4" />
        </Button>
      </form>

      <div
        className={
          filtersOpen
            ? "grid gap-3 rounded-xl border border-border bg-elevated/40 p-3 sm:grid-cols-2 lg:grid-cols-4"
            : "hidden lg:grid lg:grid-cols-4 lg:gap-3"
        }
      >
        <Field label="Gênero">
          <NativeSelect
            value={search.genre ?? ""}
            onChange={(e) =>
              apply({ genre: e.target.value || undefined })
            }
          >
            <option value="">Todos</option>

            {genreOptions.map((g) => (
              <option key={g} value={g}>
                {GENRE_PT[g] ?? g}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field label="Ano">
          <NativeSelect
            value={search.year ?? ""}
            onChange={(e) =>
              apply({ year: e.target.value || undefined })
            }
          >
            <option value="">Qualquer</option>

            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field label="Formato">
          <NativeSelect
            value={search.format ?? ""}
            onChange={(e) =>
              apply({ format: e.target.value || undefined })
            }
          >
            <option value="">Todos</option>

            {Object.entries(FORMAT_PT)
              .filter(([k]) =>
                ["TV", "MOVIE", "OVA", "ONA", "SPECIAL", "TV_SHORT"].includes(k)
              )
              .map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
          </NativeSelect>
        </Field>

        <Field label="Status">
          <NativeSelect
            value={search.status ?? ""}
            onChange={(e) =>
              apply({ status: e.target.value || undefined })
            }
          >
            <option value="">Todos</option>

            {Object.entries(STATUS_PT).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field label="Ordenar" className="lg:col-span-2">
          <NativeSelect
            value={search.sort ?? "TRENDING_DESC"}
            onChange={(e) =>
              apply({ sort: e.target.value || undefined })
            }
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      {items.length === 0 ? (
        <div className="py-20 text-center">
          <p className="font-display text-2xl">Nada encontrado</p>

          <p className="mt-2 text-sm text-muted">
            Tente outro título ou limpe os filtros.
          </p>

          <Link
            to="/search"
            className="mt-4 inline-block text-sm text-fg underline"
          >
            Limpar busca
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

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={className}>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
    </label>
  );
            }
