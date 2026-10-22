import { memo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Play, Film } from "lucide-react";
import { cleanEpisodeDisplay, type PublishedEpisode } from "@/lib/published-episodes";

export const EpisodeCard = memo(function EpisodeCard({
  episode,
}: {
  episode: PublishedEpisode;
}) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);

  const fallbackImage = episode.animeBanner || episode.animeCover;
  const hasValidThumbnail = Boolean(episode.thumbnail && !thumbFailed);
  const showFallback = !hasValidThumbnail && Boolean(fallbackImage && !fallbackFailed);

  const formattedSubtitle = cleanEpisodeDisplay(
    episode.episodeNumber,
    episode.episodeTitle,
    episode.animeAltTitles && episode.animeAltTitles.length > 0
      ? episode.animeAltTitles
      : episode.animeTitle,
  );

  return (
    <article className="group relative w-full overflow-hidden transition-all duration-300">
      <Link
        to="/watch/$id"
        params={{ id: episode.animeId }}
        search={{ ep: episode.episodeId }}
        className="block group focus:outline-none"
      >
        {/* Contêiner da Imagem Horizontal (Proporção 16:9 de Vídeo) */}
        <div className="relative aspect-video w-full overflow-hidden rounded-lg sm:rounded-xl bg-[#0f0d1a] border border-purple-500/15 transition-all duration-300 ease-out group-hover:border-purple-400/50 group-hover:shadow-[0_10px_25px_-5px_rgba(168,85,247,0.3)]">
          {hasValidThumbnail ? (
            /* Imagem real correspondente ao vídeo do episódio */
            <img
              src={episode.thumbnail}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setThumbFailed(true)}
              className="size-full object-cover transition-transform duration-500 ease-out [@media(hover:hover)]:group-hover:scale-[1.05]"
            />
          ) : showFallback ? (
            /* Imagem alternativa adequada (banner/capa oficial do anime em 16:9) */
            <img
              src={fallbackImage}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setFallbackFailed(true)}
              className="size-full object-cover opacity-90 transition-transform duration-500 ease-out [@media(hover:hover)]:group-hover:scale-[1.05]"
            />
          ) : (
            /* Tratamento gracioso caso nenhuma imagem esteja acessível, sem deixar espaços quebrados */
            <div className="relative flex size-full flex-col items-center justify-center bg-gradient-to-br from-[#17122a] via-[#0f0d19] to-[#09080e] p-2 sm:p-3 text-center">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.12)_0%,transparent_70%)]" />
              <div className="relative flex size-7 sm:size-9 items-center justify-center rounded-full bg-purple-950/80 border border-purple-500/30 text-purple-300 shadow-md">
                <Film className="size-3.5 sm:size-4 text-purple-300" />
              </div>
            </div>
          )}

          {/* Sombra interna com gradiente escuro */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-40" />

          {/* Badge do Número do Episódio */}
          <div className="absolute bottom-1.5 left-1.5 sm:bottom-2 sm:left-2 flex items-center rounded bg-purple-950/90 backdrop-blur-md border border-purple-500/40 px-1 sm:px-1.5 py-0.5 text-[8.5px] sm:text-[10px] font-bold text-purple-200 shadow-md">
            <span>EP {episode.episodeNumber}</span>
          </div>

          {/* Duração se disponível */}
          {episode.duration ? (
            <div className="absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2 rounded bg-black/85 backdrop-blur-md border border-white/10 px-1 sm:px-1.5 py-0.5 text-[8px] sm:text-[9.5px] font-medium text-zinc-300">
              {episode.duration}
            </div>
          ) : null}

          {/* Overlay de Play ao passar o mouse */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 [@media(hover:hover)]:group-hover:opacity-100">
            <div className="flex size-8 sm:size-11 items-center justify-center rounded-full bg-purple-600/90 text-white shadow-[0_0_20px_rgba(168,85,247,0.7)] backdrop-blur-sm transition-transform duration-300 [@media(hover:hover)]:group-hover:scale-110">
              <Play className="size-3.5 sm:size-5 fill-current ml-0.5" />
            </div>
          </div>
        </div>

        {/* Informações de Texto: Nome do Anime (Linha 1) e Número/Título do Episódio (Abaixo) sem duplicações */}
        <div className="mt-1.5 sm:mt-2.5 px-0.5">
          {/* Nome do Anime exibido uma única vez */}
          <h4
            title={episode.animeTitle}
            className="text-[10.5px] sm:text-xs md:text-[13px] font-bold text-zinc-200 transition-colors group-hover:text-purple-300 truncate"
          >
            {episode.animeTitle}
          </h4>

          {/* Número e Título correto do Episódio sem palavras duplicadas ou números repetidos */}
          <p
            title={formattedSubtitle}
            className="mt-0.5 text-[9.5px] sm:text-[11px] md:text-xs font-medium text-zinc-400 line-clamp-2 leading-tight sm:leading-snug break-words"
          >
            {formattedSubtitle}
          </p>
        </div>
      </Link>
    </article>
  );
});
