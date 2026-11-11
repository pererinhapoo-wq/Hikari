import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Film,
  Heart,
  MessageSquare,
  Trash2,
  X,
} from "lucide-react";
import type { MyProfileComment } from "@/lib/profile.functions";
import { useScrollLock } from "@/lib/scroll-lock";

interface ProfileCommentsSpaceProps {
  comments: MyProfileComment[];
  total?: number;
  page?: number;
  totalPages?: number;
  onPageChange?: (newPage: number) => void;
  loading?: boolean;
  isOwner?: boolean;
  onCommentDeleted?: (commentId: string) => void;
  onCommentUpdated?: (
    commentId: string,
    newContent: string,
    isSpoiler: boolean,
  ) => void;
}

export function ProfileCommentsSpace({
  comments,
  total = comments.length,
  page = 1,
  totalPages = 1,
  onPageChange,
  loading = false,
  isOwner = true,
  onCommentDeleted,
  onCommentUpdated,
}: ProfileCommentsSpaceProps) {
  // Estado para edição inline
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editIsSpoiler, setEditIsSpoiler] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");

  // Estado para exclusão
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  useScrollLock(Boolean(deletingCommentId));

  const formatRelativeDate = (isoString: string): string => {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "";

    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return "Agora mesmo";
    if (diffMin < 60) return `Há ${diffMin} ${diffMin === 1 ? "minuto" : "minutos"}`;
    if (diffHour < 24) return `Há ${diffHour} ${diffHour === 1 ? "hora" : "horas"}`;
    if (diffDay === 1) {
      const timeStr = d.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `Ontem às ${timeStr}`;
    }
    if (diffDay < 30) return `Há ${diffDay} ${diffDay === 1 ? "dia" : "dias"}`;

    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatFullDate = (isoString: string): string => {
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

  const handleStartEdit = (comment: MyProfileComment) => {
    setEditingCommentId(comment.id);
    setEditContent(comment.content);
    setEditIsSpoiler(Boolean(comment.isSpoiler));
    setEditError("");
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditContent("");
    setEditIsSpoiler(false);
    setEditError("");
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editContent.trim()) {
      setEditError("O conteúdo não pode estar vazio.");
      return;
    }

    setEditSubmitting(true);
    setEditError("");

    try {
      const response = await fetch("/api/comments/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commentId,
          action: "edit",
          content: editContent.trim(),
          isSpoiler: editIsSpoiler,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Erro ao salvar edição.");
      }

      onCommentUpdated?.(commentId, editContent.trim(), editIsSpoiler);
      setEditingCommentId(null);
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : "Não foi possível salvar.",
      );
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleConfirmDelete = async (commentId: string) => {
    setDeleteSubmitting(true);
    try {
      const response = await fetch("/api/comments/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commentId,
          action: "delete",
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Erro ao excluir comentário.");
      }

      onCommentDeleted?.(commentId);
      setDeletingCommentId(null);
    } catch (err) {
      console.error("Erro ao deletar:", err);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Seção de Comentários */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="size-5 text-violet-400" />
            <span>{isOwner ? "Meus Comentários" : "Comentários"}</span>
          </h2>
          <p className="mt-0.5 text-xs sm:text-sm text-zinc-400">
            {isOwner
              ? "Discussões e participações na comunidade do Hikari."
              : "Histórico público de comentários publicados por este usuário."}
          </p>
        </div>

        {total > 0 && (
          <span className="self-start sm:self-auto rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-zinc-300 tabular-nums">
            {total} {total === 1 ? "comentário" : "comentários"}
          </span>
        )}
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
      ) : comments.length === 0 ? null : (
        <div className="space-y-3.5">
          {comments.map((comment) => {
            const epNum =
              comment.episodeId.match(/ep-(?:\d+-)?(\d+)$/i)?.[1] ||
              comment.episodeId.match(/(\d+)$/)?.[1] ||
              "1";

            const isEditing = editingCommentId === comment.id;
            const hasAnimeInfo = Boolean(
              comment.animeTitle && comment.animeTitle !== "Anime indisponível",
            );

            return (
              <article
                key={comment.id}
                className="group relative flex flex-col rounded-2xl border border-white/[0.06] bg-[#0c0b14]/90 p-4 sm:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-colors duration-200 [@media(hover:hover)_and_(pointer:fine)]:hover:border-violet-500/35 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#12101e]"
              >
                {/* Cabeçalho do Comentário com Anime e Episódio */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.05] pb-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Capa Miniatura do Anime se disponível */}
                    {comment.animeCover ? (
                      <img
                        src={comment.animeCover}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="size-8 shrink-0 rounded-lg object-cover bg-white/5"
                      />
                    ) : (
                      <div className="size-8 shrink-0 rounded-lg bg-white/5 grid place-items-center text-zinc-500">
                        <Film className="size-4" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {hasAnimeInfo ? (
                          <Link
                            to="/anime/$id"
                            params={{ id: comment.animeId }}
                            className="truncate font-semibold text-sm text-zinc-200 transition-colors hover:text-violet-300"
                            title={comment.animeTitle}
                          >
                            {comment.animeTitle}
                          </Link>
                        ) : (
                          <span className="text-zinc-500 text-xs italic">
                            Conteúdo arquivado ou indisponível
                          </span>
                        )}

                        <Link
                          to="/watch/$id/$ep"
                          params={{
                            id: comment.animeId,
                            ep: `ep-${epNum}`,
                          }}
                          search={{
                            comment: comment.id,
                          }}
                          className="rounded-md bg-violet-500/15 px-2 py-0.5 text-[11px] font-bold text-violet-300 transition-colors hover:bg-violet-500/25 ring-1 ring-violet-500/30"
                        >
                          Episódio {epNum}
                        </Link>

                        {comment.parentId && (
                          <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-300">
                            Resposta
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className="flex items-center gap-1 text-zinc-400 text-[11px] cursor-default"
                      title={formatFullDate(comment.createdAt)}
                    >
                      <Calendar className="size-3 text-zinc-500" />
                      <span>{formatRelativeDate(comment.createdAt)}</span>
                    </span>

                    {/* Ações de Edição e Exclusão para o proprietário */}
                    {isOwner && !isEditing && (
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(comment)}
                          className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                          title="Editar comentário"
                        >
                          <Edit2 className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingCommentId(comment.id)}
                          className="p-1 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Excluir comentário"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Conteúdo do Comentário ou Modo de Edição */}
                {isEditing ? (
                  <div className="pt-3 space-y-3">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-violet-500/40 bg-black/40 p-3 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-violet-400"
                      placeholder="Escreva seu comentário..."
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={editIsSpoiler}
                          onChange={(e) => setEditIsSpoiler(e.target.checked)}
                          className="rounded border-white/20 bg-white/5 text-violet-600 focus:ring-0"
                        />
                        <span>Contém spoiler</span>
                      </label>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          disabled={editSubmitting}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
                        >
                          <X className="size-3.5" />
                          <span>Cancelar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleSaveEdit(comment.id)}
                          disabled={editSubmitting}
                          className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 transition-colors disabled:opacity-50"
                        >
                          <Check className="size-3.5" />
                          <span>{editSubmitting ? "Salvando..." : "Salvar"}</span>
                        </button>
                      </div>
                    </div>

                    {editError && (
                      <p className="text-xs text-red-400">{editError}</p>
                    )}
                  </div>
                ) : (
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

                    {comment.imageUrl && (
                      <div className="mt-3 max-w-xs overflow-hidden rounded-xl border border-white/10">
                        <img
                          src={comment.imageUrl}
                          alt="Imagem do comentário"
                          className="max-h-60 w-auto rounded-xl object-contain bg-black/40"
                          loading="lazy"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Rodapé com Likes e Link Direto */}
                <div className="mt-3.5 flex items-center justify-between pt-2 text-xs text-zinc-400 border-t border-white/[0.03]">
                  <div className="flex items-center gap-1.5 text-zinc-300 font-semibold tabular-nums">
                    <Heart
                      className={`size-3.5 ${
                        comment.likes > 0
                          ? "fill-rose-500 text-rose-500"
                          : "text-zinc-500"
                      }`}
                    />
                    <span>
                      {comment.likes}{" "}
                      {comment.likes === 1 ? "curtida" : "curtidas"}
                    </span>
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
                    className="text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
                  >
                    <span>Ver no episódio</span>
                    <span>→</span>
                  </Link>
                </div>
              </article>
            );
          })}

          {/* Modal de confirmação de exclusão */}
          {deletingCommentId && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200"
              role="dialog"
              aria-modal="true"
            >
              <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d0c18] p-5 shadow-2xl space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-500/20 text-red-400 border border-red-500/30">
                    <Trash2 className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-white text-sm sm:text-base">
                      Excluir comentário?
                    </h3>
                    <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
                      Esta ação é permanente e removerá o comentário e todas as
                      suas respostas associadas da comunidade.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setDeletingCommentId(null)}
                    disabled={deleteSubmitting}
                    className="rounded-xl border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/5"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleConfirmDelete(deletingCommentId)}
                    disabled={deleteSubmitting}
                    className="rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    {deleteSubmitting ? "Excluindo..." : "Sim, excluir"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Paginação de Comentários */}
          {totalPages > 1 && onPageChange && (
            <div className="flex items-center justify-between border-t border-white/[0.06] pt-4">
              <span className="text-xs text-zinc-400">
                Página <strong className="text-white">{page}</strong> de{" "}
                <strong className="text-white">{totalPages}</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onPageChange(page - 1)}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-all hover:bg-white/[0.08] disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ChevronLeft className="size-4" />
                  <span>Anterior</span>
                </button>

                <button
                  type="button"
                  onClick={() => onPageChange(page + 1)}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-all hover:bg-white/[0.08] disabled:opacity-40 disabled:pointer-events-none"
                >
                  <span>Próxima</span>
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
