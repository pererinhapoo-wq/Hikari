import { EpisodeCommentsSection } from "@/components/comments/EpisodeCommentsSection";

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
    <EpisodeCommentsSection
      animeId={animeId}
      episodeId="anime"
      animeTitle={animeTitle}
      targetCommentId={targetCommentId}
      hideCommunityAndSettings
    />
  );
}

export default DeferredAnimeComments;
