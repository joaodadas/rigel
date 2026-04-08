import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const DEFAULT_TTL = 60 * 60 * 24; // 24h

export async function cacheGet<T>(key: string): Promise<T | null> {
  return redis.get<T>(key);
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttl = DEFAULT_TTL
): Promise<void> {
  await redis.set(key, value, { ex: ttl });
}

export async function cacheDelete(key: string): Promise<void> {
  await redis.del(key);
}

export async function cacheGetOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl = DEFAULT_TTL
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;
  const fresh = await fetcher();
  await cacheSet(key, fresh, ttl);
  return fresh;
}

export const CACHE_KEYS = {
  kpiAdmin: "kpi:admin",
  kpiComercial: "kpi:comercial",
  kpiFinanceiro: "kpi:financeiro",
  kpiRh: "kpi:rh",
  vendedoresAtivos: "cache:vendedores-ativos",
  categoriasFinanceiras: "cache:categorias-financeiras",
  centrosCusto: "cache:centros-custo",
  contasBancarias: "cache:contas-bancarias",
  categoriasProduto: "cache:categorias-produto",
  transportadoras: "cache:transportadoras",
} as const;

export async function invalidateKPIs(): Promise<void> {
  await Promise.all([
    cacheDelete(CACHE_KEYS.kpiAdmin),
    cacheDelete(CACHE_KEYS.kpiComercial),
    cacheDelete(CACHE_KEYS.kpiFinanceiro),
    cacheDelete(CACHE_KEYS.kpiRh),
  ]);
}
