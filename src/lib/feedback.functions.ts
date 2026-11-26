import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { optionalAuthMiddleware, adminMiddleware } from "@/lib/auth/middleware";

export const feedbackCategorySchema = z.enum([
  "suggestion",
  "bug",
  "anime_request",
  "episode_issue",
]);

export const feedbackStatusSchema = z.enum([
  "pending",
  "in_review",
  "resolved",
  "archived",
]);

export const submitFeedbackSchema = z.object({
  category: feedbackCategorySchema,
  title: z.string().min(3, "Título muito curto").max(150, "Título muito longo"),
  description: z.string().min(10, "Descrição muito curta").max(2000, "Descrição muito longa"),
  animeName: z.string().max(150).optional().nullable(),
  episodeNumber: z.number().int().min(1).max(9999).optional().nullable(),
  referenceLink: z.string().url("URL inválida").max(500).optional().nullable().or(z.literal("")),
  pageUrl: z.string().max(500).optional().nullable().or(z.literal("")),
});

export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;

export interface FeedbackItem {
  id: number;
  userId: string | null;
  category: string;
  title: string;
  description: string;
  animeName: string | null;
  episodeNumber: number | null;
  referenceLink: string | null;
  pageUrl: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  userName?: string | null;
  userEmail?: string | null;
}

export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator((data: unknown) => submitFeedbackSchema.parse(data))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const userId = context.userId ?? null;

    if (userId) {
      const recent = await sql<{ cnt: number }>`
        select count(*)::int as cnt 
        from "feedback" 
        where "user_id" = ${userId} 
          and "created_at" > now() - interval '1 hour'
      `;
      const count = Number(recent[0]?.cnt ?? 0);
      if (count >= 5) {
        throw new Error("Você atingiu o limite de envios recentes. Tente novamente mais tarde.");
      }
    }

    const rows = await sql<{ id: number }>`
      insert into "feedback" (
        "user_id",
        "category",
        "title",
        "description",
        "anime_name",
        "episode_number",
        "reference_link",
        "page_url",
        "status"
      ) values (
        ${userId},
        ${data.category},
        ${data.title},
        ${data.description},
        ${data.animeName || null},
        ${data.episodeNumber || null},
        ${data.referenceLink || null},
        ${data.pageUrl || null},
        'pending'
      )
      returning "id"
    `;

    return { success: true as const, id: Number(rows[0]?.id ?? 1) };
  });

export const listAdminFeedbacks = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((data: unknown) => {
    const schema = z.object({
      category: z.string().optional(),
      status: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),
    });
    return schema.parse(data ?? {});
  })
  .handler(async ({ data }) => {
    const sql = await getSql();
    const categoryFilter = data.category && data.category !== "all" ? data.category : null;
    const statusFilter = data.status && data.status !== "all" ? data.status : null;

    const rows = await sql<FeedbackItem & { userName: string | null; userEmail: string | null }>`
      select 
        f."id",
        f."user_id" as "userId",
        f."category",
        f."title",
        f."description",
        f."anime_name" as "animeName",
        f."episode_number" as "episodeNumber",
        f."reference_link" as "referenceLink",
        f."page_url" as "pageUrl",
        f."status",
        f."created_at" as "createdAt",
        f."updated_at" as "updatedAt",
        u."name" as "userName",
        u."email" as "userEmail"
      from "feedback" f
      left join "user" u on u."id" = f."user_id"
      where (${categoryFilter}::text is null or f."category" = ${categoryFilter})
        and (${statusFilter}::text is null or f."status" = ${statusFilter})
      order by f."created_at" desc
      limit ${data.limit}
      offset ${data.offset}
    `;

    return rows.map((r) => ({
      ...r,
      createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date(r.createdAt).toISOString(),
      updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : new Date(r.updatedAt).toISOString(),
    }));
  });

export const updateFeedbackStatus = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((data: unknown) => {
    const schema = z.object({
      id: z.number().int().positive(),
      status: feedbackStatusSchema,
    });
    return schema.parse(data);
  })
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      update "feedback"
      set "status" = ${data.status}, "updated_at" = now()
      where "id" = ${data.id}
    `;
    return { success: true };
  });
