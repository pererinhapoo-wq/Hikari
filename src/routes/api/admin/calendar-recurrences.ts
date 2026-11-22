import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { assertSameSiteRequest, CrossSiteRequestError } from "@/lib/auth/isolation.server";
import { AdminGuardError, requireAdminUser } from "@/lib/auth/admin-guard";
import {
  CalendarRecurrenceError,
  createCalendarRecurrence,
  deleteCalendarRecurrence,
  listCalendarRecurrences,
  searchCatalogAnimesForRecurrence,
  updateCalendarRecurrence,
} from "@/lib/calendar-schedule.server";

const createRecurrenceSchema = z.object({
  animeId: z.string().trim().min(1, "Selecione um anime.").max(128),
  dayOfWeek: z.number().int().min(0, "Dia da semana inválido.").max(6, "Dia da semana inválido."),
  active: z.boolean().optional(),
});

const patchRecurrenceSchema = z
  .object({
    id: z.string().trim().min(1, "Identificador obrigatório.").max(128),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    active: z.boolean().optional(),
  })
  .refine((v) => v.dayOfWeek !== undefined || v.active !== undefined, {
    message: "Informe ao menos o novo dia da semana ou o status ativo/inativo.",
  });

const deleteRecurrenceSchema = z.object({
  id: z.string().trim().min(1, "Identificador obrigatório.").max(128),
});

function handleRouteError(err: unknown, context: string): Response {
  if (err instanceof CrossSiteRequestError) {
    return Response.json(
      { error: "Origem cruzada não permitida." },
      { status: err.status },
    );
  }
  if (err instanceof AdminGuardError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof CalendarRecurrenceError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  console.error(`[api/admin/calendar-recurrences] Erro em ${context}:`, err);
  return Response.json(
    {
      error:
        err instanceof Error
          ? err.message
          : "Erro interno ao processar programação semanal recorrente.",
    },
    { status: 500 },
  );
}

export const Route = createFileRoute("/api/admin/calendar-recurrences")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          assertSameSiteRequest();
          const adminId = await requireAdminUser(request);

          const url = new URL(request.url);
          const q = url.searchParams.get("q");
          const includeCatalog = url.searchParams.get("includeCatalog") === "1";

          const [recurrences, animeOptions] = await Promise.all([
            listCalendarRecurrences(),
            q !== null || includeCatalog
              ? searchCatalogAnimesForRecurrence(q ?? "")
              : Promise.resolve(undefined),
          ]);

          return Response.json({
            ok: true,
            adminId,
            recurrences,
            ...(animeOptions !== undefined ? { animeOptions } : {}),
          });
        } catch (err) {
          return handleRouteError(err, "GET");
        }
      },

      POST: async ({ request }) => {
        try {
          assertSameSiteRequest();
          await requireAdminUser(request);

          let rawBody: unknown;
          try {
            rawBody = await request.json();
          } catch {
            return Response.json({ error: "JSON inválido." }, { status: 400 });
          }

          const parsed = createRecurrenceSchema.safeParse(rawBody);
          if (!parsed.success) {
            return Response.json(
              {
                error:
                  parsed.error.issues[0]?.message ||
                  "Dados inválidos para cadastro da recorrência.",
              },
              { status: 400 },
            );
          }

          const recurrence = await createCalendarRecurrence(parsed.data);
          return Response.json(
            {
              ok: true,
              recurrence,
              message: "Programação semanal cadastrada com sucesso.",
            },
            { status: 201 },
          );
        } catch (err) {
          return handleRouteError(err, "POST");
        }
      },

      PATCH: async ({ request }) => {
        try {
          assertSameSiteRequest();
          await requireAdminUser(request);

          let rawBody: unknown;
          try {
            rawBody = await request.json();
          } catch {
            return Response.json({ error: "JSON inválido." }, { status: 400 });
          }

          const parsed = patchRecurrenceSchema.safeParse(rawBody);
          if (!parsed.success) {
            return Response.json(
              {
                error:
                  parsed.error.issues[0]?.message ||
                  "Dados inválidos para atualizar recorrência.",
              },
              { status: 400 },
            );
          }

          const recurrence = await updateCalendarRecurrence(parsed.data);
          return Response.json({
            ok: true,
            recurrence,
            message: "Programação semanal atualizada com sucesso.",
          });
        } catch (err) {
          return handleRouteError(err, "PATCH");
        }
      },

      DELETE: async ({ request }) => {
        try {
          assertSameSiteRequest();
          await requireAdminUser(request);

          const url = new URL(request.url);
          let targetId = url.searchParams.get("id")?.trim() ?? "";

          if (!targetId) {
            const textBody = await request.text().catch(() => "");
            if (textBody.trim()) {
              let rawBody: unknown;
              try {
                rawBody = JSON.parse(textBody);
              } catch {
                return Response.json({ error: "JSON inválido." }, { status: 400 });
              }
              const parsed = deleteRecurrenceSchema.safeParse(rawBody);
              if (!parsed.success) {
                return Response.json(
                  {
                    error:
                      parsed.error.issues[0]?.message ||
                      "Identificador inválido para exclusão.",
                  },
                  { status: 400 },
                );
              }
              targetId = parsed.data.id;
            }
          }

          if (!targetId) {
            return Response.json(
              { error: "Identificador da recorrência é obrigatório." },
              { status: 400 },
            );
          }

          const deleted = await deleteCalendarRecurrence(targetId);
          return Response.json({
            ok: true,
            deleted,
            message: "Programação semanal removida com sucesso.",
          });
        } catch (err) {
          return handleRouteError(err, "DELETE");
        }
      },
    },
  },
});
