import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

async function handleGet({ request }: { request: Request }) {
  const urlObj = new URL(request.url);
  const id = urlObj.searchParams.get("id");

  if (!id) {
    return new Response("ID não informado", { status: 400 });
  }

  try {
    const sql = await getSql();

    await sql.query(`
      CREATE TABLE IF NOT EXISTS "thumbnail_storage" (
        "id" text PRIMARY KEY,
        "filename" text NOT NULL,
        "mime_type" text NOT NULL DEFAULT 'image/jpeg',
        "data" text NOT NULL,
        "created_at" bigint NOT NULL
      );
    `);

    const rows = await sql.query<{
      mime_type: string;
      data: string;
    }>(
      `SELECT "mime_type", "data" FROM "thumbnail_storage" WHERE "id" = $1 LIMIT 1`,
      [id],
    );

    if (!rows || rows.length === 0) {
      return new Response("Miniatura não encontrada", { status: 404 });
    }

    const item = rows[0];
    const buffer = Buffer.from(item.data, "base64");

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": item.mime_type || "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("[media/thumbnail] Erro:", err);
    return new Response("Erro ao recuperar miniatura", { status: 500 });
  }
}

export const Route = createFileRoute("/api/media/thumbnail")({
  server: {
    handlers: {
      GET: handleGet,
    },
  },
});
