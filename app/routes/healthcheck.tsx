import type { Route } from "./+types/healthcheck";

import { requestLoggerContext } from "~/features/auth/middleware.server";
import { pingDatabase } from "~/models/health.server";

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const logger = context.get(requestLoggerContext);
  const host =
    request.headers.get("X-Forwarded-Host") ?? request.headers.get("host");

  try {
    const url = new URL("/", `http://${host}`);
    await Promise.all([
      pingDatabase(),
      fetch(url.toString(), { method: "HEAD" }).then((r) => {
        if (!r.ok) return Promise.reject(r);
      }),
    ]);
    return new Response("OK");
  } catch (error: unknown) {
    logger.error({ error }, "Healthcheck failed");
    return new Response("ERROR", { status: 500 });
  }
};
