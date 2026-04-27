import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

/** @deprecated Use cacheGetOrFetchSWR instead. Kept for backward compat. */
export const redis = { del: async (...keys: string[]) => { getRedis()?.del(...keys); } } as unknown as Redis;

const DEFAULT_TTL = 60 * 60; // 1h hard TTL

// ---------------------------------------------------------------------------
// Simple helpers
// ---------------------------------------------------------------------------

export async function cacheGet<T>(key: string): Promise<T | null> {
  const r = getRedis();
  if (!r) return null;
  return r.get<T>(key);
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttl = DEFAULT_TTL
): Promise<void> {
  const r = getRedis();
  if (!r) return;
  await r.set(key, value, { ex: ttl });
}

export async function cacheDelete(key: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  await r.del(key);
}

// ---------------------------------------------------------------------------
// SWR cache wrapper
// ---------------------------------------------------------------------------

interface CacheEnvelope<T> {
  data: T;
  fetchedAt: number; // epoch ms
}

/**
 * Stale-while-revalidate cache.
 * Returns cached data if present (sync invalidation clears when data changes).
 * On cache miss, fetches fresh data and stores it with 1h hard TTL.
 */
export async function cacheGetOrFetchSWR<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl = DEFAULT_TTL
): Promise<T> {
  // Try Redis cache — gracefully skip if Redis is unavailable
  try {
    const cached = await cacheGet<CacheEnvelope<T>>(key);
    if (cached !== null && cached.data !== undefined) {
      return cached.data;
    }
  } catch (e) {
    console.warn(`[cache] Redis read failed for ${key}:`, e);
  }

  const fresh = await fetcher();

  // Store in cache — don't block on failure
  try {
    const envelope: CacheEnvelope<T> = {
      data: fresh,
      fetchedAt: Date.now(),
    };
    await cacheSet(key, envelope, ttl);
  } catch (e) {
    console.warn(`[cache] Redis write failed for ${key}:`, e);
  }

  return fresh;
}

/**
 * Shortcut for listing queries. Same as cacheGetOrFetchSWR but semantically
 * for paginated listing results.
 */
export async function cacheList<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl = DEFAULT_TTL
): Promise<T> {
  return cacheGetOrFetchSWR<T>(key, fetcher, ttl);
}

// ---------------------------------------------------------------------------
// Cache key registry
// ---------------------------------------------------------------------------

export const CACHE_KEYS = {
  // KPI / dashboard
  kpiAdmin: "kpi:admin",

  // BI analytics (dynamic: mesInicio, mesFim, ano, vendedor opcional)
  biKpis: (mi: number, mf: number, a: number, v?: string) =>
    `bi:kpis:${mi}:${mf}:${a}:${v || "_all"}`,
  biVendedor: (mi: number, mf: number, a: number, v?: string) =>
    `bi:vendedor:${mi}:${mf}:${a}:${v || "_all"}`,
  biRegiao: (mi: number, mf: number, a: number, v?: string) =>
    `bi:regiao:${mi}:${mf}:${a}:${v || "_all"}`,

  // BI static
  biClientesStatus: "bi:clientes-status",
  biClientesInativos: "bi:clientes-inativos",

  // BI evolucao (dynamic: meses)
  biEvolucao: (meses: number) => `bi:evolucao:${meses}`,

  // Listing queries (entity, page, pageSize, search)
  list: (entity: string, page: number, size: number, search?: string) =>
    `list:${entity}:p${page}:s${size}:${search || "_"}`,
} as const;

// ---------------------------------------------------------------------------
// Bulk invalidation
// ---------------------------------------------------------------------------

const LIST_ENTITIES = [
  "clientes",
  "pedidos",
  "produtos",
  "vendedores",
  "contas-pagar",
  "contas-receber",
  "notas-fiscais",
  "orcamentos",
] as const;

const COMMON_PAGE_SIZES = [10, 20, 50];

/**
 * Deletes all known cache keys (static + common dynamic combos).
 * Does NOT use SCAN - explicitly deletes known keys for predictability.
 */
export async function invalidateAllCaches(): Promise<void> {
  const keys: string[] = [];

  // Static BI keys
  keys.push(CACHE_KEYS.kpiAdmin);
  keys.push(CACHE_KEYS.biClientesStatus);
  keys.push(CACHE_KEYS.biClientesInativos);

  // Dynamic BI keys for current year (months 1 through current)
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-based
  const currentYear = now.getFullYear();

  for (let mi = 1; mi <= currentMonth; mi++) {
    for (let mf = mi; mf <= currentMonth; mf++) {
      keys.push(CACHE_KEYS.biKpis(mi, mf, currentYear));
      keys.push(CACHE_KEYS.biVendedor(mi, mf, currentYear));
      keys.push(CACHE_KEYS.biRegiao(mi, mf, currentYear));
    }
  }

  // Evolucao for common values
  for (const meses of [3, 6, 12]) {
    keys.push(CACHE_KEYS.biEvolucao(meses));
  }

  // Listing keys for first 5 pages of each entity
  for (const entity of LIST_ENTITIES) {
    for (let page = 1; page <= 5; page++) {
      for (const size of COMMON_PAGE_SIZES) {
        keys.push(CACHE_KEYS.list(entity, page, size)); // no search
        keys.push(CACHE_KEYS.list(entity, page, size, "")); // empty search
      }
    }
  }

  // Delete all in parallel
  const r = getRedis();
  if (r && keys.length > 0) {
    try {
      await r.del(...keys);
    } catch (e) {
      console.warn("[cache] invalidateAllCaches failed:", e);
    }
  }
}

/**
 * Legacy helper - invalidates KPI caches only.
 * Kept for backward compatibility with sync handlers.
 */
export async function invalidateKPIs(): Promise<void> {
  await cacheDelete(CACHE_KEYS.kpiAdmin);
}
