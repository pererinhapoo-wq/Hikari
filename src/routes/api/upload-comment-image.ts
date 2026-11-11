import { createFileRoute } from "@tanstack/react-router";
import { assertSameSiteRequest, CrossSiteRequestError } from "@/lib/auth/isolation.server";
import { auth } from "@/lib/auth/server";
import {
  handleClientBlobUpload,
  uploadImageToStorage,
  StorageValidationError,
  StorageConfigurationError,
} from "@/lib/storage/image-storage";

export const Route = createFileRoute("/api/upload-comment-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // 1. Validar Same-Site
          assertSameSiteRequest();

          const contentType = request.headers.get("content-type") || "";

          // Fluxo A: Requisição de token do SDK @vercel/blob/client (JSON)
          if (contentType.includes("application/json")) {
            return await handleClientBlobUpload(request, "comment-images");
          }

          // Fluxo B: Upload direto via multipart/form-data
          if (contentType.includes("multipart/form-data")) {
            const session = await auth.api.getSession({ headers: request.headers });
            const userId = session?.user?.id;
            if (!userId) {
              return Response.json(
                { error: "Não autenticado. Faça login para enviar imagens nos comentários." },
                { status: 401 },
              );
            }

            let formData: FormData;
            try {
              formData = await request.formData();
            } catch {
              return Response.json(
                { error: "Falha ao processar corpo multipart/form-data." },
                { status: 400 },
              );
            }

            const file = formData.get("file");
            if (!file || !(file instanceof Blob)) {
              return Response.json(
                { error: "Campo 'file' obrigatório não fornecido ou inválido." },
                { status: 400 },
              );
            }

            const originalFilename = file instanceof File ? file.name : "comment-image.jpg";

            const result = await uploadImageToStorage({
              file,
              category: "comment-images",
              actorId: userId,
              filename: originalFilename,
            });

            return Response.json({
              ok: true,
              url: result.url,
              pathname: result.pathname,
              size: result.size,
            });
          }

          return Response.json(
            { error: "Content-Type não suportado. Esperado application/json ou multipart/form-data." },
            { status: 400 },
          );
        } catch (err) {
          if (err instanceof CrossSiteRequestError) {
            return Response.json({ error: "Origem cruzada não permitida." }, { status: 403 });
          }
          if (err instanceof StorageValidationError) {
            return Response.json({ error: err.message }, { status: err.status });
          }
          if (err instanceof StorageConfigurationError) {
            return Response.json({ error: err.message }, { status: err.status });
          }

          console.error("[api/upload-comment-image] Erro no upload de imagem de comentário:", err);
          return Response.json(
            {
              error: err instanceof Error ? err.message : "Erro interno ao processar upload.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
