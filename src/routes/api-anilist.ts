import { createFileRoute } from "@tanstack/react-router";
import { withCache } from "@/lib/api";
import {
  EMPTY_PUBLIC_VISIBILITY_CONTEXT,
  isConfirmedDonghuaOrigin,
  isPubliclyBlockedAnime,
  type VisibilityIndexContext,
} from "@/lib/public-visibility";
import { getServerPublicVisibilityContext } from "@/lib/public-visibility.server";

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

async function resolveSafeProxyVisibilityContext(): Promise<VisibilityIndexContext> {
  try {
    return await getServerPublicVisibilityContext();
  } catch {
    return EMPTY_PUBLIC_VISIBILITY_CONTEXT;
  }
}

const MEDIA_ANCESTOR_KEYS = new Set([
  "media",
  "Media",
  "relations",
  "characterMedia",
  "staffMedia",
  "mediaRecommendation",
]);

function extractOpeningFieldContext(header: string): {
  fieldName: string | null;
  isMediaFragment: boolean;
} {
  const clean = header.trim();
  if (!clean) {
    return { fieldName: null, isMediaFragment: false };
  }

  if (/\bon\s+Media\s*$/i.test(clean)) {
    return { fieldName: "Media", isMediaFragment: true };
  }

  // Remove trailing arguments `(...)` and directives `@...` while scanning from end
  let idx = clean.length - 1;
  while (idx >= 0) {
    while (idx >= 0 && /\s/.test(clean[idx])) idx--;
    if (idx < 0) break;

    if (clean[idx] === ")") {
      let parenDepth = 1;
      idx--;
      let inStr = false;
      while (idx >= 0 && parenDepth > 0) {
        const ch = clean[idx];
        if (ch === '"' && clean[idx - 1] !== "\\") {
          inStr = !inStr;
        } else if (!inStr) {
          if (ch === ")") parenDepth++;
          else if (ch === "(") parenDepth--;
        }
        idx--;
      }
      continue;
    }

    // Check if preceded by a directive `@dirName`
    const beforeDirective = clean.slice(0, idx + 1);
    const dirMatch = /@[A-Za-z_][A-Za-z0-9_]*$/.exec(beforeDirective);
    if (dirMatch) {
      idx -= dirMatch[0].length;
      continue;
    }

    break;
  }

  const head = clean.slice(0, idx + 1).trim();
  const nameMatch = /([A-Za-z_][A-Za-z0-9_]*)$/.exec(head);
  return {
    fieldName: nameMatch ? nameMatch[1] : null,
    isMediaFragment: false,
  };
}

function getDirectChildFieldNames(blockContent: string): Set<string> {
  const names = new Set<string>();
  let depth = 0;
  let i = 0;
  let expectingField = true;

  while (i < blockContent.length) {
    const ch = blockContent[i];
    if (ch === "#") {
      while (i < blockContent.length && blockContent[i] !== "\n") i++;
      continue;
    }
    if (ch === '"') {
      if (blockContent.slice(i, i + 3) === '"""') {
        i += 3;
        while (i < blockContent.length && blockContent.slice(i, i + 3) !== '"""') {
          if (blockContent[i] === "\\") i += 2;
          else i++;
        }
        i += 3;
      } else {
        i++;
        while (i < blockContent.length && blockContent[i] !== '"') {
          if (blockContent[i] === "\\") i += 2;
          else i++;
        }
        i++;
      }
      continue;
    }
    if (ch === "(") {
      let pDepth = 1;
      i++;
      while (i < blockContent.length && pDepth > 0) {
        if (blockContent[i] === '"') {
          i++;
          while (i < blockContent.length && blockContent[i] !== '"') {
            if (blockContent[i] === "\\") i += 2;
            else i++;
          }
          i++;
          continue;
        }
        if (blockContent[i] === "(") pDepth++;
        else if (blockContent[i] === ")") pDepth--;
        i++;
      }
      expectingField = false;
      continue;
    }
    if (ch === "{") {
      depth++;
      expectingField = false;
      i++;
      continue;
    }
    if (ch === "}") {
      depth--;
      if (depth === 0) expectingField = true;
      i++;
      continue;
    }

    if (depth === 0) {
      if (/\s|,/.test(ch)) {
        expectingField = true;
        i++;
        continue;
      }
      if (ch === "@") {
        i++;
        while (i < blockContent.length && /[A-Za-z0-9_]/.test(blockContent[i])) {
          i++;
        }
        expectingField = false;
        continue;
      }
      if (ch === "." && blockContent.slice(i, i + 3) === "...") {
        i += 3;
        while (i < blockContent.length && /\s/.test(blockContent[i])) i++;
        if (blockContent.slice(i, i + 2) === "on" && /\s/.test(blockContent[i + 2] ?? "")) {
          i += 2;
          while (i < blockContent.length && /\s/.test(blockContent[i])) i++;
          while (i < blockContent.length && /[A-Za-z0-9_]/.test(blockContent[i])) i++;
        } else {
          while (i < blockContent.length && /[A-Za-z0-9_]/.test(blockContent[i])) i++;
        }
        expectingField = false;
        continue;
      }
      if (/[A-Za-z_]/.test(ch)) {
        const start = i;
        while (i < blockContent.length && /[A-Za-z0-9_]/.test(blockContent[i])) {
          i++;
        }
        const ident = blockContent.slice(start, i);
        // Check if followed by `:` (alias)
        let j = i;
        while (j < blockContent.length && /\s/.test(blockContent[j])) j++;
        if (blockContent[j] === ":") {
          i = j + 1;
          expectingField = true;
          continue;
        }
        if (expectingField) {
          names.add(ident);
          expectingField = false;
        }
        continue;
      }
      if (ch === ":") {
        expectingField = true;
      }
    }
    i++;
  }

  return names;
}

function findMatchingBraceEnd(source: string, openIdx: number): number {
  let depth = 1;
  let i = openIdx + 1;
  while (i < source.length && depth > 0) {
    const ch = source[i];
    if (ch === "#") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (ch === '"') {
      if (source.slice(i, i + 3) === '"""') {
        i += 3;
        while (i < source.length && source.slice(i, i + 3) !== '"""') {
          if (source[i] === "\\") i += 2;
          else i++;
        }
        i += 3;
      } else {
        i++;
        while (i < source.length && source[i] !== '"') {
          if (source[i] === "\\") i += 2;
          else i++;
        }
        i++;
      }
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    i++;
  }
  return i - 1;
}

/**
 * Injeta `countryOfOrigin` em selection sets GraphQL de `Media` / `media` / `mediaRecommendation`
 * e `node`/`nodes` de conexões de mídia para que o proxy possa detectar Donghua ("CN") mesmo
 * quando o cliente não solicitou o campo explicitamente.
 */
export function injectCountryOfOriginIntoAnilistQuery(query: string): string {
  if (typeof query !== "string" || !query.trim()) return query;
  const trimmedLower = query.trim().toLowerCase();
  if (
    trimmedLower.startsWith("mutation") ||
    /\bviewer\b/i.test(query)
  ) {
    return query;
  }

  const insertions: number[] = [];
  const stack: Array<{ fieldName: string | null }> = [];
  let tokenStart = 0;
  let i = 0;

  while (i < query.length) {
    const ch = query[i];
    if (ch === "#") {
      while (i < query.length && query[i] !== "\n") i++;
      continue;
    }
    if (ch === '"') {
      if (query.slice(i, i + 3) === '"""') {
        i += 3;
        while (i < query.length && query.slice(i, i + 3) !== '"""') {
          if (query[i] === "\\") i += 2;
          else i++;
        }
        i += 3;
      } else {
        i++;
        while (i < query.length && query[i] !== '"') {
          if (query[i] === "\\") i += 2;
          else i++;
        }
        i++;
      }
      continue;
    }
    if (ch === "(") {
      let pDepth = 1;
      i++;
      while (i < query.length && pDepth > 0) {
        if (query[i] === '"') {
          i++;
          while (i < query.length && query[i] !== '"') {
            if (query[i] === "\\") i += 2;
            else i++;
          }
          i++;
          continue;
        }
        if (query[i] === "(") pDepth++;
        else if (query[i] === ")") pDepth--;
        i++;
      }
      continue;
    }
    if (ch === "{") {
      const header = query.slice(tokenStart, i);
      const { fieldName, isMediaFragment } = extractOpeningFieldContext(header);
      const parentField = stack.length > 0 ? stack[stack.length - 1].fieldName : null;
      const grandParentField = stack.length > 1 ? stack[stack.length - 2].fieldName : null;

      const isMediaTargetField =
        isMediaFragment ||
        fieldName === "Media" ||
        fieldName === "media" ||
        fieldName === "mediaRecommendation" ||
        (fieldName === "nodes" && Boolean(parentField && MEDIA_ANCESTOR_KEYS.has(parentField))) ||
        (fieldName === "node" &&
          parentField === "edges" &&
          Boolean(grandParentField && MEDIA_ANCESTOR_KEYS.has(grandParentField)));

      if (isMediaTargetField) {
        const closeIdx = findMatchingBraceEnd(query, i);
        if (closeIdx > i) {
          const inner = query.slice(i + 1, closeIdx);
          const directFields = getDirectChildFieldNames(inner);
          const isConnectionBlock =
            directFields.has("edges") ||
            directFields.has("nodes") ||
            directFields.has("pageInfo");
          if (!isConnectionBlock && !directFields.has("countryOfOrigin")) {
            insertions.push(i + 1);
          }
        }
      }

      stack.push({ fieldName });
      tokenStart = i + 1;
      i++;
      continue;
    }
    if (ch === "}") {
      stack.pop();
      tokenStart = i + 1;
      i++;
      continue;
    }
    if (ch === "\n" || ch === ",") {
      tokenStart = i + 1;
    }
    i++;
  }

  if (insertions.length === 0) return query;

  let out = "";
  let prev = 0;
  for (const pos of insertions) {
    out += query.slice(prev, pos) + " countryOfOrigin ";
    prev = pos;
  }
  out += query.slice(prev);
  return out;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isMediaObjectCandidate(
  obj: Record<string, unknown>,
  keyHint?: string,
): boolean {
  if ("edges" in obj || "nodes" in obj || "pageInfo" in obj) return false;
  if ("airingSchedules" in obj || "media" in obj) return false;
  if (
    "countryOfOrigin" in obj ||
    "idMal" in obj ||
    "title" in obj ||
    "coverImage" in obj ||
    "format" in obj ||
    "episodes" in obj ||
    "seasonYear" in obj ||
    "bannerImage" in obj
  ) {
    return true;
  }
  return (
    keyHint === "Media" ||
    keyHint === "media" ||
    keyHint === "mediaRecommendation"
  );
}

function isBlockedAniListMedia(
  media: unknown,
  visCtx: VisibilityIndexContext,
): boolean {
  if (!isPlainObject(media)) return false;
  if (isConfirmedDonghuaOrigin(media.countryOfOrigin)) {
    return true;
  }
  const rawId =
    typeof media.id === "number" || typeof media.id === "string"
      ? media.id
      : undefined;
  const rawIdMal =
    typeof media.idMal === "number" ? media.idMal : undefined;

  if (rawId === undefined && rawIdMal === undefined) {
    return false;
  }

  return isPubliclyBlockedAnime(
    {
      id: rawId,
      anilistId: typeof media.id === "number" ? media.id : undefined,
      idMal: rawIdMal,
      countryOfOrigin:
        typeof media.countryOfOrigin === "string"
          ? media.countryOfOrigin
          : null,
    },
    visCtx,
  );
}

function sanitizeMediaConnection(
  conn: unknown,
  visCtx: VisibilityIndexContext,
): unknown {
  if (!isPlainObject(conn)) return conn;
  const next: Record<string, unknown> = { ...conn };
  if (Array.isArray(next.nodes)) {
    next.nodes = next.nodes
      .filter((node) => !isBlockedAniListMedia(node, visCtx))
      .map((node) => sanitizeAniListValue(node, visCtx, "media"));
  }
  if (Array.isArray(next.edges)) {
    next.edges = next.edges
      .filter((edge) => {
        if (!isPlainObject(edge)) return true;
        return !isBlockedAniListMedia(edge.node, visCtx);
      })
      .map((edge) => {
        if (!isPlainObject(edge)) return edge;
        return {
          ...edge,
          node: sanitizeAniListValue(edge.node, visCtx, "media"),
        };
      });
  }
  return next;
}

function sanitizeRecommendationsContainer(
  rec: unknown,
  visCtx: VisibilityIndexContext,
): unknown {
  if (!isPlainObject(rec)) return rec;
  const next: Record<string, unknown> = { ...rec };
  if (Array.isArray(next.nodes)) {
    next.nodes = next.nodes
      .filter((item) => {
        if (!isPlainObject(item)) return true;
        if (isBlockedAniListMedia(item.mediaRecommendation, visCtx)) return false;
        if (isBlockedAniListMedia(item.media, visCtx)) return false;
        return true;
      })
      .map((item) => sanitizeAniListValue(item, visCtx));
  }
  if (Array.isArray(next.edges)) {
    next.edges = next.edges
      .filter((edge) => {
        if (!isPlainObject(edge) || !isPlainObject(edge.node)) return true;
        if (isBlockedAniListMedia(edge.node.mediaRecommendation, visCtx)) {
          return false;
        }
        if (isBlockedAniListMedia(edge.node.media, visCtx)) return false;
        return true;
      })
      .map((edge) => sanitizeAniListValue(edge, visCtx));
  }
  return next;
}

function sanitizeAniListValue(
  value: unknown,
  visCtx: VisibilityIndexContext,
  keyHint?: string,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAniListValue(item, visCtx, keyHint));
  }
  if (!isPlainObject(value)) {
    return value;
  }

  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (k === "media" && Array.isArray(v)) {
      next[k] = v
        .filter((item) => !isBlockedAniListMedia(item, visCtx))
        .map((item) => sanitizeAniListValue(item, visCtx, "media"));
      continue;
    }

    if (k === "airingSchedules" && Array.isArray(v)) {
      next[k] = v
        .filter((entry) => {
          if (!isPlainObject(entry)) return true;
          return !isBlockedAniListMedia(entry.media, visCtx);
        })
        .map((entry) => sanitizeAniListValue(entry, visCtx));
      continue;
    }

    if (
      (k === "relations" ||
        k === "characterMedia" ||
        k === "staffMedia" ||
        (k === "media" && isPlainObject(v) && ("nodes" in v || "edges" in v))) &&
      isPlainObject(v)
    ) {
      next[k] = sanitizeMediaConnection(v, visCtx);
      continue;
    }

    if (k === "recommendations" && isPlainObject(v)) {
      next[k] = sanitizeRecommendationsContainer(v, visCtx);
      continue;
    }

    if (
      (k === "media" || k === "mediaRecommendation" || k === "Media") &&
      isPlainObject(v) &&
      isMediaObjectCandidate(v, k)
    ) {
      if (isBlockedAniListMedia(v, visCtx)) {
        next[k] = null;
      } else {
        next[k] = sanitizeAniListValue(v, visCtx, k);
      }
      continue;
    }

    if (
      keyHint === "data" &&
      isPlainObject(v) &&
      isMediaObjectCandidate(v, k)
    ) {
      if (isBlockedAniListMedia(v, visCtx)) {
        next[k] = null;
      } else {
        next[k] = sanitizeAniListValue(v, visCtx, k);
      }
      continue;
    }

    next[k] = sanitizeAniListValue(v, visCtx, k);
  }

  return next;
}

/**
 * Remove qualquer anime bloqueado (CN ou um dos 22 IDs AniList, além de aliases/duplicatas
 * resolvidos no catálogo local) de respostas do proxy `/api-anilist`.
 */
export function filterAnilistProxyPayload(
  payload: unknown,
  visCtx: VisibilityIndexContext = EMPTY_PUBLIC_VISIBILITY_CONTEXT,
): unknown {
  if (!isPlainObject(payload)) return payload;
  if (!("data" in payload) || payload.data == null) return payload;
  return {
    ...payload,
    data: sanitizeAniListValue(payload.data, visCtx, "data"),
  };
}

function filterProxyResultBody(
  result: ProxyResult,
  visCtx: VisibilityIndexContext,
): ProxyResult {
  if (!result.body || result.status >= 400) return result;
  try {
    const parsed = JSON.parse(result.body);
    const filtered = filterAnilistProxyPayload(parsed, visCtx);
    return {
      ...result,
      body: JSON.stringify(filtered),
    };
  } catch {
    return result;
  }
}

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
      const isPublicBypass = !authHeader || authHeader.trim().length === 0;
      const effectiveQuery = isPublicBypass
        ? injectCountryOfOriginIntoAnilistQuery(query)
        : queryPayload.query;
      const result = await executeAniListFetch(
        { ...queryPayload, query: effectiveQuery },
        authHeader,
      );
      const finalResult = isPublicBypass
        ? filterProxyResultBody(result, await resolveSafeProxyVisibilityContext())
        : result;
      return new Response(finalResult.body, {
        status: finalResult.status,
        headers: {
          "Content-Type": finalResult.contentType,
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    const effectiveQuery = injectCountryOfOriginIntoAnilistQuery(query);
    const effectivePayload = {
      ...queryPayload,
      query: effectiveQuery,
    };

    // Consulta pública: utiliza cache integrado da Etapa 1A (Singleflight, SWR, LRU)
    const isCalendar = effectiveQuery.includes("airingSchedules");
    const prefix = isCalendar ? "calendar:proxy" : "proxy-anilist";
    const cacheKey = `${prefix}:${hashQuery(effectiveQuery, queryPayload.variables)}`;

    const result = await withCache<ProxyResult>(
      cacheKey,
      async () => {
        const fresh = await executeAniListFetch(effectivePayload, authHeader);
        if (fresh.hasErrors || fresh.status >= 400) {
          throw new Error(
            `AniList retornou status ${fresh.status} com erros`,
          );
        }
        const visCtx = await resolveSafeProxyVisibilityContext();
        return filterProxyResultBody(fresh, visCtx);
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

    const liveVisCtx = await resolveSafeProxyVisibilityContext();
    const filteredResult = filterProxyResultBody(result, liveVisCtx);

    return new Response(filteredResult.body, {
      status: filteredResult.status,
      headers: {
        "Content-Type": filteredResult.contentType,
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
