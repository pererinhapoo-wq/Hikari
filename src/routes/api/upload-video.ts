import { createFileRoute } from "@tanstack/react-router";
import {
  handleUpload,
  type HandleUploadBody,
} from "@vercel/blob/client";

const ALLOWED_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

const MAX_SIZE = 900 * 1024 * 1024;

async function handlePost({ request }: { request: Request }) {
  try {
    const body = (await request.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request,

      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_TYPES,
        maximumSizeInBytes: MAX_SIZE,
        addRandomSuffix: true,
      }),

      onUploadCompleted: async ({ blob }) => {
        console.log("Upload concluído:", blob.url);
      },
    });

    return Response.json(jsonResponse);
  } catch (error) {
    console.error("Erro no upload do Vercel Blob:", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? `Falha no upload: ${error.message}`
            : "Falha no upload.",
      },
      {
        status: 500,
      },
    );
  }
}

export const Route = createFileRoute("/api/upload-video")({
  server: {
    handlers: {
      POST: handlePost,
    },
  },
});
