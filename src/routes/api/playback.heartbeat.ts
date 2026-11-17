import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { resolveApiUser } from "@/lib/auth/api-session";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { executeHeartbeatEpisodeProgress } from "@/lib/profile-playback.functions";
import { heartbeatEpisodeProgressSchema } from "@/types/profile-playback";

export const Route = createFileRoute("/api/playback/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          assertSameSiteRequest();
          const sql = await getSql();
          const apiUser = await resolveApiUser(request, sql);
          if (!apiUser?.id) {
            return Response.json(
              { error: "Unauthorized" },
              { status: 401 }
            );
          }

          let body: unknown;
          try {
            body = await request.json();
          } catch {
            return Response.json(
              { error: "Invalid JSON" },
              { status: 400 }
            );
          }

          const parsed = heartbeatEpisodeProgressSchema.safeParse(body);
          if (!parsed.success) {
            return Response.json(
              { error: "Invalid request payload", details: parsed.error.format() },
              { status: 400 }
            );
          }

          const result = await executeHeartbeatEpisodeProgress(apiUser.id, parsed.data);
          return Response.json(result);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Internal error";
          const status = (err as { status?: number })?.status || 500;
          return Response.json(
            { error: message },
            { status }
          );
        }
      },
    },
  },
});
