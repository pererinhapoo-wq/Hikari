import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { publishFilledEpisodesInSeason } from "@/lib/editor-episodes-window";
import type { Season } from "@/lib/types";
import { EditorSeasons } from "./editor-seasons";

function noop() {}
async function noopAsync() {}

describe("EditorSeasons — Botão Publicar todos", () => {
  it("renderiza o botão 'Publicar todos' no cabeçalho da temporada mantendo os controles individuais Rascunho e Publicado", () => {
    const seasons: Season[] = [
      {
        id: "season-1",
        number: 1,
        title: "Temporada 1",
        episodes: Array.from({ length: 12 }, (_, idx) => ({
          id: `ep-${idx + 1}`,
          number: idx + 1,
          title: `Episódio ${idx + 1}`,
          hikariPlayerEpisodeId: `hp_${idx + 1}`,
          published: false,
        })),
      },
    ];

    const htmlBefore = renderToStaticMarkup(
      <EditorSeasons
        animeId="anime-test"
        seasons={seasons}
        onAddSeason={noop}
        onPatchSeason={noop}
        onRemoveSeason={noop}
        onAddEpisode={noop}
        onPatchEpisode={noop}
        onPublishAllEpisodes={(sid) => publishFilledEpisodesInSeason(seasons, sid)}
        onRemoveEpisode={noop}
        onCaptureFrame={noopAsync}
        onUploadVideoToB2={noopAsync}
        uploadingEpisode={null}
        captureStatus={{}}
        outboxOps={[]}
      />,
    );

    assert.match(htmlBefore, /Publicar todos/);
    assert.match(htmlBefore, /data-bulk-publish-season="season-1"/);
    assert.match(htmlBefore, /0 publicados/);
    assert.match(htmlBefore, /Rascunho/);
    assert.match(htmlBefore, /Publicado/);

    const bulkResult = publishFilledEpisodesInSeason(seasons, "season-1");
    assert.equal(bulkResult.changedEpisodeIds.length, 12);

    const htmlAfter = renderToStaticMarkup(
      <EditorSeasons
        animeId="anime-test"
        seasons={bulkResult.seasons}
        onAddSeason={noop}
        onPatchSeason={noop}
        onRemoveSeason={noop}
        onAddEpisode={noop}
        onPatchEpisode={noop}
        onPublishAllEpisodes={(sid) =>
          publishFilledEpisodesInSeason(bulkResult.seasons, sid)
        }
        onRemoveEpisode={noop}
        onCaptureFrame={noopAsync}
        onUploadVideoToB2={noopAsync}
        uploadingEpisode={null}
        captureStatus={{}}
        outboxOps={[]}
      />,
    );

    assert.match(htmlAfter, /12 publicados/);
    assert.match(htmlAfter, /aria-pressed="true"[^>]*>.*Publicado/);
    // Controles individuais continuam presentes para alternância posterior
    assert.match(htmlAfter, /aria-pressed="false"[^>]*>.*Rascunho/);
  });
});
