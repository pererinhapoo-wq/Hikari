import * as Sentry from "@sentry/tanstackstart-react";

import "../../src/lib/sentry-server";

export default async function sentryMiddleware(
  _event: unknown,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  try {
    return await next();
  } catch (error) {
    if (!(error instanceof Response)) {
      Sentry.captureException(error);
    }
    throw error;
  }
}
