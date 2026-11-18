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

    // Remove registros com mais de 180 dias sem tocar em episódios em andamento (<90%)
    const query = `
      DELETE FROM "progress"
      WHERE "updated_at" < NOW() - INTERVAL '180 days'
        AND "position" >= "duration" * 0.95;
    `;

    await sql.query(query);

    return Response.json({
      success: true,
      cleaned: true,
    });
  } catch (err) {
    console.error("[cron/cleanup-progress] Erro ao limpar progresso antigo:", err);
    return Response.json(
      { error: "Falha ao executar limpeza diária de progresso" },
      { status: 500 },
    );
  }
}
