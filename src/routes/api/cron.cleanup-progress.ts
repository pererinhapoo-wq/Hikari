import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

function verifyCronSecret(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return true;
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) return true;
  const customHeader = request.headers.get("x-cron-secret");
  if (customHeader === cronSecret) return true;
  return false;
}

export const Route = createFileRoute("/api/cron/cleanup-progress")({
  server: {
    handlers: {
      GET: async ({ request }) => handleCleanup(request),
      POST: async ({ request }) => handleCleanup(request),
    },
  },
});

async function handleCleanup(request: Request): Promise<Response> {
  if (!verifyCronSecret(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const sql = await getSql();

    // Remove linhas com updated_at > 180 dias, mas nunca apaga a linha mais recente de um episódio em andamento
    const query = `
      WITH latest_in_progress AS (
        SELECT DISTINCT ON ("user_key") "user_key", "episode_id"
        FROM "progress"
        WHERE "duration" > 0
          AND "position" > 0
          AND "position" < "duration" * 0.95
        ORDER BY "user_key", "updated_at" DESC
      )
      DELETE FROM "progress" p
      WHERE p."updated_at" < NOW() - INTERVAL '180 days'
        AND NOT EXISTS (
          SELECT 1
          FROM latest_in_progress lip
          WHERE lip."user_key" = p."user_key"
            AND lip."episode_id" = p."episode_id"
        )
      RETURNING p."user_key", p."episode_id";
    `;

    const deleted = await sql.query<{ user_key: string; episode_id: string }>(
      query,
    );

    return Response.json({
      success: true,
      deleted: deleted.length,
    });
  } catch (err) {
    console.error("[cron/cleanup-progress] Erro ao limpar progresso antigo:", err);
    return Response.json(
      { error: "Falha ao executar limpeza diária de progresso" },
      { status: 500 },
    );
  }
}
