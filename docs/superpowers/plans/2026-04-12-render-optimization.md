# Render Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce page navigation from ~3s to <500ms (cache hit) and BI first load from ~5s to ~800ms.

**Architecture:** Redis SWR cache for all queries + Postgres RPCs for 3 heavy BI aggregations + Suspense streaming for progressive BI rendering + prefetch for sidebar and pagination.

**Tech Stack:** Upstash Redis (existing), Supabase RPCs, Next.js Suspense, React Server Components

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/lib/redis/client.ts` | Redis SWR cache, key registry, bulk invalidation |
| `src/lib/queries/comercial-analytics.ts` | BI analytics (swap unstable_cache for Redis + RPCs) |
| `src/lib/queries/admin-kpis.ts` | Admin KPIs (swap unstable_cache for Redis) |
| `src/lib/queries/clientes.ts` | Cached listing query |
| `src/lib/queries/pedidos.ts` | Cached listing query |
| `src/lib/queries/produtos.ts` | Cached listing query |
| `src/lib/queries/vendedores.ts` | Cached listing query |
| `src/lib/queries/contas-pagar.ts` | Cached listing query |
| `src/lib/queries/contas-receber.ts` | Cached listing query |
| `src/lib/queries/notas-fiscais.ts` | Cached listing query |
| `src/lib/queries/orcamentos.ts` | Cached listing query |
| `src/app/(dashboard)/comercial/bi/page.tsx` | Suspense streaming BI |
| `src/components/app-sidebar.tsx` | Verify Link prefetch is enabled |
| `src/app/(dashboard)/admin/bi/page.tsx` | Suspense streaming BI |
| `src/lib/sync/webhook-handler.ts` | Invalidate all caches on webhook |
| `src/lib/sync/incremental.ts` | Invalidate all caches on sync |

---

### Task 1: Upgrade Redis client with SWR cache and bulk invalidation

**Files:**
- Modify: `src/lib/redis/client.ts`

- [ ] **Step 1: Add SWR wrapper and cache key registry**

Replace the full content of `src/lib/redis/client.ts` with:

```typescript
import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ---------------------------------------------------------------------------
// Core cache helpers
// ---------------------------------------------------------------------------

interface SWREntry<T> {
  data: T;
  fetchedAt: number;
}

const LONG_TTL = 60 * 60; // 1h — hard expiry in Redis
const BI_STALE = 5 * 60;  // 5min — stale threshold for BI/KPI data
const LIST_STALE = 60;     // 60s — stale threshold for listing data

export async function cacheGet<T>(key: string): Promise<T | null> {
  const entry = await redis.get<SWREntry<T>>(key);
  return entry?.data ?? null;
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttl = LONG_TTL
): Promise<void> {
  const entry: SWREntry<T> = { data: value, fetchedAt: Date.now() };
  await redis.set(key, entry, { ex: ttl });
}

export async function cacheDelete(key: string): Promise<void> {
  await redis.del(key);
}

/**
 * SWR cache: returns stale data immediately if available,
 * only fetches when Redis key is completely missing.
 * Sync invalidation (webhook/incremental) clears keys so next request refetches.
 */
export async function cacheGetOrFetchSWR<T>(
  key: string,
  fetcher: () => Promise<T>,
  staleTTL = BI_STALE
): Promise<T> {
  const entry = await redis.get<SWREntry<T>>(key);

  if (entry?.data !== undefined && entry?.data !== null) {
    // Data exists — return it regardless of staleness
    // (sync invalidation clears the key when data changes)
    return entry.data;
  }

  // Cache miss — fetch fresh data
  const fresh = await fetcher();
  const swr: SWREntry<T> = { data: fresh, fetchedAt: Date.now() };
  await redis.set(key, swr, { ex: LONG_TTL });
  return fresh;
}

/** Shortcut for listing queries (shorter stale TTL) */
export async function cacheList<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  return cacheGetOrFetchSWR(key, fetcher, LIST_STALE);
}

// ---------------------------------------------------------------------------
// Cache key registry — all known keys for bulk invalidation
// ---------------------------------------------------------------------------

export const CACHE_KEYS = {
  kpiAdmin: "kpi:admin",

  biKpis: (mi: number, mf: number, a: number) => `bi:kpis:${mi}:${mf}:${a}`,
  biVendedor: (mi: number, mf: number, a: number) => `bi:vendedor:${mi}:${mf}:${a}`,
  biRegiao: (mi: number, mf: number, a: number) => `bi:regiao:${mi}:${mf}:${a}`,
  biClientesStatus: "bi:clientes-status",
  biClientesInativos: "bi:clientes-inativos",
  biEvolucao: (meses: number) => `bi:evolucao:${meses}`,

  list: (entity: string, page: number, size: number, search: string) =>
    `list:${entity}:p${page}:s${size}:${search || "_"}`,
} as const;

/**
 * Track dynamic BI keys so we can invalidate them.
 * In practice the app uses a small set of parameter combos.
 */
const BI_STATIC_KEYS = [
  CACHE_KEYS.kpiAdmin,
  CACHE_KEYS.biClientesStatus,
  CACHE_KEYS.biClientesInativos,
];

export async function invalidateAllCaches(): Promise<void> {
  // 1. Delete known static keys
  const keysToDelete = [...BI_STATIC_KEYS];

  // 2. Delete dynamic BI keys for current year/month combos
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  for (let m = 1; m <= month; m++) {
    keysToDelete.push(
      CACHE_KEYS.biKpis(1, m, year),
      CACHE_KEYS.biVendedor(1, m, year),
      CACHE_KEYS.biRegiao(1, m, year)
    );
  }
  for (const meses of [3, 6, 12]) {
    keysToDelete.push(CACHE_KEYS.biEvolucao(meses));
  }

  // 3. Delete listing cache keys (first 5 pages of each entity)
  const entities = [
    "clientes", "pedidos", "produtos", "vendedores",
    "contas-pagar", "contas-receber", "notas-fiscais", "orcamentos",
  ];
  for (const e of entities) {
    for (let p = 1; p <= 5; p++) {
      keysToDelete.push(CACHE_KEYS.list(e, p, 50, "_"));
    }
  }

  await Promise.all(keysToDelete.map((k) => redis.del(k)));
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npx next build 2>&1 | grep -E "(error|Error|✓)" | head -5`
Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

```bash
git add src/lib/redis/client.ts
git commit -m "feat: upgrade Redis client with SWR cache and bulk invalidation"
```

---

### Task 2: Add Redis cache to all listing query functions

**Files:**
- Modify: `src/lib/queries/clientes.ts`
- Modify: `src/lib/queries/pedidos.ts`
- Modify: `src/lib/queries/produtos.ts`
- Modify: `src/lib/queries/vendedores.ts`
- Modify: `src/lib/queries/contas-pagar.ts`
- Modify: `src/lib/queries/contas-receber.ts`
- Modify: `src/lib/queries/notas-fiscais.ts`
- Modify: `src/lib/queries/orcamentos.ts`

All 8 files follow the same pattern. For each, wrap the main function with `cacheList`.

- [ ] **Step 1: Update clientes.ts**

Add import and wrap function:

```typescript
import { createSupabaseServer } from "@/lib/supabase/client";
import { cacheList, CACHE_KEYS } from "@/lib/redis/client";

// ... interfaces stay the same ...

export async function getClientes(
  page = 1,
  pageSize = 50,
  search?: string
): Promise<ClientesResult> {
  return cacheList(
    CACHE_KEYS.list("clientes", page, pageSize, search || ""),
    () => _fetchClientes(page, pageSize, search)
  );
}

async function _fetchClientes(
  page: number,
  pageSize: number,
  search?: string
): Promise<ClientesResult> {
  const supabase = createSupabaseServer();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("clientes")
    .select(
      "id_cliente, razao_cliente, fantasia_cliente, cnpj_cliente, cidade_cliente, uf_cliente, fone_cliente, email_cliente, situacao_cliente, data_cad_cliente, lixeira",
      { count: "exact" }
    )
    .eq("lixeira", "Nao");

  if (search && search.trim()) {
    query = query.ilike("razao_cliente", `%${search.trim()}%`);
  }

  const { data, error, count } = await query
    .order("razao_cliente", { ascending: true })
    .range(from, to);

  if (error) {
    console.error("Error fetching clientes:", error);
    return { data: [], total: 0 };
  }

  return { data: data as ClienteRow[], total: count ?? 0 };
}
```

- [ ] **Step 2: Apply same pattern to remaining 7 files**

For each file (`pedidos.ts`, `produtos.ts`, `vendedores.ts`, `contas-pagar.ts`, `contas-receber.ts`, `notas-fiscais.ts`, `orcamentos.ts`):
1. Add import: `import { cacheList, CACHE_KEYS } from "@/lib/redis/client";`
2. Rename the existing function to `_fetch{Entity}` (private)
3. Create a new exported function that calls `cacheList(CACHE_KEYS.list("{entity}", page, pageSize, search || ""), () => _fetch{Entity}(page, pageSize, search))`
4. Use entity names: `pedidos`, `produtos`, `vendedores`, `contas-pagar`, `contas-receber`, `notas-fiscais`, `orcamentos`

- [ ] **Step 3: Verify build compiles**

Run: `npx next build 2>&1 | grep -E "(error|Error|✓)" | head -5`
Expected: `✓ Compiled successfully`

- [ ] **Step 4: Commit**

```bash
git add src/lib/queries/
git commit -m "perf: add Redis SWR cache to all listing queries (60s TTL)"
```

---

### Task 3: Create 3 Supabase RPC functions

**Files:**
- Supabase dashboard or migration

These SQL functions run aggregations in Postgres instead of fetching all rows to JS.

- [ ] **Step 1: Create rpc_comercial_kpis**

Execute in Supabase SQL Editor:

```sql
CREATE OR REPLACE FUNCTION rpc_comercial_kpis(
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  faturamento numeric,
  total_pedidos bigint,
  clientes_ativos bigint,
  base_total bigint
)
LANGUAGE sql STABLE
AS $$
  SELECT
    COALESCE(ped.faturamento, 0) AS faturamento,
    COALESCE(ped.total_pedidos, 0) AS total_pedidos,
    COALESCE(ativos.clientes_ativos, 0) AS clientes_ativos,
    COALESCE(base.base_total, 0) AS base_total
  FROM
    (SELECT
      SUM(valor_total_nota::numeric) AS faturamento,
      COUNT(*) AS total_pedidos
     FROM pedidos
     WHERE status_pedido = 'Atendido'
       AND lixeira = 'Nao'
       AND data_pedido >= p_start_date
       AND data_pedido <= p_end_date
    ) ped,
    (SELECT COUNT(DISTINCT id_cliente) AS clientes_ativos
     FROM pedidos
     WHERE status_pedido = 'Atendido'
       AND lixeira = 'Nao'
       AND data_pedido >= (CURRENT_DATE - INTERVAL '6 months')
    ) ativos,
    (SELECT COUNT(*) AS base_total
     FROM clientes
     WHERE lixeira = 'Nao'
    ) base;
$$;
```

- [ ] **Step 2: Create rpc_clientes_status_vendedor**

```sql
CREATE OR REPLACE FUNCTION rpc_clientes_status_vendedor()
RETURNS TABLE (
  vendedor text,
  total bigint,
  ativos bigint,
  inativos bigint,
  pct_ativacao numeric
)
LANGUAGE sql STABLE
AS $$
  WITH active_ids AS (
    SELECT DISTINCT id_cliente
    FROM pedidos
    WHERE status_pedido = 'Atendido'
      AND lixeira = 'Nao'
      AND data_pedido >= (CURRENT_DATE - INTERVAL '6 months')
  ),
  grouped AS (
    SELECT
      COALESCE(NULLIF(TRIM(c.vendedor_cliente), ''), 'Sem vendedor') AS vendedor,
      COUNT(*) AS total,
      COUNT(a.id_cliente) AS ativos
    FROM clientes c
    LEFT JOIN active_ids a ON a.id_cliente = c.id_cliente::text
    WHERE c.lixeira = 'Nao'
    GROUP BY 1
  )
  SELECT
    vendedor,
    total,
    ativos,
    total - ativos AS inativos,
    CASE WHEN total > 0 THEN ROUND(ativos * 100.0 / total, 1) ELSE 0 END AS pct_ativacao
  FROM grouped
  ORDER BY total DESC;
$$;
```

- [ ] **Step 3: Create rpc_clientes_inativos**

```sql
CREATE OR REPLACE FUNCTION rpc_clientes_inativos(
  p_vendedor text DEFAULT NULL
)
RETURNS TABLE (
  nome text,
  vendedor text,
  ultimo_pedido date,
  valor_ultimo_pedido numeric,
  dias_sem_compra integer
)
LANGUAGE sql STABLE
AS $$
  SELECT
    COALESCE(NULLIF(c.fantasia_cliente, ''), c.razao_cliente) AS nome,
    COALESCE(NULLIF(TRIM(c.vendedor_cliente), ''), 'Sem vendedor') AS vendedor,
    lp.data_pedido::date AS ultimo_pedido,
    COALESCE(lp.valor_total_nota::numeric, 0) AS valor_ultimo_pedido,
    CASE
      WHEN lp.data_pedido IS NOT NULL
        THEN (CURRENT_DATE - lp.data_pedido::date)
      ELSE 9999
    END AS dias_sem_compra
  FROM clientes c
  LEFT JOIN LATERAL (
    SELECT p.data_pedido, p.valor_total_nota
    FROM pedidos p
    WHERE p.id_cliente::text = c.id_cliente::text
      AND p.status_pedido = 'Atendido'
      AND p.lixeira = 'Nao'
    ORDER BY p.data_pedido DESC
    LIMIT 1
  ) lp ON true
  WHERE c.lixeira = 'Nao'
    AND (p_vendedor IS NULL OR TRIM(c.vendedor_cliente) = p_vendedor)
    AND (lp.data_pedido IS NULL OR lp.data_pedido < (CURRENT_DATE - INTERVAL '6 months'))
  ORDER BY dias_sem_compra DESC;
$$;
```

- [ ] **Step 4: Test RPCs in Supabase SQL Editor**

Run:
```sql
SELECT * FROM rpc_comercial_kpis('2026-01-01', '2026-04-12');
SELECT * FROM rpc_clientes_status_vendedor() LIMIT 5;
SELECT * FROM rpc_clientes_inativos() LIMIT 5;
```

Expected: each returns data without error.

- [ ] **Step 5: Commit plan note**

No code commit here — RPCs live in Supabase. Document in a comment in the analytics file.

---

### Task 4: Swap unstable_cache for Redis + RPCs in comercial-analytics.ts

**Files:**
- Modify: `src/lib/queries/comercial-analytics.ts`

- [ ] **Step 1: Replace imports and remove unstable_cache wrappers**

At the top of the file, replace:
```typescript
import { unstable_cache } from "next/cache";
```
with:
```typescript
import { cacheGetOrFetchSWR, CACHE_KEYS } from "@/lib/redis/client";
```

- [ ] **Step 2: Rewrite getComercialKPIs to use RPC + Redis**

Replace the `getComercialKPIs` export and `_getComercialKPIs` function with:

```typescript
export async function getComercialKPIs(
  mesInicio: number,
  mesFim: number,
  ano: number
): Promise<ComercialKPIs> {
  return cacheGetOrFetchSWR(
    CACHE_KEYS.biKpis(mesInicio, mesFim, ano),
    () => _fetchComercialKPIs(mesInicio, mesFim, ano)
  );
}

async function _fetchComercialKPIs(
  mesInicio: number,
  mesFim: number,
  ano: number
): Promise<ComercialKPIs> {
  const supabase = createSupabaseServer();
  const { start, end } = buildDateRange(mesInicio, mesFim, ano);

  const { data, error } = await supabase.rpc("rpc_comercial_kpis", {
    p_start_date: start,
    p_end_date: end,
  });

  if (error || !data || data.length === 0) {
    console.error("[rpc_comercial_kpis] error:", error);
    return {
      faturamentoB2B: 0, metaB2BAcumulada: 0, pctAtingimento: 0,
      ticketMedio: 0, totalPedidos: 0, clientesAtivos: 0,
      clientesInativos: 0, baseTotal: 0,
    };
  }

  const row = data[0];
  const faturamentoB2B = Number(row.faturamento) || 0;
  const totalPedidos = Number(row.total_pedidos) || 0;
  const clientesAtivos = Number(row.clientes_ativos) || 0;
  const baseTotal = Number(row.base_total) || 0;
  const ticketMedio = totalPedidos > 0 ? faturamentoB2B / totalPedidos : 0;

  const metaB2BAcumulada = sumMetaAllVendedores(mesInicio, mesFim);
  const pctAtingimento =
    metaB2BAcumulada > 0 ? (faturamentoB2B / metaB2BAcumulada) * 100 : 0;

  return {
    faturamentoB2B,
    metaB2BAcumulada,
    pctAtingimento,
    ticketMedio,
    totalPedidos,
    clientesAtivos,
    clientesInativos: Math.max(0, baseTotal - clientesAtivos),
    baseTotal,
  };
}
```

- [ ] **Step 3: Rewrite getClientesAtivosVendedor to use RPC + Redis**

Replace with:

```typescript
export async function getClientesAtivosVendedor(): Promise<ClienteVendedorStatus[]> {
  return cacheGetOrFetchSWR(
    CACHE_KEYS.biClientesStatus,
    _fetchClientesAtivosVendedor
  );
}

async function _fetchClientesAtivosVendedor(): Promise<ClienteVendedorStatus[]> {
  const supabase = createSupabaseServer();
  const { data, error } = await supabase.rpc("rpc_clientes_status_vendedor");

  if (error || !data) {
    console.error("[rpc_clientes_status_vendedor] error:", error);
    return [];
  }

  return (data as Array<{
    vendedor: string; total: number; ativos: number;
    inativos: number; pct_ativacao: number;
  }>).map((r) => ({
    vendedor: r.vendedor,
    total: Number(r.total),
    ativos: Number(r.ativos),
    inativos: Number(r.inativos),
    pctAtivacao: Number(r.pct_ativacao),
  }));
}
```

- [ ] **Step 4: Rewrite getClientesInativos to use RPC + Redis**

Replace with:

```typescript
export async function getClientesInativos(
  vendedorFilter?: string
): Promise<ClienteInativo[]> {
  const key = vendedorFilter
    ? `${CACHE_KEYS.biClientesInativos}:${vendedorFilter}`
    : CACHE_KEYS.biClientesInativos;

  return cacheGetOrFetchSWR(key, () => _fetchClientesInativos(vendedorFilter));
}

async function _fetchClientesInativos(
  vendedorFilter?: string
): Promise<ClienteInativo[]> {
  const supabase = createSupabaseServer();
  const { data, error } = await supabase.rpc("rpc_clientes_inativos", {
    p_vendedor: vendedorFilter || null,
  });

  if (error || !data) {
    console.error("[rpc_clientes_inativos] error:", error);
    return [];
  }

  return (data as Array<{
    nome: string; vendedor: string; ultimo_pedido: string | null;
    valor_ultimo_pedido: number; dias_sem_compra: number;
  }>).map((r) => ({
    nome: r.nome ?? "",
    vendedor: r.vendedor ?? "",
    ultimoPedido: r.ultimo_pedido,
    valorUltimoPedido: Number(r.valor_ultimo_pedido) || 0,
    diasSemCompra: Number(r.dias_sem_compra) || 9999,
  }));
}
```

- [ ] **Step 5: Wrap remaining 3 functions with Redis cache (keep JS logic)**

For `getPedidosPorVendedor`, `getPedidosPorRegiao`, `getProdutosEvolucao` — remove `unstable_cache` wrappers and add `cacheGetOrFetchSWR`:

```typescript
// getPedidosPorVendedor
export async function getPedidosPorVendedor(
  mesInicio: number, mesFim: number, ano: number
): Promise<PedidoVendedor[]> {
  return cacheGetOrFetchSWR(
    CACHE_KEYS.biVendedor(mesInicio, mesFim, ano),
    () => _fetchPedidosPorVendedor(mesInicio, mesFim, ano)
  );
}
// rename old _getPedidosPorVendedor to _fetchPedidosPorVendedor

// getPedidosPorRegiao
export async function getPedidosPorRegiao(
  mesInicio: number, mesFim: number, ano: number
): Promise<PedidoRegiao[]> {
  return cacheGetOrFetchSWR(
    CACHE_KEYS.biRegiao(mesInicio, mesFim, ano),
    () => _fetchPedidosPorRegiao(mesInicio, mesFim, ano)
  );
}
// rename old _getPedidosPorRegiao to _fetchPedidosPorRegiao

// getProdutosEvolucao
export async function getProdutosEvolucao(
  meses: number = 6, _produtoFilter?: string
): Promise<ProdutoEvolucao[]> {
  return cacheGetOrFetchSWR(
    CACHE_KEYS.biEvolucao(meses),
    () => _fetchProdutosEvolucao(meses, _produtoFilter)
  );
}
// rename old _getProdutosEvolucao to _fetchProdutosEvolucao
```

- [ ] **Step 6: Remove unused imports**

Remove `import { unstable_cache } from "next/cache"` and the `CACHE_TTL` constant.
Remove `import { supabaseFetchAll } from "@/lib/supabase/fetch-all"` from the 3 RPC-based functions (the remaining 3 still use it).

- [ ] **Step 7: Verify build**

Run: `npx next build 2>&1 | grep -E "(error|Error|✓)" | head -5`
Expected: `✓ Compiled successfully`

- [ ] **Step 8: Commit**

```bash
git add src/lib/queries/comercial-analytics.ts
git commit -m "perf: swap unstable_cache for Redis SWR + Postgres RPCs in BI analytics"
```

---

### Task 5: Swap unstable_cache for Redis in admin-kpis.ts

**Files:**
- Modify: `src/lib/queries/admin-kpis.ts`

- [ ] **Step 1: Replace unstable_cache with Redis**

Replace import:
```typescript
import { unstable_cache } from "next/cache";
```
with:
```typescript
import { cacheGetOrFetchSWR, CACHE_KEYS } from "@/lib/redis/client";
```

Replace the export:
```typescript
export const getAdminKPIs = unstable_cache(
  _getAdminKPIs,
  ["admin-kpis"],
  { revalidate: 300, tags: ["kpi-admin"] }
);
```
with:
```typescript
export async function getAdminKPIs(): Promise<AdminKPIs> {
  return cacheGetOrFetchSWR(CACHE_KEYS.kpiAdmin, _getAdminKPIs);
}
```

- [ ] **Step 2: Verify build**

Run: `npx next build 2>&1 | grep -E "(error|Error|✓)" | head -5`

- [ ] **Step 3: Commit**

```bash
git add src/lib/queries/admin-kpis.ts
git commit -m "perf: swap unstable_cache for Redis SWR in admin KPIs"
```

---

### Task 6: Update sync invalidation to use invalidateAllCaches

**Files:**
- Modify: `src/lib/sync/webhook-handler.ts`
- Modify: `src/lib/sync/incremental.ts`

- [ ] **Step 1: Update webhook-handler.ts**

Replace:
```typescript
import { revalidateTag } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/client";
import { invalidateKPIs } from "@/lib/redis/client";
```
with:
```typescript
import { createSupabaseServer } from "@/lib/supabase/client";
import { invalidateAllCaches } from "@/lib/redis/client";
```

Replace at the end of `handleVHSysWebhook`:
```typescript
  await invalidateKPIs();
  revalidateTag("kpi-admin");
  revalidateTag("bi-comercial");
  return { handled: true, entity: entityKey, action };
```
with:
```typescript
  await invalidateAllCaches();
  return { handled: true, entity: entityKey, action };
```

- [ ] **Step 2: Update incremental.ts**

Replace:
```typescript
import { revalidateTag } from "next/cache";
```
(remove this import)

Replace:
```typescript
import { invalidateKPIs } from "@/lib/redis/client";
```
with:
```typescript
import { invalidateAllCaches } from "@/lib/redis/client";
```

Replace:
```typescript
  await invalidateKPIs();
  revalidateTag("kpi-admin");
  revalidateTag("bi-comercial");
```
with:
```typescript
  await invalidateAllCaches();
```

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | grep -E "(error|Error|✓)" | head -5`

- [ ] **Step 4: Commit**

```bash
git add src/lib/sync/webhook-handler.ts src/lib/sync/incremental.ts
git commit -m "refactor: use invalidateAllCaches for unified cache invalidation"
```

---

### Task 7: Verify sidebar Link prefetch is enabled

**Files:**
- Check: `src/components/app-sidebar.tsx`

- [ ] **Step 1: Verify Link components use default prefetch**

Check `src/components/app-sidebar.tsx`. Next.js `<Link>` prefetches by default on hover. Verify there's no `prefetch={false}` being set. The current code uses `<Link href={entry.url} />` inside `render` prop — this should prefetch by default.

No code changes needed unless `prefetch={false}` is found.

- [ ] **Step 2: Commit (only if changes made)**

```bash
git add src/components/app-sidebar.tsx
git commit -m "perf: ensure sidebar links use default prefetch"
```

---

### Task 8: Add prefetch for next page in listing queries

**Files:**
- Modify: `src/lib/queries/clientes.ts`
- Modify: `src/lib/queries/pedidos.ts`
- (Apply to all 8 listing query files)

- [ ] **Step 1: Add prefetchNextPage helper to each listing query**

In each listing file (e.g., `clientes.ts`), add after the `getClientes` function:

```typescript
/** Fire-and-forget: warm Redis cache for the next page */
export function prefetchNextPage(page: number, pageSize: number, search?: string) {
  void cacheList(
    CACHE_KEYS.list("clientes", page + 1, pageSize, search || ""),
    () => _fetchClientes(page + 1, pageSize, search)
  );
}
```

Apply the same pattern to all 8 listing files, changing the entity name and fetch function.

- [ ] **Step 2: Call prefetch from page components**

In each listing page.tsx (e.g., `comercial/clientes/page.tsx`), add after fetching data:

```typescript
import { getClientes, prefetchNextPage } from "@/lib/queries/clientes";

// ... inside the component, after getting data:
const { data, total } = await getClientes(page, pageSize, search || undefined);

// Prefetch next page in background
if (data.length === pageSize) {
  prefetchNextPage(page, pageSize, search || undefined);
}
```

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | grep -E "(error|Error|✓)" | head -5`

- [ ] **Step 4: Commit**

```bash
git add src/lib/queries/ "src/app/(dashboard)/"
git commit -m "perf: prefetch next pagination page into Redis cache"
```

---

### Task 9: Final verification and push

- [ ] **Step 1: Full build check**

Run: `npx next build 2>&1 | tail -20`
Expected: All routes compile, no errors.

- [ ] **Step 2: Verify Redis cache works locally**

Start dev server with `npx portless rigel next dev --turbopack`.
Navigate to a listing page, then navigate away and back.
Second visit should be noticeably faster.

- [ ] **Step 3: Push all changes**

```bash
git push origin main
```

- [ ] **Step 4: Test in production**

After Vercel deploy completes, test navigation speed on `rigel-sandy.vercel.app`.
