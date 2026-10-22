import { memo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Play, Film } from "lucide-react";
import type { PublishedEpisode } from "@/lib/published-episodes";

export const EpisodeCard = memo(function EpisodeCard({
  episode,
}: {
  episode: PublishedEpisode;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  const hasValidThumbnail = Boolean(episode.thumbnail && !imgFailed);

  return (
    <article className="group relative w-full overflow-hidden transition-all duration-300">
      <Link
        to="/watch/$id"
        params={{ id: episode.animeId }}
        search={{ ep: episode.episodeId }}
        className="block group focus:outline-none"
      >
        {/* Contêiner da Imagem Horizontal (Proporção 16:9 de Vídeo) */}
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-[#0f0d1a] border border-purple-500/15 transition-all duration-300 ease-out group-hover:border-purple-400/50 group-hover:shadow-[0_10px_25px_-5px_rgba(168,85,247,0.3)]">
          {hasValidThumbnail ? (
            <img
              src={episode.thumbnail}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setImgFailed(true)}
              className="size-full object-cover transition-transform duration-500 ease-out [@media(hover:hover)]:group-hover:scale-[1.05]"
            />
          ) : (
            /* Tratamento elegante quando não há frame ou a captura falha, sem imagem quebrada */
            <div className="relative flex size-full flex-col items-center justify-center bg-gradient-to-br from-[#17122a] via-[#0f0d19] to-[#09080e] p-3 text-center">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.12)_0%,transparent_70%)]" />
              <div className="relative flex size-9 items-center justify-center rounded-full bg-purple-950/80 border border-purple-500/30 text-purple-300 shadow-md">
                <Film className="size-4 text-purple-300" />
              </div>
              <span className="relative mt-1.5 text-[10px] font-semibold tracking-wider text-purple-300/70 uppercase">
                Prévia de Vídeo
              </span>
            </div>
          )}

          {/* Sombra interna com gradiente escuro */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-40" />

          {/* Badge do Número do Episódio */}
          <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-purple-950/90 backdrop-blur-md border border-purple-500/40 px-2 py-0.5 text-[10px] font-black text-purple-200 shadow-md">
            <span>EP {episode.episodeNumber}</span>
          </div>

          {/* Badge de Duração ou HD */}
          {episode.duration ? (
            <div className="absolute bottom-2 right-2 rounded-md bg-black/85 backdrop-blur-md border border-white/10 px-1.5 py-0.5 text-[9.5px] font-medium text-zinc-300">
              {episode.duration}
            </div>
          ) : (
            <div className="absolute bottom-2 right-2 rounded-md bg-black/85 backdrop-blur-md border border-purple-500/25 px-1.5 py-0.5 text-[9px] font-semibold text-purple-300/90">
              HD
            </div>
          )}

          {/* Overlay de Play ao passar o mouse */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 [@media(hover:hover)]:group-hover:opacity-100">
            <div className="flex size-11 items-center justify-center rounded-full bg-purple-600/90 text-white shadow-[0_0_20px_rgba(168,85,247,0.7)] backdrop-blur-sm transition-transform duration-300 [@media(hover:hover)]:group-hover:scale-110">
              <Play className="size-5 fill-current ml-0.5" />
            </div>
          </div>
        </div>

        {/* Informações de Texto: Título e Número */}
        <div className="mt-2.5 px-0.5">
          {/* Nome do Anime (Linha 1) */}
          <h4
            title={episode.animeTitle}
            className="text-xs sm:text-[13px] font-bold text-zinc-200 transition-colors group-hover:text-purple-300 line-clamp-1 truncate"
          >
            {episode.animeTitle}
          </h4>

          {/* Título e Número do Episódio (Até 2 linhas com reticências sem sobreposição) */}
          <p
            title={episode.episodeTitle}
            className="mt-0.5 text-[11px] sm:text-xs font-medium text-zinc-400 line-clamp-2 h-[2.2rem] overflow-hidden text-ellipsis leading-snug"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            Episódio {episode.episodeNumber}
            {episode.episodeTitle && episode.episodeTitle !== `Episódio ${episode.episodeNumber}`
              ? ` — ${episode.episodeTitle}`
              : ""}
          </p>

          {/* Temporada */}
          <div className="mt-1 flex items-center gap-1.5 text-[9.5px] sm:text-[10px] text-zinc-500">
            <span>{episode.seasonTitle}</span>
          </div>
        </div>
      </Link>
    </article>
  );
});
