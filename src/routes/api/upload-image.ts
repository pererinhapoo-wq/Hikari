import { createFileRoute } from "@tanstack/react-router";
import { assertSameSiteRequest, CrossSiteRequestError } from "@/lib/auth/isolation.server";
import { requireAdminUser, AdminGuardError } from "@/lib/auth/admin-guard";
import { auth } from "@/lib/auth/server";
import {
  uploadImageToStorage,
  isValidCategory,
  CATEGORY_POLICIES,
  StorageValidationError,
  StorageConfigurationError,
  type ImageCategory,
} from "@/lib/storage/image-storage";

export const Route = createFileRoute("/api/upload-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // 1. Validar Same-Site
          assertSameSiteRequest();

          // 2. Validar cabeçalho multipart/form-data
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

          // 3. Validar categoria
          const rawCategory = formData.get("category");
          if (!isValidCategory(rawCategory)) {
            return Response.json(
              {
                error: `Categoria inválida. Categorias aceitas: ${Object.keys(CATEGORY_POLICIES).join(", ")}.`,
              },
              { status: 400 },
            );
          }

          const category: ImageCategory = rawCategory;
          const policy = CATEGORY_POLICIES[category];

          // 4. Validação de Autorização de acordo com a categoria
          let actorId: string;
          if (policy.requiresAdmin) {
            actorId = await requireAdminUser(request);
          } else {
            const session = await auth.api.getSession({ headers: request.headers });
            const userId = session?.user?.id;
            if (!userId) {
              return Response.json(
                { error: "Não autenticado. Faça login para enviar imagens." },
                { status: 401 },
              );
            }
            actorId = userId;
          }

          // 5. Validar arquivo
          const file = formData.get("file");
          if (!file || !(file instanceof Blob)) {
            return Response.json(
              { error: "Campo 'file' obrigatório não fornecido ou inválido." },
              { status: 400 },
            );
          }

          const originalFilename = file instanceof File ? file.name : `${category}.jpg`;

          // 6. Gravar fisicamente no Vercel Blob
          const result = await uploadImageToStorage({
            file,
            category,
            actorId,
            filename: originalFilename,
          });

          return Response.json({
            ok: true,
            url: result.url,
            pathname: result.pathname,
            size: result.size,
            contentType: result.contentType,
            category,
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

          console.error("[api/upload-image] Erro no upload de imagem:", err);
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
