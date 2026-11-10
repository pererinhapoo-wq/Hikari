import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Clapperboard,
  Film,
  Lock,
  Search as SearchIcon,
  Star,
  Users,
  X,
} from "lucide-react";
import { searchCatalog } from "@/lib/api";
import { searchUsers, type SearchUserItem } from "@/lib/profile.functions";
import { displayTitle, type SlimAnime } from "@/lib/types";
import { overlayList } from "@/lib/overlay";
import { getResponsiveCoverAttrs } from "@/lib/image-utils";
import { useHikariStore } from "@/lib/store";
import {
  SearchCategorySelector,
  type SearchCategory,
} from "@/components/search/SearchCategorySelector";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: SearchCategory;
}

export function SearchModal({
  isOpen,
  onClose,
  initialCategory = "animes",
}: SearchModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const savedScrollYRef = useRef<number>(0);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  const [category, setCategory] = useState<SearchCategory>(initialCategory);
  const [query, setQuery] = useState("");

  // Resultados de Animes
  const [animeResults, setAnimeResults] = useState<SlimAnime[]>([]);
  const [animeLoading, setAnimeLoading] = useState(false);

  // Resultados de Usuários
  const [userResults, setUserResults] = useState<SearchUserItem[]>([]);
  const [userLoading, setUserLoading] = useState(false);

  const localAnimes = useHikariStore((s) => s.animes);

  /* =========================================================
     5. PROTEÇÃO OBRIGATÓRIA DA PÁGINA QUE ESTÁ ATRÁS DA BUSCA
     - Preserva posição exata de rolagem
     - Preserva conteúdo, estado e filtros
     - Não causa recarregamento ou navegação indevida
     - Ao fechar, retorna exatamente ao ponto anterior
  ========================================================== */
  useEffect(() => {
    if (!isOpen) return;

    // Salva o ponto exato de rolagem antes de qualquer interação com o modal
    const currentScrollY =
      window.scrollY || document.documentElement.scrollTop || 0;
    savedScrollYRef.current = currentScrollY;
    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

    // Foco automático no input de busca sem rolar a página
    const timer = window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
    }, 40);

    return () => {
      window.clearTimeout(timer);
      const targetScroll = savedScrollYRef.current;

      // Restaura a rolagem imediatamente e no próximo frame de animação
      window.scrollTo({
        top: targetScroll,
        behavior: "instant" as ScrollBehavior,
      });

      requestAnimationFrame(() => {
        window.scrollTo({
          top: targetScroll,
          behavior: "instant" as ScrollBehavior,
        });
      });

      // Restaura o foco sem provocar scroll
      try {
        previousActiveElementRef.current?.focus({ preventScroll: true });
      } catch {
        // no-op
      }
    };
  }, [isOpen]);

  const handleClose = useCallback(() => {
    // Desfoca o input antes de fechar para o navegador não alterar o scroll
    inputRef.current?.blur();
    onClose();
  }, [onClose]);

  // Tecla Escape para fechar a busca
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  // Limpeza de texto da busca ao tocar no botão X
  const handleClear = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setQuery("");
    setAnimeResults([]);
    setUserResults([]);
    inputRef.current?.focus({ preventScroll: true });
  };

  // Troca de categoria
  const handleCategoryChange = (nextCategory: SearchCategory) => {
    setCategory(nextCategory);
    inputRef.current?.focus({ preventScroll: true });
  };

  /* =========================================================
     4. BUSCA DE ANIMES (Exclusivamente catálogo)
  ========================================================== */
  useEffect(() => {
    if (!isOpen || category !== "animes") {
      setAnimeResults([]);
      setAnimeLoading(false);
      return;
    }

    const trimmed = query.trim();
    if (!trimmed) {
      setAnimeResults([]);
      setAnimeLoading(false);
      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(async () => {
      setAnimeLoading(true);

      try {
        const isAdultArea =
          typeof window !== "undefined" &&
          window.location.pathname.startsWith("/adult");

        const result = await searchCatalog({
          data: {
            q: trimmed,
            page: 1,
            adult: isAdultArea,
          },
        });

        if (cancelled) return;

        const normalized = trimmed
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();

        const localHits = overlayList([], localAnimes).filter((anime) => {
          const isHentai =
            anime.genres?.some(
              (genre) => genre.trim().toLowerCase() === "hentai",
            ) ?? false;

          if (isAdultArea ? !isHentai : isHentai) {
            return false;
          }

          const title =
            `${anime.titles?.romaji || ""} ${anime.titles?.english || ""} ${anime.titles?.native || ""}`
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase();

          const matchesDirect = title.includes(normalized);
          const matchesWords = normalized
            .split(/\s+/)
            .every((word) => title.includes(word));

          return matchesDirect || matchesWords;
        });

        const remote = overlayList(result.items ?? [], localAnimes);

        const seen = new Set<string>();
        const merged: SlimAnime[] = [];

        for (const anime of [...localHits, ...remote]) {
          if (seen.has(anime.id)) continue;
          seen.add(anime.id);
          merged.push(anime);
        }

        const ranked = merged.sort((a, b) => {
          const aTitle =
            `${a.titles.romaji} ${a.titles.english} ${a.titles.native}`
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase();

          const bTitle =
            `${b.titles.romaji} ${b.titles.english} ${b.titles.native}`
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase();

          const aStarts = aTitle.startsWith(normalized);
          const bStarts = bTitle.startsWith(normalized);

          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;

          const aContains = aTitle.includes(normalized);
          const bContains = bTitle.includes(normalized);

          if (aContains && !bContains) return -1;
          if (!aContains && bContains) return 1;

          return 0;
        });

        if (!cancelled) {
          setAnimeResults(ranked);
        }
      } catch {
        if (!cancelled) {
          setAnimeResults([]);
        }
      } finally {
        if (!cancelled) {
          setAnimeLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOpen, category, query, localAnimes]);

  /* =========================================================
     4. BUSCA DE USUÁRIOS (Exclusivamente membros)
  ========================================================== */
  useEffect(() => {
    if (!isOpen || category !== "users") {
      setUserResults([]);
      setUserLoading(false);
      return;
    }

    let clean = query.trim();
    if (clean.startsWith("@")) {
      clean = clean.slice(1).trim();
    }

    if (clean.length < 2) {
      setUserResults([]);
      setUserLoading(false);
      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(async () => {
      setUserLoading(true);

      try {
        const users = await searchUsers({
          data: {
            query: clean,
            page: 1,
            limit: 20,
          },
        });

        if (!cancelled) {
          setUserResults(users);
        }
      } catch {
        if (!cancelled) {
          setUserResults([]);
        }
      } finally {
        if (!cancelled) {
          setUserLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOpen, category, query]);

  if (!isOpen) return null;

  const isAnimes = category === "animes";
  const userQueryClean = query.trim().replace(/^@/, "").trim();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Caixa de busca do Hikari"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6"
    >
      {/* Backdrop: Escurece a página que fica atrás. Tocar nele fecha o modal */}
      <div
        onClick={handleClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity animate-in fade-in duration-200 cursor-pointer"
        aria-hidden="true"
      />

      {/* Janela modal centralizada com identidade visual moderna do Hikari */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 flex w-full max-w-2xl max-h-[85vh] flex-col overflow-hidden rounded-2xl border border-purple-500/25 bg-[#0b0914] shadow-[0_25px_65px_rgba(0,0,0,0.95),0_0_40px_rgba(168,85,247,0.18)] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200"
      >
        {/* =========================================================
            1. CAMPO DE PESQUISA NA PARTE SUPERIOR
            - Seta ao lado direito do campo (seletor Animes / Usuários)
            - Botão X ao lado da seta (somente um X, oculto quando vazio,
              visível ao digitar, limpa a pesquisa ao tocar)
        ========================================================== */}
        <div className="relative border-b border-purple-500/15 bg-surface/80 p-3 sm:p-3.5">
          <div className="relative flex items-center rounded-xl border border-purple-500/20 bg-elevated/70 px-3 py-1 shadow-inner transition-all focus-within:border-purple-500/50 focus-within:bg-elevated focus-within:ring-2 focus-within:ring-purple-500/25">
            {/* Ícone de busca à esquerda */}
            <SearchIcon className="pointer-events-none size-4 shrink-0 text-purple-400/80 mr-2" />

            {/* Input de texto */}
            <input
              ref={inputRef}
              type="text"
              enterKeyHint="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                isAnimes
                  ? "Buscar animes, filmes, títulos..."
                  : "Buscar membros por @username ou nome..."
              }
              className="h-10 sm:h-11 w-full flex-1 bg-transparent text-xs sm:text-sm text-fg outline-none placeholder:text-muted"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />

            {/* Grupo de controles à direita: [Botão X] + [Seta Seletor] */}
            <div className="flex items-center gap-1.5 shrink-0 ml-1">
              {/* 3. BOTÃO X:
                  - Mostrar somente um X
                  - Oculto quando o campo estiver vazio
                  - Mostrado após o usuário digitar
                  - Posicionado ao lado da seta
                  - Ao tocar, limpa a pesquisa */}
              {query.length > 0 && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleClear}
                  className="flex size-7 items-center justify-center rounded-lg text-muted hover:bg-white/10 hover:text-fg transition-colors"
                  aria-label="Limpar pesquisa"
                  title="Limpar pesquisa"
                >
                  <X className="size-4" />
                </button>
              )}

              {/* 2. SELETOR DE CATEGORIA:
                  - Seta ao lado direito do campo
                  - Ao tocar, mostra somente: Animes, Usuários
                  - Mantém a categoria identificada visualmente */}
              <SearchCategorySelector
                category={category}
                onChange={handleCategoryChange}
                align="right"
                size="sm"
              />
            </div>
          </div>
        </div>

        {/* =========================================================
            BARRA DE QUANTIDADE DE RESULTADOS (Quando houver busca)
        ========================================================== */}
        {query.trim().length > 0 && (
          <div className="flex items-center justify-between border-b border-purple-500/10 bg-white/[0.02] px-4 py-2 text-[11px] font-semibold text-subtle">
            <span className="uppercase tracking-wider">
              {isAnimes ? "Resultados de animes" : "Resultados de usuários"}
            </span>

            <span className="text-[#c084fc] font-bold">
              {isAnimes
                ? animeLoading
                  ? "Buscando..."
                  : `${animeResults.length} ${animeResults.length === 1 ? "resultado" : "resultados"}`
                : userLoading
                  ? "Buscando..."
                  : `${userResults.length} ${userResults.length === 1 ? "resultado" : "resultados"}`}
            </span>
          </div>
        )}

        {/* =========================================================
            LISTA VERTICAL DE RESULTADOS COM ROLAGEM INTERNA
            - Apresentados dentro do próprio modal
            - Rolagem interna suave
            - Sem botão 'Ver todos os resultados'
        ========================================================== */}
        <div
          data-search-scroll-container
          className="flex-1 overflow-y-auto overscroll-contain p-2 sm:p-3 divide-y divide-purple-500/10"
        >
          {/* =======================================================
              ESTADO INICIAL VAZIO (Antes de digitar)
          ======================================================== */}
          {!query.trim() && (
            <div className="px-4 py-12 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-purple-500/10 text-[#c084fc] ring-1 ring-purple-500/20">
                {isAnimes ? (
                  <Film className="size-6" />
                ) : (
                  <Users className="size-6" />
                )}
              </div>
              <p className="mt-3 text-sm font-semibold text-fg">
                {isAnimes
                  ? "Pesquise por qualquer anime do catálogo"
                  : "Encontre usuários e amigos na comunidade"}
              </p>
              <p className="mt-1 text-xs text-muted max-w-sm mx-auto">
                {isAnimes
                  ? "Digite títulos em português, inglês ou japonês para visualizar os resultados com capas e notas."
                  : "Digite o @username ou nome de exibição para acessar o perfil."}
              </p>
            </div>
          )}

          {/* =======================================================
              RESULTADOS DE ANIMES (Exclusivo catálogo)
          ======================================================== */}
          {isAnimes && query.trim().length > 0 && (
            <div>
              {animeLoading ? (
                <div className="space-y-2 p-1">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3.5 rounded-xl border border-white/5 bg-elevated/40 p-2.5 animate-pulse"
                    >
                      <div className="h-16 w-11 shrink-0 rounded-lg bg-white/10" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-44 rounded bg-white/10" />
                        <div className="h-3 w-28 rounded bg-white/5" />
                        <div className="h-3 w-36 rounded bg-white/5" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : animeResults.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <Clapperboard className="mx-auto size-8 text-subtle" />
                  <p className="mt-3 text-sm font-semibold text-fg">
                    Nenhum anime encontrado
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Não encontramos resultados para &quot;{query.trim()}&quot; no
                    catálogo. Tente outro título.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 p-1">
                  {animeResults.map((anime) => {
                    const coverAttrs = anime.cover
                      ? getResponsiveCoverAttrs(anime.cover, "thumb")
                      : null;

                    return (
                      <Link
                        key={anime.id}
                        to="/anime/$id"
                        params={{ id: anime.id }}
                        onClick={handleClose}
                        className="group flex items-start gap-3.5 rounded-xl p-2.5 transition-all hover:bg-elevated hover:shadow-[0_0_20px_rgba(168,85,247,0.15)]"
                      >
                        {/* Capa */}
                        {coverAttrs ? (
                          <img
                            src={coverAttrs.src}
                            srcSet={coverAttrs.srcSet}
                            sizes="48px"
                            alt=""
                            width={48}
                            height={64}
                            loading="lazy"
                            decoding="async"
                            className="h-16 w-11 shrink-0 rounded-lg object-cover ring-1 ring-white/10 transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-16 w-11 shrink-0 items-center justify-center rounded-lg bg-surface text-muted ring-1 ring-white/10">
                            <Clapperboard className="size-4" />
                          </div>
                        )}

                        {/* Metadados reais disponíveis */}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-semibold text-fg group-hover:text-[#c084fc] transition-colors line-clamp-1">
                            {displayTitle(anime)}
                          </p>

                          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted flex-wrap">
                            {anime.score && (
                              <span className="inline-flex items-center gap-1 font-semibold text-amber-400">
                                <Star className="size-3 fill-amber-400 text-amber-400" />
                                {Number.isInteger(anime.score)
                                  ? anime.score
                                  : Number(anime.score.toFixed(1))}
                              </span>
                            )}

                            {anime.year && (
                              <span className="text-zinc-300 font-medium">
                                {anime.year}
                              </span>
                            )}

                            {anime.format && (
                              <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-300">
                                {anime.format === "TV"
                                  ? "Série"
                                  : anime.format === "MOVIE"
                                    ? "Filme"
                                    : anime.format}
                              </span>
                            )}

                            {anime.episodes && (
                              <span className="text-zinc-400 text-[10px]">
                                {anime.episodes} eps
                              </span>
                            )}
                          </div>

                          {/* Gêneros reais disponíveis */}
                          {anime.genres && anime.genres.length > 0 && (
                            <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                              {anime.genres.slice(0, 3).map((g) => (
                                <span
                                  key={g}
                                  className="rounded-md bg-purple-500/10 border border-purple-500/15 px-1.5 py-0.5 text-[10px] font-medium text-purple-300/90"
                                >
                                  {g}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <span className="hidden sm:inline-flex text-xs font-semibold text-muted group-hover:text-fg group-hover:translate-x-0.5 transition-all self-center shrink-0">
                          Ver anime →
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* =======================================================
              RESULTADOS DE USUÁRIOS (Exclusivo membros)
          ======================================================== */}
          {!isAnimes && query.trim().length > 0 && (
            <div>
              {userQueryClean.length < 2 && (
                <div className="px-4 py-10 text-center">
                  <Users className="mx-auto size-8 text-subtle" />
                  <p className="mt-3 text-sm font-semibold text-fg">
                    Digite pelo menos 2 caracteres
                  </p>
                  <p className="mt-1 text-xs text-muted max-w-sm mx-auto">
                    Pesquise por @username ou nome de exibição para encontrar
                    membros da comunidade.
                  </p>
                </div>
              )}

              {userQueryClean.length >= 2 && userLoading && (
                <div className="space-y-2 p-1">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-xl border border-white/5 bg-elevated/40 p-2.5 animate-pulse"
                    >
                      <div className="size-11 shrink-0 rounded-xl bg-white/10" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-36 rounded bg-white/10" />
                        <div className="h-3 w-20 rounded bg-white/5" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {userQueryClean.length >= 2 &&
                !userLoading &&
                userResults.length === 0 && (
                  <div className="px-4 py-12 text-center">
                    <Users className="mx-auto size-8 text-subtle" />
                    <p className="mt-3 text-sm font-semibold text-fg">
                      Nenhum usuário encontrado
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Não encontramos membros correspondentes a &quot;
                      {query.trim()}&quot;. Tente outro username ou nome.
                    </p>
                  </div>
                )}

              {userQueryClean.length >= 2 &&
                !userLoading &&
                userResults.length > 0 && (
                  <div className="space-y-1.5 p-1">
                    {userResults.map((person) => {
                      const avatarLetter = (
                        person.displayName ||
                        person.nick ||
                        "U"
                      )
                        .charAt(0)
                        .toUpperCase();

                      return (
                        /* 4. COMPORTAMENTO:
                           Ao selecionar um usuário, abrir o Perfil novo (/profile/$nick) */
                        <Link
                          key={person.userId}
                          to="/profile/$nick"
                          params={{ nick: person.nick }}
                          onClick={handleClose}
                          className="group flex items-center justify-between gap-3 rounded-xl p-2.5 transition-all hover:bg-elevated hover:shadow-[0_0_20px_rgba(168,85,247,0.15)]"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* Avatar */}
                            <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#161424] font-semibold text-sm text-[#c084fc] ring-1 ring-purple-500/25 group-hover:ring-purple-500/50 transition-all">
                              {person.avatarUrl ? (
                                <img
                                  src={person.avatarUrl}
                                  alt=""
                                  className="size-full object-cover"
                                />
                              ) : (
                                <span>{avatarLetter}</span>
                              )}
                            </div>

                            {/* Identificação e badges */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="truncate text-xs sm:text-sm font-semibold text-fg group-hover:text-[#c084fc] transition-colors">
                                  {person.displayName || person.nick}
                                </p>

                                {person.accountType === "private" && (
                                  <span
                                    className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 border border-white/[0.08]"
                                    title="Conta privada"
                                  >
                                    <Lock className="size-2.5 text-zinc-400" />
                                    <span>Privada</span>
                                  </span>
                                )}

                                {person.isFollowing && (
                                  <span className="inline-flex items-center rounded-md bg-[#a855f7]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#c084fc] border border-purple-500/20">
                                    Seguindo
                                  </span>
                                )}

                                {person.isOwner && (
                                  <span className="inline-flex items-center rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-300">
                                    Você
                                  </span>
                                )}
                              </div>

                              <p className="truncate text-[11px] sm:text-xs text-muted">
                                @{person.nick}
                              </p>
                            </div>
                          </div>

                          <span className="shrink-0 rounded-lg border border-purple-500/20 bg-purple-500/10 px-2.5 py-1 text-xs font-semibold text-[#c084fc] group-hover:bg-[#a855f7] group-hover:text-white transition-all">
                            Ver Perfil
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Rodapé discreto */}
        <div className="flex items-center justify-end border-t border-purple-500/15 bg-elevated/40 px-4 py-2 text-[11px] text-subtle">
          <span className="text-[10px] text-muted">Hikari Search</span>
        </div>
      </div>
    </div>
  );
}
