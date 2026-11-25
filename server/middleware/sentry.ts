import * as Sentry from "@sentry/tanstackstart-react";

import { initSentryServer } from "../../src/lib/sentry-server";

initSentryServer();

export default async function sentryMiddleware(
  _event: unknown,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  initSentryServer();
  try {
    return await next();
  } catch (error) {
    if (!(error instanceof Response)) {
      Sentry.captureException(error);
    }
    throw error;
  }
}
