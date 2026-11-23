import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatEpisodeRelativeTime,
  getNextEpisodeRelativeTickMs,
  parseEpisodePublicationTimestamp,
} from "./relative-published-time";
import { resolvePublicRecentEpisodes } from "./published-episodes";
import type { PublicEpisodeRow } from "./catalog-episodes";

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("Tempo relativo de publicação nos Episódios recentes", () => {
  it("interpreta timestamps ISO e PostgreSQL respeitando fuso horário", () => {
    const utcIso = "2026-11-23T15:30:00.000Z";
    const expectedMs = Date.parse(utcIso);

    assert.equal(parseEpisodePublicationTimestamp(utcIso), expectedMs);
    assert.equal(
      parseEpisodePublicationTimestamp("2026-11-23T12:30:00-03:00"),
      expectedMs,
    );
    assert.equal(
      parseEpisodePublicationTimestamp("2026-11-23 15:30:00+00"),
      expectedMs,
    );
    assert.equal(
      parseEpisodePublicationTimestamp("2026-11-23 15:30:00"),
      expectedMs,
    );

    // Datas sem horário ou inválidas não geram timestamp artificial
    assert.equal(parseEpisodePublicationTimestamp("2026-11-23"), null);
    assert.equal(parseEpisodePublicationTimestamp("23/11/2026"), null);
    assert.equal(parseEpisodePublicationTimestamp(""), null);
    assert.equal(parseEpisodePublicationTimestamp(null), null);
    assert.equal(parseEpisodePublicationTimestamp(undefined), null);
  });

  it("formata corretamente singular, plural, Agora mesmo, dias e semanas", () => {
    const now = Date.UTC(2026, 10, 23, 15, 0, 0);

    assert.equal(
      formatEpisodeRelativeTime(now - 5 * SECOND, now, { published: true }),
      "Agora mesmo",
    );
    assert.equal(
      formatEpisodeRelativeTime(now - 59 * SECOND, now, { published: true }),
      "Agora mesmo",
    );
    assert.equal(
      formatEpisodeRelativeTime(now - 1 * MINUTE, now, { published: true }),
      "Há 1 minuto",
    );
    assert.equal(
      formatEpisodeRelativeTime(now - 5 * MINUTE, now, { published: true }),
      "Há 5 minutos",
    );
    assert.equal(
      formatEpisodeRelativeTime(now - 30 * MINUTE, now, { published: true }),
      "Há 30 minutos",
    );
    assert.equal(
      formatEpisodeRelativeTime(now - 1 * HOUR, now, { published: true }),
      "Há 1 hora",
    );
    assert.equal(
      formatEpisodeRelativeTime(now - 2 * HOUR, now, { published: true }),
      "Há 2 horas",
    );
    assert.equal(
      formatEpisodeRelativeTime(now - 1 * DAY, now, { published: true }),
      "Há 1 dia",
    );
    assert.equal(
      formatEpisodeRelativeTime(now - 3 * DAY, now, { published: true }),
      "Há 3 dias",
    );
    assert.equal(
      formatEpisodeRelativeTime(now - 7 * DAY, now, { published: true }),
      "Há 1 semana",
    );
    assert.equal(
      formatEpisodeRelativeTime(now - 14 * DAY, now, { published: true }),
      "Há 2 semanas",
    );

    const oneMonthAgo = Date.UTC(2026, 9, 23, 15, 0, 0);
    assert.equal(
      formatEpisodeRelativeTime(oneMonthAgo, now, { published: true }),
      "Há 1 mês",
    );

    const twoMonthsAgo = Date.UTC(2026, 8, 23, 15, 0, 0);
    assert.equal(
      formatEpisodeRelativeTime(twoMonthsAgo, now, { published: true }),
      "Há 2 meses",
    );

    const oneYearAgo = Date.UTC(2025, 10, 23, 15, 0, 0);
    assert.equal(
      formatEpisodeRelativeTime(oneYearAgo, now, { published: true }),
      "Há 1 ano",
    );
  });

  it("não exibe tempo relativo para episódios futuros, agendados ou não publicados", () => {
    const now = Date.UTC(2026, 10, 23, 15, 0, 0);

    // Futuro / agendado
    assert.equal(
      formatEpisodeRelativeTime(now + 10 * SECOND, now, { published: true }),
      null,
    );
    assert.equal(
      formatEpisodeRelativeTime(now + 2 * HOUR, now, { published: true }),
      null,
    );

    // Não publicado
    assert.equal(
      formatEpisodeRelativeTime(now - 5 * MINUTE, now, { published: false }),
      null,
    );

    // Sem data real de publicação
    assert.equal(
      formatEpisodeRelativeTime(null, now, { published: true }),
      null,
    );
  });

  it("calcula o próximo tick compartilhado apenas para a próxima transição visível", () => {
    const now = Date.UTC(2026, 10, 23, 15, 0, 0);

    assert.equal(getNextEpisodeRelativeTickMs([], now), null);
    assert.equal(
      getNextEpisodeRelativeTickMs(
        [{ published: true, publishedTimestamp: null }],
        now,
      ),
      null,
    );

    // Episódio lançado há 50s muda para "Há 1 minuto" em 10s (+50ms de margem)
    assert.equal(
      getNextEpisodeRelativeTickMs(
        [
          { published: true, publishedTimestamp: now - 3 * DAY },
          { published: true, publishedTimestamp: now - 50 * SECOND },
        ],
        now,
      ),
      10_050,
    );

    // Episódio agendado para daqui a 4s desperta exatamente ao liberar
    assert.equal(
      getNextEpisodeRelativeTickMs(
        [{ published: true, publishedTimestamp: now + 4 * SECOND }],
        now,
      ),
      4_050,
    );
  });

  it("usa publishedAt real em resolvePublicRecentEpisodes sem substituir por updatedAt ou createdAt", () => {
    const realPublishedAt = "2026-11-23T14:55:00.000Z";
    const rowWithRealDate: PublicEpisodeRow = {
      id: "ep-real",
      animeId: "anime-1",
      seasonNumber: 1,
      number: 1,
      title: "Episódio 1",
      thumbnail: null,
      duration: null,
      synopsis: null,
      videoUrl: "https://cdn.example.com/ep1.m3u8",
      videoUrl2: null,
      videoUrl3: null,
      videoUrl4: null,
      videoUrl5: null,
      published: true,
      publishedAt: realPublishedAt,
      createdAt: "2026-11-20T10:00:00.000Z",
      updatedAt: "2026-11-23T14:59:50.000Z",
      animeTitle: "Anime Teste",
      animeTitleRomaji: "Anime Teste",
      animeTitleEnglish: null,
      animeTitleNative: null,
      animeCover: "https://cdn.example.com/cover.jpg",
      animeBanner: null,
      animeStatus: "RELEASING",
      animeEpisodesCount: 12,
      animeCreatedAt: null,
      animeUpdatedAt: null,
      seasonTitle: "Temporada 1",
    };

    const rowWithoutPublishedAt: PublicEpisodeRow = {
      ...rowWithRealDate,
      id: "ep-no-date",
      animeId: "anime-2",
      publishedAt: null,
      createdAt: "2026-11-23T14:00:00.000Z",
      updatedAt: "2026-11-23T14:59:00.000Z",
      animeTitle: "Anime Sem Data",
    };

    const recent = resolvePublicRecentEpisodes(
      {
        status: "success",
        episodes: [rowWithRealDate, rowWithoutPublishedAt],
        total: 2,
      },
      [],
    );

    const epReal = recent.find((e) => e.episodeId === "ep-real");
    const epNoDate = recent.find((e) => e.episodeId === "ep-no-date");

    assert.equal(epReal?.published, true);
    assert.equal(epReal?.publishedTimestamp, Date.parse(realPublishedAt));
    assert.equal(
      formatEpisodeRelativeTime(
        epReal?.publishedTimestamp,
        Date.UTC(2026, 10, 23, 15, 0, 0),
        { published: epReal?.published },
      ),
      "Há 5 minutos",
    );

    // Quando publishedAt é null, NÃO pode usar updatedAt nem createdAt para tempo relativo
    assert.equal(epNoDate?.publishedTimestamp, null);
    assert.equal(
      formatEpisodeRelativeTime(
        epNoDate?.publishedTimestamp,
        Date.UTC(2026, 10, 23, 15, 0, 0),
        { published: epNoDate?.published },
      ),
      null,
    );
  });
});
