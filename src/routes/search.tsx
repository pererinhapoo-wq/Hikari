import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Search as SearchIcon,
  SlidersHorizontal,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  fetchHomeCatalog,
  searchCatalog,
} from "@/lib/api";

import {
  FORMAT_PT,
  GENRE_PT,
  SORT_OPTIONS,
  STATUS_PT,
} from "@/lib/labels";

import { overlayList } from "@/lib/overlay";
import { useHikariStore } from "@/lib/store";

import {
  AnimeCard,
  AnimeCardSkeleton,
} from "@/components/anime-card";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

const YEARS = Array.from(
  { length: 37 },
  (_, i) => String(2026 - i),
);

type Search = {
  q?: string;
  genre?: string;
  year?: string;
  format?: string;
  status?: string;
  sort?: string;
};

export const Route = createFileRoute("/search")({
  validateSearch: (
    raw: Record<string, unknown>,
  ): Search => ({
    q:
      typeof raw.q === "string" &&
      raw.q
        ? raw.q
        : undefined,

    genre:
      typeof raw.genre === "string" &&
      raw.genre
        ? raw.genre
        : undefined,

    year:
      typeof raw.year === "string" &&
      raw.year
        ? raw.year
        : undefined,

    format:
      typeof raw.format === "string" &&
      raw.format
        ? raw.format
        : undefined,

    status:
      typeof raw.status === "string" &&
      raw.status
        ? raw.status
        : undefined,

    sort:
      typeof raw.sort === "string" &&
      raw.sort
        ? raw.sort
        : undefined,
  }),

  loaderDeps: ({ search }) => search,

  loader: async ({ deps }) => {
    const [result, home] =
      await Promise.all([
        searchCatalog({
          data: {
            ...deps,
            page: 1,
          },
        }),

        fetchHomeCatalog(),
      ]);

    return {
      result,
      genres: home.genres,
    };
  },

  pendingComponent: SearchPending,

  component: SearchPage,
});

function SearchPending() {
  return (
    <div className="grid grid-cols-2 gap-3 pt-20 sm:grid-cols-4 lg:grid-cols-6">
      {Array.from(
        { length: 12 },
        (_, i) => (
          <AnimeCardSkeleton key={i} />
        ),
      )}
    </div>
  );
}

function SearchPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const {
    result,
    genres,
  } = Route.useLoaderData();

  const locals = useHikariStore(
    (s) => s.animes,
  );

  const [
    draft,
    setDraft,
  ] = useState(
    search.q ?? "",
  );

  const [
    filtersOpen,
    setFiltersOpen,
  ] = useState(false);

  const [
    allRemoteItems,
    setAllRemoteItems,
  ] = useState<typeof result.items>(
    [],
  );

  const [
    loadingAll,
    setLoadingAll,
  ] = useState(false);

  const [
    allLoaded,
    setAllLoaded,
  ] = useState(false);

  useEffect(() => {
    setDraft(
      search.q ?? "",
    );
  }, [search.q]);

  useEffect(() => {
    setAllRemoteItems([]);
    setAllLoaded(false);
    setLoadingAll(false);
  }, [
    search.q,
    search.genre,
    search.year,
    search.format,
    search.status,
    search.sort,
  ]);

  useEffect(() => {
    const q = draft.trim();

    const timer = window.setTimeout(() => {
      const current = (
        search.q ?? ""
      ).trim();

      if (q === current) return;

      void navigate({
        search: {
          ...search,
          q: q || undefined,
        },
        replace: true,
      });
    }, 400);

    return () =>
      window.clearTimeout(timer);
  }, [
    draft,
    navigate,
    search,
  ]);

  async function loadAllResults() {
    if (
      loadingAll ||
      allLoaded ||
      !result.hasNext
    ) {
      return;
    }

    setLoadingAll(true);

    try {
      const collected = [
        ...result.items,
      ];

      let page =
        result.page + 1;

      let hasNext =
        result.hasNext;

      /*
       * Limite de segurança para evitar
       * uma quantidade absurda de requisições.
       *
       * Cada página possui até 24 animes.
       */
      let requests = 0;

      while (
        hasNext &&
        requests < 50
      ) {
        const next =
          await searchCatalog({
            data: {
              ...search,
              page,
            },
          });

        collected.push(
          ...next.items,
        );

        hasNext =
          next.hasNext;

        page += 1;
        requests += 1;
      }

      const unique =
        Array.from(
          new Map(
            collected.map(
              (anime) => [
                anime.id,
                anime,
              ],
            ),
          ).values(),
        );

      setAllRemoteItems(
        unique,
      );

      setAllLoaded(true);
    } catch {
      /*
       * Mantém os resultados que já
       * estavam carregados caso alguma
       * página adicional falhe.
       */
      setAllLoaded(false);
    } finally {
      setLoadingAll(false);
    }
  }

  const items =
    useMemo(() => {
      const q =
        (search.q ?? "")
          .trim()
          .toLowerCase();

      const localHits =
        overlayList(
          [],
          locals,
        ).filter((a) => {
          if (
            q &&
            !`${a.titles.romaji} ${a.titles.english} ${a.titles.native}`
              .toLowerCase()
              .includes(q)
          ) {
            return false;
          }

          if (
            search.genre &&
            !a.genres.includes(
              search.genre,
            )
          ) {
            return false;
          }

          return true;
        });

      const remoteSource =
        allRemoteItems.length
          ? allRemoteItems
          : result.items;

      const remote =
        overlayList(
          remoteSource,
          locals,
        );

      const seen =
        new Set(
          localHits.map(
            (a) => a.id,
          ),
        );

      return [
        ...localHits,
        ...remote.filter(
          (a) =>
            !seen.has(a.id),
        ),
      ];
    }, [
      result.items,
      locals,
      search.q,
      search.genre,
      allRemoteItems,
    ]);

  function apply(
    next: Partial<Search>,
  ) {
    void navigate({
      search: {
        ...search,
        ...next,
      },
    });
  }

  const genreOptions =
    genres.length
      ? genres
      : Object.keys(
          GENRE_PT,
        );

  const hasAnimes =
    items.length > 0;

  const hasQuery =
    Boolean(
      search.q?.trim(),
    );

  const showLoadAll =
    hasQuery &&
    result.hasNext &&
    !allLoaded;

  return (
    <div className="space-y-6 pt-6">
      <header className="space-y-1">
        <p className="text-[11px] tracking-[0.28em] text-muted uppercase">
          Catálogo
        </p>

        <h1 className="font-display text-3xl tracking-tight">
          Buscar
        </h1>
      </header>

      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />

          <Input
            value={draft}
            onChange={(e) => {
              setDraft(
                e.target.value,
              );
            }}
            placeholder="Buscar animes…"
            className="pl-10"
            aria-label="Buscar animes"
          />
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Filtros"
          onClick={() =>
            setFiltersOpen(
              (v) => !v,
            )
          }
        >
          <SlidersHorizontal className="size-4" />
        </Button>
      </div>

      <div
        className={
          filtersOpen
            ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            : "hidden lg:grid lg:grid-cols-4 lg:gap-3"
        }
      >
        <Field label="Gênero">
          <NativeSelect
            value={
              search.genre ?? ""
            }
            onChange={(e) =>
              apply({
                genre:
                  e.target
                    .value ||
                  undefined,
              })
            }
          >
            <option value="">
              Todos
            </option>

            {genreOptions.map(
              (g) => (
                <option
                  key={g}
                  value={g}
                >
                  {GENRE_PT[g] ??
                    g}
                </option>
              ),
            )}
          </NativeSelect>
        </Field>

        <Field label="Ano">
          <NativeSelect
            value={
              search.year ?? ""
            }
            onChange={(e) =>
              apply({
                year:
                  e.target
                    .value ||
                  undefined,
              })
            }
          >
            <option value="">
              Qualquer
            </option>

            {YEARS.map(
              (y) => (
                <option
                  key={y}
                  value={y}
                >
                  {y}
                </option>
              ),
            )}
          </NativeSelect>
        </Field>

        <Field label="Formato">
          <NativeSelect
            value={
              search.format ?? ""
            }
            onChange={(e) =>
              apply({
                format:
                  e.target
                    .value ||
                  undefined,
              })
            }
          >
            <option value="">
              Todos
            </option>

            {Object.entries(
              FORMAT_PT,
            )
              .filter(
                ([k]) =>
                  [
                    "TV",
                    "MOVIE",
                    "OVA",
                    "ONA",
                    "SPECIAL",
                    "TV_SHORT",
                  ].includes(k),
              )
              .map(
                ([k, v]) => (
                  <option
                    key={k}
                    value={k}
                  >
                    {v}
                  </option>
                ),
              )}
          </NativeSelect>
        </Field>

        <Field label="Status">
          <NativeSelect
            value={
              search.status ?? ""
            }
            onChange={(e) =>
              apply({
                status:
                  e.target
                    .value ||
                  undefined,
              })
            }
          >
            <option value="">
              Todos
            </option>

            {Object.entries(
              STATUS_PT,
            ).map(
              ([k, v]) => (
                <option
                  key={k}
                  value={k}
                >
                  {v}
                </option>
              ),
            )}
          </NativeSelect>
        </Field>

        <Field
          label="Ordenar"
          className="lg:col-span-2"
        >
          <NativeSelect
            value={
              search.sort ??
              "TRENDING_DESC"
            }
            onChange={(e) =>
              apply({
                sort:
                  e.target
                    .value ||
                  undefined,
              })
            }
          >
            {SORT_OPTIONS.map(
              (o) => (
                <option
                  key={o.value}
                  value={o.value}
                >
                  {o.label}
                </option>
              ),
            )}
          </NativeSelect>
        </Field>
      </div>

      {hasQuery && hasAnimes && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl">
                Animes
              </h2>

              <span className="text-xs text-muted">
                {items.length} resultado
                {items.length ===
                1
                  ? ""
                  : "s"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {items.map(
              (a) => (
                <AnimeCard
                  key={a.id}
                  anime={a}
                />
              ),
            )}
          </div>

          {showLoadAll && (
            <div className="flex justify-center pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={
                  loadAllResults
                }
                disabled={
                  loadingAll
                }
              >
                {loadingAll
                  ? "Carregando todos os resultados…"
                  : "Ver todos os resultados"}
              </Button>
            </div>
          )}

          {allLoaded && (
            <p className="pt-2 text-center text-xs text-muted">
              Todos os resultados foram carregados.
            </p>
          )}
        </section>
      )}

      {!hasQuery && (
        <div className="py-20 text-center">
          <SearchIcon className="mx-auto size-8 text-subtle" />

          <p className="mt-4 font-display text-2xl">
            Pesquise um anime
          </p>

          <p className="mt-2 text-sm text-muted">
            Digite o nome do anime para ver os resultados.
          </p>
        </div>
      )}

      {hasQuery && !hasAnimes && (
        <div className="py-20 text-center">
          <p className="font-display text-2xl">
            Nada encontrado
          </p>

          <p className="mt-2 text-sm text-muted">
            Tente outro título
            ou limpe os
            filtros.
          </p>

          <Link
            to="/search"
            className="mt-4 inline-block text-sm text-fg underline"
          >
            Limpar busca
          </Link>
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
      <Label className="mb-1.5 block">
        {label}
      </Label>

      {children}
    </label>
  );
      }
