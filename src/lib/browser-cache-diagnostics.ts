import type { BrowserStorageAuditReport } from "@/lib/browser-storage-diagnostics";

export type CacheModuleStatus =
  | "SAUDÁVEL"
  | "ATENÇÃO"
  | "CRÍTICO"
  | "INDISPONÍVEL"
  | "NÃO VERIFICADO"
  | "PARCIAL";

export interface LocalStorageCacheKeyReport {
  key: string;
  label: string;
  present: boolean;
  bytes: number | null;
  formattedSize: string;
}

export interface PassiveResourceCacheEvidence {
  supported: boolean;
  status: CacheModuleStatus;
  sameOriginCount: number;
  zeroTransferCandidateCount: number;
  networkTransferCount: number;
  crossOriginRestrictedCount: number;
  note: string;
}

export interface StaticCacheLayerSpec {
  id: string;
  layer: "browser_local" | "app_memory" | "redis_shared" | "http_cdn";
  name: string;
  keyOrRoute: string;
  ttlOrPolicy: string;
  invalidationMechanism: string;
  runtimeVisibility: string;
}

export interface BrowserCacheDiagnosticsReport {
  isBrowserEnvironment: boolean;
  measuredAt: string;
  localCatalogIndexedDb: {
    status: CacheModuleStatus;
    present: boolean;
    version: number | null;
    detail: string;
  };
  localKeyPresence: LocalStorageCacheKeyReport[];
  passiveHttpEvidence: PassiveResourceCacheEvidence;
  inMemoryClientCaches: StaticCacheLayerSpec[];
  serverMemoryAndRedisSpecs: StaticCacheLayerSpec[];
  httpCdnPolicySpecs: StaticCacheLayerSpec[];
  unverifiableMetrics: Array<{ label: string; reason: string }>;
}

const KNOWN_LOCAL_CACHE_KEYS: Array<{ key: string; label: string }> = [
  {
    key: "hikari-catalog-fallback-v1",
    label: "Fallback local do catálogo (quando IndexedDB falha)",
  },
  {
    key: "hikari_anime_user_cache_v1",
    label: "Cache local por usuário/anime (LRU máx. 30 entradas)",
  },
  {
    key: "hikari-user-state-v1",
    label: "Estado local e progresso persistido no navegador",
  },
  {
    key: "hikari-deleted-episodes-v1",
    label: "Tombstones locais de episódios excluídos",
  },
  {
    key: "hikari-episode-outbox-v1",
    label: "Outbox local de sincronização offline",
  },
];

export const CLIENT_MEMORY_CACHE_SPECS: StaticCacheLayerSpec[] = [
  {
    id: "client-ep-mem",
    layer: "app_memory",
    name: "Cache em Memória de Episódios (Cliente)",
    keyOrRoute: "clientCatalogEpisodesCache (Map por animeId)",
    ttlOrPolicy: "Stale time ~2 min (120s) + dedup in-flight",
    invalidationMechanism: "invalidateCatalogEpisodesCache(animeId)",
    runtimeVisibility:
      "NÃO VERIFICADO em tempo de execução (Map privado de módulo)",
  },
  {
    id: "client-search-mem",
    layer: "app_memory",
    name: "Cache em Memória de Busca (Cliente)",
    keyOrRoute: "animeSearchCache / userSearchCache",
    ttlOrPolicy: "TTL 5 min (300s) • limite LRU 100 consultas",
    invalidationMechanism: "Expiração TTL / troca de usuário autenticado",
    runtimeVisibility:
      "NÃO VERIFICADO em tempo de execução (Map privado de módulo)",
  },
  {
    id: "client-profile-mem",
    layer: "app_memory",
    name: "Cache em Memória de Perfis & Tracking",
    keyOrRoute: "profile-client-cache / tracking-client-cache",
    ttlOrPolicy: "TTL 2 min (120s) • isolamento por epoch de sessão",
    invalidationMechanism: "Mutações locais e logout/troca de conta",
    runtimeVisibility:
      "NÃO VERIFICADO em tempo de execução (Map privado de módulo)",
  },
  {
    id: "client-admin-mem",
    layer: "app_memory",
    name: "Cache em Memória do Painel Admin",
    keyOrRoute: "admin-dashboard-client-cache",
    ttlOrPolicy: "Status 60s • Sync meta 2 min (120s)",
    invalidationMechanism: "invalidateAdminDashboardCache()",
    runtimeVisibility:
      "NÃO VERIFICADO em tempo de execução (variável privada de módulo)",
  },
];

export const SERVER_CACHE_AND_REDIS_SPECS: StaticCacheLayerSpec[] = [
  {
    id: "srv-catalog-index",
    layer: "redis_shared",
    name: "Índice Global do Catálogo",
    keyOrRoute: "hikari:catalog:index:v2",
    ttlOrPolicy: "Redis TTL 15 min (900s) • RAM instância 3 min (180s)",
    invalidationMechanism: "invalidateCatalogIndex() + DEL Redis",
    runtimeVisibility: "Conteúdo/contagem NÃO VERIFICADO (sem KEYS/SCAN)",
  },
  {
    id: "srv-badges",
    layer: "redis_shared",
    name: "Selos Recentes de Animes (Badges)",
    keyOrRoute: "hikari:catalog:badges:v1",
    ttlOrPolicy: "Redis TTL 3 min (180s) • RAM instância 3 min (180s)",
    invalidationMechanism: "invalidateAnimeRecentBadgesCache()",
    runtimeVisibility: "Hit/miss NÃO VERIFICADO sem telemetria agregada",
  },
  {
    id: "srv-episodes",
    layer: "redis_shared",
    name: "Episódios por Anime & Home Pública",
    keyOrRoute:
      "hikari:catalog:episodes:<id>:v3 • hikari:home:episodes:v3 • hikari:catalog:episodes:public:v3",
    ttlOrPolicy: "Redis TTL 3 min (180s) • RAM instância 180s (máx. 300 animes)",
    invalidationMechanism: "Token de geração (fence) atômico + DEL",
    runtimeVisibility: "Ocupação real NÃO VERIFICADA (sem KEYS/SCAN)",
  },
  {
    id: "srv-detail",
    layer: "redis_shared",
    name: "Detalhes Completos de Anime",
    keyOrRoute: "hikari:catalog:detail:v1:<id>",
    ttlOrPolicy: "Redis TTL 30 min (1800s) com fence global e por ID",
    invalidationMechanism: "INCR geração atômica + CAS / DEL",
    runtimeVisibility: "Chaves ativas NÃO VERIFICADAS (sem KEYS/SCAN)",
  },
  {
    id: "srv-search",
    layer: "redis_shared",
    name: "Consultas de Busca do Catálogo",
    keyOrRoute: "hikari:catalog:search:v1:<query>:<limit>",
    ttlOrPolicy: "Redis TTL 60s com fence por geração",
    invalidationMechanism: "INCR geração global de busca",
    runtimeVisibility: "Hit/miss NÃO VERIFICADO",
  },
  {
    id: "srv-home-cal",
    layer: "redis_shared",
    name: "Home Hero, Em Alta, Calendário & Créditos",
    keyOrRoute:
      "hikari:home:hero-banner:v2 (20m) • hikari:home:trending:v2 (12m) • hikari:calendar:* (15m/30m) • hikari:catalog:credits:v1:* (2h)",
    ttlOrPolicy: "TTLs 12 min a 2 horas com envelopes versionados",
    invalidationMechanism: "Invalidadores de domínio + TTL expirante",
    runtimeVisibility: "Chaves ativas NÃO VERIFICADAS (sem KEYS/SCAN)",
  },
];

export const HTTP_CDN_POLICY_SPECS: StaticCacheLayerSpec[] = [
  {
    id: "http-admin",
    layer: "http_cdn",
    name: "Rotas Administrativas, Auth & APIs Privadas",
    keyOrRoute: "/admin/*, /login, /api/admin/*, /api/progress, /api/notifications",
    ttlOrPolicy: "Cache-Control: private, no-store (sem cache de borda)",
    invalidationMechanism: "Revalidação obrigatória por requisição",
    runtimeVisibility:
      "Política definida em server/middleware/cache-control.ts; headers de resposta não inspecionados via fetch extra",
  },
  {
    id: "http-anime",
    layer: "http_cdn",
    name: "Páginas de Detalhe de Anime",
    keyOrRoute: "/anime/*",
    ttlOrPolicy:
      "public, s-maxage=60, stale-while-revalidate=300, stale-if-error=86400",
    invalidationMechanism: "CDN-Cache-Control + SWR 5 min",
    runtimeVisibility: "Estado de cache na borda CDN: NÃO VERIFICADO",
  },
  {
    id: "http-public",
    layer: "http_cdn",
    name: "Home, Catálogo, Busca, Calendário & Notícias",
    keyOrRoute: "/, /browse/*, /search/*, /calendar, /episodes, /news/*",
    ttlOrPolicy:
      "public, s-maxage=300, stale-while-revalidate=900, stale-if-error=86400",
    invalidationMechanism: "CDN-Cache-Control + SWR 15 min",
    runtimeVisibility: "Estado de cache na borda CDN: NÃO VERIFICADO",
  },
  {
    id: "http-media-assets",
    layer: "http_cdn",
    name: "Assets Imutáveis & Proxy HLS",
    keyOrRoute: "/assets/* (1 ano immutable) • /api/hls (playlist 5s / seg 1 ano)",
    ttlOrPolicy: "vercel.json + rotas /api/hls e /api/video-proxy",
    invalidationMechanism: "Hash de build Vite / parâmetros de stream",
    runtimeVisibility: "Hit/Miss CDN (x-vercel-cache): NÃO VERIFICADO",
  },
];

function inspectPassiveResourceCacheEvidence(): PassiveResourceCacheEvidence {
  if (typeof window === "undefined" || typeof performance === "undefined") {
    return {
      supported: false,
      status: "NÃO VERIFICADO",
      sameOriginCount: 0,
      zeroTransferCandidateCount: 0,
      networkTransferCount: 0,
      crossOriginRestrictedCount: 0,
      note: "Aguardando execução no navegador.",
    };
  }

  try {
    if (typeof performance.getEntriesByType !== "function") {
      return {
        supported: false,
        status: "INDISPONÍVEL",
        sameOriginCount: 0,
        zeroTransferCandidateCount: 0,
        networkTransferCount: 0,
        crossOriginRestrictedCount: 0,
        note: "performance.getEntriesByType('resource') indisponível neste navegador.",
      };
    }

    const entries = performance.getEntriesByType(
      "resource",
    ) as PerformanceResourceTiming[];
    const currentOrigin = window.location.origin;

    let sameOriginCount = 0;
    let zeroTransferCandidateCount = 0;
    let networkTransferCount = 0;
    let crossOriginRestrictedCount = 0;

    for (const entry of entries) {
      const transferSize =
        typeof entry.transferSize === "number" ? entry.transferSize : 0;
      const encodedSize =
        typeof entry.encodedBodySize === "number" ? entry.encodedBodySize : 0;
      const decodedSize =
        typeof entry.decodedBodySize === "number" ? entry.decodedBodySize : 0;

      let sameOrigin = false;
      try {
        sameOrigin = new URL(entry.name, currentOrigin).origin === currentOrigin;
      } catch {
        sameOrigin = false;
      }

      if (!sameOrigin && transferSize === 0 && encodedSize === 0 && decodedSize === 0) {
        crossOriginRestrictedCount += 1;
        continue;
      }

      if (sameOrigin) {
        sameOriginCount += 1;
      }

      if (transferSize === 0 && (decodedSize > 0 || encodedSize > 0)) {
        zeroTransferCandidateCount += 1;
      } else if (transferSize > 0) {
        networkTransferCount += 1;
      }
    }

    return {
      supported: true,
      status: entries.length > 0 ? "PARCIAL" : "NÃO VERIFICADO",
      sameOriginCount,
      zeroTransferCandidateCount,
      networkTransferCount,
      crossOriginRestrictedCount,
      note:
        "Leitura passiva do buffer ResourceTiming desta aba. transferSize=0 com body>0 sugere resposta servida de cache local (HTTP/memória/SW); cabeçalhos CDN (x-vercel-cache) não são expostos por essa API.",
    };
  } catch {
    return {
      supported: false,
      status: "INDISPONÍVEL",
      sameOriginCount: 0,
      zeroTransferCandidateCount: 0,
      networkTransferCount: 0,
      crossOriginRestrictedCount: 0,
      note: "Falha ao ler PerformanceResourceTiming nesta sessão.",
    };
  }
}

export function buildBrowserCacheDiagnosticsReport(
  storageAudit: BrowserStorageAuditReport | null,
): BrowserCacheDiagnosticsReport {
  const isBrowser =
    typeof window !== "undefined" && Boolean(storageAudit?.isBrowserEnvironment);

  let localCatalogIndexedDb: BrowserCacheDiagnosticsReport["localCatalogIndexedDb"];
  if (!storageAudit || !storageAudit.isBrowserEnvironment) {
    localCatalogIndexedDb = {
      status: "NÃO VERIFICADO",
      present: false,
      version: null,
      detail: "Aguardando auditoria local de armazenamento do navegador.",
    };
  } else if (!storageAudit.indexedDb.available) {
    localCatalogIndexedDb = {
      status:
        storageAudit.indexedDb.status === "blocked"
          ? "ATENÇÃO"
          : "INDISPONÍVEL",
      present: false,
      version: null,
      detail:
        storageAudit.indexedDb.reason ??
        "IndexedDB indisponível neste navegador.",
    };
  } else if (storageAudit.indexedDb.status === "partial") {
    localCatalogIndexedDb = {
      status: "PARCIAL",
      present: false,
      version: null,
      detail:
        storageAudit.indexedDb.reason ??
        "Navegador não suporta listagem automática de bancos IndexedDB.",
    };
  } else {
    const hikariDb = storageAudit.indexedDb.databases.find(
      (db) => db.name === "hikari",
    );
    if (hikariDb) {
      const catalogStore = hikariDb.stores.find((s) => s.name === "catalog");
      localCatalogIndexedDb = {
        status: "SAUDÁVEL",
        present: true,
        version: hikariDb.version,
        detail: catalogStore
          ? `Banco "hikari" v${hikariDb.version} ativo com object store "catalog" (${catalogStore.count} registro(s)).`
          : `Banco "hikari" v${hikariDb.version} localizado na origem.`,
      };
    } else {
      localCatalogIndexedDb = {
        status: "ATENÇÃO",
        present: false,
        version: null,
        detail:
          'Banco IndexedDB "hikari" ainda não foi inicializado nesta origem (ex.: catálogo não carregado no admin/store neste navegador).',
      };
    }
  }

  const lsItemsMap = new Map(
    (storageAudit?.localStorage.items ?? []).map((item) => [item.key, item]),
  );

  const localKeyPresence: LocalStorageCacheKeyReport[] =
    KNOWN_LOCAL_CACHE_KEYS.map((spec) => {
      const found = lsItemsMap.get(spec.key);
      return {
        key: spec.key,
        label: spec.label,
        present: Boolean(found),
        bytes: found ? found.bytes : null,
        formattedSize: found
          ? found.formattedSize
          : storageAudit?.localStorage.available
            ? "Ausente"
            : "--",
      };
    });

  const passiveHttpEvidence = inspectPassiveResourceCacheEvidence();

  return {
    isBrowserEnvironment: isBrowser,
    measuredAt:
      storageAudit?.measuredAt ||
      (typeof window !== "undefined"
        ? new Date().toLocaleTimeString("pt-BR")
        : "--:--:--"),
    localCatalogIndexedDb,
    localKeyPresence,
    passiveHttpEvidence,
    inMemoryClientCaches: CLIENT_MEMORY_CACHE_SPECS,
    serverMemoryAndRedisSpecs: SERVER_CACHE_AND_REDIS_SPECS,
    httpCdnPolicySpecs: HTTP_CDN_POLICY_SPECS,
    unverifiableMetrics: [
      {
        label: "Hit Rate / Miss Rate Global",
        reason:
          "NÃO VERIFICADO: o Hikari não mantém contadores globais persistidos de acerto/erro nem realiza amostragem agregada no Redis ou Vercel.",
      },
      {
        label: "Contagem Total e Memória das Chaves Redis",
        reason:
          "NÃO VERIFICADO: comandos como KEYS, SCAN, DBSIZE e INFO estão bloqueados por política de segurança e desempenho no plano Upstash.",
      },
      {
        label: "Economia de Consultas & Visitantes Beneficiados",
        reason:
          "NÃO VERIFICADO: não existem métricas globais de tráfego ou economia de leitura coletadas pela aplicação.",
      },
      {
        label: "Status de Edge Cache CDN (HIT / MISS / STALE)",
        reason:
          "NÃO VERIFICADO: cabeçalhos x-vercel-cache de páginas públicas não são visíveis passivamente sem disparar novas requisições HTTP.",
      },
    ],
  };
}
