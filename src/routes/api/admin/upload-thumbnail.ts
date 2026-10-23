import { createFileRoute } from "@tanstack/react-router";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSql } from "@/lib/db";

async function handlePost({ request }: { request: Request }) {
  try {
    let imageBuffer: Buffer;
    let mimeType = "image/jpeg";
    const uniqueSuffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    let filename = `thumb-${uniqueSuffix}.jpg`;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!file || !(file instanceof Blob)) {
        return Response.json({ error: "Nenhum arquivo enviado no campo 'file'." }, { status: 400 });
      }
      mimeType = file.type || "image/jpeg";
      imageBuffer = Buffer.from(await file.arrayBuffer());
    } else if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        imageBase64?: string;
        filename?: string;
        mimeType?: string;
      };
      if (!body.imageBase64) {
        return Response.json({ error: "Campo 'imageBase64' é obrigatório." }, { status: 400 });
      }
      const rawBase64 = body.imageBase64.replace(/^data:[^;]+;base64,/, "");
      imageBuffer = Buffer.from(rawBase64, "base64");
      if (body.mimeType) mimeType = body.mimeType;
      if (body.filename) filename = body.filename;
    } else {
      imageBuffer = Buffer.from(await request.arrayBuffer());
      if (contentType) mimeType = contentType;
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      return Response.json({ error: "Arquivo de imagem vazio." }, { status: 400 });
    }

    if (imageBuffer.length > 5 * 1024 * 1024) {
      return Response.json({ error: "A imagem não pode ter mais de 5 MB." }, { status: 400 });
    }

    // 1. Armazenamento Cloudflare R2 / S3 / Backblaze B2 (se configurado nas variáveis de ambiente)
    const r2KeyId =
      process.env.R2_ACCESS_KEY_ID?.trim() ||
      process.env.AWS_ACCESS_KEY_ID?.trim() ||
      process.env.B2_APPLICATION_KEY_ID?.trim();

    const r2AppKey =
      process.env.R2_SECRET_ACCESS_KEY?.trim() ||
      process.env.AWS_SECRET_ACCESS_KEY?.trim() ||
      process.env.B2_APPLICATION_KEY?.trim();

    const r2Bucket =
      process.env.R2_BUCKET_NAME?.trim() ||
      process.env.AWS_BUCKET_NAME?.trim() ||
      process.env.B2_BUCKET_NAME?.trim();

    const r2Endpoint =
      process.env.R2_ENDPOINT?.trim() ||
      process.env.AWS_ENDPOINT_URL_S3?.trim() ||
      process.env.B2_ENDPOINT?.trim();

    const r2PublicUrl =
      process.env.R2_PUBLIC_URL?.trim() ||
      process.env.B2_PUBLIC_URL?.trim();

    if (r2KeyId && r2AppKey && r2Bucket && r2Endpoint) {
      const s3Client = new S3Client({
        endpoint: r2Endpoint,
        region: process.env.R2_REGION || process.env.AWS_REGION || "auto",
        credentials: {
          accessKeyId: r2KeyId,
          secretAccessKey: r2AppKey,
        },
      });

      const key = `hikari/thumbnails/${filename}`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: r2Bucket,
          Key: key,
          ContentType: mimeType,
          Body: imageBuffer,
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );

      let finalUrl: string;
      if (r2PublicUrl) {
        finalUrl = `${r2PublicUrl.replace(/\/+$/, "")}/${key}`;
      } else {
        const endpointHost = r2Endpoint.replace(/^https?:\/\//, "").replace(/\/+$/, "");
        finalUrl = `https://${r2Bucket}.${endpointHost}/${key}`;
      }

      return Response.json({ url: finalUrl, storage: "r2" });
    }

    // 2. Armazenamento Vercel Blob (se configurado)
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const { put } = await import("@vercel/blob");
        const blob = await put(`hikari/thumbnails/${filename}`, imageBuffer, {
          access: "public",
          contentType: mimeType,
        });
        return Response.json({ url: blob.url, storage: "blob" });
      } catch (blobErr) {
        console.warn("[upload-thumbnail] Vercel Blob indisponível, usando armazenamento persistente do banco:", blobErr);
      }
    }

    // 3. Fallback de Armazenamento Persistente no Servidor (Tabela PostgreSQL / PGLite)
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

    const id = `thumb-${uniqueSuffix}`;
    const base64Data = imageBuffer.toString("base64");

    await sql.query(
      `INSERT INTO "thumbnail_storage" ("id", "filename", "mime_type", "data", "created_at")
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ("id") DO NOTHING`,
      [id, filename, mimeType, base64Data, Date.now()],
    );

    const servedUrl = `/api/media/thumbnail?id=${id}`;
    return Response.json({ url: servedUrl, storage: "db" });
  } catch (error) {
    console.error("[upload-thumbnail] Erro:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro interno ao processar miniatura." },
      { status: 500 },
    );
  }
}

export const Route = createFileRoute("/api/admin/upload-thumbnail")({
  server: {
    handlers: {
      POST: handlePost,
    },
  },
});
