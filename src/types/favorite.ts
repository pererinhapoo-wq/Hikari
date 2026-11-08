import { z } from "zod";

/**
 * Categorias suportadas de favoritos oficiais no Hikari.
 */
export const FAVORITE_TARGET_TYPES = [
  "anime",
  "character",
  "studio",
  "company",
  "person",
] as const;

export type FavoriteTargetType = (typeof FAVORITE_TARGET_TYPES)[number];

export const favoriteTargetTypeSchema = z.enum(FAVORITE_TARGET_TYPES);

/**
 * Schema e tipo para adição de favorito.
 */
export const addFavoriteSchema = z.object({
  targetType: favoriteTargetTypeSchema,
  targetId: z
    .string()
    .trim()
    .min(1, "O identificador do item (targetId) é obrigatório."),
  animeSnapshot: z
    .object({
      title: z.string().optional(),
      titleRomaji: z.string().nullable().optional(),
      titleEnglish: z.string().nullable().optional(),
      titleNative: z.string().nullable().optional(),
      cover: z.string().nullable().optional(),
      banner: z.string().nullable().optional(),
      synopsis: z.string().nullable().optional(),
      format: z.string().nullable().optional(),
      year: z.number().nullable().optional(),
      episodesCount: z.number().nullable().optional(),
      status: z.string().nullable().optional(),
    })
    .catchall(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional()
    .nullable(),
});

export type AddFavoriteInput = z.infer<typeof addFavoriteSchema>;

/**
 * Schema e tipo para remoção de favorito.
 */
export const removeFavoriteSchema = z
  .object({
    favoriteId: z.string().trim().optional(),
    targetType: favoriteTargetTypeSchema.optional(),
    targetId: z.string().trim().optional(),
  })
  .refine(
    (data) => Boolean(data.favoriteId || (data.targetType && data.targetId)),
    {
      message:
        "O identificador do favorito (favoriteId) ou o par (targetType e targetId) é obrigatório.",
    },
  );

export type RemoveFavoriteInput = z.infer<typeof removeFavoriteSchema>;

/**
 * Schema e tipo para reordenação de favoritos dentro de uma categoria.
 */
export const reorderFavoritesSchema = z.object({
  targetType: favoriteTargetTypeSchema,
  orderedFavoriteIds: z
    .array(z.string().trim().min(1))
    .min(1, "A lista de favoritos para reordenar não pode ser vazia."),
});

export type ReorderFavoritesInput = z.infer<typeof reorderFavoritesSchema>;

/**
 * Schema e tipo para consulta de favoritos.
 */
export const getFavoritesSchema = z.object({
  targetType: favoriteTargetTypeSchema.optional(),
  targetId: z.string().trim().optional(),
});

export type GetFavoritesInput = z.infer<typeof getFavoritesSchema>;

/**
 * Representação direta da linha na tabela "user_favorite".
 */
export interface ProfileFavoriteRecord {
  id: string;
  userId: string;
  targetType: FavoriteTargetType;
  animeId: string | null;
  characterId: string | null;
  studioId: string | null;
  companyId: string | null;
  personId: string | null;
  position: number;
  createdAt: string;
}

/**
 * Item de favorito enriquecido com os dados canônicos do catálogo da Migration 0019.
 */
export interface ProfileFavoriteItem {
  id: string;
  userId: string;
  targetType: FavoriteTargetType;
  targetId: string;
  position: number;
  createdAt: string;
  title: string;
  nativeTitle: string | null;
  image: string | null;
  banner: string | null;
  description: string | null;
  subtitle: string | null;
}

/**
 * Agrupamento de favoritos pelas 5 categorias oficiais.
 */
export interface ProfileFavoritesGrouped {
  anime: ProfileFavoriteItem[];
  character: ProfileFavoriteItem[];
  studio: ProfileFavoriteItem[];
  company: ProfileFavoriteItem[];
  person: ProfileFavoriteItem[];
}

/**
 * Resposta da consulta de favoritos do usuário autenticado.
 */
export interface ProfileFavoritesResponse {
  items: ProfileFavoriteItem[];
  grouped: ProfileFavoritesGrouped;
}
