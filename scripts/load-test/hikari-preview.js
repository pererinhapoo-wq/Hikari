import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import exec from "k6/execution";

/**
 * HIKARI PRINCIPAL — Script k6 OSS (Etapa 1: máximo 10 VUs)
 * Repositório: pererinhapoo-wq/Hikari | Branch: main
 * Ambiente permitido: exclusivamente deployment Preview da Vercel.
 *
 * IMPORTANTE:
 * - Este script prepara APENAS a Etapa 1 (ramp-up 15s -> platô 60s em 10 VUs).
 * - Não possui execução automática para etapas posteriores (25..500 VUs).
 * - Exige BASE_URL apontando estritamente para um hostname de Preview da Vercel.
 */

const MAX_VUS_ETAPA_1 = 10;

const FORBIDDEN_HOST_EXACT = new Set([
  "grokhikari.vercel.app",
  "www.grokhikari.vercel.app",
  "hikari.vercel.app",
  "www.hikari.vercel.app",
  "hikaritv.cc.cd",
  "www.hikaritv.cc.cd",
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
]);

const FORBIDDEN_HOST_PATTERNS = [
  /(^|\.)grokhikari\.vercel\.app$/i,
  /(^|\.)hikaritv\.cc\.cd$/i,
  /(^|[.-])(player|hikari-player|hikariplayer)([.-]|$)/i,
  /(^|[.-])(prod|production)([.-]|$)/i,
  /\.run\.app$/i,
  /\.grok-sandbox\.com$/i,
];

function validateAndNormalizePreviewBaseUrl(rawBaseUrl) {
  if (typeof rawBaseUrl !== "string" || !rawBaseUrl.trim()) {
    throw new Error(
      "[BLOQUEADO] A variável de ambiente BASE_URL é obrigatória. " +
        "Informe o endereço exato do Preview da Vercel (ex.: BASE_URL=https://<deployment-preview>.vercel.app).",
    );
  }

  const trimmed = rawBaseUrl.trim().replace(/\/+$/, "");

  if (trimmed.includes("@") || trimmed.includes("?") || trimmed.includes("#")) {
    throw new Error(
      "[BLOQUEADO] BASE_URL não deve conter credenciais embutidas, query string ou fragmento.",
    );
  }

  const match = trimmed.match(/^(https?):\/\/([^/:?#]+)(?::(\d+))?(\/.*)?$/i);
  if (!match) {
    throw new Error(
      `[BLOQUEADO] BASE_URL inválida: "${trimmed}". Esperado formato https://<preview-deployment>.vercel.app`,
    );
  }

  const protocol = match[1].toLowerCase();
  const hostname = match[2].toLowerCase();
  const port = match[3] || "";
  const extraPath = match[4] || "";

  if (protocol !== "https") {
    throw new Error(
      `[BLOQUEADO] Protocolo "${protocol}" rejeitado. Apenas HTTPS é permitido.`,
    );
  }

  if (port && port !== "443") {
    throw new Error(
      `[BLOQUEADO] Porta customizada ":${port}" rejeitada para evitar alvos não autorizados.`,
    );
  }

  if (extraPath && extraPath !== "/") {
    throw new Error(
      `[BLOQUEADO] BASE_URL deve conter apenas origem (https://host), sem path ("${extraPath}").`,
    );
  }

  if (FORBIDDEN_HOST_EXACT.has(hostname)) {
    throw new Error(
      `[BLOQUEADO] Hostname "${hostname}" pertence a lista proibida (Produção/local). Execução interrompida.`,
    );
  }

  for (const pattern of FORBIDDEN_HOST_PATTERNS) {
    if (pattern.test(hostname)) {
      throw new Error(
        `[BLOQUEADO] Hostname "${hostname}" corresponde a padrão proibido (${pattern}). Execução interrompida.`,
      );
    }
  }

  if (!hostname.endsWith(".vercel.app")) {
    throw new Error(
      `[BLOQUEADO] Hostname "${hostname}" não é um domínio "*.vercel.app" de deployment Preview.`,
    );
  }

  // Deployments Preview da Vercel seguem o formato "<projeto>-<hash/git>-<escopo>.vercel.app"
  // (ao menos 3 segmentos separados por hífen antes de .vercel.app).
  // Aliases curtos como "meuapp.vercel.app" são rejeitados para não atingir Produção por engano.
  const subdomain = hostname.slice(0, -".vercel.app".length);
  const hyphenParts = subdomain.split("-").filter(Boolean);
  if (hyphenParts.length < 3) {
    throw new Error(
      `[BLOQUEADO] Hostname "${hostname}" parece um alias curto/produção e não um deployment Preview verificável da Vercel. ` +
        "Confirme a URL exata do deployment Preview no painel da Vercel antes de prosseguir.",
    );
  }

  return `https://${hostname}`;
}

function assertStage1VuLimit() {
  const requestedVus = Number(__ENV.VUS || __ENV.K6_VUS || 0);
  if (Number.isFinite(requestedVus) && requestedVus > MAX_VUS_ETAPA_1) {
    throw new Error(
      `[BLOQUEADO] Esta versão do script é limitada exclusivamente à Etapa 1 (máximo ${MAX_VUS_ETAPA_1} VUs).`,
    );
  }
}

assertStage1VuLimit();
const BASE_URL = validateAndNormalizePreviewBaseUrl(__ENV.BASE_URL);
const PREVIEW_HOST = BASE_URL.replace(/^https:\/\//i, "").toLowerCase();

/**
 * Identificadores reais extraídos do catálogo fallback e mapeamentos do projeto
 * (src/lib/fallback-catalog.ts e src/lib/anime-logos.ts).
 * Lista fixa e enxuta para evitar rajadas de cache-miss contra AniList/Jikan/Kitsu.
 */
const REAL_ANIME_IDS = [
  "16498", // Shingeki no Kyojin / Attack on Titan
  "101922", // Kimetsu no Yaiba / Demon Slayer
  "113415", // Jujutsu Kaisen
  "154587", // Sousou no Frieren
  "21", // One Piece
  "5114", // Fullmetal Alchemist: Brotherhood
];

/**
 * Termos reais presentes em src/lib/anime-search-ranking.ts e src/lib/fallback-catalog.ts.
 * Conjunto fixo para não gerar combinações aleatórias na busca.
 */
const REAL_SEARCH_TERMS = [
  "naruto",
  "one piece",
  "jujutsu kaisen",
  "kimetsu",
  "frieren",
  "death note",
];

/**
 * Rotas reais do catálogo Browse verificadas em src/routes/browse.$section.tsx.
 */
const BROWSE_PATHS = [
  "/browse/trending",
  "/browse/popular",
  "/browse/season",
  "/browse/genres",
];

/**
 * Paginação real verificada em src/routes/episodes.tsx.
 */
const EPISODE_PATHS = ["/episodes", "/episodes?page=2", "/episodes?page=3"];

/**
 * Nicks de perfis públicos reais do Preview podem ser informados via PROFILE_NICKS=nick1,nick2.
 * Como não há nicks de usuários reais fixos no repositório, não inventamos identificadores:
 * quando PROFILE_NICKS não é informado, os 4% alocados a /profile/$nick redirecionam com segurança para "/".
 */
const REAL_PROFILE_NICKS = (__ENV.PROFILE_NICKS || "")
  .split(",")
  .map((item) => item.trim().replace(/^@+/, ""))
  .filter((item) => /^[a-zA-Z0-9_.-]{2,40}$/.test(item));

if (REAL_PROFILE_NICKS.length === 0) {
  console.warn(
    "[hikari-k6] PROFILE_NICKS não informado: fluxo de /profile/$nick (4%) usará '/' nesta execução sem inventar perfis fictícios.",
  );
}

// Métricas customizadas para visibilidade por rota e falhas específicas
const http5xxErrors = new Counter("http_5xx_errors");
const http5xxRate = new Rate("http_5xx_rate");
const http429Errors = new Counter("http_429_errors");
const http429Rate = new Rate("http_429_rate");
const forbiddenTargetHits = new Counter("forbidden_target_hits");

const routeDurationHome = new Trend("route_duration_home", true);
const routeDurationAnimeDetail = new Trend("route_duration_anime_detail", true);
const routeDurationBrowse = new Trend("route_duration_browse", true);
const routeDurationEpisodes = new Trend("route_duration_episodes", true);
const routeDurationSearch = new Trend("route_duration_search", true);
const routeDurationProfile = new Trend("route_duration_profile", true);
const routeDurationCalendar = new Trend("route_duration_calendar", true);

export const options = {
  // Etapa 1 estritamente limitada a 10 VUs (15s ramp-up + 60s platô = 75s totais)
  stages: [
    { duration: "15s", target: MAX_VUS_ETAPA_1 },
    { duration: "60s", target: MAX_VUS_ETAPA_1 },
  ],
  // Desativa redirecionamentos automáticos para impedir salto silencioso para Produção/Player
  maxRedirects: 0,
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
  thresholds: {
    // Interrompe após janela mínima de avaliação se erros HTTP > 1%
    http_req_failed: [
      { threshold: "rate<0.01", abortOnFail: true, delayAbortEval: "20s" },
    ],
    // Interrompe se p95 sustentado ultrapassar 2.500 ms após janela inicial de 20s
    http_req_duration: [
      { threshold: "p(95)<2500", abortOnFail: true, delayAbortEval: "20s" },
    ],
    // Interrompe em caso de respostas 5xx recorrentes
    http_5xx_rate: [
      { threshold: "rate<0.01", abortOnFail: true, delayAbortEval: "15s" },
    ],
    http_5xx_errors: [
      { threshold: "count<=3", abortOnFail: true, delayAbortEval: "15s" },
    ],
    // Interrompe em caso de rate limiting severo (429)
    http_429_rate: [
      { threshold: "rate<0.01", abortOnFail: true, delayAbortEval: "15s" },
    ],
    // Qualquer tentativa de redirecionamento para domínio proibido aborta
    forbidden_target_hits: [{ threshold: "count==0", abortOnFail: true }],
  },
};

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Seleção ponderada conforme distribuição definida:
 * Home (30%), Detalhes de anime (22%), Catálogo Browse (20%),
 * Episódios e paginação (13%), Busca (8%), Perfil público (4%), Calendário (3%).
 */
function selectNextFlow() {
  const roll = Math.random() * 100;

  if (roll < 30) {
    return {
      routeName: "home",
      path: "/",
      trend: routeDurationHome,
    };
  }

  if (roll < 52) {
    const animeId = pickRandom(REAL_ANIME_IDS);
    return {
      routeName: "anime_detail",
      path: `/anime/${animeId}`,
      trend: routeDurationAnimeDetail,
    };
  }

  if (roll < 72) {
    return {
      routeName: "browse",
      path: pickRandom(BROWSE_PATHS),
      trend: routeDurationBrowse,
    };
  }

  if (roll < 85) {
    return {
      routeName: "episodes",
      path: pickRandom(EPISODE_PATHS),
      trend: routeDurationEpisodes,
    };
  }

  if (roll < 93) {
    const term = pickRandom(REAL_SEARCH_TERMS);
    return {
      routeName: "search",
      path: `/search?q=${encodeURIComponent(term)}`,
      trend: routeDurationSearch,
    };
  }

  if (roll < 97) {
    if (REAL_PROFILE_NICKS.length > 0) {
      const nick = pickRandom(REAL_PROFILE_NICKS);
      return {
        routeName: "profile",
        path: `/profile/${encodeURIComponent(nick)}`,
        trend: routeDurationProfile,
      };
    }
    return {
      routeName: "home",
      path: "/",
      trend: routeDurationHome,
    };
  }

  return {
    routeName: "calendar",
    path: "/calendar",
    trend: routeDurationCalendar,
  };
}

function inspectRedirectAndTargetSafety(res) {
  const responseUrl = String(res.url || "").toLowerCase();
  if (responseUrl && !responseUrl.startsWith(`https://${PREVIEW_HOST}`)) {
    forbiddenTargetHits.add(1);
    exec.test.abort(
      `[ABORTADO] URL efetiva "${res.url}" desviou do host Preview autorizado "${PREVIEW_HOST}".`,
    );
    return false;
  }

  if (res.status >= 300 && res.status < 400) {
    const locationHeader =
      res.headers.Location || res.headers.location || "";
    const location = String(locationHeader).trim();

    if (/^https?:\/\//i.test(location)) {
      const targetMatch = location.match(/^https?:\/\/([^/:?#]+)/i);
      const targetHost = targetMatch ? targetMatch[1].toLowerCase() : "";
      if (targetHost && targetHost !== PREVIEW_HOST) {
        forbiddenTargetHits.add(1);
        exec.test.abort(
          `[ABORTADO] Redirecionamento detectado para outro domínio ("${location}").`,
        );
        return false;
      }
    }
  }

  return true;
}

export function setup() {
  if (exec.instance.vusInitialized > MAX_VUS_ETAPA_1) {
    exec.test.abort(
      `[BLOQUEADO] Número de VUs (${exec.instance.vusInitialized}) excede o limite de ${MAX_VUS_ETAPA_1} VUs da Etapa 1.`,
    );
  }

  // Confirma que nenhum VU tem configuração acima de 10 antes de iniciar o tráfego
  return {
    previewHost: PREVIEW_HOST,
    maxVus: MAX_VUS_ETAPA_1,
  };
}

export default function () {
  if (exec.instance.vusActive > MAX_VUS_ETAPA_1) {
    exec.test.abort(
      `[BLOQUEADO] VUs ativos (${exec.instance.vusActive}) ultrapassaram o limite de ${MAX_VUS_ETAPA_1}.`,
    );
  }

  const flow = selectNextFlow();
  const targetUrl = `${BASE_URL}${flow.path}`;

  const res = http.get(targetUrl, {
    redirects: 0,
    timeout: "15s",
    tags: {
      route: flow.routeName,
    },
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "hikari-k6-preview-stage1/1.0",
    },
  });

  const safeTarget = inspectRedirectAndTargetSafety(res);
  if (!safeTarget) {
    return;
  }

  const is5xx = res.status >= 500 && res.status < 600;
  const is429 = res.status === 429;

  http5xxRate.add(is5xx);
  if (is5xx) {
    http5xxErrors.add(1);
  }

  http429Rate.add(is429);
  if (is429) {
    http429Errors.add(1);
  }

  flow.trend.add(res.timings.duration);

  check(res, {
    "status HTTP 200": (r) => r.status === 200,
    "sem resposta 5xx": (r) => r.status < 500,
    "sem rate limit 429": (r) => r.status !== 429,
    "HTML não vazio": (r) => typeof r.body === "string" && r.body.length > 200,
  });

  // Think time aleatório realista entre 4 e 7 segundos
  const thinkTimeSec = 4 + Math.random() * 3;
  sleep(thinkTimeSec);
}
