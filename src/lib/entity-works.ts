const ANILIST_ENDPOINT = "https://graphql.anilist.co";

export interface StudioWorkAnime {
  id: string;
  title: string;
  cover?: string | null;
  format?: string | null;
  year?: number | string | null;
}

export interface DubladorWorkItem {
  id: string;
  anime: {
    id: string;
    title: string;
    cover?: string | null;
    year?: number | string | null;
  };
  character: {
    name: string;
    role?: string | null;
  };
}

export interface StaffWorkItem {
  id: string;
  roleLabel: string;
  anime: {
    id: string;
    title: string;
    cover?: string | null;
    year?: number | string | null;
  };
}

export interface EntityWorksData {
  kind: "studio" | "dublador" | "staff" | "person";
  name: string;
  image?: string | null;
  subtitle?: string | null;
  studioAnimes?: StudioWorkAnime[];
  dubladorWorks?: DubladorWorkItem[];
  staffWorks?: StaffWorkItem[];
  error?: string;
}

const cache = new Map<string, { data: EntityWorksData; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 15; // 15 minutos

const STUDIO_QUERY = `
  query StudioWorks($search: String, $id: Int) {
    Studio(search: $search, id: $id) {
      id
      name
      isAnimationStudio
      media(sort: [POPULARITY_DESC, START_DATE_DESC], perPage: 30) {
        nodes {
          id
          title {
            romaji
            english
            userPreferred
          }
          coverImage {
            large
            extraLarge
          }
          format
          startDate {
            year
          }
        }
      }
    }
  }
`;

const PERSON_WORKS_QUERY = `
  query PersonWorks($search: String, $id: Int) {
    Staff(search: $search, id: $id) {
      id
      name {
        full
        native
        userPreferred
      }
      image {
        large
        medium
      }
      primaryOccupations
      characterMedia(sort: [POPULARITY_DESC, START_DATE_DESC], perPage: 30) {
        edges {
          node {
            id
            title {
              romaji
              english
              userPreferred
            }
            coverImage {
              large
              extraLarge
            }
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
          }
          characterRole
        }
      }
      staffMedia(sort: [POPULARITY_DESC, START_DATE_DESC], perPage: 30) {
        edges {
          staffRole
          node {
            id
            title {
              romaji
              english
              userPreferred
            }
            coverImage {
              large
              extraLarge
            }
            startDate {
              year
            }
          }
        }
      }
    }
  }
`;

export async function getStudioWorks(
  studioName: string,
  studioId?: string | number | null,
): Promise<EntityWorksData> {
  const cacheKey = `studio:${studioId || studioName.trim().toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const cleanName = studioName.trim();
  const numericId = studioId ? Number(studioId) : undefined;
  const variables = Number.isFinite(numericId) && numericId! > 0
    ? { id: numericId }
    : { search: cleanName };

  try {
    const res = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: STUDIO_QUERY,
        variables,
      }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const json = await res.json();
    const studio = json?.data?.Studio;
    const mediaNodes: any[] = studio?.media?.nodes ?? [];

    const studioAnimes: StudioWorkAnime[] = mediaNodes.map((m: any) => ({
      id: String(m.id),
      title: m.title?.romaji || m.title?.userPreferred || m.title?.english || "Anime",
      cover: m.coverImage?.large || m.coverImage?.extraLarge || null,
      format: m.format || "TV",
      year: m.startDate?.year ?? null,
    }));

    const result: EntityWorksData = {
      kind: "studio",
      name: studio?.name || cleanName,
      subtitle: studio?.isAnimationStudio ? "Estúdio Principal de Animação" : "Estúdio de Animação",
      studioAnimes,
    };

    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (err) {
    console.warn("[getStudioWorks] Falha ao consultar AniList:", err);
    return {
      kind: "studio",
      name: cleanName,
      subtitle: "Estúdio de animação",
      studioAnimes: [],
    };
  }
}

export async function getPersonWorks(
  personName: string,
  personId?: string | number | null,
  prefer: "dublador" | "staff" = "dublador",
): Promise<EntityWorksData> {
  const cacheKey = `person:${prefer}:${personId || personName.trim().toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const cleanName = personName.trim();
  const numericId = personId ? Number(personId) : undefined;
  const variables = Number.isFinite(numericId) && numericId! > 0
    ? { id: numericId }
    : { search: cleanName };

  try {
    const res = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: PERSON_WORKS_QUERY,
        variables,
      }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const json = await res.json();
    const staff = json?.data?.Staff;
    const resolvedName = staff?.name?.full || staff?.name?.userPreferred || cleanName;
    const personImage = staff?.image?.large || staff?.image?.medium || null;

    const dubladorWorks: DubladorWorkItem[] = [];
    const charEdges: any[] = staff?.characterMedia?.edges ?? [];
    for (let i = 0; i < charEdges.length; i++) {
      const edge = charEdges[i];
      const node = edge?.node;
      if (!node) continue;
      const char = edge?.characters?.[0];
      dubladorWorks.push({
        id: `${node.id}-${char?.id || i}`,
        anime: {
          id: String(node.id),
          title: node.title?.romaji || node.title?.userPreferred || node.title?.english || "Anime",
          cover: node.coverImage?.large || node.coverImage?.extraLarge || null,
          year: node.startDate?.year ?? null,
        },
        character: {
          name: char?.name?.full || char?.name?.userPreferred || "Personagem",
          role: edge?.characterRole || "Secundário",
        },
      });
    }

    const staffWorks: StaffWorkItem[] = [];
    const staffEdges: any[] = staff?.staffMedia?.edges ?? [];
    for (let i = 0; i < staffEdges.length; i++) {
      const edge = staffEdges[i];
      const node = edge?.node;
      if (!node) continue;
      staffWorks.push({
        id: `${node.id}-${i}`,
        roleLabel: edge.staffRole || "Equipe técnica",
        anime: {
          id: String(node.id),
          title: node.title?.romaji || node.title?.userPreferred || node.title?.english || "Anime",
          cover: node.coverImage?.large || node.coverImage?.extraLarge || null,
          year: node.startDate?.year ?? null,
        },
      });
    }

    const result: EntityWorksData = {
      kind: prefer === "dublador" ? "dublador" : "staff",
      name: resolvedName,
      image: personImage,
      subtitle: prefer === "dublador" ? "Dublador(a) / Ator de voz" : "Direção e equipe técnica",
      dubladorWorks,
      staffWorks,
    };

    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (err) {
    console.warn("[getPersonWorks] Falha ao consultar AniList:", err);
    return {
      kind: prefer === "dublador" ? "dublador" : "staff",
      name: cleanName,
      subtitle: prefer === "dublador" ? "Dublador(a)" : "Equipe técnica",
      dubladorWorks: [],
      staffWorks: [],
    };
  }
}
