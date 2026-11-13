import { lazy, Suspense } from "react";

const CommentsSection = lazy(() =>
  import("@/components/comments/CommentsSection").then((mod) => ({
    default: mod.CommentsSection,
  })),
);

function CommentsLoadingFallback() {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-purple-500/10 bg-[#0d0c16]/50 p-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <div className="size-6 animate-spin rounded-full border-2 border-purple-500/30 border-t-purple-400" />
        <span className="text-xs text-zinc-400">Carregando comentários...</span>
      </div>
    </div>
  );
}

export function DeferredAnimeComments({
  animeId,
  animeTitle,
  targetCommentId,
}: {
  animeId: string;
  animeTitle: string;
  targetCommentId?: string;
}) {
  return (
    <Suspense fallback={<CommentsLoadingFallback />}>
      <CommentsSection
        animeId={animeId}
        animeTitle={animeTitle}
        targetCommentId={targetCommentId}
        isAnimeGeneral
      />
    </Suspense>
  );
}

export default DeferredAnimeComments;
