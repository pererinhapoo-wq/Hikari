import * as Sentry from "@sentry/tanstackstart-react";

import { sanitizeSentryEvent } from "./sentry-privacy";

const dsn = import.meta.env.VITE_SENTRY_DSN?.trim() || undefined;

if (!Sentry.getClient()) {
  Sentry.init({
    dsn,
    enabled: Boolean(dsn),
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
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
