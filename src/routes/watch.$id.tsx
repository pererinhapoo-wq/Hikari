import { createFileRoute, redirect } from "@tanstack/react-router";
import { buildCleanCanonical } from "@/lib/seo";

function parseEpisodeNumber(epStr?: string): number {
  if (!epStr) return 1;
  const match = epStr.match(/ep-(?:\d+-)?(\d+)$/i) || epStr.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 1;
}

export const Route = createFileRoute("/watch/$id")({
  validateSearch: (
    raw: Record<string, unknown>,
  ): {
    ep?: string;
    comment?: string;
  } => ({
    ep:
      typeof raw.ep === "string" && raw.ep
        ? raw.ep
        : undefined,

    comment:
      typeof raw.comment === "string" && raw.comment
        ? raw.comment
        : undefined,
  }),

  beforeLoad: ({ params, search }) => {
    const epNum = parseEpisodeNumber(search.ep);
    const targetEp = `ep-${epNum}`;

    throw redirect({
      to: "/watch/$id/$ep",
      params: {
        id: params.id,
        ep: targetEp,
      },
      search: search.comment ? { comment: search.comment } : undefined,
      statusCode: 301,
    });
  },

  head: ({ params, match }) => {
    const searchEp = (match?.search as { ep?: string })?.ep;
    const epNum = parseEpisodeNumber(searchEp);
    const canonicalUrl = buildCleanCanonical(`/watch/${params.id}/ep-${epNum}`);

    return {
      links: [
        {
          rel: "canonical",
          href: canonicalUrl,
        },
      ],
      meta: [
        {
          name: "robots",
          content: "noindex, follow",
        },
      ],
    };
  },

  component: () => null,
});
