import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/upload-video")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as HandleUploadBody;
        const token = process.env.BLOB_READ_WRITE_TOKEN;

        if (!token) {
          return Response.json(
            { error: "BLOB_READ_WRITE_TOKEN não está disponível." },
            { status: 500 },
          );
        }

        try {
          const jsonResponse = await handleUpload({
            token,
            body,
            request,
            onBeforeGenerateToken: async () => ({
              allowedContentTypes: [
                "video/mp4",
                "video/webm",
                "video/quicktime",
              ],
              maximumSizeInBytes: 900 * 1024 * 1024,
              addRandomSuffix: true,
            }),
            onUploadCompleted: async ({ blob }) => {
              console.log("Upload concluído:", blob.url);
            },
          });

          return Response.json(jsonResponse);
        } catch (error) {
          console.error("Erro no upload do Blob:", error);

          return Response.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Falha no upload.",
            },
            { status: 400 },
          );
        }
      },
    },
  },
});
