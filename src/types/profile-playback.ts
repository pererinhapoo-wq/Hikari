import { z } from "zod";
import { animeSnapshotSchema, type AnimeSnapshot } from "./profile-tracking";

export { animeSnapshotSchema };
export type { AnimeSnapshot };

export const startEpisodeSessionSchema = z.object({
  animeId: z.string().min(1, "animeId é obrigatório"),
  episodeId: z.string().min(1, "episodeId é obrigatório"),
  episodeNumber: z.number().int().min(0, "episodeNumber deve ser maior ou igual a 0"),
  duration: z.number().positive().optional().nullable(),
  animeSnapshot: animeSnapshotSchema.optional().nullable(),
});

export type StartEpisodeSessionInput = z.infer<typeof startEpisodeSessionSchema>;

export interface StartEpisodeSessionResponse {
  playbackSessionId: string;
  currentTime: number;
  duration: number | null;
  accumulatedTime: number;
  autoCompleteSuppressed: boolean;
}

export const heartbeatEpisodeProgressSchema = z.object({
  animeId: z.string().min(1, "animeId é obrigatório"),
  episodeId: z.string().min(1, "episodeId é obrigatório"),
  playbackSessionId: z.string().min(1, "playbackSessionId é obrigatório"),
  currentTime: z.number().min(0, "currentTime deve ser >= 0"),
  duration: z.number().positive().optional().nullable(),
  deltaMs: z.number().min(0).max(60000).optional().nullable(),
  isPlaying: z.boolean().optional().default(true),
  isBuffering: z.boolean().optional().default(false),
  isSeeking: z.boolean().optional().default(false),
  ended: z.boolean().optional().default(false),
  animeSnapshot: animeSnapshotSchema.optional().nullable(),
});

export type HeartbeatEpisodeProgressInput = z.infer<typeof heartbeatEpisodeProgressSchema>;

export interface HeartbeatEpisodeProgressResponse {
  success: boolean;
  currentTime: number;
  duration: number | null;
  accumulatedTime: number;
  completed: boolean;
  episodesWatched?: number;
}

export const getEpisodeProgressSchema = z.object({
  animeId: z.string().min(1, "animeId é obrigatório"),
  episodeId: z.string().min(1, "episodeId é obrigatório"),
});

export type GetEpisodeProgressInput = z.infer<typeof getEpisodeProgressSchema>;

export interface EpisodeProgressRecord {
  userId: string;
  animeId: string;
  episodeId: string;
  episodeNumber: number;
  currentTime: number;
  duration: number | null;
  accumulatedTime: number;
  accumulatedRemainderMs: number;
  autoCompleteSuppressed: boolean;
  playbackSessionId: string | null;
  isWatched: boolean;
  updatedAt: string;
}

export const clearEpisodeProgressSchema = z.object({
  animeId: z.string().min(1, "animeId é obrigatório"),
  episodeId: z.string().min(1, "episodeId é obrigatório"),
});

export type ClearEpisodeProgressInput = z.infer<typeof clearEpisodeProgressSchema>;

export interface ClearEpisodeProgressResponse {
  success: boolean;
  cleared: boolean;
  episodeId: string;
}
