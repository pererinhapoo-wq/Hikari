import type * as Sentry from "@sentry/tanstackstart-react";

type SentryEvent = Parameters<NonNullable<Sentry.BrowserOptions["beforeSend"]>>[0];

const MAX_SCRUB_DEPTH = 8;

const SENSITIVE_KEY_TOKEN_RE =
  /(?:^|_)(?:password|passwd|pass|secret|token|jwt|apikey|api_key|authorization|auth|bearer|basic|cookie|cookies|set_cookie|dsn|connection_string|database_url|db_url|neon|upstash|redis|credential|credentials|private_key|email|ip|ip_address|user_id|client_secret|signature|sig|session|session_id|state)(?:$|_)/;

const SENSITIVE_KV_NAMES = [
  "password",
  "passwd",
  "pass",
  "secret",
  "client_secret",
  "clientSecret",
  "token",
  "access_token",
  "accessToken",
  "refresh_token",
  "refreshToken",
  "id_token",
  "idToken",
  "oauth_token",
  "auth_token",
  "authToken",
  "jwt",
  "api_key",
  "apiKey",
  "apikey",
  "x-api-key",
  "authorization",
  "bearer",
  "basic",
  "cookie",
  "set-cookie",
  "dsn",
  "connection_string",
  "connectionString",
  "database_url",
  "databaseUrl",
  "db_url",
  "dbUrl",
  "upstash",
  "neon",
  "redis",
  "credential",
  "credentials",
  "private_key",
  "privateKey",
  "email",
  "ip",
  "ip_address",
  "ipAddress",
  "user_id",
  "userId",
  "session",
  "session_id",
  "sessionId",
  "signature",
  "sig",
  "state",
].join("|");

const CONNECTION_URL_RE =
  /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|rediss?):\/\/[^\s"'`<>]+/gi;

const URL_USERINFO_RE = /(https?:\/\/)[^\s"'`<>/@]+@([^\s"'`<>]+)/gi;

const BEARER_RE = /\b(Bearer)\s+[^\s"'`<>},;]+/gi;

const BASIC_RE =
  /\b(Basic)\s+(?=[A-Za-z0-9+/=._:-]*[0-9=:/+_-]|[A-Za-z0-9+/]{8,}={0,2}\b)[A-Za-z0-9+/=._:-]+/gi;

const QUERY_PARAM_RE = new RegExp(
  `([?&](?:${SENSITIVE_KV_NAMES})=)[^&\\s"'\`<>]+`,
  "gi",
);

const QUOTED_KV_RE = new RegExp(
  `((?:^|[\\s,{([;&])["']?(?:${SENSITIVE_KV_NAMES})["']?\\s*[:=]\\s*)("[^"\\r\\n]*"|'[^'\\r\\n]*')`,
  "gi",
);

const UNQUOTED_KV_RE = new RegExp(
  `((?:^|[\\s,{([;&])["']?(?:${SENSITIVE_KV_NAMES})["']?\\s*[:=]\\s*)(?!["'])[^\\s,;}\\]"')]+`,
  "gi",
);

function isSensitiveKey(key: string): boolean {
  const normalized = key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[.-]+/g, "_")
    .toLowerCase();
  return SENSITIVE_KEY_TOKEN_RE.test(normalized);
}

export function scrubString(value: string): string {
  return value
    .replace(CONNECTION_URL_RE, "[REDACTED_CONNECTION_URL]")
    .replace(URL_USERINFO_RE, "$1[REDACTED]@$2")
    .replace(BEARER_RE, "$1 [REDACTED]")
    .replace(BASIC_RE, "$1 [REDACTED]")
    .replace(QUERY_PARAM_RE, "$1[REDACTED]")
    .replace(QUOTED_KV_RE, (_match, prefix: string, quoted: string) => {
      const quote = quoted[0] === "'" ? "'" : '"';
      return `${prefix}${quote}[REDACTED]${quote}`;
    })
    .replace(UNQUOTED_KV_RE, "$1[REDACTED]");
}

function stripUrlQuery(rawUrl: string): string {
  const withoutHash = rawUrl.split("#", 1)[0] ?? rawUrl;
  const withoutQuery = withoutHash.split("?", 1)[0] ?? withoutHash;
  return scrubString(withoutQuery);
}

function scrubValue(value: unknown, depth = 0, ancestors = new WeakSet<object>()): unknown {
  if (typeof value === "string") {
    return scrubString(value);
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (ancestors.has(value)) {
    return "[Circular]";
  }
  if (depth >= MAX_SCRUB_DEPTH) {
    return "[Truncated]";
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item) => scrubValue(item, depth + 1, ancestors));
    }

    const cleaned: Record<string, unknown> = {};
    let entries: Array<[string, unknown]>;
    try {
      entries = Object.entries(value as Record<string, unknown>);
    } catch {
      return "[Unreadable]";
    }

    for (const [key, val] of entries) {
      if (isSensitiveKey(key)) {
        cleaned[key] = "[REDACTED]";
      } else {
        cleaned[key] = scrubValue(val, depth + 1, ancestors);
      }
    }
    return cleaned;
  } finally {
    ancestors.delete(value);
  }
}

function scrubRecord(
  record: Record<string, unknown>,
  depth = 0,
  ancestors = new WeakSet<object>(),
): Record<string, unknown> {
  const result = scrubValue(record, depth, ancestors);
  return result && typeof result === "object" && !Array.isArray(result)
    ? (result as Record<string, unknown>)
    : {};
}

type SentryStacktrace = NonNullable<
  NonNullable<NonNullable<SentryEvent["exception"]>["values"]>[number]["stacktrace"]
>;

function sanitizeStacktrace(stacktrace: SentryStacktrace): SentryStacktrace {
  if (!Array.isArray(stacktrace.frames)) {
    return { ...stacktrace };
  }
  return {
    ...stacktrace,
    frames: stacktrace.frames.map((frame) => {
      if (!frame || typeof frame !== "object") return frame;
      const nextFrame = { ...frame };
      delete nextFrame.vars;
      if (typeof nextFrame.abs_path === "string") {
        nextFrame.abs_path = /^https?:\/\//i.test(nextFrame.abs_path)
          ? stripUrlQuery(nextFrame.abs_path)
          : scrubString(nextFrame.abs_path);
      }
      if (typeof nextFrame.filename === "string") {
        nextFrame.filename = /^https?:\/\//i.test(nextFrame.filename)
          ? stripUrlQuery(nextFrame.filename)
          : scrubString(nextFrame.filename);
      }
      return nextFrame;
    }),
  };
}

function sanitizeThreadEntry(thread: unknown): unknown {
  if (!thread || typeof thread !== "object") return thread;
  const nextThread = { ...(thread as Record<string, unknown>) };
  if (nextThread.stacktrace && typeof nextThread.stacktrace === "object") {
    nextThread.stacktrace = sanitizeStacktrace(nextThread.stacktrace as SentryStacktrace);
  }
  return nextThread;
}

export function sanitizeSentryEvent<T extends SentryEvent>(event: T): T | null {
  try {
    if (!event || typeof event !== "object") return null;

    const nextEvent: T = { ...event };
    delete nextEvent.user;

    if (nextEvent.request && typeof nextEvent.request === "object") {
      const nextRequest = { ...nextEvent.request };
      delete nextRequest.cookies;
      delete nextRequest.headers;
      delete nextRequest.data;
      delete nextRequest.query_string;
      delete nextRequest.env;
      if (typeof nextRequest.url === "string") {
        nextRequest.url = stripUrlQuery(nextRequest.url);
      }
      nextEvent.request = nextRequest;
    }

    if (typeof nextEvent.transaction === "string") {
      nextEvent.transaction = stripUrlQuery(nextEvent.transaction);
    }

    if (typeof nextEvent.message === "string") {
      nextEvent.message = scrubString(nextEvent.message);
    }

    if (nextEvent.logentry && typeof nextEvent.logentry === "object") {
      const nextLogentry = { ...nextEvent.logentry };
      if (typeof nextLogentry.message === "string") {
        nextLogentry.message = scrubString(nextLogentry.message);
      }
      if (Array.isArray(nextLogentry.params)) {
        nextLogentry.params = nextLogentry.params.map((param) => scrubValue(param));
      }
      nextEvent.logentry = nextLogentry;
    }

    if (nextEvent.exception && typeof nextEvent.exception === "object") {
      const nextException = { ...nextEvent.exception };
      if (Array.isArray(nextException.values)) {
        nextException.values = nextException.values.map((ex) => {
          if (!ex || typeof ex !== "object") return ex;
          const nextEx = { ...ex };
          if (typeof nextEx.value === "string") {
            nextEx.value = scrubString(nextEx.value);
          }
          if (nextEx.stacktrace && typeof nextEx.stacktrace === "object") {
            nextEx.stacktrace = sanitizeStacktrace(nextEx.stacktrace);
          }
          return nextEx;
        });
      }
      nextEvent.exception = nextException;
    }

    const rawThreads = (nextEvent as Record<string, unknown>).threads;
    if (rawThreads && typeof rawThreads === "object") {
      if (Array.isArray(rawThreads)) {
        (nextEvent as Record<string, unknown>).threads = rawThreads.map((entry) => {
          if (entry && typeof entry === "object" && Array.isArray((entry as Record<string, unknown>).values)) {
            return {
              ...(entry as Record<string, unknown>),
              values: ((entry as Record<string, unknown>).values as unknown[]).map(sanitizeThreadEntry),
            };
          }
          return sanitizeThreadEntry(entry);
        });
      } else {
        const nextThreads = { ...(rawThreads as Record<string, unknown>) };
        if (Array.isArray(nextThreads.values)) {
          nextThreads.values = nextThreads.values.map(sanitizeThreadEntry);
        }
        (nextEvent as Record<string, unknown>).threads = nextThreads;
      }
    }

    if (Array.isArray(nextEvent.breadcrumbs)) {
      nextEvent.breadcrumbs = nextEvent.breadcrumbs.map((crumb) => {
        if (!crumb || typeof crumb !== "object") return crumb;
        const nextCrumb = { ...crumb };
        if (typeof nextCrumb.message === "string") {
          nextCrumb.message = scrubString(nextCrumb.message);
        }
        if (nextCrumb.data && typeof nextCrumb.data === "object") {
          const nextData = scrubRecord(nextCrumb.data);
          for (const urlField of ["url", "from", "to"] as const) {
            if (typeof nextData[urlField] === "string") {
              nextData[urlField] = stripUrlQuery(nextData[urlField] as string);
            }
          }
          nextCrumb.data = nextData;
        }
        return nextCrumb;
      });
    }

    if (nextEvent.contexts && typeof nextEvent.contexts === "object") {
      const nextContexts: Record<string, unknown> = {};
      for (const [ctxKey, ctxVal] of Object.entries(nextEvent.contexts)) {
        if (ctxVal && typeof ctxVal === "object") {
          nextContexts[ctxKey] = scrubValue(ctxVal);
        } else if (typeof ctxVal === "string") {
          nextContexts[ctxKey] = scrubString(ctxVal);
        } else {
          nextContexts[ctxKey] = ctxVal;
        }
      }
      nextEvent.contexts = nextContexts as T["contexts"];
    }

    if (nextEvent.tags && typeof nextEvent.tags === "object") {
      nextEvent.tags = scrubRecord(nextEvent.tags as Record<string, unknown>) as T["tags"];
    }

    if (nextEvent.extra && typeof nextEvent.extra === "object") {
      nextEvent.extra = scrubRecord(nextEvent.extra);
    }

    return nextEvent;
  } catch {
    return null;
  }
}
