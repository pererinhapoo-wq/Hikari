export const BLOCKED_ANILIST_IDS = [
  212308,
  165159,
  146004,
  202851,
  209709,
  966,
  8687,
  168085,
  218011,
  213298,
  204269,
  185646,
  202957,
  216860,
  206523,
  217787,
  213356,
  155723,
  216557,
  214968,
  214260,
  137683,
  2406,
  118123,
  215835,
  209032,
  217782,
  218217,
  214593,
  137653,
  218532,
  218938,
  213188,
  218008,
  204656,
  214974,
  220079,
  217624,
  218942,
  217577,
  212144,
] as const;

export const BLOCKED_ANILIST_ID_SET: ReadonlySet<number> = new Set<number>(
  BLOCKED_ANILIST_IDS,
);

export interface ParsedVisibilityIdentifier {
  raw: string;
  normalized: string;
  anilistId: number | null;
  malId: number | null;
  kitsuId: number | null;
  isLocal: boolean;
}

export interface VisibilityIndexContext {
  blockedCatalogIds: ReadonlySet<string>;
  blockedAnilistIds: ReadonlySet<number>;
  blockedMalIds: ReadonlySet<number>;
  blockedKitsuIds: ReadonlySet<number>;
  countryByCatalogId?: ReadonlyMap<string, string>;
  countryByAnilistId?: ReadonlyMap<number, string>;
  aliasToCanonicalId?: ReadonlyMap<string, string>;
}

export interface VisibilityAnimeCandidate {
  id?: string | number | null;
  animeId?: string | number | null;
  serverCatalogId?: string | null;
  anilistId?: number | null;
  animeAnilistId?: number | null;
  malId?: number | null;
  animeMalId?: number | null;
  idMal?: number | null;
  kitsuId?: number | null;
  animeKitsuId?: number | null;
  duplicateOfId?: string | null;
  resolvedFromAliasId?: string | null;
  resolvedAliasIds?: ReadonlyArray<string> | null;
  countryOfOrigin?: string | null;
  animeCountryOfOrigin?: string | null;
}

export const EMPTY_PUBLIC_VISIBILITY_CONTEXT: VisibilityIndexContext = {
  blockedCatalogIds: new Set<string>(),
  blockedAnilistIds: BLOCKED_ANILIST_ID_SET,
  blockedMalIds: new Set<number>(),
  blockedKitsuIds: new Set<number>(),
};

/**
 * Normaliza o código de país de origem do AniList.
 * Nunca atribui "JP" como fallback; valores ausentes ou inválidos retornam null.
 */
export function normalizeCountryOfOrigin(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) return null;
  if (!/^[A-Z]{2,3}$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Identifica exclusivamente origem chinesa confirmada ("CN").
 * "TW", "HK", null ou desconhecido retornam false.
 */
export function isConfirmedDonghuaOrigin(countryOfOrigin: unknown): boolean {
  return normalizeCountryOfOrigin(countryOfOrigin) === "CN";
}

function toPositiveInt(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      const parsed = Number(trimmed);
      return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
    }
  }
  return null;
}

/**
 * Normaliza os formatos de ID usados no Hikari:
 * - Numérico (AniList ID)
 * - "anilist-<id>"
 * - "mal-<id>"
 * - "kitsu-<id>"
 * - "local-<uuid>" ou outros IDs locais/canônicos
 */
export function parseVisibilityIdentifier(
  rawId: unknown,
): ParsedVisibilityIdentifier | null {
  if (typeof rawId === "number") {
    const anilistId = toPositiveInt(rawId);
    if (!anilistId) return null;
    const str = String(anilistId);
    return {
      raw: str,
      normalized: str,
      anilistId,
      malId: null,
      kitsuId: null,
      isLocal: false,
    };
  }

  if (typeof rawId !== "string") return null;
  const trimmed = rawId.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    const anilistId = toPositiveInt(trimmed);
    return {
      raw: trimmed,
      normalized: anilistId ? String(anilistId) : trimmed,
      anilistId,
      malId: null,
      kitsuId: null,
      isLocal: false,
    };
  }

  const anilistMatch = /^anilist-(\d+)$/i.exec(trimmed);
  if (anilistMatch) {
    const anilistId = toPositiveInt(anilistMatch[1]);
    return {
      raw: trimmed,
      normalized: anilistId ? `anilist-${anilistId}` : trimmed.toLowerCase(),
      anilistId,
      malId: null,
      kitsuId: null,
      isLocal: false,
    };
  }

  const malMatch = /^mal-(\d+)$/i.exec(trimmed);
  if (malMatch) {
    const malId = toPositiveInt(malMatch[1]);
    return {
      raw: trimmed,
      normalized: malId ? `mal-${malId}` : trimmed.toLowerCase(),
      anilistId: null,
      malId,
      kitsuId: null,
      isLocal: false,
    };
  }

  const kitsuMatch = /^kitsu-(\d+)$/i.exec(trimmed);
  if (kitsuMatch) {
    const kitsuId = toPositiveInt(kitsuMatch[1]);
    return {
      raw: trimmed,
      normalized: kitsuId ? `kitsu-${kitsuId}` : trimmed.toLowerCase(),
      anilistId: null,
      malId: null,
      kitsuId,
      isLocal: false,
    };
  }

  return {
    raw: trimmed,
    normalized: trimmed,
    anilistId: null,
    malId: null,
    kitsuId: null,
    isLocal: trimmed.toLowerCase().startsWith("local-"),
  };
}

function collectIdentifierKeys(
  candidate: VisibilityAnimeCandidate,
): {
  catalogIds: string[];
  anilistIds: number[];
  malIds: number[];
  kitsuIds: number[];
  explicitCountry: string | null;
} {
  const catalogIds = new Set<string>();
  const anilistIds = new Set<number>();
  const malIds = new Set<number>();
  const kitsuIds = new Set<number>();

  const rawIds: Array<string | number | null | undefined> = [
    candidate.id,
    candidate.animeId,
    candidate.serverCatalogId,
    candidate.resolvedFromAliasId,
    ...(Array.isArray(candidate.resolvedAliasIds)
      ? candidate.resolvedAliasIds
      : []),
  ];

  for (const raw of rawIds) {
    const parsed = parseVisibilityIdentifier(raw);
    if (!parsed) continue;
    catalogIds.add(parsed.raw);
    catalogIds.add(parsed.normalized);
    if (parsed.anilistId) {
      anilistIds.add(parsed.anilistId);
      catalogIds.add(String(parsed.anilistId));
      catalogIds.add(`anilist-${parsed.anilistId}`);
    }
    if (parsed.malId) {
      malIds.add(parsed.malId);
      catalogIds.add(`mal-${parsed.malId}`);
    }
    if (parsed.kitsuId) {
      kitsuIds.add(parsed.kitsuId);
      catalogIds.add(`kitsu-${parsed.kitsuId}`);
    }
  }

  for (const rawAni of [candidate.anilistId, candidate.animeAnilistId]) {
    const ani = toPositiveInt(rawAni);
    if (ani) {
      anilistIds.add(ani);
      catalogIds.add(String(ani));
      catalogIds.add(`anilist-${ani}`);
    }
  }

  for (const rawMal of [
    candidate.malId,
    candidate.animeMalId,
    candidate.idMal,
  ]) {
    const mal = toPositiveInt(rawMal);
    if (mal) {
      malIds.add(mal);
      catalogIds.add(`mal-${mal}`);
    }
  }

  for (const rawKitsu of [candidate.kitsuId, candidate.animeKitsuId]) {
    const kitsu = toPositiveInt(rawKitsu);
    if (kitsu) {
      kitsuIds.add(kitsu);
      catalogIds.add(`kitsu-${kitsu}`);
    }
  }

  const explicitCountry =
    normalizeCountryOfOrigin(candidate.countryOfOrigin) ??
    normalizeCountryOfOrigin(candidate.animeCountryOfOrigin);

  return {
    catalogIds: Array.from(catalogIds),
    anilistIds: Array.from(anilistIds),
    malIds: Array.from(malIds),
    kitsuIds: Array.from(kitsuIds),
    explicitCountry,
  };
}

/**
 * Verifica se um único identificador (numérico, anilist-<id>, mal-<id>, kitsu-<id>, local-*, alias)
 * está bloqueado pela regra centralizada.
 */
export function isPubliclyBlockedId(
  id: string | number | null | undefined,
  ctx: VisibilityIndexContext = EMPTY_PUBLIC_VISIBILITY_CONTEXT,
): boolean {
  const parsed = parseVisibilityIdentifier(id);
  if (!parsed) return false;

  if (parsed.anilistId) {
    if (
      BLOCKED_ANILIST_ID_SET.has(parsed.anilistId) ||
      ctx.blockedAnilistIds.has(parsed.anilistId)
    ) {
      return true;
    }
    const mappedCountry = ctx.countryByAnilistId?.get(parsed.anilistId);
    if (mappedCountry && isConfirmedDonghuaOrigin(mappedCountry)) {
      return true;
    }
  }

  if (parsed.malId && ctx.blockedMalIds.has(parsed.malId)) {
    return true;
  }

  if (parsed.kitsuId && ctx.blockedKitsuIds.has(parsed.kitsuId)) {
    return true;
  }

  if (
    ctx.blockedCatalogIds.has(parsed.raw) ||
    ctx.blockedCatalogIds.has(parsed.normalized)
  ) {
    return true;
  }

  const catalogCountry =
    ctx.countryByCatalogId?.get(parsed.raw) ??
    ctx.countryByCatalogId?.get(parsed.normalized);
  if (catalogCountry && isConfirmedDonghuaOrigin(catalogCountry)) {
    return true;
  }

  if (ctx.aliasToCanonicalId) {
    const target =
      ctx.aliasToCanonicalId.get(parsed.raw) ??
      ctx.aliasToCanonicalId.get(parsed.normalized);
    if (target && target !== parsed.raw && target !== parsed.normalized) {
      return isPubliclyBlockedId(target, {
        ...ctx,
        aliasToCanonicalId: undefined,
      });
    }
  }

  return false;
}

/**
 * Decisão final de visibilidade pública para um registro/mídia individual.
 */
export function isPubliclyBlockedAnime(
  candidate: VisibilityAnimeCandidate | null | undefined,
  ctx: VisibilityIndexContext = EMPTY_PUBLIC_VISIBILITY_CONTEXT,
): boolean {
  if (!candidate || typeof candidate !== "object") return false;

  const keys = collectIdentifierKeys(candidate);

  if (isConfirmedDonghuaOrigin(keys.explicitCountry)) {
    return true;
  }

  for (const ani of keys.anilistIds) {
    if (BLOCKED_ANILIST_ID_SET.has(ani) || ctx.blockedAnilistIds.has(ani)) {
      return true;
    }
    const mappedCountry = ctx.countryByAnilistId?.get(ani);
    if (mappedCountry && isConfirmedDonghuaOrigin(mappedCountry)) {
      return true;
    }
  }

  for (const mal of keys.malIds) {
    if (ctx.blockedMalIds.has(mal)) {
      return true;
    }
  }

  for (const kitsu of keys.kitsuIds) {
    if (ctx.blockedKitsuIds.has(kitsu)) {
      return true;
    }
  }

  for (const cid of keys.catalogIds) {
    if (ctx.blockedCatalogIds.has(cid)) {
      return true;
    }
    const mappedCountry = ctx.countryByCatalogId?.get(cid);
    if (mappedCountry && isConfirmedDonghuaOrigin(mappedCountry)) {
      return true;
    }
  }

  if (candidate.duplicateOfId) {
    if (isPubliclyBlockedId(candidate.duplicateOfId, ctx)) {
      return true;
    }
  }

  return false;
}

/**
 * Filtra qualquer coleção de itens de anime removendo registros ocultos pela regra pública.
 */
export function filterPublicAnimes<T extends VisibilityAnimeCandidate>(
  items: ReadonlyArray<T> | null | undefined,
  ctx: VisibilityIndexContext = EMPTY_PUBLIC_VISIBILITY_CONTEXT,
): T[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  return items.filter((item) => !isPubliclyBlockedAnime(item, ctx));
}

/**
 * Constrói o contexto de visibilidade no cliente a partir dos registros locais
 * (incluindo propagação transitiva para cópias dubladas `local-*` com `duplicateOfId`
 * ou IDs externos compartilhados, sem usar correspondência aproximada de títulos).
 */
export function buildClientVisibilityContext(
  locals?: ReadonlyArray<VisibilityAnimeCandidate> | null,
): VisibilityIndexContext {
  const blockedCatalogIds = new Set<string>();
  const blockedAnilistIds = new Set<number>(BLOCKED_ANILIST_IDS);
  const blockedMalIds = new Set<number>();
  const blockedKitsuIds = new Set<number>();
  const countryByCatalogId = new Map<string, string>();
  const countryByAnilistId = new Map<number, string>();
  const aliasToCanonicalId = new Map<string, string>();

  for (const blockedAni of BLOCKED_ANILIST_IDS) {
    blockedCatalogIds.add(String(blockedAni));
    blockedCatalogIds.add(`anilist-${blockedAni}`);
  }

  const list = Array.isArray(locals) ? locals : [];
  const parsedEntries = list.map((item) => ({
    item,
    keys: collectIdentifierKeys(item),
    duplicateOfId:
      typeof item.duplicateOfId === "string" && item.duplicateOfId.trim()
        ? item.duplicateOfId.trim()
        : null,
  }));

  for (const entry of parsedEntries) {
    if (entry.keys.explicitCountry) {
      for (const cid of entry.keys.catalogIds) {
        countryByCatalogId.set(cid, entry.keys.explicitCountry);
      }
      for (const ani of entry.keys.anilistIds) {
        countryByAnilistId.set(ani, entry.keys.explicitCountry);
      }
    }

    const canonical =
      (typeof entry.item.serverCatalogId === "string" &&
        entry.item.serverCatalogId.trim()) ||
      (typeof entry.item.id === "string" ? entry.item.id.trim() : "") ||
      "";
    if (canonical) {
      for (const cid of entry.keys.catalogIds) {
        if (cid !== canonical && !aliasToCanonicalId.has(cid)) {
          aliasToCanonicalId.set(cid, canonical);
        }
      }
    }
  }

  const seedEntryBlocked = (entry: (typeof parsedEntries)[number]) => {
    for (const cid of entry.keys.catalogIds) blockedCatalogIds.add(cid);
    for (const ani of entry.keys.anilistIds) {
      blockedAnilistIds.add(ani);
      blockedCatalogIds.add(String(ani));
      blockedCatalogIds.add(`anilist-${ani}`);
    }
    for (const mal of entry.keys.malIds) {
      blockedMalIds.add(mal);
      blockedCatalogIds.add(`mal-${mal}`);
    }
    for (const kitsu of entry.keys.kitsuIds) {
      blockedKitsuIds.add(kitsu);
      blockedCatalogIds.add(`kitsu-${kitsu}`);
    }
  };

  let changed = true;
  while (changed) {
    changed = false;
    for (const entry of parsedEntries) {
      const alreadyBlocked =
        entry.keys.catalogIds.some((cid) => blockedCatalogIds.has(cid)) ||
        entry.keys.anilistIds.some((ani) => blockedAnilistIds.has(ani)) ||
        entry.keys.malIds.some((mal) => blockedMalIds.has(mal)) ||
        entry.keys.kitsuIds.some((kitsu) => blockedKitsuIds.has(kitsu));

      const shouldBlock =
        alreadyBlocked ||
        isConfirmedDonghuaOrigin(entry.keys.explicitCountry) ||
        (entry.duplicateOfId !== null &&
          (blockedCatalogIds.has(entry.duplicateOfId) ||
            Boolean(
              parseVisibilityIdentifier(entry.duplicateOfId)?.anilistId &&
                blockedAnilistIds.has(
                  parseVisibilityIdentifier(entry.duplicateOfId)!.anilistId!,
                ),
            )));

      if (!shouldBlock) continue;

      const beforeSize =
        blockedCatalogIds.size +
        blockedAnilistIds.size +
        blockedMalIds.size +
        blockedKitsuIds.size;

      seedEntryBlocked(entry);

      if (entry.duplicateOfId) {
        const dupParsed = parseVisibilityIdentifier(entry.duplicateOfId);
        if (dupParsed) {
          blockedCatalogIds.add(dupParsed.raw);
          blockedCatalogIds.add(dupParsed.normalized);
          if (dupParsed.anilistId) {
            blockedAnilistIds.add(dupParsed.anilistId);
            blockedCatalogIds.add(String(dupParsed.anilistId));
            blockedCatalogIds.add(`anilist-${dupParsed.anilistId}`);
          }
          if (dupParsed.malId) {
            blockedMalIds.add(dupParsed.malId);
            blockedCatalogIds.add(`mal-${dupParsed.malId}`);
          }
          if (dupParsed.kitsuId) {
            blockedKitsuIds.add(dupParsed.kitsuId);
            blockedCatalogIds.add(`kitsu-${dupParsed.kitsuId}`);
          }
        }
      }

      const afterSize =
        blockedCatalogIds.size +
        blockedAnilistIds.size +
        blockedMalIds.size +
        blockedKitsuIds.size;
      if (afterSize > beforeSize) {
        changed = true;
      }
    }
  }

  return {
    blockedCatalogIds,
    blockedAnilistIds,
    blockedMalIds,
    blockedKitsuIds,
    countryByCatalogId,
    countryByAnilistId,
    aliasToCanonicalId,
  };
}
