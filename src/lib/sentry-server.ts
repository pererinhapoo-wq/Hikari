import * as Sentry from "@sentry/tanstackstart-react";

import { sanitizeSentryEvent } from "./sentry-privacy";

const dsn = process.env.SENTRY_DSN?.trim() || undefined;

if (!Sentry.getClient()) {
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
