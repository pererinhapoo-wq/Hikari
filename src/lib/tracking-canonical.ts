import type { Sql } from "@/lib/db";
import type {
  AnimeSnapshot,
  TrackingStatus,
  UserAnimeTrackingItem,
} from "@/types/profile-tracking";

export interface TrackingCatalogRow {
  id: string;
  title: string;
  anilistId: number | null;
  malId: number | null;
  kitsuId: number | null;
  titleRomaji: string | null;
  titleEnglish: string | null;
  titleNative: string | null;
  cover: string | null;
  banner: string | null;
  format: string | null;
  year: number | null;
  episodesCount: number | null;
  status: string | null;
}

export interface JoinedUserTrackingRow {
  userId: string;
  animeId: string;
  status: TrackingStatus;
  score: string | number | null;
  episodesWatched: number;
  animeSnapshot: unknown;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  catalogId: string | null;
  catalogTitle: string | null;
  catalogAnilistId: number | null;
  catalogMalId: number | null;
  catalogKitsuId: number | null;
  catalogTitleRomaji: string | null;
  catalogTitleEnglish: string | null;
  catalogTitleNative: string | null;
  catalogCover: string | null;
  catalogBanner: string | null;
  catalogFormat: string | null;
  catalogYear: number | null;
  catalogEpisodesCount: number | null;
  catalogStatus: string | null;
}

interface NormalizedIdentity {
  animeId: string;
  serverCatalogId: string | null;
  anilistId: number | null;
  malId: number | null;
  kitsuId: number | null;
  isDubbed: boolean;
  titles: string[];
  format: string | null;
  year: number | null;
}

const STATUS_PRIORITY: Record<TrackingStatus, number> = {
  completed: 5,
  watching: 4,
  on_hold: 3,
  dropped: 2,
  planning: 1,
};

function toPositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  return null;
}

export function parseTrackingSnapshot(raw: unknown): AnimeSnapshot | null {
  if (!raw) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as AnimeSnapshot;
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as AnimeSnapshot;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function isDubbedString(text: string): boolean {
  return /\b(dub|dublado|dublada)\b/i.test(text);
}

function normalizeTitleKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || cleaned === "sem titulo") return null;
  return cleaned;
}

function parseIdsFromAnimeId(animeId: string): {
  anilistId: number | null;
  malId: number | null;
  kitsuId: number | null;
} {
  const clean = animeId.trim();
  if (/^\d+$/.test(clean)) {
    return { anilistId: toPositiveInt(clean), malId: null, kitsuId: null };
  }
  if (clean.startsWith("mal-")) {
    return { anilistId: null, malId: toPositiveInt(clean.slice(4)), kitsuId: null };
  }
  if (clean.startsWith("kitsu-")) {
    return { anilistId: null, malId: null, kitsuId: toPositiveInt(clean.slice(6)) };
  }
  return { anilistId: null, malId: null, kitsuId: null };
}

function buildIdentityFromParts(parts: {
  animeId: string;
  catalog?: Partial<TrackingCatalogRow> | null;
  snapshot?: AnimeSnapshot | null;
}): NormalizedIdentity {
  const parsedId = parseIdsFromAnimeId(parts.animeId);
  const rawTitles = [
    parts.catalog?.title,
    parts.catalog?.titleRomaji,
    parts.catalog?.titleEnglish,
    parts.catalog?.titleNative,
    parts.snapshot?.title,
    parts.snapshot?.titleRomaji,
    parts.snapshot?.titleEnglish,
    parts.snapshot?.titleNative,
  ]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0);

  const isDubbed = rawTitles.some((t) => isDubbedString(t));

  const titles = Array.from(
    new Set(
      rawTitles
        .map((t) => normalizeTitleKey(t))
        .filter((t): t is string => Boolean(t)),
    ),
  );

  const serverCatalogId =
    (typeof parts.catalog?.id === "string" && parts.catalog.id.trim()) ||
    (typeof parts.snapshot?.serverCatalogId === "string" && parts.snapshot.serverCatalogId.trim()) ||
    null;

  const anilistId =
    toPositiveInt(parts.catalog?.anilistId) ??
    toPositiveInt(parts.snapshot?.anilistId) ??
    (!isDubbed ? parsedId.anilistId : null);

  const malId =
    toPositiveInt(parts.catalog?.malId) ??
    toPositiveInt(parts.snapshot?.malId) ??
    (!isDubbed ? parsedId.malId : null);

  const kitsuId =
    toPositiveInt(parts.catalog?.kitsuId) ??
    toPositiveInt(parts.snapshot?.kitsuId) ??
    (!isDubbed ? parsedId.kitsuId : null);

  const formatRaw =
    (typeof parts.catalog?.format === "string" && parts.catalog.format.trim()) ||
    (typeof parts.snapshot?.format === "string" && parts.snapshot.format.trim()) ||
    null;

  const year =
    toPositiveInt(parts.catalog?.year) ??
    toPositiveInt(parts.snapshot?.year);

  return {
    animeId: parts.animeId,
    serverCatalogId,
    anilistId,
    malId,
    kitsuId,
    isDubbed,
    titles,
    format: formatRaw ? formatRaw.toUpperCase() : null,
    year,
  };
}

function buildIdentityFromJoinedRow(row: JoinedUserTrackingRow): NormalizedIdentity {
  const snapshot = parseTrackingSnapshot(row.animeSnapshot);
  return buildIdentityFromParts({
    animeId: row.animeId,
    catalog: row.catalogId
      ? {
          id: row.catalogId,
          title: row.catalogTitle ?? "",
          anilistId: row.catalogAnilistId,
          malId: row.catalogMalId,
          kitsuId: row.catalogKitsuId,
          titleRomaji: row.catalogTitleRomaji,
          titleEnglish: row.catalogTitleEnglish,
          titleNative: row.catalogTitleNative,
          format: row.catalogFormat,
          year: row.catalogYear,
        }
      : null,
    snapshot,
  });
}

function buildIdentityFromTrackingItem(item: UserAnimeTrackingItem): NormalizedIdentity {
  return buildIdentityFromParts({
    animeId: item.animeId,
    catalog: {
      id: item.animeSnapshot?.serverCatalogId ?? undefined,
      title: item.title,
      titleRomaji: item.titleRomaji,
      titleEnglish: item.titleEnglish,
      titleNative: item.titleNative,
      format: item.format,
      year: item.year,
    },
    snapshot: item.animeSnapshot,
  });
}

function areFormatsCompatible(a: string | null, b: string | null): boolean {
  if (!a || !b) return true;
  if (a === b) return true;
  return false;
}

function areYearsCompatible(a: number | null, b: number | null): boolean {
  if (!a || !b) return true;
  return Math.abs(a - b) <= 1;
}

function areIdentitiesSameAnime(a: NormalizedIdentity, b: NormalizedIdentity): boolean {
  if (a.animeId === b.animeId) return true;
  if (a.serverCatalogId && b.serverCatalogId && a.serverCatalogId === b.serverCatalogId) {
    return true;
  }
  if (a.serverCatalogId && a.serverCatalogId === b.animeId) return true;
  if (b.serverCatalogId && b.serverCatalogId === a.animeId) return true;

  // Não mescla versões explicitamente dubladas com legendadas/originais
  if (a.isDubbed !== b.isDubbed) {
    return false;
  }

  // Conflito explícito de IDs externos garante obras distintas (ex: Naruto vs Naruto Shippuden)
  if (a.anilistId && b.anilistId && a.anilistId !== b.anilistId) return false;
  if (a.malId && b.malId && a.malId !== b.malId) return false;
  if (a.kitsuId && b.kitsuId && a.kitsuId !== b.kitsuId) return false;

  if (a.anilistId && b.anilistId && a.anilistId === b.anilistId) return true;
  if (a.malId && b.malId && a.malId === b.malId) return true;
  if (a.kitsuId && b.kitsuId && a.kitsuId === b.kitsuId) return true;

  // Fallback seguro por título exato normalizado (apenas entre namespaces diferentes, ex: local-* vs 20)
  if (a.titles.length === 0 || b.titles.length === 0) {
    return false;
  }
  if (!areFormatsCompatible(a.format, b.format)) {
    return false;
  }
  if (!areYearsCompatible(a.year, b.year)) {
    return false;
  }

  const bTitles = new Set(b.titles);
  return a.titles.some((title) => bTitles.has(title));
}

export async function lookupCatalogRowForTracking(
  sql: Sql,
  requestedAnimeId: string,
  snapshot?: AnimeSnapshot | null,
): Promise<TrackingCatalogRow | null> {
  const cleanId = requestedAnimeId.trim();
  const snapshotServerId =
    typeof snapshot?.serverCatalogId === "string" && snapshot.serverCatalogId.trim()
      ? snapshot.serverCatalogId.trim()
      : null;

  // 1. Busca direta por ID exato na catalog_anime
  const directRows = await sql.query<TrackingCatalogRow>(
    `SELECT "id", "title", "anilistId", "malId", "kitsuId",
            "titleRomaji", "titleEnglish", "titleNative",
            "cover", "banner", "format", "year", "episodesCount", "status"
     FROM "catalog_anime"
     WHERE "id" = $1 OR ($2::text IS NOT NULL AND "id" = $2)
     ORDER BY CASE WHEN "id" = $1 THEN 0 ELSE 1 END ASC
     LIMIT 1`,
    [cleanId, snapshotServerId],
  );
  if (directRows[0]) {
    return directRows[0];
  }

  // 1.5. Busca por snapshot gravado no user_anime_tracking caso o ID direto tenha sido excluído e readicionado com novo ID
  let fallbackSnapshot = snapshot;
  if (!fallbackSnapshot) {
    try {
      const trackingRows = await sql.query<{ animeSnapshot: unknown }>(
        `SELECT "animeSnapshot" FROM "user_anime_tracking" WHERE "animeId" = $1 LIMIT 1`,
        [cleanId],
      );
      if (trackingRows[0]?.animeSnapshot) {
        fallbackSnapshot = parseTrackingSnapshot(trackingRows[0].animeSnapshot);
      }
    } catch {
      // Ignora falhas na consulta de tracking
    }
  }

  // 2. Busca por IDs externos somente quando a obra solicitada não for dublada separada
  const reqTitles = [
    fallbackSnapshot?.title,
    fallbackSnapshot?.titleRomaji,
    fallbackSnapshot?.titleEnglish,
    fallbackSnapshot?.titleNative,
  ]
    .filter((v): v is string => typeof v === "string")
    .join(" ");
  const requestedIsDubbed = isDubbedString(reqTitles);
  if (requestedIsDubbed) {
    return null;
  }

  const parsed = parseIdsFromAnimeId(cleanId);
  const anilistId = toPositiveInt(fallbackSnapshot?.anilistId) ?? parsed.anilistId;
  const malId = toPositiveInt(fallbackSnapshot?.malId) ?? parsed.malId;
  const kitsuId = toPositiveInt(fallbackSnapshot?.kitsuId) ?? parsed.kitsuId;

  if (!anilistId && !malId && !kitsuId) {
    return null;
  }

  const extRows = await sql.query<TrackingCatalogRow>(
    `SELECT "id", "title", "anilistId", "malId", "kitsuId",
            "titleRomaji", "titleEnglish", "titleNative",
            "cover", "banner", "format", "year", "episodesCount", "status"
     FROM "catalog_anime"
     WHERE "hidden" = false
       AND (
         ($1::int IS NOT NULL AND "anilistId" = $1)
         OR ($2::int IS NOT NULL AND "malId" = $2)
         OR ($3::int IS NOT NULL AND "kitsuId" = $3)
       )
     ORDER BY "updatedAt" DESC`,
    [anilistId, malId, kitsuId],
  );

  for (const row of extRows) {
    const rowTitleText = `${row.title ?? ""} ${row.titleRomaji ?? ""} ${row.titleEnglish ?? ""} ${row.titleNative ?? ""}`;
    if (!isDubbedString(rowTitleText)) {
      return row;
    }
  }

  return null;
}

export function buildMergedTrackingSnapshot(
  catalogRow: TrackingCatalogRow | null,
  inputSnapshot?: AnimeSnapshot | null,
  fallbackSnapshots: (AnimeSnapshot | null)[] = [],
): AnimeSnapshot {
  const allInputs = [inputSnapshot ?? null, ...fallbackSnapshots].filter(
    (s): s is AnimeSnapshot => Boolean(s),
  );

  const pickString = (
    catalogVal: string | null | undefined,
    getter: (s: AnimeSnapshot) => string | null | undefined,
  ): string | null => {
    if (catalogVal && catalogVal.trim()) return catalogVal.trim();
    for (const snap of allInputs) {
      const v = getter(snap);
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return null;
  };

  const pickInt = (
    catalogVal: number | null | undefined,
    getter: (s: AnimeSnapshot) => number | null | undefined,
  ): number | null => {
    const cat = toPositiveInt(catalogVal);
    if (cat !== null) return cat;
    for (const snap of allInputs) {
      const n = toPositiveInt(getter(snap));
      if (n !== null) return n;
    }
    return null;
  };

  const title =
    pickString(catalogRow?.title, (s) => s.title) ?? "Sem título";

  let score: number | null = null;
  for (const snap of allInputs) {
    if (typeof snap.score === "number" && Number.isFinite(snap.score)) {
      score = snap.score;
      break;
    }
  }

  return {
    title,
    titleRomaji: pickString(catalogRow?.titleRomaji, (s) => s.titleRomaji),
    titleEnglish: pickString(catalogRow?.titleEnglish, (s) => s.titleEnglish),
    titleNative: pickString(catalogRow?.titleNative, (s) => s.titleNative),
    cover: pickString(catalogRow?.cover, (s) => s.cover),
    banner: pickString(catalogRow?.banner, (s) => s.banner),
    format: pickString(catalogRow?.format, (s) => s.format),
    year: pickInt(catalogRow?.year, (s) => s.year),
    episodesCount: pickInt(catalogRow?.episodesCount, (s) => s.episodesCount),
    status: pickString(catalogRow?.status, (s) => s.status),
    score,
    anilistId: pickInt(catalogRow?.anilistId, (s) => s.anilistId),
    malId: pickInt(catalogRow?.malId, (s) => s.malId),
    kitsuId: pickInt(catalogRow?.kitsuId, (s) => s.kitsuId),
    serverCatalogId: pickString(catalogRow?.id, (s) => s.serverCatalogId),
  };
}

async function fetchJoinedTrackingRowsForUser(
  sql: Sql,
  userId: string,
): Promise<JoinedUserTrackingRow[]> {
  return sql.query<JoinedUserTrackingRow>(
    `SELECT
       uat."userId",
       uat."animeId",
       uat."status",
       uat."score",
       uat."episodesWatched",
       uat."animeSnapshot",
       uat."startedAt",
       uat."completedAt",
       uat."createdAt",
       uat."updatedAt",
       ca."id" AS "catalogId",
       ca."title" AS "catalogTitle",
       ca."anilistId" AS "catalogAnilistId",
       ca."malId" AS "catalogMalId",
       ca."kitsuId" AS "catalogKitsuId",
       ca."titleRomaji" AS "catalogTitleRomaji",
       ca."titleEnglish" AS "catalogTitleEnglish",
       ca."titleNative" AS "catalogTitleNative",
       ca."cover" AS "catalogCover",
       ca."banner" AS "catalogBanner",
       ca."format" AS "catalogFormat",
       ca."year" AS "catalogYear",
       ca."episodesCount" AS "catalogEpisodesCount",
       ca."status" AS "catalogStatus"
     FROM "user_anime_tracking" uat
     LEFT JOIN "catalog_anime" ca ON ca."id" = uat."animeId"
     WHERE uat."userId" = $1
     ORDER BY uat."updatedAt" DESC;`,
    [userId],
  );
}

function chooseWinnerRow(
  rows: JoinedUserTrackingRow[],
  preferredCatalogId?: string | null,
): JoinedUserTrackingRow {
  const sorted = [...rows].sort((a, b) => {
    if (preferredCatalogId) {
      if (a.animeId === preferredCatalogId && b.animeId !== preferredCatalogId) return -1;
      if (b.animeId === preferredCatalogId && a.animeId !== preferredCatalogId) return 1;
    }

    const epDiff = (Number(b.episodesWatched) || 0) - (Number(a.episodesWatched) || 0);
    if (epDiff !== 0) return epDiff;

    const stDiff = (STATUS_PRIORITY[b.status] ?? 0) - (STATUS_PRIORITY[a.status] ?? 0);
    if (stDiff !== 0) return stDiff;

    const aHasScore = a.score !== null && a.score !== undefined ? 1 : 0;
    const bHasScore = b.score !== null && b.score !== undefined ? 1 : 0;
    if (bHasScore !== aHasScore) return bHasScore - aHasScore;

    const aUpdated = Date.parse(String(a.updatedAt)) || 0;
    const bUpdated = Date.parse(String(b.updatedAt)) || 0;
    return bUpdated - aUpdated;
  });

  return sorted[0];
}

function pickEarliestDate(values: (string | null | undefined)[]): string | null {
  let best: string | null = null;
  let bestMs = Number.POSITIVE_INFINITY;
  for (const val of values) {
    if (!val) continue;
    const ms = Date.parse(String(val));
    if (Number.isFinite(ms) && ms < bestMs) {
      bestMs = ms;
      best = new Date(ms).toISOString();
    }
  }
  return best;
}

export async function consolidateMatchingTrackingRows(
  sql: Sql,
  userId: string,
  rows: JoinedUserTrackingRow[],
  preferredCatalogRow?: TrackingCatalogRow | null,
  extraSnapshot?: AnimeSnapshot | null,
): Promise<{
  canonicalAnimeId: string;
  episodesWatched: number;
  status: TrackingStatus;
  score: number | null;
  startedAt: string | null;
  completedAt: string | null;
  mergedSnapshot: AnimeSnapshot;
}> {
  const winner = chooseWinnerRow(rows, preferredCatalogRow?.id ?? null);
  const canonicalAnimeId = winner.animeId;
  const loserIds = rows
    .map((r) => r.animeId)
    .filter((id) => id !== canonicalAnimeId);

  let maxEpisodesWatched = 0;
  let bestStatus: TrackingStatus = winner.status;
  let bestStatusScore = STATUS_PRIORITY[winner.status] ?? 0;
  let resolvedScore: number | null =
    winner.score !== null && winner.score !== undefined && String(winner.score).trim() !== ""
      ? Number(winner.score)
      : null;

  const rowSnapshots: (AnimeSnapshot | null)[] = [];
  for (const r of rows) {
    const eps = Number(r.episodesWatched) || 0;
    if (eps > maxEpisodesWatched) {
      maxEpisodesWatched = eps;
    }
    const pr = STATUS_PRIORITY[r.status] ?? 0;
    if (pr > bestStatusScore) {
      bestStatusScore = pr;
      bestStatus = r.status;
    }
    if (resolvedScore === null && r.score !== null && r.score !== undefined && String(r.score).trim() !== "") {
      resolvedScore = Number(r.score);
    }
    rowSnapshots.push(parseTrackingSnapshot(r.animeSnapshot));
  }

  const startedAt = pickEarliestDate(rows.map((r) => r.startedAt));
  const completedAt =
    bestStatus === "completed" ? pickEarliestDate(rows.map((r) => r.completedAt)) : null;

  const catalogRow: TrackingCatalogRow | null =
    preferredCatalogRow ??
    (winner.catalogId
      ? {
          id: winner.catalogId,
          title: winner.catalogTitle ?? "",
          anilistId: winner.catalogAnilistId,
          malId: winner.catalogMalId,
          kitsuId: winner.catalogKitsuId,
          titleRomaji: winner.catalogTitleRomaji,
          titleEnglish: winner.catalogTitleEnglish,
          titleNative: winner.catalogTitleNative,
          cover: winner.catalogCover,
          banner: winner.catalogBanner,
          format: winner.catalogFormat,
          year: winner.catalogYear,
          episodesCount: winner.catalogEpisodesCount,
          status: winner.catalogStatus,
        }
      : null);

  const mergedSnapshot = buildMergedTrackingSnapshot(
    catalogRow,
    extraSnapshot,
    rowSnapshots,
  );

  if (loserIds.length > 0) {
    // 1. Migra histórico de episódios assistidos sem colidir na PK
    await sql.query(
      `INSERT INTO "user_watched_episode" (
         "userId", "animeId", "episodeId", "episodeNumber", "origin", "watchedAt"
       )
       SELECT "userId", $2, "episodeId", "episodeNumber", "origin", "watchedAt"
       FROM "user_watched_episode"
       WHERE "userId" = $1 AND "animeId" = ANY($3::text[])
       ON CONFLICT ("userId", "animeId", "episodeId") DO NOTHING;`,
      [userId, canonicalAnimeId, loserIds],
    );

    await sql.query(
      `DELETE FROM "user_watched_episode"
       WHERE "userId" = $1 AND "animeId" = ANY($2::text[]);`,
      [userId, loserIds],
    );

    // 2. Migra progresso técnico de reprodução sem colidir na PK
    await sql.query(
      `INSERT INTO "user_episode_progress" (
         "userId", "animeId", "episodeId", "episodeNumber", "currentTime", "duration",
         "accumulatedTime", "accumulatedRemainderMs", "autoCompleteSuppressed", "playbackSessionId", "updatedAt"
       )
       SELECT
         "userId", $2, "episodeId", "episodeNumber", "currentTime", "duration",
         "accumulatedTime", "accumulatedRemainderMs", "autoCompleteSuppressed", "playbackSessionId", "updatedAt"
       FROM "user_episode_progress"
       WHERE "userId" = $1 AND "animeId" = ANY($3::text[])
       ON CONFLICT ("userId", "animeId", "episodeId") DO NOTHING;`,
      [userId, canonicalAnimeId, loserIds],
    );

    await sql.query(
      `DELETE FROM "user_episode_progress"
       WHERE "userId" = $1 AND "animeId" = ANY($2::text[]);`,
      [userId, loserIds],
    );

    // Garante que o total de episódios nunca regrida nem fique abaixo dos episódios migrados
    const countRows = await sql.query<{ count: number }>(
      `SELECT count(*)::int AS count
       FROM "user_watched_episode"
       WHERE "userId" = $1 AND "animeId" = $2`,
      [userId, canonicalAnimeId],
    );
    const watchedCount = Number(countRows[0]?.count) || 0;
    const finalEpisodesWatched = Math.max(maxEpisodesWatched, watchedCount);

    await sql.query(
      `UPDATE "user_anime_tracking"
       SET
         "status" = $3,
         "score" = $4,
         "episodesWatched" = $5,
         "animeSnapshot" = $6::jsonb,
         "startedAt" = COALESCE($7::timestamptz, "startedAt"),
         "completedAt" = CASE
           WHEN $3 = 'completed' THEN COALESCE($8::timestamptz, "completedAt", CURRENT_TIMESTAMP)
           ELSE $8::timestamptz
         END,
         "updatedAt" = CURRENT_TIMESTAMP
       WHERE "userId" = $1 AND "animeId" = $2`,
      [
        userId,
        canonicalAnimeId,
        bestStatus,
        resolvedScore,
        finalEpisodesWatched,
        JSON.stringify(mergedSnapshot),
        startedAt,
        completedAt,
      ],
    );

    await sql.query(
      `DELETE FROM "user_anime_tracking"
       WHERE "userId" = $1 AND "animeId" = ANY($2::text[]);`,
      [userId, loserIds],
    );

    return {
      canonicalAnimeId,
      episodesWatched: finalEpisodesWatched,
      status: bestStatus,
      score: resolvedScore,
      startedAt,
      completedAt,
      mergedSnapshot,
    };
  }

  return {
    canonicalAnimeId,
    episodesWatched: maxEpisodesWatched,
    status: bestStatus,
    score: resolvedScore,
    startedAt,
    completedAt,
    mergedSnapshot,
  };
}

/**
 * Resolve o animeId canônico para qualquer operação de acompanhamento ou reprodução,
 * consolidando automaticamente entradas duplicadas existentes do mesmo anime.
 */
export async function resolveAndConsolidateTrackingTarget(
  sql: Sql,
  userId: string,
  requestedAnimeId: string,
  inputSnapshot?: AnimeSnapshot | null,
): Promise<{
  canonicalAnimeId: string;
  catalogRow: TrackingCatalogRow | null;
  mergedSnapshot: AnimeSnapshot;
  existingEpisodesWatched: number | null;
  candidateIds: string[];
}> {
  const cleanId = requestedAnimeId.trim();
  const catalogRow = await lookupCatalogRowForTracking(sql, cleanId, inputSnapshot);
  const targetIdentity = buildIdentityFromParts({
    animeId: cleanId,
    catalog: catalogRow,
    snapshot: inputSnapshot,
  });

  const userRows = await fetchJoinedTrackingRowsForUser(sql, userId);
  const matchingRows = userRows.filter((row) =>
    areIdentitiesSameAnime(targetIdentity, buildIdentityFromJoinedRow(row)),
  );

  const candidateIds = Array.from(
    new Set(
      [
        cleanId,
        catalogRow?.id,
        ...matchingRows.map((r) => r.animeId),
      ].filter((id): id is string => Boolean(id && id.trim())),
    ),
  );

  if (matchingRows.length > 1) {
    const consolidated = await consolidateMatchingTrackingRows(
      sql,
      userId,
      matchingRows,
      catalogRow,
      inputSnapshot,
    );
    return {
      canonicalAnimeId: consolidated.canonicalAnimeId,
      catalogRow,
      mergedSnapshot: consolidated.mergedSnapshot,
      existingEpisodesWatched: consolidated.episodesWatched,
      candidateIds: Array.from(new Set([...candidateIds, consolidated.canonicalAnimeId])),
    };
  }

  if (matchingRows.length === 1) {
    const existing = matchingRows[0];
    const existingSnap = parseTrackingSnapshot(existing.animeSnapshot);
    const mergedSnapshot = buildMergedTrackingSnapshot(catalogRow, inputSnapshot, [
      existingSnap,
    ]);
    return {
      canonicalAnimeId: existing.animeId,
      catalogRow,
      mergedSnapshot,
      existingEpisodesWatched: Number(existing.episodesWatched) || 0,
      candidateIds: Array.from(new Set([...candidateIds, existing.animeId])),
    };
  }

  const canonicalAnimeId = catalogRow?.id || cleanId;
  const mergedSnapshot = buildMergedTrackingSnapshot(catalogRow, inputSnapshot);

  return {
    canonicalAnimeId,
    catalogRow,
    mergedSnapshot,
    existingEpisodesWatched: null,
    candidateIds: Array.from(new Set([...candidateIds, canonicalAnimeId])),
  };
}

/**
 * Varre os acompanhamentos do próprio usuário e consolida em banco
 * quaisquer duplicatas pré-existentes do mesmo anime (idempotente e rápido: só escreve se achar duplicatas).
 */
export async function consolidateUserTrackingDuplicates(
  sql: Sql,
  userId: string,
): Promise<void> {
  const rows = await fetchJoinedTrackingRowsForUser(sql, userId);
  if (rows.length <= 1) return;

  const identities = rows.map((row) => buildIdentityFromJoinedRow(row));
  const visited = new Array<boolean>(rows.length).fill(false);

  for (let i = 0; i < rows.length; i++) {
    if (visited[i]) continue;
    visited[i] = true;
    const clusterIndices = [i];

    for (let j = 0; j < clusterIndices.length; j++) {
      const currentIdx = clusterIndices[j];
      for (let k = i + 1; k < rows.length; k++) {
        if (visited[k]) continue;
        if (areIdentitiesSameAnime(identities[currentIdx], identities[k])) {
          visited[k] = true;
          clusterIndices.push(k);
        }
      }
    }

    if (clusterIndices.length > 1) {
      const clusterRows = clusterIndices.map((idx) => rows[idx]);
      const preferredCatalog = clusterRows.find((r) => r.catalogId) ?? null;
      await consolidateMatchingTrackingRows(
        sql,
        userId,
        clusterRows,
        preferredCatalog
          ? {
              id: preferredCatalog.catalogId!,
              title: preferredCatalog.catalogTitle ?? "",
              anilistId: preferredCatalog.catalogAnilistId,
              malId: preferredCatalog.catalogMalId,
              kitsuId: preferredCatalog.catalogKitsuId,
              titleRomaji: preferredCatalog.catalogTitleRomaji,
              titleEnglish: preferredCatalog.catalogTitleEnglish,
              titleNative: preferredCatalog.catalogTitleNative,
              cover: preferredCatalog.catalogCover,
              banner: preferredCatalog.catalogBanner,
              format: preferredCatalog.catalogFormat,
              year: preferredCatalog.catalogYear,
              episodesCount: preferredCatalog.catalogEpisodesCount,
              status: preferredCatalog.catalogStatus,
            }
          : null,
      );
    }
  }
}

/**
 * Deduplica em memória listas públicas sem mutar registros de terceiros em leitura GET.
 */
export function dedupePublicTrackingItems(
  items: UserAnimeTrackingItem[],
): UserAnimeTrackingItem[] {
  if (items.length <= 1) return items;

  const clusters: { identity: NormalizedIdentity; items: UserAnimeTrackingItem[] }[] = [];

  for (const item of items) {
    const id = buildIdentityFromTrackingItem(item);
    const match = clusters.find((c) => areIdentitiesSameAnime(c.identity, id));
    if (match) {
      match.items.push(item);
    } else {
      clusters.push({ identity: id, items: [item] });
    }
  }

  return clusters.map(({ items: group }) => {
    if (group.length === 1) return group[0];
    const sorted = [...group].sort((a, b) => {
      const epDiff = (b.episodesWatched || 0) - (a.episodesWatched || 0);
      if (epDiff !== 0) return epDiff;
      const stDiff = (STATUS_PRIORITY[b.status] ?? 0) - (STATUS_PRIORITY[a.status] ?? 0);
      if (stDiff !== 0) return stDiff;
      return (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0);
    });
    const best = sorted[0];
    const maxEpisodes = Math.max(...group.map((g) => g.episodesWatched || 0));
    return {
      ...best,
      episodesWatched: maxEpisodes,
    };
  });
}
