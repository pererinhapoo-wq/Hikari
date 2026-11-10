import { useHikariStore } from "@/lib/store";
import { overlayList } from "@/lib/overlay";
import { type LocalAnime } from "@/lib/types";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

export interface SearchCharacterItem {
  id: number;
  name: {
    full: string;
    native?: string | null;
    userPreferred?: string | null;
  };
  image?: {
    large?: string | null;
    medium?: string | null;
  } | null;
  role?: string | null;
  anime?: {
    id: number | string;
    title: string;
  } | null;
}

export interface SearchPersonItem {
  id: number;
  name: {
    full: string;
    native?: string | null;
    userPreferred?: string | null;
  };
  image?: {
    large?: string | null;
    medium?: string | null;
  } | null;
  primaryOccupations?: string[];
  role?: string | null;
  anime?: {
    id: number | string;
    title: string;
  } | null;
}

export interface SearchEntitiesResult<T> {
  items: T[];
  page: number;
  hasNext: boolean;
}

/* =========================================================================
   BUSCA DE PERSONAGENS
   - Consulta AniList GraphQL com suporte a paginação e relevância
   - Mescla com personagens do catálogo local/armazenado
   - Deduplicação estrita por ID
========================================================================= */

const CHARACTERS_QUERY = `
  query SearchCharacters($search: String, $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        hasNextPage
      }
      characters(search: $search, sort: [FAVOURITES_DESC, SEARCH_MATCH]) {
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
        media(sort: POPULARITY_DESC, perPage: 1) {
          nodes {
            id
            title {
              romaji
              english
              userPreferred
            }
          }
        }
      }
    }
  }
`;

export async function searchCharacters(
  query: string,
  page = 1,
  perPage = 18,
): Promise<SearchEntitiesResult<SearchCharacterItem>> {
  const clean = query.trim();
  if (!clean) {
    return { items: [], page, hasNext: false };
  }

  try {
    const res = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "Hikari/1.0 (anime streaming platform; +https://hikari.app)",
      },
      body: JSON.stringify({
        query: CHARACTERS_QUERY,
        variables: {
          search: clean,
          page,
          perPage,
        },
      }),
      signal: AbortSignal.timeout(7000),
    });

    if (!res.ok) {
      return searchCharactersLocalFallback(clean, page, perPage);
    }

    const json = (await res.json()) as {
      data?: {
        Page?: {
          pageInfo?: { hasNextPage?: boolean };
          characters?: Array<{
            id: number;
            name?: { full?: string; native?: string; userPreferred?: string };
            image?: { large?: string; medium?: string };
            media?: {
              nodes?: Array<{
                id: number;
                title?: { romaji?: string; english?: string; userPreferred?: string };
              }>;
            };
          }>;
        };
      };
    };

    const rawList = json.data?.Page?.characters ?? [];
    const hasNext = Boolean(json.data?.Page?.pageInfo?.hasNextPage);

    const items: SearchCharacterItem[] = rawList.map((c) => {
      const bestMedia = c.media?.nodes?.[0];
      const mediaTitle =
        bestMedia?.title?.userPreferred ||
        bestMedia?.title?.romaji ||
        bestMedia?.title?.english ||
        "Anime";

      return {
        id: c.id,
        name: {
          full: c.name?.full || c.name?.userPreferred || "Personagem",
          native: c.name?.native,
          userPreferred: c.name?.userPreferred,
        },
        image: {
          large: c.image?.large,
          medium: c.image?.medium,
        },
        role: "Personagem",
        anime: bestMedia?.id
          ? {
              id: bestMedia.id,
              title: mediaTitle,
            }
          : null,
      };
    });

    // Se estiver na primeira página, mescla personagens locais correspondentes
    if (page === 1) {
      const localChars = getLocalCharacters(clean);
      const seen = new Set<string>();
      const merged: SearchCharacterItem[] = [];

      for (const item of [...localChars, ...items]) {
        const key = String(item.id);
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(item);
        }
      }

      return { items: merged, page, hasNext };
    }

    return { items, page, hasNext };
  } catch {
    return searchCharactersLocalFallback(clean, page, perPage);
  }
}

function getLocalCharacters(query: string): SearchCharacterItem[] {
  try {
    const localAnimes: LocalAnime[] = useHikariStore.getState().animes ?? [];
    const normalized = query
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    const results: SearchCharacterItem[] = [];

    for (const anime of overlayList([], localAnimes)) {
      if (!anime.characters || !Array.isArray(anime.characters)) continue;
      for (const char of anime.characters) {
        const nameFull = (char.name?.full || "").toLowerCase();
        const nameNative = (char.name?.native || "").toLowerCase();
        if (nameFull.includes(normalized) || nameNative.includes(normalized)) {
          results.push({
            id: char.id,
            name: {
              full: char.name.full,
              native: char.name.native,
              userPreferred: char.name.full,
            },
            image: char.image ? { large: char.image, medium: char.image } : null,
            role: char.role || "Personagem",
            anime: {
              id: anime.id,
              title: anime.titles.romaji || anime.titles.english || "Anime",
            },
          });
        }
      }
    }

    return results;
  } catch {
    return [];
  }
}

function searchCharactersLocalFallback(
  query: string,
  page: number,
  perPage: number,
): SearchEntitiesResult<SearchCharacterItem> {
  const local = getLocalCharacters(query);
  const start = (page - 1) * perPage;
  const sliced = local.slice(start, start + perPage);
  return {
    items: sliced,
    page,
    hasNext: start + perPage < local.length,
  };
}

/* =========================================================================
   BUSCA DE PROFISSIONAIS (PEOPLE / STAFF)
   - Dubladores, Diretores, Roteiristas, Produtores e Equipe Técnica
   - Consulta AniList GraphQL Staff com ocupações e anime mais popular
========================================================================= */

const STAFF_QUERY = `
  query SearchStaff($search: String, $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        hasNextPage
      }
      staff(search: $search, sort: [FAVOURITES_DESC, SEARCH_MATCH]) {
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
        staffMedia(sort: POPULARITY_DESC, perPage: 1) {
          edges {
            staffRole
            node {
              id
              title {
                romaji
                english
                userPreferred
              }
            }
          }
        }
        characterMedia(sort: POPULARITY_DESC, perPage: 1) {
          edges {
            node {
              id
              title {
                romaji
                english
                userPreferred
              }
            }
          }
        }
      }
    }
  }
`;

export async function searchPeople(
  query: string,
  page = 1,
  perPage = 18,
): Promise<SearchEntitiesResult<SearchPersonItem>> {
  const clean = query.trim();
  if (!clean) {
    return { items: [], page, hasNext: false };
  }

  try {
    const res = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "Hikari/1.0 (anime streaming platform; +https://hikari.app)",
      },
      body: JSON.stringify({
        query: STAFF_QUERY,
        variables: {
          search: clean,
          page,
          perPage,
        },
      }),
      signal: AbortSignal.timeout(7000),
    });

    if (!res.ok) {
      return searchPeopleLocalFallback(clean, page, perPage);
    }

    const json = (await res.json()) as {
      data?: {
        Page?: {
          pageInfo?: { hasNextPage?: boolean };
          staff?: Array<{
            id: number;
            name?: { full?: string; native?: string; userPreferred?: string };
            image?: { large?: string; medium?: string };
            primaryOccupations?: string[];
            staffMedia?: {
              edges?: Array<{
                staffRole?: string;
                node?: {
                  id: number;
                  title?: { romaji?: string; english?: string; userPreferred?: string };
                };
              }>;
            };
            characterMedia?: {
              edges?: Array<{
                node?: {
                  id: number;
                  title?: { romaji?: string; english?: string; userPreferred?: string };
                };
              }>;
            };
          }>;
        };
      };
    };

    const rawList = json.data?.Page?.staff ?? [];
    const hasNext = Boolean(json.data?.Page?.pageInfo?.hasNextPage);

    const items: SearchPersonItem[] = rawList.map((s) => {
      const topStaffEdge = s.staffMedia?.edges?.[0];
      const topCharEdge = s.characterMedia?.edges?.[0];
      const bestMedia = topStaffEdge?.node || topCharEdge?.node;
      const mediaTitle =
        bestMedia?.title?.userPreferred ||
        bestMedia?.title?.romaji ||
        bestMedia?.title?.english ||
        "Anime";

      const role = topStaffEdge?.staffRole || (s.primaryOccupations?.[0] ? s.primaryOccupations[0] : "Equipe técnica");

      return {
        id: s.id,
        name: {
          full: s.name?.full || s.name?.userPreferred || "Profissional",
          native: s.name?.native,
          userPreferred: s.name?.userPreferred,
        },
        image: {
          large: s.image?.large,
          medium: s.image?.medium,
        },
        primaryOccupations: s.primaryOccupations || [],
        role,
        anime: bestMedia?.id
          ? {
              id: bestMedia.id,
              title: mediaTitle,
            }
          : null,
      };
    });

    // Se estiver na primeira página, mescla profissionais locais correspondentes
    if (page === 1) {
      const localStaff = getLocalPeople(clean);
      const seen = new Set<string>();
      const merged: SearchPersonItem[] = [];

      for (const item of [...localStaff, ...items]) {
        const key = String(item.id);
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(item);
        }
      }

      return { items: merged, page, hasNext };
    }

    return { items, page, hasNext };
  } catch {
    return searchPeopleLocalFallback(clean, page, perPage);
  }
}

function getLocalPeople(query: string): SearchPersonItem[] {
  try {
    const localAnimes: LocalAnime[] = useHikariStore.getState().animes ?? [];
    const normalized = query
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    const results: SearchPersonItem[] = [];

    for (const anime of overlayList([], localAnimes)) {
      if (!anime.staff || !Array.isArray(anime.staff)) continue;
      for (const st of anime.staff) {
        const nameLower = (st.name || "").toLowerCase();
        if (nameLower.includes(normalized)) {
          results.push({
            id: st.id,
            name: {
              full: st.name,
              userPreferred: st.name,
            },
            image: st.image ? { large: st.image, medium: st.image } : null,
            role: st.role || "Equipe técnica",
            primaryOccupations: [st.role || "Staff"],
            anime: {
              id: anime.id,
              title: anime.titles.romaji || anime.titles.english || "Anime",
            },
          });
        }
      }
    }

    return results;
  } catch {
    return [];
  }
}

function searchPeopleLocalFallback(
  query: string,
  page: number,
  perPage: number,
): SearchEntitiesResult<SearchPersonItem> {
  const local = getLocalPeople(query);
  const start = (page - 1) * perPage;
  const sliced = local.slice(start, start + perPage);
  return {
    items: sliced,
    page,
    hasNext: start + perPage < local.length,
  };
}
