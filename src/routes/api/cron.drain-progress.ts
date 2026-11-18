import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import {
  drainProgressFromQueue,
  cleanupDrainedProgressHashes,
} from "@/lib/redis";

function verifyCronSecret(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    // Se não houver CRON_SECRET configurado (ex: dev local), permitir
    return true;
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) return true;
  const customHeader = request.headers.get("x-cron-secret");
  if (customHeader === cronSecret) return true;
  return false;
}

export const Route = createFileRoute("/api/cron/drain-progress")({
  server: {
    handlers: {
      GET: async ({ request }) => handleDrain(request),
      POST: async ({ request }) => handleDrain(request),
    },
  },
});

async function handleDrain(request: Request): Promise<Response> {
  if (!verifyCronSecret(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const items = await drainProgressFromQueue(500);
    if (items.length === 0) {
      return Response.json({ drained: 0, inserted: 0 });
    }

    const sql = await getSql();

    // Montar query de inserção em lote (batch upsert)
    const valueClauses: string[] = [];
    const params: unknown[] = [];
    let pIdx = 1;

    for (const item of items) {
      valueClauses.push(
        `($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}::timestamptz)`,
      );
      params.push(
        item.userKey,
        item.episodeId,
        item.position,
        item.duration,
        item.updated_at,
      );
      pIdx += 5;
    }

    const query = `
      INSERT INTO "progress" ("user_key", "episode_id", "position", "duration", "updated_at")
      VALUES ${valueClauses.join(", ")}
      ON CONFLICT ("user_key", "episode_id")
      DO UPDATE SET
        "position" = EXCLUDED."position",
        "duration" = EXCLUDED."duration",
        "updated_at" = EXCLUDED."updated_at"
      WHERE "progress"."updated_at" < EXCLUDED."updated_at";
    `;

    await sql.query(query, params);

    // Limpar chaves drenadas do Redis cuja versão não foi sobrescrita
    await cleanupDrainedProgressHashes(items);

    return Response.json({
      drained: items.length,
      success: true,
    });
  } catch (err) {
    console.error("[cron/drain-progress] Erro ao drenar progresso:", err);
    return Response.json(
      { error: "Falha ao drenar progresso para Postgres" },
      { status: 500 },
    );
  }
}
