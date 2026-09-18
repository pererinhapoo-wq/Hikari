import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Search as SearchIcon,
  SlidersHorizontal,
  UserCircle,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { fetchHomeCatalog, searchCatalog } from "@/lib/api";
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

type UserSearchResult = {
  id: string;
  name: string;
  image: string | null;
};

export const Route = createFileRoute(
  "/search",
)({
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

  pendingComponent:
    SearchPending,

  component:
    SearchPage,
});

function SearchPending() {
  return (
    <div className="grid grid-cols-2 gap-3 pt-20 sm:grid-cols-4 lg:grid-cols-6">
      {Array.from(
        { length: 12 },
        (_, i) => (
          <AnimeCardSkeleton
            key={i}
          />
        ),
      )}
    </div>
  );
}

function SearchPage() {
  const search =
    Route.useSearch();

  const navigate =
    Route.useNavigate();

  const {
    result,
    genres,
  } =
    Route.useLoaderData();

  const locals =
    useHikariStore(
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
    users,
    setUsers,
  ] = useState<
    UserSearchResult[]
  >([]);

  const [
    usersLoading,
    setUsersLoading,
  ] = useState(false);

  const [
    usersError,
    setUsersError,
  ] = useState("");

  const [
    suggestionsOpen,
    setSuggestionsOpen,
  ] = useState(false);

  useEffect(() => {
    setDraft(
      search.q ?? "",
    );
  }, [search.q]);

  /*
   * Busca usuários enquanto o usuário digita.
   *
   * O pequeno atraso evita fazer uma requisição
   * para cada tecla pressionada imediatamente.
   */
  useEffect(() => {
    const q =
      draft.trim();

    if (!q) {
      setUsers([]);
      setUsersLoading(false);
      setUsersError("");
      return;
    }

    let cancelled = false;

    const timer =
      window.setTimeout(
        () => {
          setUsersLoading(
            true,
          );
          setUsersError("");

          void fetch(
            `/api/users/search?q=${encodeURIComponent(
              q,
            )}`,
            {
              credentials:
                "include",
            },
          )
            .then(
              async (
                response,
              ) => {
                const data =
                  await response.json();

                if (
                  !response.ok
                ) {
                  throw new Error(
                    typeof data?.error ===
                      "string"
                      ? data.error
                      : "Não foi possível buscar usuários.",
                  );
                }

                return data;
              },
            )
            .then(
              (data) => {
                if (
                  cancelled
                ) {
                  return;
                }

                setUsers(
                  Array.isArray(
                    data.users,
                  )
                    ? data.users
                    : [],
                );
              },
            )
            .catch(
              (error) => {
                if (
                  cancelled
                ) {
                  return;
                }

                console.error(
                  "ERRO AO BUSCAR USUÁRIOS:",
                  error,
                );

                setUsers(
                  [],
                );

                setUsersError(
                  "Não foi possível carregar os usuários.",
                );
              },
            )
            .finally(
              () => {
                if (
                  !cancelled
                ) {
                  setUsersLoading(
                    false,
                  );
                }
              },
            );
        },
        250,
      );

    return () => {
      cancelled = true;
      window.clearTimeout(
        timer,
      );
    };
  }, [draft]);

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

      const remote =
        overlayList(
          result.items,
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

  function submitSearch() {
    const q =
      draft.trim();

    setSuggestionsOpen(
      false,
    );

    apply({
      q:
        q ||
        undefined,
    });
  }

  function selectUser(
    user: UserSearchResult,
  ) {
    /*
     * Por enquanto o perfil público ainda
     * será criado na próxima etapa.
     *
     * Ao tocar no usuário, colocamos o nome
     * na busca e executamos a pesquisa.
     */
    setDraft(
      user.name,
    );

    setSuggestionsOpen(
      false,
    );

    apply({
      q: user.name,
    });
  }

  const genreOptions =
    genres.length
      ? genres
      : Object.keys(
          GENRE_PT,
        );

  const hasUsers =
    users.length > 0;

  const hasAnimes =
    items.length > 0;

  const hasResults =
    hasUsers ||
    hasAnimes;

  const showSuggestions =
    suggestionsOpen &&
    draft.trim().length > 0;

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

      <form
        className="relative flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submitSearch();
        }}
      >
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />

          <Input
            value={draft}
            onChange={(e) => {
              setDraft(
                e.target.value,
              );

              setSuggestionsOpen(
                true,
              );
            }}
            onFocus={() => {
              if (
                draft.trim()
              ) {
                setSuggestionsOpen(
                  true,
                );
              }
            }}
            placeholder="Buscar animes ou usuários…"
            className="pl-10"
            aria-label="Buscar animes ou usuários"
          />

          {showSuggestions && (
            <div className="absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
              <div className="border-b border-border px-4 py-3">
                <p className="text-[11px] font-medium tracking-[0.2em] text-muted uppercase">
                  Usuários
                </p>
              </div>

              {usersLoading ? (
                <div className="px-4 py-4 text-sm text-muted">
                  Buscando usuários...
                </div>
              ) : usersError ? (
                <div className="px-4 py-4 text-sm text-muted">
                  {usersError}
                </div>
              ) : users.length > 0 ? (
                <div className="max-h-72 overflow-y-auto py-1">
                  {users.map(
                    (user) => (
                      <button
                        key={
                          user.id
                        }
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-elevated active:bg-elevated"
                        onMouseDown={(
                          e,
                        ) => {
                          e.preventDefault();
                        }}
                        onClick={() =>
                          selectUser(
                            user,
                          )
                        }
                      >
                        {user.image ? (
                          <img
                            src={
                              user.image
                            }
                            alt=""
                            className="size-10 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-elevated">
                            <UserCircle className="size-5 text-muted" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {
                              user.name
                            }
                          </p>

                          <p className="text-xs text-muted">
                            Usuário HIKARI
                          </p>
                        </div>

                        <SearchIcon className="size-4 shrink-0 text-subtle" />
                      </button>
                    ),
                  )}
                </div>
              ) : (
                <div className="px-4 py-4">
                  <p className="text-sm text-muted">
                    Nenhum usuário encontrado.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <Button type="submit">
          Buscar
        </Button>

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
      </form>

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
              search.genre ??
              ""
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
              search.year ??
              ""
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
              search.format ??
              ""
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
              search.status ??
              ""
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
                  value={
                    o.value
                  }
                >
                  {o.label}
                </option>
              ),
            )}
          </NativeSelect>
        </Field>
      </div>

      {search.q &&
        users.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <UserCircle className="size-5" />

              <h2 className="font-display text-xl">
                Usuários
              </h2>

              <span className="text-xs text-muted">
                {users.length} resultado
                {users.length ===
                1
                  ? ""
                  : "s"}
              </span>
            </div>

            <div className="space-y-2">
              {users.map(
                (user) => (
                  <button
                    key={
                      user.id
                    }
                    type="button"
                    className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface p-3 text-left transition hover:bg-elevated"
                    onClick={() =>
                      selectUser(
                        user,
                      )
                    }
                  >
                    {user.image ? (
                      <img
                        src={
                          user.image
                        }
                        alt=""
                        className="size-12 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="grid size-12 shrink-0 place-items-center rounded-full bg-elevated">
                        <UserCircle className="size-6 text-muted" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {
                          user.name
                        }
                      </p>

                      <p className="text-xs text-muted">
                        Usuário HIKARI
                      </p>
                    </div>

                    <SearchIcon className="size-4 shrink-0 text-subtle" />
                  </button>
                ),
              )}
            </div>
          </section>
        )}

      {hasAnimes && (
        <section className="space-y-3">
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
        </section>
      )}

      {!hasResults &&
        !usersLoading && (
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
    <label
      className={
        className
      }
    >
      <Label className="mb-1.5 block">
        {label}
      </Label>

      {children}
    </label>
  );
}
