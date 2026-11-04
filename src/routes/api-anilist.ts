import { createFileRoute } from "@tanstack/react-router";
import { withCache } from "@/lib/api";

const ANILIST_GRAPHQL_URL = "https://graphql.anilist.co";
const TIMEOUT_MS = 10000; // Timeout de 10 segundos para chamadas externas
const MAX_CONCURRENT_CALLS = 8; // Limite de concorrência para o AniList
const MAX_QUEUE_LENGTH = 30; // Limite da fila de espera para evitar acúmulo descontrolado

/* =========================================================
   LIMITADOR DE CONCORRÊNCIA (SEMAPHORE COM FILA LIMITADA)
========================================================= */

export class ConcurrencyLimiter {
  private activeCount = 0;
  private readonly maxConcurrent: number;
  private readonly maxQueueLength: number;
  private queue: Array<{
    resolve: () => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];

  constructor(
    maxConcurrent = MAX_CONCURRENT_CALLS,
    maxQueueLength = MAX_QUEUE_LENGTH,
  ) {
    this.maxConcurrent = maxConcurrent;
    this.maxQueueLength = maxQueueLength;
  }

  async acquire(timeoutMs = TIMEOUT_MS): Promise<() => void> {
    if (this.activeCount < this.maxConcurrent) {
      this.activeCount++;
      return () => this.release();
    }

    if (this.queue.length >= this.maxQueueLength) {
      throw new Error("RATE_LIMIT_QUEUE_FULL");
    }

    return new Promise<() => void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.queue.findIndex((item) => item.timer === timer);
        if (idx !== -1) {
          this.queue.splice(idx, 1);
          reject(new Error("QUEUE_TIMEOUT"));
        }
      }, timeoutMs);

      this.queue.push({
        resolve: () => {
          clearTimeout(timer);
          resolve(() => this.release());
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
        timer,
      });
    });
  }

  private release(): void {
    this.activeCount--;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        this.activeCount++;
        next.resolve();
      }
    }
  }

  get stats() {
    return {
      active: this.activeCount,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent,
      maxQueue: this.maxQueueLength,
    };
  }
}

export const anilistLimiter = new ConcurrencyLimiter(
  MAX_CONCURRENT_CALLS,
  MAX_QUEUE_LENGTH,
);

/* =========================================================
   UTILITÁRIOS DE SEGURANÇA E CACHE
========================================================= */

function canonicalize(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map(canonicalize).join(",")}]`;
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize((obj as Record<string, unknown>)[k])}`).join(",")}}`;
}

/**
 * Gera um hash determinístico e compacto a partir da query e variáveis GraphQL.
 * Normaliza pontuação e espaçamentos no GraphQL para evitar chaves duplicadas.
 */
export function hashQuery(
  query: string,
  variables?: Record<string, unknown> | null,
): string {
  const normQuery = query
    .replace(/\s+/g, " ")
    .replace(/\s*([(){}:,])\s*/g, "$1")
    .trim();
  const normVars = variables ? canonicalize(variables) : "";
  const combined = `${normQuery}::${normVars}`;

  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c64e6d ^ 0;
  for (let i = 0; i < combined.length; i++) {
    const ch = combined.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Determina se a consulta é estritamente pública e segura para cache compartilhado.
 * Não armazena consultas autenticadas, mutações ou campos privados (ex: Viewer).
 */
export function isQueryCacheable(
  query: string,
  authHeader: string | null,
): boolean {
  // Se contiver token de autorização, a resposta pode ser privada do usuário
  if (authHeader && authHeader.trim().length > 0) {
    return false;
  }

  const clean = query.trim().toLowerCase();

  // Mutações alteram dados no AniList; nunca devem ser cacheadas
  if (clean.startsWith("mutation") || clean.includes("mutation ")) {
    return false;
  }

  // Consultas sobre perfil de usuário logado (Viewer no AniList)
  if (
    clean.includes("viewer") ||
    clean.includes("viewer {") ||
    clean.includes("viewer{")
  ) {
    return false;
  }

  return true;
}

export type ProxyResult = {
  status: number;
  body: string;
  contentType: string;
  hasErrors: boolean;
};

/**
 * Executa a chamada externa ao AniList com proteção de concorrência e timeout de 10s.
 */
export async function executeAniListFetch(
  body: { query: string; variables?: Record<string, unknown> },
  authHeader: string | null,
): Promise<ProxyResult> {
  const release = await anilistLimiter.acquire(TIMEOUT_MS);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(
      new Error("Tempo limite de 10 segundos excedido ao consultar o AniList"),
    );
  }, TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent":
        "Hikari/1.0 (anime streaming platform; +https://hikari.app)",
    };

    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    const res = await fetch(ANILIST_GRAPHQL_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();
    let hasErrors = !res.ok;

    try {
      const parsed = JSON.parse(text);
      if (
        parsed.errors &&
        Array.isArray(parsed.errors) &&
        parsed.errors.length > 0
      ) {
        hasErrors = true;
      }
    } catch {
      hasErrors = true;
    }

    return {
      status: res.status,
      body: text,
      contentType: res.headers.get("content-type") ?? "application/json",
      hasErrors,
    };
  } finally {
    clearTimeout(timeoutId);
    release();
  }
}

/**
 * Processa requisições ao proxy com validação, cache SWR, singleflight e proteção contra erros.
 */
export async function handleProxyRequest(
  request: Request,
  queryPayload: {
    query: string;
    variables?: Record<string, unknown>;
  } | null,
): Promise<Response> {
  if (
    !queryPayload ||
    typeof queryPayload !== "object" ||
    typeof queryPayload.query !== "string"
  ) {
    return Response.json(
      {
        errors: [
          {
            message:
              "Corpo da requisição inválido. Campo 'query' é obrigatório.",
          },
        ],
        error: "Bad Request",
      },
      { status: 400 },
    );
  }

  const query = queryPayload.query.trim();
  if (!query) {
    return Response.json(
      {
        errors: [{ message: "O campo 'query' não pode estar vazio." }],
        error: "Bad Request",
      },
      { status: 400 },
    );
  }

  const authHeader = request.headers.get("authorization");
  const canCache = isQueryCacheable(query, authHeader);

  try {
    if (!canCache) {
      // Consulta privada ou mutação: bypass de cache com controle de concorrência e timeout
      const result = await executeAniListFetch(queryPayload, authHeader);
      return new Response(result.body, {
        status: result.status,
        headers: {
          "Content-Type": result.contentType,
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    // Consulta pública: utiliza cache integrado da Etapa 1A (Singleflight, SWR, LRU)
    const isCalendar = query.includes("airingSchedules");
    const prefix = isCalendar ? "calendar:proxy" : "proxy-anilist";
    const cacheKey = `${prefix}:${hashQuery(query, queryPayload.variables)}`;

    const result = await withCache<ProxyResult>(
      cacheKey,
      async () => {
        const fresh = await executeAniListFetch(queryPayload, authHeader);
        if (fresh.hasErrors || fresh.status >= 400) {
          throw new Error(
            `AniList retornou status ${fresh.status} com erros`,
          );
        }
        return fresh;
      },
      {
        freshTtl: isCalendar ? 15 * 60 * 1000 : 5 * 60 * 1000,
        swrWindow: isCalendar ? 3 * 60 * 60 * 1000 : 60 * 60 * 1000,
        shouldCache: (data) => {
          // NUNCA armazena respostas com erros no cache
          if (!data || data.hasErrors || data.status >= 400) {
            return false;
          }
          return true;
        },
      },
    );

    return new Response(result.body, {
      status: result.status,
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": isCalendar
          ? "public, max-age=900, s-maxage=900, stale-while-revalidate=10800"
          : "public, max-age=300, s-maxage=300, stale-while-revalidate=3600",
      },
    });
  } catch (err: unknown) {
    const errorObj =
      err instanceof Error ? err : new Error(String(err));
    const isAbort =
      errorObj.name === "AbortError" ||
      errorObj.message.includes("Tempo limite") ||
      errorObj.message.includes("Timeout") ||
      errorObj.message.includes("aborted");

    const isRateLimit =
      errorObj.message === "RATE_LIMIT_QUEUE_FULL" ||
      errorObj.message === "QUEUE_TIMEOUT";

    if (isAbort) {
      return Response.json(
        {
          errors: [
            {
              message:
                "Tempo limite de 10 segundos excedido ao consultar o AniList.",
            },
          ],
          error: "Gateway Timeout (10s)",
        },
        { status: 504 },
      );
    }

    if (isRateLimit) {
      return Response.json(
        {
          errors: [
            {
              message:
                "Muitas requisições simultâneas ao AniList. Tente novamente em instantes.",
            },
          ],
          error: "Too Many Requests",
        },
        { status: 429 },
      );
    }

    return Response.json(
      {
        errors: [
          {
            message:
              errorObj.message ||
              "Erro de conexão ao acessar a API do AniList",
          },
        ],
        error: errorObj.message || "Erro ao acessar AniList",
      },
      { status: 502 },
    );
  }
}

/* =========================================================
   ROTA DO ENDPOINT /api-anilist
========================================================= */

export const Route = createFileRoute("/api-anilist")({
  server: {
    handlers: {
      OPTIONS: async () => {
        return new Response(null, {
          status: 204,
          headers: {
            Allow: "GET, POST, OPTIONS",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        });
      },
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const query = url.searchParams.get("query");
          if (!query) {
            return Response.json(
              {
                errors: [
                  { message: "Parâmetro 'query' ausente na URL." },
                ],
                error: "Bad Request",
              },
              { status: 400 },
            );
          }
          const rawVars = url.searchParams.get("variables");
          let variables: Record<string, unknown> | undefined;
          if (rawVars) {
            try {
              variables = JSON.parse(rawVars);
            } catch {
              return Response.json(
                {
                  errors: [
                    {
                      message:
                        "Formato de 'variables' inválido (JSON esperado).",
                    },
                  ],
                  error: "Bad Request",
                },
                { status: 400 },
              );
            }
          }
          return await handleProxyRequest(request, {
            query,
            variables,
          });
        } catch (err) {
          return Response.json(
            {
              errors: [
                { message: "Erro ao processar requisição GET." },
              ],
              error:
                err instanceof Error ? err.message : "Internal Error",
            },
            { status: 500 },
          );
        }
      },
      POST: async ({ request }) => {
        try {
          let body: any;
          try {
            body = await request.json();
          } catch {
            return Response.json(
              {
                errors: [
                  { message: "JSON inválido no corpo da requisição." },
                ],
                error: "Bad Request",
              },
              { status: 400 },
            );
          }
          return await handleProxyRequest(request, body);
        } catch (err) {
          return Response.json(
            {
              errors: [
                { message: "Erro ao processar requisição POST." },
              ],
              error:
                err instanceof Error ? err.message : "Internal Error",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
