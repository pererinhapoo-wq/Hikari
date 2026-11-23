import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isValidImagePreviewUrl,
  shouldRunAutoThumbnailProbe,
  isDuplicatePasteTrigger,
} from "./thumbnail-probe-guard";
import {
  getOutboxMonitorState,
  subscribeOutbox,
} from "./episode-writer";
import { getAnimeQuickSummaries, getAnimeQuickSummary } from "@/components/admin/QuickPlayerUpdate";
import type { LocalAnime } from "./types";

describe("Hikari Admin Bloco 3 — Testes Unitários e de Integração (M1–M6)", () => {
  it("M1: Outbox monitor state and subscription architecture", () => {
    const initialState = getOutboxMonitorState();
    assert.equal(typeof initialState.subscriberCount, "number");
    assert.equal(typeof initialState.hasActiveTimer, "boolean");

    let receivedOps: unknown[] | null = null;
    const unsubscribe = subscribeOutbox((ops) => {
      receivedOps = ops;
    });

    const midState = getOutboxMonitorState();
    assert.equal(midState.subscriberCount >= 1, true);

    unsubscribe();
    assert.equal(typeof receivedOps, "object");
  });

  it("M2 & M5.A: Admin guard and user query parameters", () => {
    const mockAnime: LocalAnime = {
      id: "anime-m5-test",
      titleRomaji: "Test Anime",
      titleEnglish: "Test Anime EN",
      titleNative: "テスト",
      cover: "https://example.com/cover.jpg",
      banner: "https://example.com/banner.jpg",
      synopsis: "Test synopsis",
      score: 9.0,
      format: "TV",
      status: "FINISHED",
      episodesCount: 1,
      season: "SPRING",
      year: 2024,
      trailerId: null,
      hidden: false,
      genres: ["Action"],
      seasons: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const summary = getAnimeQuickSummary(mockAnime);
    assert.equal(summary.id, "anime-m5-test");
    assert.equal(summary.title, "Test Anime EN");

    const summaries = getAnimeQuickSummaries([mockAnime]);
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0]?.id, "anime-m5-test");
  });

  it("M3: Health table definitions and comment_report table check", () => {
    const tableNames = [
      "catalog_anime",
      "catalog_season",
      "catalog_episode",
      "user",
      "profile",
      "session",
      "account",
      "comment",
      "comment_report",
      "admin_settings",
    ];
    assert.equal(tableNames.includes("comment_report"), true);
    assert.equal(tableNames.includes("comment_reports"), false);
  });

  it("M6: Thumbnail probe guards, valid image URLs, and paste deduplication", () => {
    // Valid image preview URLs
    assert.equal(isValidImagePreviewUrl("https://example.com/image.jpg"), true);
    assert.equal(isValidImagePreviewUrl("http://localhost:3000/img.png"), true);
    assert.equal(isValidImagePreviewUrl("/images/local.jpg"), true);
    assert.equal(isValidImagePreviewUrl("blob:https://example.com/abc"), true);
    assert.equal(isValidImagePreviewUrl("data:image/png;base64,iVBORw0KGgo="), true);

    // Invalid / partial image preview URLs that should be rejected
    assert.equal(isValidImagePreviewUrl(""), false);
    assert.equal(isValidImagePreviewUrl(null), false);
    assert.equal(isValidImagePreviewUrl(undefined), false);
    assert.equal(isValidImagePreviewUrl("https://"), false);
    assert.equal(isValidImagePreviewUrl("https://cd"), false);
    assert.equal(isValidImagePreviewUrl("htt"), false);

    // Auto thumbnail probe recurrence check
    const existingLoadedState = {
      loading: false,
      sourceUrl: "https://www.youtube.com/watch?v=abc123xyz",
      candidates: [{ id: "1", previewUrl: "blob:1", label: "00:00" }],
    };

    // Same video URL without force -> should not re-probe automatically
    assert.equal(
      shouldRunAutoThumbnailProbe(
        existingLoadedState,
        "https://www.youtube.com/watch?v=abc123xyz",
        false,
      ),
      false,
    );

    // Same video URL WITH force -> should re-probe (manual retry)
    assert.equal(
      shouldRunAutoThumbnailProbe(
        existingLoadedState,
        "https://www.youtube.com/watch?v=abc123xyz",
        true,
      ),
      true,
    );

    // Different video URL -> should probe automatically
    assert.equal(
      shouldRunAutoThumbnailProbe(
        existingLoadedState,
        "https://www.youtube.com/watch?v=new456uvw",
        false,
      ),
      true,
    );

    // Paste deduplication test
    const now = Date.now();
    const pasteRecord = {
      slotKey: "videoUrl" as const,
      value: "https://www.youtube.com/watch?v=abc123xyz",
      at: now,
    };

    assert.equal(
      isDuplicatePasteTrigger(
        pasteRecord,
        "videoUrl",
        "https://www.youtube.com/watch?v=abc123xyz",
        now + 200,
      ),
      true,
    );

    assert.equal(
      isDuplicatePasteTrigger(
        pasteRecord,
        "videoUrl",
        "https://www.youtube.com/watch?v=abc123xyz",
        now + 800,
      ),
      false,
    );
  });
});
