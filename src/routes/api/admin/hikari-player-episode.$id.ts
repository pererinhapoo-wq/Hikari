import { createFileRoute } from "@tanstack/react-router";
import {
  assertSameSiteRequest,
  CrossSiteRequestError,
} from "@/lib/auth/isolation.server";
import { AdminGuardError, requireAdminUser } from "@/lib/auth/admin-guard";
import { validateHikariPlayerEpisodeId } from "@/lib/hikari-player";
import {
  fetchHikariPlayerEpisodePoster,
  type HikariPlayerPosterLookupResult,
} from "@/lib/hikari-player-api.server";

export interface HikariPlayerEpisodeRouteDeps {
  assertSameSite?: () => void;
  requireAdmin?: (request: Request) => Promise<string>;
  fetchPoster?: (
    episodeId: string,
    options?: { signal?: AbortSignal },
  ) => Promise<HikariPlayerPosterLookupResult>;
}

export async function handleGetHikariPlayerEpisode(
  {
    request,
    params,
  }: {
    request: Request;
    params: { id?: string };
  },
  deps?: HikariPlayerEpisodeRouteDeps,
): Promise<Response> {
  try {
    const checkSameSite = deps?.assertSameSite ?? assertSameSiteRequest;
    checkSameSite();

    const checkAdmin = deps?.requireAdmin ?? requireAdminUser;
    await checkAdmin(request);

    const rawParam = typeof params?.id === "string" ? params.id : "";
    let decodedId = rawParam;
    try {
      decodedId = decodeURIComponent(rawParam);
    } catch {
      return Response.json(
        { error: "ID do episódio no Hikari Player inválido." },
        { status: 400 },
      );
    }

    const validation = validateHikariPlayerEpisodeId(decodedId);
    if (!validation.valid || !validation.value) {
      return Response.json(
        { error: validation.error || "ID do episódio no Hikari Player inválido." },
        { status: 400 },
      );
    }

    const fetchPoster = deps?.fetchPoster ?? fetchHikariPlayerEpisodePoster;
    const result = await fetchPoster(validation.value, {
      signal: request.signal,
    });

    if (result.ok) {
      return Response.json({
        id: result.id,
        poster_url: result.posterUrl,
      });
    }

    switch (result.kind) {
      case "invalid_id":
        return Response.json({ error: result.error }, { status: 400 });
      case "not_found":
        return Response.json(
          {
            error: "Episódio não encontrado no Hikari Player.",
            code: "NOT_FOUND",
          },
          { status: 404 },
        );
      case "unavailable":
        return Response.json(
          {
            error: "Integração com o Hikari Player indisponível no servidor.",
            code: "HIKARI_PLAYER_UNAVAILABLE",
          },
          { status: 503 },
        );
      case "timeout":
        return Response.json(
          {
            error: "Tempo esgotado ao consultar o Hikari Player.",
            code: "TIMEOUT",
          },
          { status: 504 },
        );
      case "upstream_auth_error":
        return Response.json(
          {
            error: "Falha de autenticação ao consultar o Hikari Player.",
            code: "UPSTREAM_AUTH_ERROR",
          },
          { status: 502 },
        );
      default:
        return Response.json(
          {
            error: "Não foi possível consultar o Hikari Player.",
            code: "UPSTREAM_ERROR",
          },
          { status: 502 },
        );
    }
  } catch (err) {
    if (err instanceof CrossSiteRequestError) {
      return Response.json(
        { error: "Origem cruzada não permitida." },
        { status: err.status },
      );
    }
    if (err instanceof AdminGuardError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/admin/hikari-player-episode] Erro inesperado:", err);
    return Response.json(
      { error: "Erro interno ao consultar o Hikari Player." },
      { status: 500 },
    );
  }
}

export const Route = createFileRoute("/api/admin/hikari-player-episode/$id")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleGetHikariPlayerEpisode({ request, params }),
    },
  },
});
