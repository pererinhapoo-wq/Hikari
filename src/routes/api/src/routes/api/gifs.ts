import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/gifs")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);

          const query =
            url.searchParams.get("q")?.trim() ?? "";

          if (!query) {
            return Response.json(
              {
                gifs: [],
              },
              {
                status: 200,
              },
            );
          }

          if (query.length > 100) {
            return Response.json(
              {
                error:
                  "A busca pode ter no máximo 100 caracteres.",
              },
              {
                status: 400,
              },
            );
          }

          const apiKey =
            process.env.GIPHY_API_KEY;

          if (!apiKey) {
            console.error(
              "GIPHY_API_KEY não está configurada.",
            );

            return Response.json(
              {
                error:
                  "A busca de GIFs ainda não está configurada.",
              },
              {
                status: 500,
              },
            );
          }

          const giphyUrl =
            new URL(
              "https://api.giphy.com/v1/gifs/search",
            );

          giphyUrl.searchParams.set(
            "api_key",
            apiKey,
          );

          giphyUrl.searchParams.set(
            "q",
            query,
          );

          giphyUrl.searchParams.set(
            "limit",
            "24",
          );

          giphyUrl.searchParams.set(
            "offset",
            "0",
          );

          giphyUrl.searchParams.set(
            "rating",
            "pg-13",
          );

          giphyUrl.searchParams.set(
            "lang",
            "pt",
          );

          const response =
            await fetch(
              giphyUrl.toString(),
              {
                headers: {
                  Accept:
                    "application/json",
                },
              },
            );

          if (!response.ok) {
            console.error(
              "Erro da API do GIPHY:",
              response.status,
            );

            return Response.json(
              {
                error:
                  "Não foi possível buscar GIFs.",
              },
              {
                status: 502,
              },
            );
          }

          const data =
            await response.json();

          const gifs =
            Array.isArray(data?.data)
              ? data.data
                  .map((gif: any) => {
                    const images =
                      gif?.images;

                    const preview =
                      images?.fixed_width_small
                        ?.url ??
                      images?.preview_gif
                        ?.url ??
                      null;

                    const original =
                      images?.original
                        ?.url ??
                      images?.downsized
                        ?.url ??
                      null;

                    if (
                      !preview ||
                      !original
                    ) {
                      return null;
                    }

                    return {
                      id:
                        String(
                          gif.id,
                        ),

                      title:
                        typeof gif.title ===
                        "string"
                          ? gif.title
                          : "",

                      preview,

                      url:
                        original,
                    };
                  })
                  .filter(
                    Boolean,
                  )
              : [];

          return Response.json({
            gifs,
          });
        } catch (error) {
          console.error(
            "ERRO REAL AO BUSCAR GIFS:",
            error,
          );

          return Response.json(
            {
              error:
                "Não foi possível buscar GIFs.",
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
