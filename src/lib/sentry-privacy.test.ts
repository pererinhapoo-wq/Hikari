import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeSentryEvent, scrubString } from "./sentry-privacy.ts";

function makeBaseEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: undefined,
    event_id: "evt_123",
    ...overrides,
  } as Parameters<typeof sanitizeSentryEvent>[0];
}

function sanitizeOrFail(event: Parameters<typeof sanitizeSentryEvent>[0]) {
  const result = sanitizeSentryEvent(event);
  assert.notEqual(result, null);
  if (!result) {
    throw new Error("Expected sanitized event not to be null");
  }
  return result;
}

test("1. arrays com tokens e senhas sao sanitizados", () => {
  const event = makeBaseEvent({
    extra: {
      items: [
        "Bearer secret_token_abc123",
        "Basic dXNlcjpwYXNz",
        "password=minha_senha_secreta",
        "ok-item",
      ],
    },
  });

  const result = sanitizeOrFail(event);
  const items = result.extra?.items as unknown[];
  assert.deepEqual(items, [
    "Bearer [REDACTED]",
    "Basic [REDACTED]",
    "password=[REDACTED]",
    "ok-item",
  ]);
});

test("2. objetos dentro de arrays sao sanitizados", () => {
  const event = makeBaseEvent({
    extra: {
      attempts: [
        {
          token: "tok_999",
          password: "pw_999",
          userId: "user_42",
          email: "ana@example.com",
          step: "retry",
        },
      ],
    },
  });

  const result = sanitizeOrFail(event);
  const attempts = result.extra?.attempts as Array<Record<string, unknown>>;
  assert.equal(attempts[0]?.token, "[REDACTED]");
  assert.equal(attempts[0]?.password, "[REDACTED]");
  assert.equal(attempts[0]?.userId, "[REDACTED]");
  assert.equal(attempts[0]?.email, "[REDACTED]");
  assert.equal(attempts[0]?.step, "retry");
});

test("3. arrays dentro de objetos e estruturas profundamente aninhadas sao sanitizados", () => {
  const event = makeBaseEvent({
    extra: {
      nested: {
        steps: [
          ["rediss://default:pass123@upstash.io:6379", { apiKey: "key_live_1", ok: true }],
        ],
        depthCheck: {
          a: { b: { c: { d: { e: { f: { g: { h: { deepSecret: "should-not-leak" } } } } } } } },
        },
      },
    },
  });

  const result = sanitizeOrFail(event);
  const nested = result.extra?.nested as Record<string, unknown>;
  const list = nested.steps as Array<Array<unknown>>;
  assert.equal(list[0]?.[0], "[REDACTED_CONNECTION_URL]");
  assert.deepEqual(list[0]?.[1], { apiKey: "[REDACTED]", ok: true });
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("should-not-leak"), false);
  assert.equal(serialized.includes("pass123"), false);
  assert.equal(serialized.includes("key_live_1"), false);
});

test("4. JSON serializado com chaves entre aspas duplas, simples ou sem aspas e case-insensitive tem credenciais ocultadas", () => {
  const payloads = [
    'Falha ao validar {"password":"123456","token":"abc123","cookie":"session=abc","api_key":"abc123","connectionString":"postgres://usuario:senha@host/db"}',
    "Payload {'PASS':'s3cr3t','Authorization':'Bearer xyz987654','x-api-key':'k_123','client_secret':'cs_1','private_key':'pk_1','signature':'sig_1','sig':'s1','state':'st_1','session_id':'sid_1'}",
    "Erro JWT=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc NEON=ep-123 UPSTASH=up-123 ip_address=192.168.1.1 email=test@hikari.app",
  ];

  const event = makeBaseEvent({
    message: payloads[0],
    exception: {
      values: [
        { type: "Error", value: payloads[1] },
        { type: "Error", value: payloads[2] },
      ],
    },
  });

  const result = sanitizeOrFail(event);
  assert.equal(
    result.message,
    'Falha ao validar {"password":"[REDACTED]","token":"[REDACTED]","cookie":"[REDACTED]","api_key":"[REDACTED]","connectionString":"[REDACTED]"}',
  );
  const v0 = result.exception?.values?.[0]?.value ?? "";
  const v1 = result.exception?.values?.[1]?.value ?? "";
  for (const secret of [
    "123456",
    "abc123",
    "session=abc",
    "usuario:senha",
    "s3cr3t",
    "xyz987654",
    "k_123",
    "cs_1",
    "pk_1",
    "sig_1",
    "st_1",
    "sid_1",
    "eyJhbGciOiJIUzI1NiJ9",
    "ep-123",
    "up-123",
    "192.168.1.1",
    "test@hikari.app",
  ]) {
    assert.equal(JSON.stringify(result).includes(secret), false, `Secret leaked: ${secret}`);
  }
  assert.equal(v0.startsWith("Payload "), true);
  assert.equal(v1.startsWith("Erro "), true);
});

test("5. URLs PostgreSQL, Neon e Redis com credenciais sao sanitizadas", () => {
  const event = makeBaseEvent({
    message:
      "Erro conectando postgres://admin:superpass@ep-cool.neon.tech/hikari e postgresql://u:p@db.local:5432/app e rediss://default:tok@redis.upstash.io:6379",
  });

  const result = sanitizeOrFail(event);
  assert.equal(
    result.message,
    "Erro conectando [REDACTED_CONNECTION_URL] e [REDACTED_CONNECTION_URL] e [REDACTED_CONNECTION_URL]",
  );
});

test("6. DSNs e URLs com apenas uma chave antes do @ sao sanitizados mantendo URLs publicas intactas", () => {
  const dsnText =
    "Falha ao enviar para https://publicKey123@o450000.ingest.sentry.io/123456 e http://tokenOnly@internal.svc/hook?token=abc";
  const publicUrl = "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1.jpg";
  const handleUrl = "https://hikari.app/@perfil/lista";

  assert.equal(
    scrubString(dsnText),
    "Falha ao enviar para https://[REDACTED]@o450000.ingest.sentry.io/123456 e http://[REDACTED]@internal.svc/hook?token=[REDACTED]",
  );
  assert.equal(scrubString(publicUrl), publicUrl);
  assert.equal(scrubString(handleUrl), handleUrl);
});

test("7. breadcrumbs com argumentos de console nao preservam credenciais", () => {
  const event = makeBaseEvent({
    breadcrumbs: [
      {
        category: "console",
        level: "error",
        message: 'Falha postgres://usuario:senha@host/db {"token":"abc123"}',
        data: {
          logger: "console",
          arguments: [
            "Falha",
            [
              "postgres://usuario:senha@host/db",
              { token: "abc123", password: "senha123", code: "ECONNREFUSED" },
            ],
          ],
        },
      },
      {
        category: "http",
        data: {
          url: "https://api.example.com/auth?code=secret_oauth_code&state=xyz",
          from: "https://hikari.app/login?token=123",
          to: "https://hikari.app/home",
        },
      },
    ],
  });

  const result = sanitizeOrFail(event);
  const consoleCrumb = result.breadcrumbs?.[0];
  assert.equal(consoleCrumb?.message, 'Falha [REDACTED_CONNECTION_URL] {"token":"[REDACTED]"}');
  assert.deepEqual(consoleCrumb?.data, {
    logger: "console",
    arguments: [
      "Falha",
      ["[REDACTED_CONNECTION_URL]", { token: "[REDACTED]", password: "[REDACTED]", code: "ECONNREFUSED" }],
    ],
  });

  const httpCrumb = result.breadcrumbs?.[1];
  assert.deepEqual(httpCrumb?.data, {
    url: "https://api.example.com/auth",
    from: "https://hikari.app/login",
    to: "https://hikari.app/home",
  });
});

test("8. event.extra nao preserva informacoes sensiveis em arrays", () => {
  const event = makeBaseEvent({
    extra: {
      failedPayloads: [
        '{"cookie":"sid=super_secret","refresh_token":"rt_999"}',
        { dsn: "https://abc@sentry.io/1", credential: "cred_1", attempt: 2 },
      ],
    },
  });

  const result = sanitizeOrFail(event);
  assert.deepEqual(result.extra, {
    failedPayloads: [
      '{"cookie":"[REDACTED]","refresh_token":"[REDACTED]"}',
      { dsn: "[REDACTED]", credential: "[REDACTED]", attempt: 2 },
    ],
  });
});

test("9. contexts.node_system_error e demais contexts sao sanitizados preservando metadados seguros", () => {
  const event = makeBaseEvent({
    contexts: {
      runtime: { name: "node", version: "22.23.5" },
      os: { name: "Linux", version: "6.1.0" },
      node_system_error: {
        errno: -111,
        code: "ECONNREFUSED",
        syscall: "connect",
        address: "postgres://user:pass@ep-123.neon.tech/db",
        headers: {
          authorization: "Bearer top_secret_jwt",
          "content-type": "application/json",
        },
      },
    } as Record<string, Record<string, unknown>>,
  });

  const result = sanitizeOrFail(event);
  assert.deepEqual(result.contexts?.runtime, { name: "node", version: "22.23.5" });
  assert.deepEqual(result.contexts?.os, { name: "Linux", version: "6.1.0" });
  assert.deepEqual((result.contexts as Record<string, unknown>).node_system_error, {
    errno: -111,
    code: "ECONNREFUSED",
    syscall: "connect",
    address: "[REDACTED_CONNECTION_URL]",
    headers: {
      authorization: "[REDACTED]",
      "content-type": "application/json",
    },
  });
});

test("10. tags e logentry sao sanitizados", () => {
  const event = makeBaseEvent({
    tags: {
      route: "/anime/123",
      userId: "user_secret_id",
      target: "https://key123@ingest.sentry.io/1",
    },
    logentry: {
      message: "Falha para token=abc123",
      params: ["Bearer my_secret_token", { password: "pw1", region: "gru1" }],
    },
  });

  const result = sanitizeOrFail(event);
  assert.deepEqual(result.tags, {
    route: "/anime/123",
    userId: "[REDACTED]",
    target: "https://[REDACTED]@ingest.sentry.io/1",
  });
  assert.deepEqual(result.logentry, {
    message: "Falha para token=[REDACTED]",
    params: ["Bearer [REDACTED]", { password: "[REDACTED]", region: "gru1" }],
  });
});

test("11. frame.vars e removido de exceptions e threads", () => {
  const event = makeBaseEvent({
    exception: {
      values: [
        {
          type: "TypeError",
          value: "Erro interno",
          stacktrace: {
            frames: [
              {
                filename: "https://hikari.app/assets/app.js?token=leak",
                function: "handleSubmit",
                lineno: 42,
                vars: { password: "123", token: "abc" },
              },
            ],
          },
        },
      ],
    },
    threads: {
      values: [
        {
          id: 1,
          name: "main",
          stacktrace: {
            frames: [
              {
                filename: "/app/src/server.ts",
                function: "runQuery",
                lineno: 10,
                vars: { dbUrl: "postgres://u:p@h/db" },
              },
            ],
          },
        },
      ],
    },
  });

  const result = sanitizeOrFail(event);
  const exFrame = result.exception?.values?.[0]?.stacktrace?.frames?.[0];
  assert.equal("vars" in (exFrame ?? {}), false);
  assert.equal(exFrame?.filename, "https://hikari.app/assets/app.js");
  assert.equal(exFrame?.function, "handleSubmit");
  assert.equal(exFrame?.lineno, 42);

  const threadFrame = result.threads?.values?.[0]?.stacktrace?.frames?.[0];
  assert.equal("vars" in (threadFrame ?? {}), false);
  assert.equal(threadFrame?.filename, "/app/src/server.ts");
  assert.equal(threadFrame?.function, "runQuery");
});

test("12. informacoes tecnicas nao sensiveis continuam preservadas e dados de request/user removidos", () => {
  const event = makeBaseEvent({
    user: { id: "u1", email: "user@hikari.app", ip_address: "1.2.3.4" },
    request: {
      url: "https://hikari.app/browse?genre=action&token=abc",
      method: "GET",
      cookies: { sid: "1" },
      headers: { cookie: "sid=1", authorization: "Bearer 123" },
      data: { password: "123" },
      query_string: "token=abc",
      env: { SENTRY_DSN: "secret" },
    },
    transaction: "GET /browse?token=abc",
    exception: {
      values: [
        {
          type: "FetchError",
          value: "Failed to fetch anime metadata from https://graphql.anilist.co (status 503)",
          stacktrace: {
            frames: [
              {
                filename: "src/lib/api.ts",
                function: "fetchCatalog",
                lineno: 88,
                colno: 12,
                in_app: true,
              },
            ],
          },
        },
      ],
    },
    contexts: {
      app: { app_name: "hikari", app_memory: 1048576 },
      os: { name: "Linux", kernel_version: "6.8.0" },
    },
    tags: { status_code: 503, description: "catalog_timeout", signal: "ABORT" },
  });

  const result = sanitizeOrFail(event);
  assert.equal("user" in result, false);
  assert.deepEqual(result.request, {
    url: "https://hikari.app/browse",
    method: "GET",
  });
  assert.equal(result.transaction, "GET /browse");
  assert.equal(
    result.exception?.values?.[0]?.value,
    "Failed to fetch anime metadata from https://graphql.anilist.co (status 503)",
  );
  assert.deepEqual(result.contexts, {
    app: { app_name: "hikari", app_memory: 1048576 },
    os: { name: "Linux", kernel_version: "6.8.0" },
  });
  assert.deepEqual(result.tags, {
    status_code: 503,
    description: "catalog_timeout",
    signal: "ABORT",
  });
});

test("13. objetos com referencias circulares nao provocam falhas", () => {
  const circularObj: Record<string, unknown> = {
    token: "secret_tok",
    safe: "value",
  };
  circularObj.self = circularObj;
  const circularArr: unknown[] = ["Bearer abc_secret_123"];
  circularArr.push(circularArr);

  const event = makeBaseEvent({
    extra: {
      circularObj,
      circularArr,
    },
  });

  const result = sanitizeOrFail(event);
  assert.deepEqual(result.extra?.circularObj, {
    token: "[REDACTED]",
    safe: "value",
    self: "[Circular]",
  });
  assert.deepEqual(result.extra?.circularArr, ["Bearer [REDACTED]", "[Circular]"]);
});

test("14. objetos congelados nao provocam falhas nem mutacao insegura", () => {
  const frozenCrumb = Object.freeze({
    category: "console",
    message: '{"password":"frozen_pw"}',
    data: Object.freeze({
      arguments: Object.freeze(["postgres://u:p@db/app", Object.freeze({ token: "frozen_tok" })]),
    }),
  });
  const frozenFrame = Object.freeze({
    filename: "https://hikari.app/app.js?token=xyz",
    function: "frozenFn",
    vars: Object.freeze({ secret: "s" }),
  });
  const frozenEvent = Object.freeze({
    type: undefined,
    event_id: "evt_frozen",
    user: Object.freeze({ id: "u1" }),
    request: Object.freeze({
      url: "https://hikari.app/api?code=123",
      headers: Object.freeze({ authorization: "Bearer 123" }),
      cookies: Object.freeze({ sid: "1" }),
    }),
    message: '{"api_key":"frozen_api_key"}',
    breadcrumbs: Object.freeze([frozenCrumb]),
    exception: Object.freeze({
      values: Object.freeze([
        Object.freeze({
          type: "Error",
          value: "Bearer frozen_bearer",
          stacktrace: Object.freeze({
            frames: Object.freeze([frozenFrame]),
          }),
        }),
      ]),
    }),
    contexts: Object.freeze({
      node_system_error: Object.freeze({ code: "EACCES", token: "ctx_tok" }),
    }),
    tags: Object.freeze({ email: "frozen@hikari.app", env: "prod" }),
    extra: Object.freeze({ list: Object.freeze([Object.freeze({ password: "p" })]) }),
  }) as unknown as Parameters<typeof sanitizeSentryEvent>[0];

  const result = sanitizeOrFail(frozenEvent);
  assert.equal("user" in result, false);
  assert.deepEqual(result.request, { url: "https://hikari.app/api" });
  assert.equal(result.message, '{"api_key":"[REDACTED]"}');
  assert.equal(result.exception?.values?.[0]?.value, "Bearer [REDACTED]");
  assert.equal("vars" in (result.exception?.values?.[0]?.stacktrace?.frames?.[0] ?? {}), false);
  assert.equal(
    result.exception?.values?.[0]?.stacktrace?.frames?.[0]?.filename,
    "https://hikari.app/app.js",
  );
  assert.deepEqual(result.breadcrumbs?.[0]?.data, {
    arguments: ["[REDACTED_CONNECTION_URL]", { token: "[REDACTED]" }],
  });
  assert.deepEqual((result.contexts as Record<string, unknown>).node_system_error, {
    code: "EACCES",
    token: "[REDACTED]",
  });
  assert.deepEqual(result.tags, { email: "[REDACTED]", env: "prod" });
  assert.deepEqual(result.extra, { list: [{ password: "[REDACTED]" }] });
});

test("15. excecao inesperada em getter de event.request retorna null sem lançar erro (fail-closed)", () => {
  const faultyEvent = makeBaseEvent({
    user: { id: "u_secret", email: "leak@hikari.app" },
    message: '{"password":"secret_should_not_leak"}',
  });
  Object.defineProperty(faultyEvent, "request", {
    enumerable: true,
    get() {
      throw new Error("Simulated request getter failure");
    },
  });

  let result: ReturnType<typeof sanitizeSentryEvent> | undefined;
  assert.doesNotThrow(() => {
    result = sanitizeSentryEvent(faultyEvent);
  });
  assert.equal(result, null);
  assert.notEqual(result, faultyEvent);
});

test("16. excecao inesperada em getter de event.contexts retorna null sem lançar erro (fail-closed)", () => {
  const faultyContexts: Record<string, unknown> = {};
  Object.defineProperty(faultyContexts, "node_system_error", {
    enumerable: true,
    get() {
      throw new Error("Simulated contexts getter failure");
    },
  });

  const faultyEvent = makeBaseEvent({
    user: { id: "u_secret" },
    contexts: faultyContexts,
  });

  let result: ReturnType<typeof sanitizeSentryEvent> | undefined;
  assert.doesNotThrow(() => {
    result = sanitizeSentryEvent(faultyEvent);
  });
  assert.equal(result, null);
  assert.notEqual(result, faultyEvent);
});

test("17. entrada invalida que nao e objeto retorna null (fail-closed)", () => {
  type Input = Parameters<typeof sanitizeSentryEvent>[0];
  assert.equal(sanitizeSentryEvent(null as unknown as Input), null);
  assert.equal(sanitizeSentryEvent(undefined as unknown as Input), null);
  assert.equal(sanitizeSentryEvent("raw secret string" as unknown as Input), null);
  assert.equal(sanitizeSentryEvent(123 as unknown as Input), null);
});

