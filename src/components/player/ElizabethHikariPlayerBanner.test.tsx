import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ElizabethHikariPlayerBanner } from "./ElizabethHikariPlayerBanner";

describe("ElizabethHikariPlayerBanner", () => {
  it("1. Renderiza banner clicável em nova aba quando episódio possui associação válida", () => {
    const html = renderToStaticMarkup(
      <ElizabethHikariPlayerBanner
        animeTitle="Gintama"
        episodeNumber={12}
        episodeTitle="Quem ri por último"
        hikariPlayerEpisodeId="ep_gintama_12"
      />,
    );

    assert.match(html, /data-hikari-player-available="true"/);
    assert.match(
      html,
      /<a[^>]*href="https:\/\/hikari-player-2\.vercel\.app\/e\/ep_gintama_12"/,
    );
    assert.match(html, /target="_blank"/);
    assert.match(html, /rel="noopener noreferrer"/);
    assert.match(
      html,
      /\/assets\/aistudio\/file_000000006650820e9806dd0a131836b5_fa589477\.png/,
    );
    assert.match(html, /width="1672" height="941"/);
    assert.match(html, /hikari-ep-banner-assistir-border/);
    assert.match(html, /hikari-ep-banner-player-border/);
    assert.match(html, /hikari-ep-banner-play-glow/);
    assert.match(html, /hikari-ep-banner-logo-glint/);
    assert.match(html, /hikari-ep-banner-petal-1/);
    assert.doesNotMatch(
      html,
      /Este episódio ainda não está disponível no Hikari Player/,
    );
  });

  it("2. Mantém banner visível, porém sem link, quando não existe associação", () => {
    const html = renderToStaticMarkup(
      <ElizabethHikariPlayerBanner
        animeTitle="Gintama"
        episodeNumber={13}
        hikariPlayerEpisodeId={null}
        hikariPlayerEpisodeUrl={null}
      />,
    );

    assert.match(html, /data-hikari-player-available="false"/);
    assert.doesNotMatch(html, /<a\b/);
    assert.doesNotMatch(html, /href=/);
    assert.doesNotMatch(html, /https:\/\/hikari-player-2\.vercel\.app/);
    assert.match(
      html,
      /\/assets\/aistudio\/file_000000006650820e9806dd0a131836b5_fa589477\.png/,
    );
    assert.match(
      html,
      /Este episódio ainda não está disponível no Hikari Player\./,
    );
  });

  it("3. Nunca gera link para associação inválida ou URL injetada", () => {
    const html = renderToStaticMarkup(
      <ElizabethHikariPlayerBanner
        animeTitle="Gintama"
        episodeNumber={14}
        hikariPlayerEpisodeId="https://evil.example/e/abc"
        hikariPlayerEpisodeUrl="https://evil.example/e/abc"
      />,
    );

    assert.match(html, /data-hikari-player-available="false"/);
    assert.doesNotMatch(html, /<a\b/);
    assert.doesNotMatch(html, /href=/);
  });
});
