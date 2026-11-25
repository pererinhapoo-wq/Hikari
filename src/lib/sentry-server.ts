import * as Sentry from "@sentry/tanstackstart-react";

import { sanitizeSentryEvent } from "./sentry-privacy";

let serverInitialized = false;

export function initSentryServer(): void {
  if (serverInitialized || Sentry.getClient()) {
    serverInitialized = true;
    return;
  }

  serverInitialized = true;
  const dsn = process.env.SENTRY_DSN?.trim() || undefined;

  Sentry.init({
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    tracesSampleRate: 0,
    includeServerName: false,
    defaultIntegrations: Sentry.getDefaultIntegrationsWithoutPerformance(),
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
    },
    beforeSend(event) {
      return sanitizeSentryEvent(event);
    },
  });
}
