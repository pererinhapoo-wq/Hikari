import { put } from "@vercel/blob";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/api/comments/upload-image",
)({
  server: {
    handlers: {
      POST: async ({
        request,
      }) => {
        try {
          /* ================================================== */
          /* AUTENTICAÇÃO                                        */
          /* ================================================== */

          const sessionResponse =
            await fetch(
              new URL(
                "/api/auth/get-session",
                request.url,
              ),
              {
                method: "GET",
                headers: {
                  cookie:
                    request.headers.get(
                      "cookie",
                    ) ?? "",
                },
              },
            );

          if (
            !sessionResponse.ok
          ) {
            return Response.json(
              {
                error:
                  "Você precisa estar logado para enviar uma imagem.",
              },
              {
                status: 401,
              },
            );
          }

          const session =
            await sessionResponse.json();

          const userId =
            session?.user?.id;

          if (!userId) {
            return Response.json(
              {
                error:
                  "Você precisa estar logado para enviar uma imagem.",
              },
              {
                status: 401,
              },
            );
          }

          /* ================================================== */
          /* FORM DATA                                          */
          /* ================================================== */

          const formData =
            await request.formData();

          const file =
            formData.get("file");

          if (!(file instanceof File)) {
            return Response.json(
              {
                error:
                  "Nenhuma imagem foi enviada.",
              },
              {
                status: 400,
              },
            );
          }

          /* ================================================== */
          /* VERIFICAÇÕES                                       */
          /* ================================================== */

          const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
          ];

          if (
            !allowedTypes.includes(
              file.type,
            )
          ) {
            return Response.json(
              {
                error:
                  "Formato de imagem não permitido. Use JPG, PNG, WEBP ou GIF.",
              },
              {
                status: 400,
              },
            );
          }

          const maxSize =
            5 * 1024 * 1024;

          if (
            file.size > maxSize
          ) {
            return Response.json(
              {
                error:
                  "A imagem pode ter no máximo 5 MB.",
              },
              {
                status: 400,
              },
            );
          }

          /* ================================================== */
          /* NOME DO ARQUIVO                                    */
          /* ================================================== */

          const extension =
            file.name
              .split(".")
              .pop()
              ?.toLowerCase() ||
            "jpg";

          const safeExtension =
            [
              "jpg",
              "jpeg",
              "png",
              "webp",
              "gif",
            ].includes(
              extension,
            )
              ? extension
              : "jpg";

          const filename =
            `hikari/comments/${userId}/${crypto.randomUUID()}.${safeExtension}`;

          /* ================================================== */
          /* UPLOAD PARA VERCEL BLOB                            */
          /* ================================================== */

          const blob =
            await put(
              filename,
              file,
              {
                access:
                  "public",
                addRandomSuffix:
                  false,
                contentType:
                  file.type,
              },
            );

          /* ================================================== */
          /* RESPOSTA                                           */
          /* ================================================== */

          return Response.json(
            {
              success: true,
              url: blob.url,
            },
            {
              status: 200,
            },
          );
        } catch (error) {
          console.error(
            "ERRO AO ENVIAR IMAGEM DO COMENTÁRIO:",
            error,
          );

          return Response.json(
            {
              error:
                "Não foi possível enviar a imagem.",
            },
            {
              status: 500,
            },
          );
        }
      },
    },
  },
});
