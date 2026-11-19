import { createFileRoute } from "@tanstack/react-router";
import { resolveAnitube22DirectStream } from "@/lib/sources";

const RESOLVE_HEADERS: Record<string, string> = {
  "Cache-Control": "private, max-age=0",
};

export async function handleSourceResolveRequest(
  request: Request,
  options?: { fetchImpl?: typeof fetch },
): Promise<Response> {
  const url = new URL(request.url);
  const sourceId = (url.searchParams.get("id") || "").trim();
  const forceRefresh = url.searchParams.get("refresh") === "1";

  if (!sourceId) {
    return Response.json(
      { error: "id é obrigatório." },
      { status: 400, headers: RESOLVE_HEADERS },
    );
  }

  const result = await resolveAnitube22DirectStream(sourceId, {
    forceRefresh,
    fetchImpl: options?.fetchImpl,
  });

  if (!result.ok || !result.url || !result.kind) {
    return Response.json(
      {
        error: result.error || "Não foi possível resolver a fonte.",
        ...(result.sourceStatus ? { sourceStatus: result.sourceStatus } : {}),
        ...(result.networkError ? { networkError: true } : {}),
      },
      {
        status: result.httpStatus || 502,
        headers: RESOLVE_HEADERS,
      },
    );
  }

  return Response.json(
    {
      url: result.url,
      kind: result.kind,
    },
    {
      status: 200,
      headers: RESOLVE_HEADERS,
    },
  );
}

export const Route = createFileRoute("/api/source/resolve")({
  server: {
    handlers: {
      GET: async ({ request }) => handleSourceResolveRequest(request),
    },
  },
});
