import { Link } from "@tanstack/react-router";
import {
  Calendar,
  Film,
  FolderHeart,
  Globe,
  Layers,
  Lock,
  Sparkles,
} from "lucide-react";
import { ProfileAnimeImage } from "@/components/profile/ProfileAnimeImage";
import type { ProfileListSummary } from "@/types/profile-list";

interface ProfileListsSpaceProps {
  lists: ProfileListSummary[];
  loading?: boolean;
}

export function ProfileListsSpace({
  lists,
  loading = false,
}: ProfileListsSpaceProps) {
  return (
    <div className="space-y-6">
      {/* Cabeçalho da Seção de Listas */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <FolderHeart className="size-5 text-violet-400" />
            <span>Coleções & Listas Personalizadas</span>
          </h2>
          <p className="mt-0.5 text-xs sm:text-sm text-zinc-400">
            Suas seleções e antologias de animes catalogadas.
          </p>
        </div>

        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-zinc-300 tabular-nums">
          {lists.length} {lists.length === 1 ? "lista" : "listas"}
        </span>
      </div>

      {/* Conteúdo: Skeleton, Vazio ou Grade de Listas */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="h-56 animate-pulse rounded-2xl bg-white/[0.04]"
            />
          ))}
        </div>
      ) : lists.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 sm:p-14 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400 shadow-inner">
            <Layers className="size-7" />
          </div>

          <h3 className="mt-4 font-display text-base sm:text-lg font-bold text-white">
            Nenhuma lista personalizada criada ainda
          </h3>

          <p className="mt-1.5 max-w-sm text-xs sm:text-sm text-zinc-400 leading-relaxed">
            Crie seleções temáticas como "Meus Shonens Favoritos", "Maratona de Férias" ou "Melhores Animações" para organizar seu universo de animes.
          </p>

          <Link
            to="/browse/$section"
            params={{ section: "popular" }}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all hover:bg-violet-500 active:scale-95"
          >
            <Sparkles className="size-4" />
            <span>Explorar Obras para Catalogar</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((list) => {
            const covers = list.sampleCovers || [];
            const formattedDate = new Date(list.updatedAt).toLocaleDateString(
              "pt-BR",
              {
                day: "2-digit",
                month: "short",
                year: "numeric",
              },
            );

            return (
              <article
                key={list.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#12101e] to-[#0a0914] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.4)] transition-colors duration-300 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:border-violet-500/40"
              >
                {/* Camada de sombra acelerada por GPU */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-2xl shadow-[0_12px_40px_rgba(168,85,247,0.15)] opacity-0 transition-opacity duration-300 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100"
                />

                <div>
                  {/* Amostra Visual de Capas (Mosaico com até 4 capas) */}
                  <div className="mb-4 h-28 w-full overflow-hidden rounded-xl bg-[#07060c] p-1.5 ring-1 ring-white/10">
                    {covers.length > 0 ? (
                      <div className="grid size-full grid-cols-4 gap-1.5">
                        {covers.slice(0, 4).map((coverUrl, idx) => (
                          <div
                            key={idx}
                            className="relative size-full overflow-hidden rounded-lg bg-[#141220]"
                          >
                            <ProfileAnimeImage
                              src={coverUrl}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              fallbackClassName="rounded-lg bg-[#141220]"
                              className="size-full object-cover [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105 motion-reduce:transform-none"
                            />
                          </div>
                        ))}
                        {/* Se tiver menos de 4, preenche slots vazios decorativos */}
                        {Array.from({
                          length: Math.max(0, 4 - covers.length),
                        }).map((_, emptyIdx) => (
                          <div
                            key={`empty-${emptyIdx}`}
                            className="flex size-full items-center justify-center rounded-lg bg-white/[0.02] text-zinc-700"
                          >
                            <Film className="size-4" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex size-full items-center justify-center text-xs text-zinc-600 gap-1.5">
                        <Film className="size-4" />
                        <span>Lista vazia</span>
                      </div>
                    )}
                  </div>

                  {/* Informações da Lista */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-1 font-display text-base font-bold text-white transition-colors group-hover:text-violet-300">
                      {list.title}
                    </h3>

                    {list.isPublic ? (
                      <span
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-300"
                        title="Lista pública visível para outros membros"
                      >
                        <Globe className="size-2.5" />
                        <span>Pública</span>
                      </span>
                    ) : (
                      <span
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-500/30 bg-zinc-500/10 px-2 py-0.5 text-[10px] font-semibold text-zinc-300"
                        title="Lista privada visível apenas para você"
                      >
                        <Lock className="size-2.5" />
                        <span>Privada</span>
                      </span>
                    )}
                  </div>

                  {list.description ? (
                    <p className="mt-1.5 line-clamp-2 text-xs text-zinc-400 leading-relaxed">
                      {list.description}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs italic text-zinc-600">
                      Sem descrição adicionada.
                    </p>
                  )}
                </div>

                {/* Rodapé do Card da Lista */}
                <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3 text-[11px] text-zinc-400">
                  <span className="font-semibold text-zinc-300">
                    {list.itemCount} {list.itemCount === 1 ? "anime" : "animes"}
                  </span>

                  <span className="flex items-center gap-1 text-zinc-500">
                    <Calendar className="size-3" />
                    <span>Atualizada em {formattedDate}</span>
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
