import { z } from "zod";

/**
 * Snapshot leve com apenas os campos essenciais para exibição dos animes nas listas.
 * Suporta tanto animes canônicos quanto locais ("local-*").
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
 * 1. Schema e tipo para criação de lista personalizada.
 */
export const createProfileListSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "O título da lista é obrigatório.")
    .max(100, "O título deve ter no máximo 100 caracteres."),
  description: z
    .string()
    .trim()
    .max(1000, "A descrição deve ter no máximo 1000 caracteres.")
    .optional()
    .nullable(),
  isPublic: z.boolean().optional().default(true),
});

export type CreateProfileListInput = z.infer<typeof createProfileListSchema>;

/**
 * 2. Schema e tipo para edição de lista personalizada.
 */
export const updateProfileListSchema = z.object({
  listId: z
    .string()
    .trim()
    .min(1, "O identificador da lista (listId) é obrigatório."),
  title: z
    .string()
    .trim()
    .min(1, "O título não pode ser vazio.")
    .max(100, "O título deve ter no máximo 100 caracteres.")
    .optional(),
  description: z
    .string()
    .trim()
    .max(1000, "A descrição deve ter no máximo 1000 caracteres.")
    .optional()
    .nullable(),
  isPublic: z.boolean().optional(),
});

export type UpdateProfileListInput = z.infer<typeof updateProfileListSchema>;

/**
 * 3. Schema e tipo para exclusão de lista personalizada.
 */
export const deleteProfileListSchema = z.object({
  listId: z
    .string()
    .trim()
    .min(1, "O identificador da lista (listId) é obrigatório."),
});

export type DeleteProfileListInput = z.infer<typeof deleteProfileListSchema>;

/**
 * 4. Schema e tipo para consulta das listas do usuário autenticado.
 */
export const getMyProfileListsSchema = z.object({}).optional();

export type GetMyProfileListsInput = z.infer<typeof getMyProfileListsSchema>;

/**
 * 5. Schema e tipo para detalhes da lista e seus animes.
 */
export const getProfileListDetailsSchema = z.object({
  listId: z
    .string()
    .trim()
    .min(1, "O identificador da lista (listId) é obrigatório."),
});

export type GetProfileListDetailsInput = z.infer<
  typeof getProfileListDetailsSchema
>;

/**
 * 6. Schema e tipo para adição de anime à lista personalizada.
 */
export const addAnimeToProfileListSchema = z.object({
  listId: z
    .string()
    .trim()
    .min(1, "O identificador da lista (listId) é obrigatório."),
  animeId: z
    .string()
    .trim()
    .min(1, "O identificador do anime (animeId) é obrigatório."),
  animeSnapshot: animeSnapshotSchema,
});

export type AddAnimeToProfileListInput = z.infer<
  typeof addAnimeToProfileListSchema
>;

/**
 * 7. Schema e tipo para remoção de anime da lista personalizada.
 */
export const removeAnimeFromProfileListSchema = z.object({
  listId: z
    .string()
    .trim()
    .min(1, "O identificador da lista (listId) é obrigatório."),
  animeId: z
    .string()
    .trim()
    .min(1, "O identificador do anime (animeId) é obrigatório."),
});

export type RemoveAnimeFromProfileListInput = z.infer<
  typeof removeAnimeFromProfileListSchema
>;

/**
 * 8. Schema e tipo para reordenação atômica de animes em uma lista.
 */
export const reorderProfileListItemsSchema = z.object({
  listId: z
    .string()
    .trim()
    .min(1, "O identificador da lista (listId) é obrigatório."),
  orderedAnimeIds: z.array(z.string().trim().min(1, "ID de anime inválido.")),
});

export type ReorderProfileListItemsInput = z.infer<
  typeof reorderProfileListItemsSchema
>;

/**
 * Estrutura direta da linha na tabela "user_custom_list".
 */
export interface ProfileListRecord {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Resumo de lista com contagem e capas para apresentação no perfil.
 */
export interface ProfileListSummary {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  itemCount: number;
  sampleCovers: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Item pertencente a uma lista personalizada enriquecido com dados de exibição.
 */
export interface ProfileListItem {
  listId: string;
  animeId: string;
  position: number;
  addedAt: string;
  title: string;
  titleRomaji: string | null;
  titleEnglish: string | null;
  titleNative: string | null;
  cover: string | null;
  banner: string | null;
  format: string | null;
  year: number | null;
  episodesCount: number | null;
  status: string | null;
  score: number | null;
  animeSnapshot: AnimeSnapshot | null;
}

/**
 * Detalhes completos da lista com proprietário e lista ordenada de itens.
 */
export interface ProfileListDetails {
  list: ProfileListRecord & {
    itemCount: number;
    isOwner: boolean;
    ownerNick: string | null;
    ownerName: string | null;
    ownerImage: string | null;
  };
  items: ProfileListItem[];
}
