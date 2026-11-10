import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
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
import { useScrollLock } from "@/lib/scroll-lock";

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
  useScrollLock(isOpen);
  const navigate = useNavigate();
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
     PROTEÇÃO DA PÁGINA QUE ESTÁ ATRÁS DA BUSCA
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
     BUSCA DE ANIMES (Exclusivamente catálogo)
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
     BUSCA DE USUÁRIOS (Exclusivamente membros)
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6"
    >
      {/* Backdrop: Escurece suavemente o fundo */}
      <div
        onClick={handleClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity animate-in fade-in duration-200 cursor-pointer"
        aria-hidden="true"
      />

      {/* Janela modal compacta e moderna inspirada na proporção do BingeBang */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 flex w-full max-w-lg max-h-[78vh] sm:max-h-[82vh] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#12101e]/98 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_25px_rgba(168,85,247,0.12)] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200"
      >
        {/* =========================================================
            CAMPO DE PESQUISA COMPACTO
            - Ícone à esquerda
            - Input moderno
            - Botão X para limpar
            - Seletor compacto Animes / Usuários à direita
            - Sem efeito roxo preso ao teclar Ir no celular
        ========================================================== */}
        <div className="relative border-b border-white/5 bg-white/[0.02] p-2 sm:p-2.5">
          <div className="relative flex items-center rounded-xl border border-white/10 bg-white/[0.04] px-2.5 sm:px-3 h-10 sm:h-10.5 transition-colors focus-within:border-purple-400/40 focus-within:bg-[#181528]">
            {/* Ícone de busca discreto */}
            <SearchIcon className="pointer-events-none size-4 shrink-0 text-zinc-400 mr-2" />

            {/* Input de texto */}
            <input
              ref={inputRef}
              type="text"
              enterKeyHint="go"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  // Desfoca imediatamente para remover o foco e evitar anel roxo preso no celular
                  (e.currentTarget as HTMLInputElement).blur();
                  const clean = query.trim();
                  if (!clean) return;
                  if (category === "animes") {
                    onClose();
                    void navigate({
                      to: "/search",
                      search: { q: clean },
                    });
                  } else if (category === "users") {
                    if (userResults.length > 0) {
                      onClose();
                      void navigate({
                        to: "/profile/$nick",
                        params: { nick: userResults[0].nick },
                      });
                    } else {
                      onClose();
                      void navigate({
                        to: "/search",
                        search: { q: clean, tab: "users" },
                      });
                    }
                  }
                }
              }}
              placeholder={
                isAnimes
                  ? "Buscar animes, filmes, títulos..."
                  : "Buscar membros por @username ou nome..."
              }
              className="h-full w-full flex-1 bg-transparent text-xs sm:text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />

            {/* Controles da direita: [X] + [Seletor] */}
            <div className="flex items-center gap-1.5 shrink-0 ml-1">
              {query.length > 0 && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleClear}
                  className="flex size-6 items-center justify-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-fg transition-colors"
                  aria-label="Limpar pesquisa"
                  title="Limpar pesquisa"
                >
                  <X className="size-3.5" />
                </button>
              )}

              {/* Seletor compacto Animes / Usuários */}
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
            HEADER DE CONTAGEM DE RESULTADOS (Estilo BingeBang)
        ========================================================== */}
        {query.trim().length > 0 && (
          <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.015] px-3.5 py-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            <span>
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
            LISTA VERTICAL DE RESULTADOS COMPACTA
        ========================================================== */}
        <div
          data-search-scroll-container
          className="flex-1 overflow-y-auto overscroll-contain p-1.5 sm:p-2"
        >
          {/* ESTADO INICIAL VAZIO */}
          {!query.trim() && (
            <div className="px-4 py-8 text-center">
              <div className="mx-auto flex size-9 items-center justify-center rounded-xl bg-purple-500/10 text-[#c084fc] ring-1 ring-purple-500/20">
                {isAnimes ? (
                  <Film className="size-4.5" />
                ) : (
                  <Users className="size-4.5" />
                )}
              </div>
              <p className="mt-2.5 text-xs sm:text-sm font-semibold text-zinc-200">
                {isAnimes
                  ? "Pesquise por qualquer anime do catálogo"
                  : "Encontre usuários e amigos na comunidade"}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-400 max-w-xs mx-auto leading-normal">
                {isAnimes
                  ? "Digite títulos em português, inglês ou japonês para ver notas e detalhes."
                  : "Digite o @username ou nome de exibição para acessar o perfil."}
              </p>
            </div>
          )}

          {/* RESULTADOS DE ANIMES */}
          {isAnimes && query.trim().length > 0 && (
            <div>
              {animeLoading ? (
                <div className="space-y-1.5 p-1">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] p-2 animate-pulse"
                    >
                      <div className="h-13 w-9 shrink-0 rounded-md bg-white/10" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3.5 w-40 rounded bg-white/10" />
                        <div className="h-2.5 w-24 rounded bg-white/5" />
                        <div className="h-2.5 w-32 rounded bg-white/5" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : animeResults.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Clapperboard className="mx-auto size-7 text-zinc-500" />
                  <p className="mt-2 text-xs sm:text-sm font-semibold text-zinc-200">
                    Nenhum anime encontrado
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-400">
                    Não encontramos resultados para &quot;{query.trim()}&quot;. Tente outro título.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {animeResults.map((anime) => {
                    const coverAttrs = anime.cover
                      ? getResponsiveCoverAttrs(anime.cover, "thumb")
                      : null;

                    const scoreValue = anime.score
                      ? Number.isInteger(anime.score)
                        ? anime.score
                        : Number(anime.score.toFixed(1))
                      : null;

                    return (
                      <Link
                        key={anime.id}
                        to="/anime/$id"
                        params={{ id: anime.id }}
                        onClick={handleClose}
                        className="group flex items-center gap-2.5 sm:gap-3 rounded-xl p-1.5 sm:p-2 transition-all hover:bg-white/[0.04]"
                      >
                        {/* Capa compacta */}
                        {coverAttrs ? (
                          <img
                            src={coverAttrs.src}
                            srcSet={coverAttrs.srcSet}
                            sizes="40px"
                            alt=""
                            width={40}
                            height={56}
                            loading="lazy"
                            decoding="async"
                            className="h-13 w-9 sm:h-14 sm:w-10 shrink-0 rounded-md object-cover ring-1 ring-white/10 transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-13 w-9 sm:h-14 sm:w-10 shrink-0 items-center justify-center rounded-md bg-white/[0.04] text-zinc-500 ring-1 ring-white/10">
                            <Clapperboard className="size-3.5" />
                          </div>
                        )}

                        {/* Metadados alinhados e elegantes */}
                        <div className="min-w-0 flex-1">
                          {/* Título */}
                          <p className="text-xs sm:text-[13px] font-semibold text-zinc-100 group-hover:text-[#c084fc] transition-colors line-clamp-1">
                            {displayTitle(anime)}
                          </p>

                          {/* Linha de info: Estrela + Nota · Ano · Gêneros */}
                          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] sm:text-[11px] text-zinc-400">
                            {scoreValue && (
                              <span className="inline-flex items-center gap-1 font-bold text-amber-400">
                                <Star className="size-2.5 sm:size-3 fill-amber-400 text-amber-400" />
                                {scoreValue}
                              </span>
                            )}

                            {scoreValue && anime.year && (
                              <span className="text-zinc-600">·</span>
                            )}

                            {anime.year && (
                              <span className="text-zinc-400 font-medium">
                                {anime.year}
                              </span>
                            )}

                            {anime.genres && anime.genres.length > 0 && (
                              <>
                                <span className="text-zinc-600">·</span>
                                <span className="text-zinc-400 truncate max-w-[130px] sm:max-w-xs">
                                  {anime.genres.slice(0, 2).join(", ")}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Badge de formato */}
                          <div className="mt-1 flex items-center gap-1.5">
                            {anime.format && (
                              <span className="rounded bg-purple-500/15 border border-purple-500/25 px-1.5 py-0.2 text-[9px] font-semibold uppercase tracking-wider text-purple-300">
                                {anime.format === "TV"
                                  ? "Série"
                                  : anime.format === "MOVIE"
                                    ? "Filme"
                                    : anime.format}
                              </span>
                            )}

                            {anime.episodes && (
                              <span className="text-zinc-500 text-[9px]">
                                {anime.episodes} eps
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* RESULTADOS DE USUÁRIOS */}
          {!isAnimes && query.trim().length > 0 && (
            <div>
              {userQueryClean.length < 2 && (
                <div className="px-4 py-8 text-center">
                  <Users className="mx-auto size-7 text-zinc-500" />
                  <p className="mt-2 text-xs sm:text-sm font-semibold text-zinc-200">
                    Digite pelo menos 2 caracteres
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-400 max-w-xs mx-auto">
                    Pesquise por @username ou nome de exibição para encontrar membros.
                  </p>
                </div>
              )}

              {userQueryClean.length >= 2 && userLoading && (
                <div className="space-y-1.5 p-1">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] p-2 animate-pulse"
                    >
                      <div className="size-9 shrink-0 rounded-xl bg-white/10" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3.5 w-32 rounded bg-white/10" />
                        <div className="h-2.5 w-18 rounded bg-white/5" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {userQueryClean.length >= 2 &&
                !userLoading &&
                userResults.length === 0 && (
                  <div className="px-4 py-8 text-center">
                    <Users className="mx-auto size-7 text-zinc-500" />
                    <p className="mt-2 text-xs sm:text-sm font-semibold text-zinc-200">
                      Nenhum usuário encontrado
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-400">
                      Não encontramos membros com &quot;{query.trim()}&quot;. Tente outro username ou nome.
                    </p>
                  </div>
                )}

              {userQueryClean.length >= 2 &&
                !userLoading &&
                userResults.length > 0 && (
                  <div className="space-y-1">
                    {userResults.map((person) => {
                      const avatarLetter = (
                        person.displayName ||
                        person.nick ||
                        "U"
                      )
                        .charAt(0)
                        .toUpperCase();

                      return (
                        <Link
                          key={person.userId}
                          to="/profile/$nick"
                          params={{ nick: person.nick }}
                          onClick={handleClose}
                          className="group flex items-center justify-between gap-2.5 rounded-xl p-1.5 sm:p-2 transition-all hover:bg-white/[0.04]"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {/* Avatar compacto */}
                            <div className="flex size-9 sm:size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#161424] font-semibold text-xs sm:text-sm text-[#c084fc] ring-1 ring-purple-500/20 group-hover:ring-purple-500/40 transition-all">
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

                            {/* Informações */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="truncate text-xs sm:text-[13px] font-semibold text-zinc-100 group-hover:text-[#c084fc] transition-colors">
                                  {person.displayName || person.nick}
                                </p>

                                {person.accountType === "private" && (
                                  <span
                                    className="inline-flex items-center gap-0.5 rounded bg-white/[0.06] px-1 py-0.2 text-[9px] font-medium text-zinc-400 border border-white/[0.08]"
                                    title="Conta privada"
                                  >
                                    <Lock className="size-2 text-zinc-400" />
                                    <span>Privada</span>
                                  </span>
                                )}

                                {person.isFollowing && (
                                  <span className="inline-flex items-center rounded bg-[#a855f7]/15 px-1 py-0.2 text-[9px] font-semibold text-[#c084fc] border border-purple-500/20">
                                    Seguindo
                                  </span>
                                )}

                                {person.isOwner && (
                                  <span className="inline-flex items-center rounded bg-white/10 px-1 py-0.2 text-[9px] font-semibold text-zinc-300">
                                    Você
                                  </span>
                                )}
                              </div>

                              <p className="truncate text-[10px] sm:text-[11px] text-zinc-400">
                                @{person.nick}
                              </p>
                            </div>
                          </div>

                          <span className="shrink-0 rounded-lg border border-purple-500/25 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-[#c084fc] group-hover:bg-[#a855f7] group-hover:text-white transition-all">
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

        {/* Rodapé minimalista */}
        <div className="flex items-center justify-between border-t border-white/5 bg-white/[0.01] px-3.5 py-1.5 text-[10px] text-zinc-500">
          <span>Hikari Search</span>
          <span className="hidden sm:inline">ESC para fechar</span>
        </div>
      </div>
    </div>
  );
}
