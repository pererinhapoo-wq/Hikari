import {
  createFileRoute,
  Link,
  useNavigate,
} from "@tanstack/react-router";

import {
  ChevronLeft,
  ChevronRight,
  Tags,
} from "lucide-react";

import { AnimeCard, AnimeCardSkeleton } from "@/components/anime-card";

import { fetchAdultCatalog } from "@/lib/api";
import { overlayList } from "@/lib/overlay";
import { useHikariStore } from "@/lib/store";

type AdultTagItem = {
  name: string;
  count: number;
};

export const Route = createFileRoute("/adult/tags")({
  validateSearch: (
    search: Record<string, unknown>,
  ) => {
    const page = Number(search.page);

    return {
      tag:
        typeof search.tag === "string" &&
        search.tag.trim()
          ? search.tag.trim()
          : undefined,

      page:
        Number.isInteger(page) && page >= 1
          ? page
          : 1,
    };
  },

  loader: () => fetchAdultCatalog(),

  pendingComponent: AdultTagsPending,

  component: AdultTagsPage,
});

function AdultTagsPending() {
  return (
    <div className="space-y-6 py-5 sm:space-y-8 sm:py-8">
      <section>
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 animate-pulse items-center justify-center rounded-xl bg-elevated" />

          <div>
            <div className="h-7 w-32 animate-pulse rounded bg-elevated" />

            <div className="mt-2 h-4 w-56 animate-pulse rounded bg-elevated" />
          </div>
        </div>
      </section>

      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }, (_, index) => (
            <div
              key={index}
              className="h-12 animate-pulse rounded-xl bg-elevated"
            />
          ))}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 8 }, (_, index) => (
          <AnimeCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

function AdultTagsPage() {
  const data = Route.useLoaderData();

  const navigate = useNavigate({
    from: "/adult/tags",
  });

  const {
    tag,
    page,
  } = Route.useSearch();

  const locals = useHikariStore(
    (state) => state.animes,
  );

  /*
   * Por enquanto usamos o catálogo +18 que já existe.
   *
   * As tags reais serão ligadas à resposta da API
   * na próxima etapa, sem mexer nas outras páginas.
   */
  const items = overlayList(
    data.items ?? [],
    locals,
  );

  /*
   * Lista temporária de tags +18.
   *
   * Esta parte será substituída pelos dados reais
   * vindos da API assim que adicionarmos as tags
   * ao retorno de fetchAdultCatalog().
   */
  const tags: AdultTagItem[] = [
    {
      name: "Hentai",
      count: items.length,
    },
    {
      name: "Adult",
      count: items.length,
    },
    {
      name: "18+",
      count: items.length,
    },
  ];

  const selectedTag = tag
    ? tags.find(
        (item) => item.name === tag,
      )
    : undefined;

  /*
   * Lista de animes da tag selecionada.
   *
   * A paginação fica local à página /adult/tags
   * para não interferir em /adult/hentai.
   */
  const itemsPerPage = 8;

  const filteredItems = selectedTag
    ? items
    : [];

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredItems.length /
        itemsPerPage,
    ),
  );

  const currentPage = Math.min(
    page,
    totalPages,
  );

  const startIndex =
    (currentPage - 1) *
    itemsPerPage;

  const paginatedItems =
    filteredItems.slice(
      startIndex,
      startIndex + itemsPerPage,
    );

  const pageNumbers = (() => {
    const pages = new Set<number>();

    pages.add(1);
    pages.add(currentPage);

    if (currentPage > 1) {
      pages.add(currentPage - 1);
    }

    if (currentPage < totalPages) {
      pages.add(currentPage + 1);
    }

    return Array.from(pages)
      .filter(
        (value) =>
          value >= 1 &&
          value <= totalPages,
      )
      .sort(
        (a, b) => a - b,
      );
  })();

  function openTag(
    nextTag: string,
  ) {
    void navigate({
      to: "/adult/tags",
      search: {
        tag: nextTag,
        page: 1,
      },
    }).then(() => {
      window.scrollTo({
        top: 0,
        behavior: "auto",
      });
    });
  }

  function goToPage(
    nextPage: number,
  ) {
    if (
      nextPage < 1 ||
      nextPage > totalPages ||
      nextPage === currentPage
    ) {
      return;
    }

    void navigate({
      to: "/adult/tags",
      search: {
        tag,
        page: nextPage,
      },
    }).then(() => {
      window.scrollTo({
        top: 0,
        behavior: "auto",
      });
    });
  }

  return (
    <div className="space-y-6 py-5 sm:space-y-8 sm:py-8">
      {!tag ? (
        <>
          <section>
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-elevated">
                <Tags className="size-5 text-fg" />
              </div>

              <div>
                <h1 className="font-display text-2xl tracking-tight sm:text-3xl">
                  Tags
                </h1>

                <p className="mt-1 text-sm text-muted">
                  Explore o conteúdo +18 por tag.
                </p>
              </div>
            </div>
          </section>

          {tags.length === 0 ? (
            <p className="py-16 text-center text-muted">
              Nenhuma tag disponível no momento.
            </p>
          ) : (
            <section>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {tags.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() =>
                      openTag(item.name)
                    }
                    className="flex min-h-12 items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm font-medium text-fg transition-colors hover:bg-elevated"
                  >
                    <Tags className="size-4 shrink-0 text-muted" />

                    <span className="min-w-0 flex-1 truncate">
                      {item.name}
                    </span>

                    <span className="shrink-0 text-xs text-muted">
                      {item.count}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <>
          <section>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-elevated">
                  <Tags className="size-5 text-fg" />
                </div>

                <div className="min-w-0">
                  <h1 className="font-display text-2xl tracking-tight sm:text-3xl">
                    {tag}
                  </h1>

                  <p className="mt-1 text-sm text-muted">
                    Conteúdo +18 da tag {tag}.
                  </p>
                </div>
              </div>

              <Link
                to="/adult/tags"
                aria-label="Voltar para tags"
                title="Voltar para tags"
                className="flex size-10 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-elevated hover:text-fg"
              >
                <span
                  className="text-2xl leading-none"
                  aria-hidden="true"
                >
                  ×
                </span>
              </Link>
            </div>
          </section>

          {paginatedItems.length === 0 ? (
            <p className="py-16 text-center text-muted">
              Nenhum anime encontrado para esta tag.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {paginatedItems.map(
                (anime) => (
                  <AnimeCard
                    key={anime.id}
                    anime={anime}
                    size="lg"
                  />
                ),
              )}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-1 pt-2">
              <button
                type="button"
                onClick={() =>
                  goToPage(
                    currentPage - 1,
                  )
                }
                disabled={
                  currentPage === 1
                }
                aria-label="Página anterior"
                className="flex size-10 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-elevated hover:text-fg disabled:pointer-events-none disabled:opacity-35"
              >
                <ChevronLeft className="size-5" />
              </button>

              <div className="flex items-center gap-1">
                {pageNumbers.map(
                  (pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() =>
                        goToPage(
                          pageNumber,
                        )
                      }
                      aria-current={
                        pageNumber ===
                        currentPage
                          ? "page"
                          : undefined
                      }
                      className={
                        pageNumber ===
                        currentPage
                          ? "flex size-10 items-center justify-center rounded-lg bg-elevated text-sm font-semibold text-fg"
                          : "flex size-10 items-center justify-center rounded-lg text-sm text-muted transition-colors hover:bg-elevated hover:text-fg"
                      }
                    >
                      {pageNumber}
                    </button>
                  ),
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  goToPage(
                    currentPage + 1,
                  )
                }
                disabled={
                  currentPage ===
                  totalPages
                }
                aria-label="Próxima página"
                className="flex size-10 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-elevated hover:text-fg disabled:pointer-events-none disabled:opacity-35"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
      }
