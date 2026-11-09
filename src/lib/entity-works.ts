import { staffRoleLabel } from "@/lib/labels";

export interface StudioWorkAnime {
  id: string;
  idMal?: number | null;
  title: string;
  cover: string | null;
  banner?: string | null;
  year?: number | null;
  format?: string | null;
  episodesCount?: number | null;
  score?: number | null;
}

export interface DubladorWorkItem {
  id: string;
  anime: {
    id: string;
    idMal?: number | null;
    title: string;
    cover: string | null;
    year?: number | null;
    format?: string | null;
    episodesCount?: number | null;
    score?: number | null;
  };
  character: {
    id: number;
    name: string;
    image: string | null;
    role?: string | null; // e.g. "MAIN" | "SUPPORTING"
  };
}

export interface StaffWorkItem {
  id: string;
  role: string;
  roleLabel: string;
  anime: {
    id: string;
    idMal?: number | null;
    title: string;
    cover: string | null;
    year?: number | null;
    format?: string | null;
    episodesCount?: number | null;
    score?: number | null;
  };
}

export interface EntityWorksData {
  kind: "studio" | "dublador" | "staff";
  targetId?: string | number | null;
  name: string;
  image?: string | null;
  subtitle?: string | null;
  occupations?: string[];
  studioAnimes?: StudioWorkAnime[];
  dubladorWorks?: DubladorWorkItem[];
  staffWorks?: StaffWorkItem[];
  error?: string | null;
}

// Cache em memória compartilhado na sessão para garantir carregamento instantâneo e zero requisições duplicadas
const clientEntityWorksCache = new Map<string, EntityWorksData>();
const inFlightRequests = new Map<string, Promise<EntityWorksData>>();

/**
 * Função utilitária que seleciona o melhor título legível no alfabeto latino/português,
 * sem caracteres japoneses alternativos.
 */
function pickCleanAnimeTitle(titleObj?: {
  romaji?: string | null;
  english?: string | null;
  userPreferred?: string | null;
} | null): string {
  if (!titleObj) return "Anime";
  return (
    titleObj.english?.trim() ||
    titleObj.romaji?.trim() ||
    titleObj.userPreferred?.trim() ||
    "Anime"
  );
}

/**
 * Envia query GraphQL para o endpoint /api-anilist do Hikari,
 * aproveitando cache e controle de taxa existentes.
 */
async function queryAniListProxy<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T | null> {
  try {
    const url =
      typeof window !== "undefined"
        ? "/api-anilist"
        : "http://127.0.0.1:3000/api-anilist";

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      console.warn(`[entity-works] Resposta não-ok do proxy: ${res.status}`);
      return null;
    }

    const json = await res.json();
    if (json.errors && (!json.data || Object.keys(json.data).length === 0)) {
      console.warn("[entity-works] Erros na consulta AniList:", json.errors);
      return null;
    }

    return (json.data as T) ?? null;
  } catch (err) {
    console.error("[entity-works] Falha de rede ao consultar AniList:", err);
    return null;
  }
}

/**
 * Obtém animes e produções associadas a um Studio.
 */
export async function getStudioWorks(
  studioName: string,
  studioId?: string | number | null,
): Promise<EntityWorksData> {
  const normName = studioName.trim();
  const cacheKey = `studio:${studioId || ""}:${normName.toLowerCase()}`;

  if (clientEntityWorksCache.has(cacheKey)) {
    return clientEntityWorksCache.get(cacheKey)!;
  }

  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey)!;
  }

  const promise = (async (): Promise<EntityWorksData> => {
    const numId =
      studioId && !Number.isNaN(Number(studioId)) && Number(studioId) > 0
        ? Number(studioId)
        : null;

    const query = `
      query ($name: String, $id: Int) {
        Studio(search: $name, id: $id) {
          id
          name
          isAnimationStudio
          media(sort: POPULARITY_DESC, page: 1, perPage: 30) {
            nodes {
              id
              idMal
              title {
                romaji
                english
                userPreferred
              }
              coverImage {
                extraLarge
                large
                color
              }
              bannerImage
              format
              episodes
              averageScore
              startDate {
                year
              }
            }
          }
        }
      }
    `;

    interface StudioQueryResult {
      Studio?: {
        id: number;
        name: string;
        isAnimationStudio: boolean;
        media?: {
          nodes?: Array<{
            id: number;
            idMal?: number | null;
            title?: {
              romaji?: string | null;
              english?: string | null;
              userPreferred?: string | null;
            } | null;
            coverImage?: {
              extraLarge?: string | null;
              large?: string | null;
            } | null;
            bannerImage?: string | null;
            format?: string | null;
            episodes?: number | null;
            averageScore?: number | null;
            startDate?: { year?: number | null } | null;
          }>;
        };
      };
    }

    let data: StudioQueryResult | null = null;
    if (numId) {
      data = await queryAniListProxy<StudioQueryResult>(query, {
        id: numId,
      });
    }

    // Se não encontrou por ID, buscar por nome
    if (!data?.Studio && normName) {
      data = await queryAniListProxy<StudioQueryResult>(query, {
        name: normName,
      });
    }

    const studio = data?.Studio;
    const rawNodes = studio?.media?.nodes ?? [];

    const seenAnimeIds = new Set<string>();
    const animes: StudioWorkAnime[] = [];
    for (const node of rawNodes) {
      if (!node?.id) continue;
      const strId = String(node.id);
      if (seenAnimeIds.has(strId)) continue;
      seenAnimeIds.add(strId);

      animes.push({
        id: strId,
        idMal: node.idMal ?? null,
        title: pickCleanAnimeTitle(node.title),
        cover: node.coverImage?.extraLarge || node.coverImage?.large || null,
        banner: node.bannerImage || null,
        year: node.startDate?.year || null,
        format: node.format || null,
        episodesCount: node.episodes || null,
        score: node.averageScore ? node.averageScore / 10 : null,
      });
    }

    const result: EntityWorksData = {
      kind: "studio",
      targetId: studio?.id ?? studioId,
      name: studio?.name || normName,
      subtitle: studio?.isAnimationStudio
        ? "Estúdio de animação"
        : "Empresa / Produtora",
      studioAnimes: animes,
    };

    clientEntityWorksCache.set(cacheKey, result);
    return result;
  })();

  inFlightRequests.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inFlightRequests.delete(cacheKey);
  }
}

/**
 * Obtém os trabalhos de um Dublador ou Profissional da equipe técnica (Staff / People).
 */
export async function getPersonWorks(
  personName: string,
  personId?: string | number | null,
  preferCategory: "dublador" | "staff" = "dublador",
): Promise<EntityWorksData> {
  const cleanName = personName.trim();
  const cacheKey = `person:${preferCategory}:${personId || ""}:${cleanName.toLowerCase()}`;

  if (clientEntityWorksCache.has(cacheKey)) {
    return clientEntityWorksCache.get(cacheKey)!;
  }

  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey)!;
  }

  const promise = (async (): Promise<EntityWorksData> => {
    const numId =
      personId && !Number.isNaN(Number(personId)) && Number(personId) > 0
        ? Number(personId)
        : null;

    const query = `
      query ($id: Int, $search: String) {
        Staff(id: $id, search: $search) {
          id
          name {
            full
            userPreferred
          }
          image {
            large
            medium
          }
          primaryOccupations
          characterMedia(page: 1, perPage: 35, sort: POPULARITY_DESC) {
            edges {
              characterRole
              node {
                id
                idMal
                title {
                  romaji
                  english
                  userPreferred
                }
                coverImage {
                  extraLarge
                  large
                }
                format
                episodes
                averageScore
                startDate {
                  year
                }
              }
              characters {
                id
                name {
                  full
                  userPreferred
                }
                image {
                  large
                  medium
                }
              }
            }
          }
          staffMedia(page: 1, perPage: 35, sort: POPULARITY_DESC) {
            edges {
              staffRole
              node {
                id
                idMal
                title {
                  romaji
                  english
                  userPreferred
                }
                coverImage {
                  extraLarge
                  large
                }
                format
                episodes
                averageScore
                startDate {
                  year
                }
              }
            }
          }
        }
      }
    `;

    interface StaffQueryResult {
      Staff?: {
        id: number;
        name?: {
          full?: string | null;
          userPreferred?: string | null;
        } | null;
        image?: {
          large?: string | null;
          medium?: string | null;
        } | null;
        primaryOccupations?: string[] | null;
        characterMedia?: {
          edges?: Array<{
            characterRole?: string | null;
            node?: {
              id: number;
              idMal?: number | null;
              title?: {
                romaji?: string | null;
                english?: string | null;
                userPreferred?: string | null;
              } | null;
              coverImage?: {
                extraLarge?: string | null;
                large?: string | null;
              } | null;
              format?: string | null;
              episodes?: number | null;
              averageScore?: number | null;
              startDate?: { year?: number | null } | null;
            } | null;
            characters?: Array<{
              id: number;
              name?: {
                full?: string | null;
                userPreferred?: string | null;
              } | null;
              image?: {
                large?: string | null;
                medium?: string | null;
              } | null;
            }> | null;
          }>;
        };
        staffMedia?: {
          edges?: Array<{
            staffRole?: string | null;
            node?: {
              id: number;
              idMal?: number | null;
              title?: {
                romaji?: string | null;
                english?: string | null;
                userPreferred?: string | null;
              } | null;
              coverImage?: {
                extraLarge?: string | null;
                large?: string | null;
              } | null;
              format?: string | null;
              episodes?: number | null;
              averageScore?: number | null;
              startDate?: { year?: number | null } | null;
            } | null;
          }>;
        };
      };
    }

    // Tentar por ID numérico primeiro se houver
    let data: StaffQueryResult | null = null;
    if (numId) {
      data = await queryAniListProxy<StaffQueryResult>(query, {
        id: numId,
      });
    }

    // Fallback por busca de nome se não encontrou por ID
    if (!data?.Staff && cleanName) {
      data = await queryAniListProxy<StaffQueryResult>(query, {
        search: cleanName,
      });
    }

    const staff = data?.Staff;
    const displayName =
      staff?.name?.full?.trim() ||
      staff?.name?.userPreferred?.trim() ||
      cleanName;

    const displayImage = staff?.image?.large || staff?.image?.medium || null;
    const occupations = staff?.primaryOccupations || [];

    // Mapeamento de Dublador (Voice Acting Roles)
    const dubladorWorks: DubladorWorkItem[] = [];
    const seenDubKeys = new Set<string>();

    for (const edge of staff?.characterMedia?.edges ?? []) {
      const node = edge?.node;
      if (!node) continue;

      const charList = edge?.characters ?? [];
      const char = charList[0];
      const charName =
        char?.name?.full?.trim() ||
        char?.name?.userPreferred?.trim() ||
        "Personagem";

      const key = `${node.id}-${char?.id || charName}`;
      if (seenDubKeys.has(key)) continue;
      seenDubKeys.add(key);

      dubladorWorks.push({
        id: key,
        anime: {
          id: String(node.id),
          idMal: node.idMal ?? null,
          title: pickCleanAnimeTitle(node.title),
          cover: node.coverImage?.extraLarge || node.coverImage?.large || null,
          year: node.startDate?.year || null,
          format: node.format || null,
          episodesCount: node.episodes || null,
          score: node.averageScore ? node.averageScore / 10 : null,
        },
        character: {
          id: char?.id ?? 0,
          name: charName,
          image: char?.image?.large || char?.image?.medium || null,
          role: edge.characterRole ?? null,
        },
      });
    }

    // Mapeamento de Equipe Técnica (Staff Roles)
    const staffWorks: StaffWorkItem[] = [];
    const seenStaffKeys = new Set<string>();

    for (const edge of staff?.staffMedia?.edges ?? []) {
      const node = edge?.node;
      if (!node) continue;

      const role = edge.staffRole?.trim() || "Equipe técnica";
      const key = `${node.id}-${role.toLowerCase()}`;
      if (seenStaffKeys.has(key)) continue;
      seenStaffKeys.add(key);

      staffWorks.push({
        id: key,
        role,
        roleLabel: staffRoleLabel(role),
        anime: {
          id: String(node.id),
          idMal: node.idMal ?? null,
          title: pickCleanAnimeTitle(node.title),
          cover: node.coverImage?.extraLarge || node.coverImage?.large || null,
          year: node.startDate?.year || null,
          format: node.format || null,
          episodesCount: node.episodes || null,
          score: node.averageScore ? node.averageScore / 10 : null,
        },
      });
    }

    const result: EntityWorksData = {
      kind: preferCategory,
      targetId: staff?.id ?? personId,
      name: displayName,
      image: displayImage,
      occupations: occupations.filter(Boolean),
      dubladorWorks,
      staffWorks,
    };

    clientEntityWorksCache.set(cacheKey, result);
    return result;
  })();

  inFlightRequests.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inFlightRequests.delete(cacheKey);
  }
}
