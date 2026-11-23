import type { EpisodeSourceItem } from "@/lib/anitube22";
import type { Episode, Season } from "@/lib/types";

export const EMPTY_EPISODE_SLOTS_SIGNATURE = JSON.stringify(["", "", "", "", ""]);

export function getEpisodeSlotsSignature(
  ep: Pick<
    Episode,
    "videoUrl" | "videoUrl2" | "videoUrl3" | "videoUrl4" | "videoUrl5"
  > | {
    videoUrl?: string | null;
    videoUrl2?: string | null;
    videoUrl3?: string | null;
    videoUrl4?: string | null;
    videoUrl5?: string | null;
  },
): string {
  return JSON.stringify([
    (ep.videoUrl ?? "").trim(),
    (ep.videoUrl2 ?? "").trim(),
    (ep.videoUrl3 ?? "").trim(),
    (ep.videoUrl4 ?? "").trim(),
    (ep.videoUrl5 ?? "").trim(),
  ]);
}

export interface EpisodeSourcesCacheEntry {
  episodeId: string;
  sources: EpisodeSourceItem[];
  revision: number;
  loadedAt: number;
  slotsSignature: string;
}

export interface LoadEpisodeSourcesResult {
  sources: EpisodeSourceItem[];
  fromCache: boolean;
  deduplicated: boolean;
}

function sortSources(items: EpisodeSourceItem[]): EpisodeSourceItem[] {
  return [...items].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
}

export class EpisodeSourcesSessionStore {
  private cache = new Map<string, EpisodeSourcesCacheEntry>();
  private revisions = new Map<string, number>();
  private inFlight = new Map<
    string,
    { revision: number; promise: Promise<EpisodeSourceItem[]> }
  >();
  private baselineSlots = new Map<string, string>();

  getRevision(episodeId: string): number {
    return this.revisions.get(episodeId) ?? 0;
  }

  getCached(episodeId: string): EpisodeSourcesCacheEntry | undefined {
    return this.cache.get(episodeId);
  }

  isValid(episodeId: string): boolean {
    const entry = this.cache.get(episodeId);
    if (!entry) return false;
    return entry.revision === this.getRevision(episodeId);
  }

  isInFlight(episodeId: string): boolean {
    return this.inFlight.has(episodeId);
  }

  getBaselineSlots(episodeId: string): string | undefined {
    return this.baselineSlots.get(episodeId);
  }

  setBaselineSlotsFromEpisodes(
    episodes: Array<{
      id: string;
      videoUrl?: string | null;
      videoUrl2?: string | null;
      videoUrl3?: string | null;
      videoUrl4?: string | null;
      videoUrl5?: string | null;
    }>,
  ): void {
    for (const ep of episodes) {
      if (!ep.id) continue;
      this.baselineSlots.set(ep.id, getEpisodeSlotsSignature(ep));
    }
  }

  setBaselineSlotsFromSeasons(seasons: Season[]): void {
    for (const season of seasons) {
      this.setBaselineSlotsFromEpisodes(season.episodes);
    }
  }

  updateEpisodeBaseline(episodeId: string, slotsSignature: string): void {
    if (!episodeId) return;
    this.baselineSlots.set(episodeId, slotsSignature);
  }

  hasUnsavedSlotChanges(episode: Episode): boolean {
    const currentSignature = getEpisodeSlotsSignature(episode);
    const baseline = this.baselineSlots.get(episode.id);
    if (baseline !== undefined) {
      return currentSignature !== baseline;
    }
    // Episódio recém-criado localmente ainda não confirmado no servidor:
    // só indica alteração pendente se algum slot estiver preenchido.
    return currentSignature !== EMPTY_EPISODE_SLOTS_SIGNATURE;
  }

  invalidateEpisode(episodeId: string): void {
    if (!episodeId) return;
    this.revisions.set(episodeId, this.getRevision(episodeId) + 1);
    this.cache.delete(episodeId);
  }

  invalidateEpisodes(episodeIds: Iterable<string>): void {
    for (const id of episodeIds) {
      this.invalidateEpisode(id);
    }
  }

  invalidateAll(): void {
    const keys = new Set<string>([
      ...this.cache.keys(),
      ...this.revisions.keys(),
      ...this.inFlight.keys(),
    ]);
    for (const key of keys) {
      this.revisions.set(key, this.getRevision(key) + 1);
    }
    this.cache.clear();
  }

  removeEpisode(episodeId: string): void {
    if (!episodeId) return;
    this.revisions.set(episodeId, this.getRevision(episodeId) + 1);
    this.cache.delete(episodeId);
    this.baselineSlots.delete(episodeId);
  }

  reset(): void {
    this.cache.clear();
    this.revisions.clear();
    this.inFlight.clear();
    this.baselineSlots.clear();
  }

  async loadEpisodeSources(
    episodeId: string,
    fetcher: (episodeId: string) => Promise<EpisodeSourceItem[]>,
    options?: {
      force?: boolean;
      slotsSignature?: string;
    },
  ): Promise<LoadEpisodeSourcesResult> {
    const cleanId = episodeId.trim();
    if (!cleanId) {
      return { sources: [], fromCache: true, deduplicated: false };
    }

    const force = Boolean(options?.force);

    if (!force && this.isValid(cleanId)) {
      const entry = this.cache.get(cleanId)!;
      return {
        sources: entry.sources,
        fromCache: true,
        deduplicated: false,
      };
    }

    const activeInFlight = this.inFlight.get(cleanId);
    const currentRevision = this.getRevision(cleanId);
    if (activeInFlight && activeInFlight.revision === currentRevision) {
      const sources = await activeInFlight.promise;
      return {
        sources,
        fromCache: false,
        deduplicated: true,
      };
    }

    const requestRevision = force ? currentRevision + 1 : currentRevision;
    if (force) {
      this.revisions.set(cleanId, requestRevision);
    }

    const slotsSig =
      options?.slotsSignature ??
      this.baselineSlots.get(cleanId) ??
      EMPTY_EPISODE_SLOTS_SIGNATURE;

    const promise = (async () => {
      const fetched = await fetcher(cleanId);
      // Somente grava no cache se nenhuma invalidação/mutação mais nova ocorreu durante o voo
      if (this.getRevision(cleanId) === requestRevision) {
        this.cache.set(cleanId, {
          episodeId: cleanId,
          sources: fetched,
          revision: requestRevision,
          loadedAt: Date.now(),
          slotsSignature: slotsSig,
        });
      }
      return fetched;
    })();

    const record = { revision: requestRevision, promise };
    this.inFlight.set(cleanId, record);

    try {
      const sources = await promise;
      return {
        sources,
        fromCache: false,
        deduplicated: false,
      };
    } finally {
      if (this.inFlight.get(cleanId) === record) {
        this.inFlight.delete(cleanId);
      }
    }
  }

  applyUpsertedSource(
    episodeId: string,
    source: EpisodeSourceItem,
    slotsSignature?: string,
  ): EpisodeSourceItem[] {
    const nextRevision = this.getRevision(episodeId) + 1;
    this.revisions.set(episodeId, nextRevision);

    const prevSources = this.cache.get(episodeId)?.sources ?? [];
    const filtered = prevSources.filter((item) => item.id !== source.id);
    const nextSources = sortSources([...filtered, source]);

    this.cache.set(episodeId, {
      episodeId,
      sources: nextSources,
      revision: nextRevision,
      loadedAt: Date.now(),
      slotsSignature:
        slotsSignature ??
        this.cache.get(episodeId)?.slotsSignature ??
        this.baselineSlots.get(episodeId) ??
        EMPTY_EPISODE_SLOTS_SIGNATURE,
    });

    return nextSources;
  }

  applyDeletedSource(episodeId: string, sourceId: string): EpisodeSourceItem[] {
    const nextRevision = this.getRevision(episodeId) + 1;
    this.revisions.set(episodeId, nextRevision);

    const prevEntry = this.cache.get(episodeId);
    const nextSources = (prevEntry?.sources ?? []).filter(
      (item) => item.id !== sourceId,
    );

    if (prevEntry) {
      this.cache.set(episodeId, {
        ...prevEntry,
        sources: nextSources,
        revision: nextRevision,
        loadedAt: Date.now(),
      });
    }

    return nextSources;
  }
}

export function createEpisodeSourcesSessionStore(): EpisodeSourcesSessionStore {
  return new EpisodeSourcesSessionStore();
}
