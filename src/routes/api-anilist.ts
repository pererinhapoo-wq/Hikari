import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api-anilist")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();

          const response = await fetch(
            "https://graphql.anilist.co",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify(body),
            },
          );

          const text = await response.text();

          return new Response(text, {
            status: response.status,
            headers: {
              "Content-Type":
                response.headers.get("content-type") ??
                "application/json",
            },
          });
        } catch (error) {
          return Response.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Erro ao acessar AniList",
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
