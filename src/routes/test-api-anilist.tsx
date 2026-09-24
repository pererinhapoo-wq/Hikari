import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/test-api-anilist")({
  loader: async () => {
    const response = await fetch("/api-anilist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `
          query {
            Media(id: 1, type: ANIME) {
              id
              title {
                romaji
              }
            }
          }
        `,
      }),
    });

    const text = await response.text();

    return {
      status: response.status,
      response: text,
    };
  },

  component: TestApiAniListPage,
});

function TestApiAniListPage() {
  const data = Route.useLoaderData();

  return (
    <pre
      style={{
        padding: "20px",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      HTTP {data.status}
      {"\n\n"}
      {data.response}
    </pre>
  );
      }
