import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bookmark,
  BookmarkCheck,
  Pencil,
  Play,
} from "lucide-react";
import { useState } from "react";

import { AnimeCard } from "@/components/anime-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchAnimeDetail } from "@/lib/api";
import {
  formatLabel,
  genreLabel,
  scoreLabel,
  seasonLabel,
  statusLabel,
} from "@/lib/labels";
import { mergeDetail } from "@/lib/overlay";
import { useHikariStore } from "@/lib/store";
import { displayTitle } from "@/lib/types";
import { youtubeIdFrom } from "@/lib/utils";

export const Route = createFileRoute("/anime/$id")({
  loader: async ({ params }) => {
    if (params.id.startsWith("local-")) {
      return { remote: null };
    }

    const remote = await fetchAnimeDetail({
      data: { id: params.id },
    });

    return { remote };
  },

  pendingComponent: () => (
    <div className="space-y-4 pt-4">
      <div className="-mx-4 h-52 animate-pulse bg-elevated sm:-mx-6" />

      <div className="h-8 w-2/3 animate-pulse rounded bg-elevated" />

      <div className="h-24 animate-pulse rounded bg-elevated" />
    </div>
  ),

  component: AnimePage,
});

function AnimePage() {
  const { id } = Route.useParams();
  const { remote } = Route.useLoaderData();

  const locals = useHikariStore((s) => s.animes);

  const inList = useHikariStore(
    (s) =>
      s.myList.includes(id) ||
      (remote?.id
        ? s.myList.includes(remote.id)
        : false),
  );

  const toggleList = useHikariStore(
    (s) => s.toggleList,
  );

  const anime = mergeDetail(
    remote,
    id,
    locals,
  );

  if (!anime) {
    return (
      <div className="py-24 text-center">
        <p className="font-display text-2xl">
          Anime não encontrado
        </p>

        <Link
          to="/"
          className="mt-3 inline-block text-sm text-muted underline"
        >
          Voltar ao início
        </Link>
      </div>
    );
  }

  const title = displayTitle(anime);
  const yt = youtubeIdFrom(anime.trailerId);

  const localRecord = locals.find(
    (a) =>
      a.id === anime.id ||
      (anime.anilistId &&
        a.anilistId === anime.anilistId),
  );

  const seasons = anime.seasons;

  const episodeCount =
    seasons.reduce(
      (n, s) => n + s.episodes.length,
      0,
    ) ||
    anime.episodesCount ||
    0;

  return (
    <article className="pb-8">
      <div className="relative -mx-4 h-56 overflow-hidden sm:-mx-6 sm:h-72">
        {(anime
