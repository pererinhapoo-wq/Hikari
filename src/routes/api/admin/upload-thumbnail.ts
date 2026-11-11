import { createFileRoute } from "@tanstack/react-router";
import { assertSameSiteRequest, CrossSiteRequestError } from "@/lib/auth/isolation.server";
import { requireAdminUser, AdminGuardError } from "@/lib/auth/admin-guard";
import {
  uploadImageToStorage,
  StorageValidationError,
  StorageConfigurationError,
} from "@/lib/storage/image-storage";

export const Route = createFileRoute("/api/admin/upload-thumbnail")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // 1. Validar Same-Site
          assertSameSiteRequest();

          // 2. Validar administrador
          const adminId = await requireAdminUser(request);

          // 3. Extrair arquivo do FormData
          const contentType = request.headers.get("content-type") || "";
          if (!contentType.includes("multipart/form-data")) {
            return Response.json(
              { error: "Requisição inválida. Esperado multipart/form-data." },
              { status: 400 },
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

          const originalFilename = file instanceof File ? file.name : "episode-thumbnail.jpg";

          // 4. Gravar fisicamente no Vercel Blob sob a categoria 'episode-thumbnails'
          const result = await uploadImageToStorage({
            file,
            category: "episode-thumbnails",
            actorId: adminId,
            filename: originalFilename,
          });

          return Response.json({
            ok: true,
            url: result.url,
            pathname: result.pathname,
            size: result.size,
          });
        } catch (err) {
          if (err instanceof CrossSiteRequestError) {
            return Response.json({ error: "Origem cruzada não permitida." }, { status: 403 });
          }
          if (err instanceof AdminGuardError) {
            return Response.json({ error: err.message }, { status: err.status });
          }
          if (err instanceof StorageValidationError) {
            return Response.json({ error: err.message }, { status: err.status });
          }
          if (err instanceof StorageConfigurationError) {
            return Response.json({ error: err.message }, { status: err.status });
          }

          console.error("[api/admin/upload-thumbnail] Erro no upload da miniatura:", err);
          return Response.json(
            {
              error: err instanceof Error ? err.message : "Erro interno ao processar miniatura.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
