import { Link } from "@tanstack/react-router";
import {
  Calendar,
  ChevronRight,
  Film,
  Layers,
  Star,
} from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import {
  getPersonWorks,
  getStudioWorks,
  type EntityWorksData,
} from "@/lib/entity-works";
import { cn } from "@/lib/utils";

export interface SelectedEntityTarget {
  type: "studio" | "dublador" | "staff" | "person";
  id?: string | number | null;
  name: string;
  image?: string | null;
  subtitle?: string | null;
}

interface EntityWorksExpansionProps {
  entity: SelectedEntityTarget;
  onClear?: () => void;
  accentColor?: "purple" | "violet" | "indigo" | "pink" | "sky";
  className?: string;
  autoScroll?: boolean;
}

export const EntityWorksExpansion = memo(function EntityWorksExpansion({
  entity,
  onClear,
  className,
  autoScroll = true,
}: EntityWorksExpansionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<EntityWorksData | null>(null);
  const [loading, setLoading] = useState(true);

  const isStudio = entity.type === "studio";
  const isDublador = entity.type === "dublador";

  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setData(null);

    const load = async () => {
      try {
        let result: EntityWorksData;
        if (entity.type === "studio") {
          result = await getStudioWorks(entity.name, entity.id);
        } else {
          const prefer = isDublador ? "dublador" : ("staff" as const);
          result = await getPersonWorks(entity.name, entity.id, prefer);
        }

        if (!isCancelled) {
          setData(result);
          setLoading(false);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("[EntityWorksExpansion] Erro ao carregar trabalhos:", err);
          setData({
            kind: entity.type === "studio" ? "studio" : "staff",
            name: entity.name,
            error: "Falha ao carregar as produções associadas.",
          });
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      isCancelled = true;
    };
  }, [entity.name, entity.id, entity.type, isDublador]);

  const isFirstMountRef = useRef(true);

  // Auto-scroll suave para focar na seção como substituição de tela, mantendo a visualização confortável
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (isFirstMountRef.current) {
        isFirstMountRef.current = false;
        if (rect.top > window.innerHeight - 100 || rect.top < 60) {
          containerRef.current.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      }
    }
  }, [entity.name, autoScroll]);

  const totalWorksCount = isStudio
    ? data?.studioAnimes?.length ?? 0
    : isDublador
      ? data?.dubladorWorks?.length ?? 0
      : data?.staffWorks?.length ?? 0;

  return (
    <div
      ref={containerRef}
      aria-label={`Trabalhos e Produções de ${entity.name}`}
      className={cn(
        "relative w-full space-y-5 transition-all duration-300 animate-in fade-in",
        className,
      )}
    >
      {/* Luz ambiente de fundo violeta sutil conforme padrão Anime Stats */}
      <div
        className="pointer-events-none absolute -left-16 -top-10 size-72 rounded-full bg-violet-600/10 blur-[100px]"
        aria-hidden="true"
      />

      {/* 1. Cabeçalho com padrão idêntico ao Anime Stats de account.tsx:
          - Indicador circular luminoso
          - Título contextual com separador
          - Contador numérico de resultados
          - Sem botões Voltar, X ou Fechar
          - Sem seletores de outras entidades
      */}
      <div className="relative flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div
          onClick={() => onClear?.()}
          className={cn(
            "flex items-center gap-3 min-w-0 transition-opacity",
            onClear && "cursor-pointer group",
          )}
          title={onClear ? "Toque no título para voltar à visualização original" : undefined}
        >
          <span
            className={cn(
              "size-3.5 rounded-full shrink-0 transition-transform",
              onClear && "group-hover:scale-110",
              isStudio
                ? "bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.85)]"
                : isDublador
                  ? "bg-pink-500 shadow-[0_0_12px_rgba(236,72,153,0.85)]"
                  : "bg-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.85)]",
            )}
          />
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white truncate">
            {isStudio
              ? `Produções — ${entity.name}`
              : isDublador
                ? `Dublagens — ${entity.name}`
                : `Trabalhos — ${entity.name}`}
          </h2>

          {!loading && (
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-zinc-300">
              {totalWorksCount}
            </span>
          )}
        </div>
      </div>

      {/* 2. Conteúdo Principal: Grade Responsiva de Cards de Obras */}
      <div className="relative">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 sm:gap-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="aspect-[2/3] animate-pulse rounded-xl bg-white/[0.04] border border-white/[0.05]"
              />
            ))}
          </div>
        ) : isStudio ? (
          /* =========================================================
             A. TRABALHOS DE ESTÚDIOS (Animes relacionados com capas e nomes)
          ========================================================= */
          (data?.studioAnimes?.length ?? 0) === 0 ? (
            <EmptyNotice message="Nenhuma produção registrada para este estúdio no catálogo." />
          ) : (
            <div className="grid grid-cols-2 gap-3 min-[480px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 sm:gap-4">
              {data!.studioAnimes!.map((anime) => (
                <Link
                  key={anime.id}
                  to="/anime/$id"
                  params={{ id: anime.id }}
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-purple-500/15 bg-[#0f0d1a] p-2 transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/40 hover:bg-[#151224] hover:shadow-[0_8px_24px_rgba(168,85,247,0.2)] cursor-pointer"
                >
                  <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-[#141220]">
                    {anime.cover ? (
                      <img
                        src={anime.cover}
                        alt={anime.title}
                        loading="lazy"
                        className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-zinc-600">
                        <Film className="size-6" />
                      </div>
                    )}

                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />

                    {(anime.year || anime.format) && (
                      <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between text-[9px] font-semibold text-zinc-300">
                        <span>
                          {anime.year}
                          {anime.year && anime.format ? " • " : ""}
                          {anime.format}
                        </span>
                        {anime.score && (
                          <span className="flex items-center gap-0.5 text-amber-400">
                            <Star className="size-2.5 fill-amber-400" />
                            {anime.score.toFixed(1)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-2 min-w-0">
                    <h4
                      className="line-clamp-2 text-xs font-semibold text-zinc-100 transition-colors group-hover:text-purple-300 leading-snug"
                      title={anime.title}
                    >
                      {anime.title}
                    </h4>
                  </div>
                </Link>
              ))}
            </div>
          )
        ) : isDublador ? (
          /* =========================================================
             B. TRABALHOS DE DUBLADORES (Associação: Personagem + Dublador + Anime)
          ========================================================= */
          (data?.dubladorWorks?.length ?? 0) === 0 ? (
            <EmptyNotice message="Nenhum papel de dublagem encontrado para este profissional." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              {data!.dubladorWorks!.map((work) => {
                const isMainRole =
                  (work.character.role || "").toUpperCase() === "MAIN";
                const roleLabel = isMainRole ? "Protagonista" : "Secundário";

                return (
                  <article
                    key={work.id}
                    className="group relative flex items-stretch gap-3 overflow-hidden rounded-2xl border border-purple-500/15 bg-[#0e0c19] p-2.5 sm:p-3 transition-all duration-300 hover:border-purple-500/40 hover:bg-[#131023] hover:shadow-[0_8px_24px_rgba(168,85,247,0.18)]"
                  >
                    {/* Capa do Anime clicável */}
                    <Link
                      to="/anime/$id"
                      params={{ id: work.anime.id }}
                      className="relative w-16 sm:w-20 shrink-0 aspect-[2/3] overflow-hidden rounded-xl bg-[#161328] group/cover cursor-pointer"
                      title={`Ver ${work.anime.title}`}
                    >
                      {work.anime.cover ? (
                        <img
                          src={work.anime.cover}
                          alt={work.anime.title}
                          loading="lazy"
                          className="size-full object-cover transition-transform duration-500 group-hover/cover:scale-105"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center text-zinc-600">
                          <Film className="size-5" />
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-40 group-hover/cover:opacity-60 transition-opacity" />
                    </Link>

                    {/* Informações da Obra e do Personagem Dublado */}
                    <div className="flex flex-1 flex-col justify-between min-w-0 py-0.5">
                      <div>
                        <Link
                          to="/anime/$id"
                          params={{ id: work.anime.id }}
                          className="group/title block min-w-0"
                        >
                          <h4
                            className="line-clamp-1 text-xs sm:text-sm font-bold text-zinc-100 transition-colors group-hover/title:text-purple-300"
                            title={work.anime.title}
                          >
                            {work.anime.title}
                          </h4>
                          {(work.anime.year || work.anime.format) && (
                            <p className="mt-0.5 text-[10px] sm:text-[11px] text-zinc-400 flex items-center gap-1.5">
                              {work.anime.year && (
                                <span className="inline-flex items-center gap-1">
                                  <Calendar className="size-2.5 text-zinc-500" />
                                  {work.anime.year}
                                </span>
                              )}
                              {work.anime.format && (
                                <span>• {work.anime.format}</span>
                              )}
                            </p>
                          )}
                        </Link>

                        {/* Personagem que o dublador interpretou */}
                        <div className="mt-2.5 flex items-center gap-2.5 rounded-xl border border-white/[0.05] bg-white/[0.02] p-1.5 min-w-0">
                          <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-[#18152b] border border-purple-500/20">
                            {work.character.image ? (
                              <img
                                src={work.character.image}
                                alt={work.character.name}
                                loading="lazy"
                                className="size-full object-cover object-top"
                              />
                            ) : (
                              <div className="flex size-full items-center justify-center font-display text-xs font-bold text-purple-400">
                                {work.character.name.charAt(0)}
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <span className="text-[9px] uppercase tracking-wider font-semibold text-purple-300/80">
                              Dublou como
                            </span>
                            <p
                              className="truncate text-xs font-semibold text-white"
                              title={work.character.name}
                            >
                              {work.character.name}
                            </p>
                          </div>

                          <span
                            className={cn(
                              "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold border",
                              isMainRole
                                ? "bg-purple-950 text-purple-200 border-purple-500/40"
                                : "bg-zinc-900 text-zinc-400 border-white/10",
                            )}
                          >
                            {roleLabel}
                          </span>
                        </div>
                      </div>

                      <Link
                        to="/anime/$id"
                        params={{ id: work.anime.id }}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        <span>Acessar produção</span>
                        <ChevronRight className="size-3" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )
        ) : (
          /* =========================================================
             C. TRABALHOS DE DIREÇÃO E EQUIPE TÉCNICA (Animes + Função na produção)
          ========================================================= */
          (data?.staffWorks?.length ?? 0) === 0 ? (
            <EmptyNotice message="Nenhum trabalho técnico encontrado para este profissional." />
          ) : (
            <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {data!.staffWorks!.map((work) => (
                <article
                  key={work.id}
                  className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-purple-500/15 bg-[#0e0c19] p-2.5 sm:p-3 transition-all duration-300 hover:border-purple-500/40 hover:bg-[#131023] hover:shadow-[0_8px_24px_rgba(168,85,247,0.18)]"
                >
                  <Link
                    to="/anime/$id"
                    params={{ id: work.anime.id }}
                    className="relative w-14 sm:w-16 shrink-0 aspect-[2/3] overflow-hidden rounded-xl bg-[#161328] group/poster cursor-pointer"
                    title={`Ver ${work.anime.title}`}
                  >
                    {work.anime.cover ? (
                      <img
                        src={work.anime.cover}
                        alt={work.anime.title}
                        loading="lazy"
                        className="size-full object-cover transition-transform duration-500 group-hover/poster:scale-105"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-zinc-600">
                        <Film className="size-5" />
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-40 group-hover/poster:opacity-60 transition-opacity" />
                  </Link>

                  <div className="flex flex-1 flex-col justify-between min-w-0 py-0.5">
                    <div>
                      <span className="inline-flex items-center gap-1 rounded-md border border-purple-500/30 bg-purple-950/70 px-2 py-0.5 text-[10px] font-semibold text-purple-200">
                        <Layers className="size-2.5 text-purple-400" />
                        <span className="truncate">{work.roleLabel}</span>
                      </span>

                      <Link
                        to="/anime/$id"
                        params={{ id: work.anime.id }}
                        className="block mt-1.5 min-w-0"
                      >
                        <h4
                          className="line-clamp-2 text-xs sm:text-sm font-semibold text-zinc-100 transition-colors group-hover:text-purple-300 leading-snug"
                          title={work.anime.title}
                        >
                          {work.anime.title}
                        </h4>
                      </Link>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-400">
                      <span>
                        {work.anime.year}
                        {work.anime.year && work.anime.format ? " • " : ""}
                        {work.anime.format}
                      </span>

                      <Link
                        to="/anime/$id"
                        params={{ id: work.anime.id }}
                        className="inline-flex items-center gap-0.5 font-medium text-purple-400 hover:text-purple-300"
                      >
                        <span>Ver</span>
                        <ChevronRight className="size-3" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
});

function EmptyNotice({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
      <p className="text-xs sm:text-sm text-zinc-400">{message}</p>
    </div>
  );
}
