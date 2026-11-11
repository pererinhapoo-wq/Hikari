import { z } from "zod";

/**
 * Status válidos para o acompanhamento de animes na Migration 0021.
 */
export const TRACKING_STATUSES = [
  "watching",
  "completed",
  "planning",
  "on_hold",
  "dropped",
] as const;

export type TrackingStatus = (typeof TRACKING_STATUSES)[number];

export const trackingStatusSchema = z.enum(TRACKING_STATUSES);

/**
 * Origens válidas para o histórico de episódios assistidos.
 */
export const WATCHED_ORIGINS = ["playback", "manual"] as const;

export type WatchedOrigin = (typeof WATCHED_ORIGINS)[number];

export const watchedOriginSchema = z.enum(WATCHED_ORIGINS);

/**
 * Snapshot leve com apenas os campos essenciais para exibição dos animes.
 * Compatível tanto com catálogo canônico quanto com animes locais ("local-*").
 */
export const animeSnapshotSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    titleRomaji: z.string().trim().optional().nullable(),
    titleEnglish: z.string().trim().optional().nullable(),
    titleNative: z.string().trim().optional().nullable(),
    cover: z.string().trim().optional().nullable(),
    banner: z.string().trim().optional().nullable(),
    format: z.string().trim().optional().nullable(),
    year: z.number().int().optional().nullable(),
    episodesCount: z.number().int().optional().nullable(),
    status: z.string().trim().optional().nullable(),
    score: z.number().optional().nullable(),
  })
  .catchall(z.union([z.string(), z.number(), z.boolean(), z.null()]))
  .optional()
  .nullable();

export type AnimeSnapshot = NonNullable<z.infer<typeof animeSnapshotSchema>>;

/**
 * 1. Schema e tipo para criar ou atualizar acompanhamento de anime.
 */
export const upsertAnimeTrackingSchema = z.object({
  animeId: z
    .string()
    .trim()
    .min(1, "O identificador do anime (animeId) é obrigatório."),
  status: trackingStatusSchema.optional().default("planning"),
  score: z
    .number()
    .min(0, "A nota deve ser maior ou igual a 0.")
    .max(10, "A nota deve ser menor ou igual a 10.")
    .nullable()
    .optional(),
  episodesWatched: z
    .number()
    .int("O número de episódios assistidos deve ser inteiro.")
    .min(0, "Episódios assistidos não podem ser negativos.")
    .optional(),
  animeSnapshot: animeSnapshotSchema,
  startedAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
});

export type UpsertAnimeTrackingInput = z.infer<
  typeof upsertAnimeTrackingSchema
>;

/**
 * 2. Schema e tipo para consultar acompanhamento do usuário autenticado.
 */
export const getMyAnimeTrackingSchema = z
  .object({
    status: trackingStatusSchema.optional(),
    animeId: z.string().trim().min(1).optional(),
  })
  .optional();

export type GetMyAnimeTrackingInput = z.infer<
  typeof getMyAnimeTrackingSchema
>;

/**
 * 2b. Schema e tipo para consulta com paginação real da aba Animes (lotes de 24).
 */
export const getMyAnimeTrackingPaginatedSchema = z
  .object({
    status: trackingStatusSchema.optional(),
    page: z.number().int().min(1).optional().default(1),
    limit: z.number().int().min(1).max(100).optional().default(24),
  })
  .optional();

export type GetMyAnimeTrackingPaginatedInput = z.infer<
  typeof getMyAnimeTrackingPaginatedSchema
>;

export interface PaginatedAnimeTrackingResponse {
  items: UserAnimeTrackingItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
  counts: Record<"all" | TrackingStatus, number>;
}

/**
 * 3. Schema e tipo para consultar acompanhamento filtrado por status.
 */
export const getAnimeTrackingByStatusSchema = z.object({
  status: trackingStatusSchema,
});

export type GetAnimeTrackingByStatusInput = z.infer<
  typeof getAnimeTrackingByStatusSchema
>;

/**
 * 4. Schema e tipo para remover acompanhamento de anime.
 */
export const removeAnimeTrackingSchema = z.object({
  animeId: z
    .string()
    .trim()
    .min(1, "O identificador do anime (animeId) é obrigatório."),
});

export type RemoveAnimeTrackingInput = z.infer<
  typeof removeAnimeTrackingSchema
>;

/**
 * 5. Schema e tipo para consultar histórico paginado de episódios assistidos.
 */
export const getMyWatchedEpisodesSchema = z
  .object({
    animeId: z.string().trim().min(1).optional(),
    page: z
      .number()
      .int()
      .min(1, "A página deve ser maior ou igual a 1.")
      .optional()
      .default(1),
    limit: z
      .number()
      .int()
      .min(1, "O limite mínimo é 1.")
      .max(100, "O limite máximo é 100.")
      .optional()
      .default(30),
  })
  .optional();

export type GetMyWatchedEpisodesInput = z.infer<
  typeof getMyWatchedEpisodesSchema
>;

/**
 * 6. Schema e tipo para marcar manualmente um episódio como assistido.
 */
export const markEpisodeWatchedSchema = z.object({
  animeId: z
    .string()
    .trim()
    .min(1, "O identificador do anime (animeId) é obrigatório."),
  episodeId: z
    .string()
    .trim()
    .min(1, "O identificador do episódio (episodeId) é obrigatório."),
  episodeNumber: z
    .number()
    .int("O número do episódio deve ser inteiro.")
    .min(0, "O número do episódio não pode ser negativo."),
  animeSnapshot: animeSnapshotSchema,
});

export type MarkEpisodeWatchedInput = z.infer<
  typeof markEpisodeWatchedSchema
>;

/**
 * 7. Schema e tipo para desmarcar manualmente um episódio do histórico.
 */
export const unmarkEpisodeWatchedSchema = z.object({
  animeId: z
    .string()
    .trim()
    .min(1, "O identificador do anime (animeId) é obrigatório."),
  episodeId: z
    .string()
    .trim()
    .min(1, "O identificador do episódio (episodeId) é obrigatório."),
});

export type UnmarkEpisodeWatchedInput = z.infer<
  typeof unmarkEpisodeWatchedSchema
>;

/**
 * Representação direta da linha na tabela "user_anime_tracking".
 */
export interface UserAnimeTrackingRecord {
  userId: string;
  animeId: string;
  status: TrackingStatus;
  score: number | null;
  episodesWatched: number;
  animeSnapshot: AnimeSnapshot | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Item de acompanhamento enriquecido com dados do catálogo ou snapshot.
 */
export interface UserAnimeTrackingItem {
  userId: string;
  animeId: string;
  status: TrackingStatus;
  score: number | null;
  episodesWatched: number;
  title: string;
  titleRomaji: string | null;
  titleEnglish: string | null;
  titleNative: string | null;
  cover: string | null;
  banner: string | null;
  format: string | null;
  year: number | null;
  episodesCount: number | null;
  animeStatus: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  animeSnapshot: AnimeSnapshot | null;
}

/**
 * Representação direta da linha na tabela "user_watched_episode".
 */
export interface UserWatchedEpisodeRecord {
  userId: string;
  animeId: string;
  episodeId: string;
  episodeNumber: number;
  origin: WatchedOrigin;
  watchedAt: string;
}

/**
 * Item de episódio assistido enriquecido com dados de apresentação.
 */
export interface WatchedEpisodeItem {
  userId: string;
  animeId: string;
  episodeId: string;
  episodeNumber: number;
  origin: WatchedOrigin;
  watchedAt: string;
  animeTitle: string;
  animeCover: string | null;
}

/**
 * Resposta paginada de episódios assistidos do usuário.
 */
export interface WatchedEpisodesResponse {
  items: WatchedEpisodeItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const STATUS_CONFIG: Record<
  TrackingStatus,
  {
    label: string;
    color: string;
    badgeBg: string;
    badgeBorder: string;
    badgeText: string;
    activeStyle: string;
    indicatorDot: string;
  }
> = {
  watching: {
    label: "Assistindo",
    color: "emerald",
    badgeBg: "bg-emerald-500/15",
    badgeBorder: "border-emerald-500/30",
    badgeText: "text-emerald-300",
    activeStyle:
      "bg-emerald-500/20 text-emerald-200 border-emerald-500/50 ring-1 ring-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.25)]",
    indicatorDot: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]",
  },
  completed: {
    label: "Concluídos",
    color: "violet",
    badgeBg: "bg-violet-500/15",
    badgeBorder: "border-violet-500/30",
    badgeText: "text-violet-300",
    activeStyle:
      "bg-violet-500/20 text-violet-200 border-violet-500/50 ring-1 ring-violet-500/40 shadow-[0_0_15px_rgba(168,85,247,0.25)]",
    indicatorDot: "bg-violet-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]",
  },
  on_hold: {
    label: "Em espera",
    color: "amber",
    badgeBg: "bg-amber-500/15",
    badgeBorder: "border-amber-500/30",
    badgeText: "text-amber-300",
    activeStyle:
      "bg-amber-500/20 text-amber-200 border-amber-500/50 ring-1 ring-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.25)]",
    indicatorDot: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]",
  },
  dropped: {
    label: "Abandonados",
    color: "rose",
    badgeBg: "bg-rose-500/15",
    badgeBorder: "border-rose-500/30",
    badgeText: "text-rose-300",
    activeStyle:
      "bg-rose-500/20 text-rose-200 border-rose-500/50 ring-1 ring-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.25)]",
    indicatorDot: "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]",
  },
  planning: {
    label: "Planejados",
    color: "sky",
    badgeBg: "bg-sky-500/15",
    badgeBorder: "border-sky-500/30",
    badgeText: "text-sky-300",
    activeStyle:
      "bg-sky-500/20 text-sky-200 border-sky-500/50 ring-1 ring-sky-500/40 shadow-[0_0_15px_rgba(14,165,233,0.25)]",
    indicatorDot: "bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]",
  },
};

export const STATUS_ORDER: TrackingStatus[] = [
  "watching",
  "completed",
  "on_hold",
  "dropped",
  "planning",
];
