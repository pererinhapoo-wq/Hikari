import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { assertSameSiteRequest, CrossSiteRequestError } from "@/lib/auth/isolation.server";
import { requireAdminUser, AdminGuardError } from "@/lib/auth/admin-guard";
import { getRedisClient } from "@/lib/redis";

const querySchema = z.object({
  q: z.string().trim().min(1, "Termo de busca obrigatório").max(128, "Termo muito longo"),
});

export const Route = createFileRoute("/api/admin/kitsu-image-search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          assertSameSiteRequest();
          const adminId = await requireAdminUser(request);

          const url = new URL(request.url);
          const rawQ = url.searchParams.get("q") ?? "";
          const parsed = querySchema.safeParse({ q: rawQ });

          if (!parsed.success) {
            return Response.json({ error: parsed.error.issues[0]?.message || "Termo inválido." }, { status: 400 });
          }

          const q = parsed.data.q;
          const cacheKey = `hikari:admin:kitsu-search:v1:${q.toLowerCase()}`;
          const redis = getRedisClient();

          if (redis) {
            try {
              const cached = await redis.get<any>(cacheKey);
              if (cached) {
                return Response.json({ ok: true, source: "cache", items: cached });
              }
            } catch (err) {
              console.warn("[kitsu-image-search] Redis cache read error:", err);
            }
          }

          const kitsuUrl = `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(q)}&page[limit]=6`;
          const res = await fetch(kitsuUrl, {
            headers: {
              Accept: "application/vnd.api+json",
              "Content-Type": "application/vnd.api+json",
              "User-Agent": "Hikari/1.0 (Admin Kitsu Image Search)",
            },
          });

          if (!res.ok) {
            return Response.json({ error: `Erro ao consultar Kitsu API (${res.status})` }, { status: 502 });
          }

          const json = (await res.json()) as {
            data?: Array<{
              id: string;
              attributes?: {
                canonicalTitle?: string;
                titles?: Record<string, string>;
                posterImage?: { original?: string; large?: string; medium?: string; small?: string };
                coverImage?: { original?: string; large?: string; small?: string };
              };
            }>;
          };

          const items: Array<{
            id: string;
            title: string;
            coverUrl: string | null;
            bannerUrl: string | null;
          }> = [];

          for (const entry of json.data ?? []) {
            const attr = entry.attributes;
            if (!attr) continue;
            const title = attr.canonicalTitle || Object.values(attr.titles || {})[0] || `Anime #${entry.id}`;
            const coverUrl = attr.posterImage?.original || attr.posterImage?.large || attr.posterImage?.medium || attr.posterImage?.small || null;
            const bannerUrl = attr.coverImage?.original || attr.coverImage?.large || attr.coverImage?.small || null;

            if (coverUrl || bannerUrl) {
              items.push({
                id: entry.id,
                title,
                coverUrl,
                bannerUrl,
              });
            }
          }

          if (redis) {
            try {
              await redis.set(cacheKey, items, { ex: 86400 }); // cache 24h
            } catch (err) {
              console.warn("[kitsu-image-search] Redis cache write error:", err);
            }
          }

          return Response.json({ ok: true, source: "kitsu", items, adminId });
        } catch (err) {
          if (err instanceof CrossSiteRequestError) {
            return Response.json({ error: "Origem cruzada não permitida." }, { status: err.status });
          }
          if (err instanceof AdminGuardError) {
            return Response.json({ error: err.message }, { status: err.status });
          }
          console.error("[api/admin/kitsu-image-search] Erro:", err);
          return Response.json({ error: "Erro interno ao buscar imagens no Kitsu." }, { status: 500 });
        }
      },
    },
  },
});
