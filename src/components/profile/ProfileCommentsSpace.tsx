import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Calendar,
  Heart,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import type { MyProfileComment } from "@/lib/profile.functions";

interface ProfileCommentsSpaceProps {
  comments: MyProfileComment[];
  loading?: boolean;
}

export function ProfileCommentsSpace({
  comments,
  loading = false,
}: ProfileCommentsSpaceProps) {
  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "";

    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Seção de Comentários */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="size-5 text-violet-400" />
            <span>Minhas Interações & Comentários</span>
          </h2>
          <p className="mt-0.5 text-xs sm:text-sm text-zinc-400">
            Discussões e participações na comunidade do Hikari.
          </p>
        </div>

        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-zinc-300 tabular-nums">
          {comments.length} {comments.length === 1 ? "comentário" : "comentários"}
        </span>
      </div>

      {/* Conteúdo: Skeleton, Vazio ou Lista de Comentários */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="h-28 animate-pulse rounded-2xl bg-white/[0.04]"
            />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 sm:p-14 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400 shadow-inner">
            <MessageSquare className="size-7" />
          </div>

          <h3 className="mt-4 font-display text-base sm:text-lg font-bold text-white">
            Você ainda não fez comentários
          </h3>

          <p className="mt-1.5 max-w-sm text-xs sm:text-sm text-zinc-400 leading-relaxed">
            Compartilhe suas teorias, impressões e reações nos episódios para interagir com outros fãs de anime.
          </p>

          <Link
            to="/"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all hover:bg-violet-500 active:scale-95"
          >
            <Sparkles className="size-4" />
            <span>Explorar Episódios Recentes</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => {
            const epNum =
              comment.episodeId.match(/ep-(?:\d+-)?(\d+)$/i)?.[1] ||
              comment.episodeId.match(/(\d+)$/)?.[1] ||
              "1";

            return (
              <article
                key={comment.id}
                className="group relative flex flex-col rounded-2xl border border-white/[0.06] bg-[#0c0b14]/90 p-4 sm:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-all duration-200 hover:border-violet-500/35 hover:bg-[#12101e]"
              >
                {/* Cabeçalho do Comentário */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.05] pb-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Link
                      to="/watch/$id/$ep"
                      params={{
                        id: comment.animeId,
                        ep: `ep-${epNum}`,
                      }}
                      search={{
                        comment: comment.id,
                      }}
                      className="font-bold text-violet-300 transition-colors hover:text-violet-200 hover:underline"
                    >
                      Episódio {epNum}
                    </Link>

                    {comment.parentId && (
                      <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-300">
                        Resposta
                      </span>
                    )}
                  </div>

                  <span className="flex items-center gap-1 text-zinc-500 text-[11px]">
                    <Calendar className="size-3" />
                    <span>{formatDate(comment.createdAt)}</span>
                  </span>
                </div>

                {/* Conteúdo do Comentário (com suporte a spoiler) */}
                <div className="pt-3">
                  {comment.isSpoiler ? (
                    <details className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04]">
                      <summary className="cursor-pointer px-3.5 py-2.5 text-xs font-semibold text-amber-300 flex items-center gap-1.5 select-none">
                        <AlertTriangle className="size-3.5" />
                        <span>Contém spoiler (clique para revelar)</span>
                      </summary>
                      <div className="border-t border-amber-500/10 px-3.5 py-3 text-xs sm:text-sm leading-relaxed text-zinc-300 whitespace-pre-wrap">
                        {comment.content}
                      </div>
                    </details>
                  ) : (
                    <p className="text-xs sm:text-sm leading-relaxed text-zinc-200 whitespace-pre-wrap">
                      {comment.content}
                    </p>
                  )}
                </div>

                {/* Rodapé com Likes e Link Direto */}
                <div className="mt-3.5 flex items-center justify-between pt-2 text-xs text-zinc-400">
                  <div className="flex items-center gap-1.5 text-zinc-300 font-semibold tabular-nums">
                    <Heart
                      className={`size-3.5 ${
                        comment.likes > 0
                          ? "fill-rose-500 text-rose-500"
                          : "text-zinc-500"
                      }`}
                    />
                    <span>{comment.likes} {comment.likes === 1 ? "curtida" : "curtidas"}</span>
                  </div>

                  <Link
                    to="/watch/$id/$ep"
                    params={{
                      id: comment.animeId,
                      ep: `ep-${epNum}`,
                    }}
                    search={{
                      comment: comment.id,
                    }}
                    className="text-xs text-zinc-400 transition-colors hover:text-white"
                  >
                    Ver no episódio →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
