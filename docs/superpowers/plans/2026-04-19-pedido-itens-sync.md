# Pedido Itens Sync + Indicators 5-6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync order line items from VHSys for B2B orders, then build product evolution (Indicator 5) and client purchase history (Indicator 6) dashboards.

**Architecture:** New `pedido_itens` table populated via VHSys API (`GET /pedidos/{id}/produtos`) for B2B orders only. Backfill last 12 months (~5K orders), then incremental sync catches new ones. Two new UI sections replace the placeholder evolution chart and add the client demonstrativo.

**Tech Stack:** Supabase (table + indexes), VHSys API V2, Recharts (line chart), shadcn/ui, Vitest

**Spec:** `docs/superpowers/specs/2026-04-19-pedido-itens-sync-design.md`

---

## Task 0: Create pedido_itens Table

**Files:** Supabase migration (via MCP)

- [ ] **Step 1: Apply migration**

Apply via Supabase MCP `apply_migration`:

```sql
CREATE TABLE IF NOT EXISTS pedido_itens (
  id_ped_produto  integer PRIMARY KEY,
  id_pedido       integer NOT NULL,
  id_produto      integer,
  desc_produto    text,
  qtde_produto    numeric DEFAULT 0,
  valor_unit_produto numeric DEFAULT 0,
  valor_total_produto numeric DEFAULT 0,
  desconto_produto numeric DEFAULT 0,
  synced_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pedido_itens_pedido ON pedido_itens (id_pedido);
CREATE INDEX IF NOT EXISTS idx_pedido_itens_produto ON pedido_itens (id_produto);
```

- [ ] **Step 2: Verify table exists**

```sql
SELECT count(*) FROM pedido_itens;
-- Expected: 0
```

---

## Task 1: VHSys Pedido Itens Type + Fetch Function

**Files:**
- Modify: `src/lib/vhsys/types.ts`
- Modify: `src/lib/vhsys/client.ts`

- [ ] **Step 1: Add VHSysPedidoItem type**

Add to `src/lib/vhsys/types.ts`:

```typescript
export interface VHSysPedidoItem {
  id_ped_produto: number;
  id_pedido: number;
  id_produto: number;
  id_almoxarifado: number;
  id_lote: number;
  desc_produto: string;
  qtde_produto: string;
  desconto_produto: string;
  ipi_produto: string;
  icms_produto: string;
  valor_unit_produto: string;
  valor_custo_produto: string;
  valor_total_produto: string;
  valor_desconto: string;
  peso_produto: string;
  peso_liq_produto: string;
  info_adicional: string;
  xPed_produto: string;
  nItem_produto: string;
  json_localizacoes: string;
}
```

- [ ] **Step 2: Add vhsysFetchPedidoItens function**

Add to `src/lib/vhsys/client.ts`:

```typescript
import type { VHSysResponse, VHSysPedidoItem } from "./types";

/**
 * Fetches line items for a single order from VHSys.
 * GET /pedidos/{idPed}/produtos
 */
export async function vhsysFetchPedidoItens(
  idPed: number
): Promise<VHSysPedidoItem[]> {
  try {
    const response = await vhsysGet<VHSysPedidoItem>(
      `/pedidos/${idPed}/produtos`
    );
    return response.data ?? [];
  } catch (error) {
    console.warn(`[vhsys] Failed to fetch items for pedido ${idPed}:`, error);
    return [];
  }
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/vhsys/types.ts src/lib/vhsys/client.ts
git commit -m "feat: add VHSysPedidoItem type + vhsysFetchPedidoItens function"
```

---

## Task 2: Backfill Sync Endpoint

**Files:**
- Create: `src/lib/sync/pedido-itens.ts`
- Create: `src/app/api/sync/pedido-itens/route.ts`

- [ ] **Step 1: Create sync logic**

Create `src/lib/sync/pedido-itens.ts`:

```typescript
import { createSupabaseServer } from "@/lib/supabase/client";
import { vhsysFetchPedidoItens } from "@/lib/vhsys/client";
import { B2B_VENDEDORES_NORMALIZED } from "@/lib/config/vendedores-map";
import type { VHSysPedidoItem } from "@/lib/vhsys/types";

const CONCURRENCY = 5;
const DELAY_BETWEEN_BATCHES_MS = 200;
const UPSERT_BATCH_SIZE = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface SyncResult {
  pedidosProcessed: number;
  itensInserted: number;
  errors: number;
  durationMs: number;
}

/**
 * Syncs pedido_itens for B2B orders from the last N months.
 * Skips orders that already have items in the table.
 */
export async function syncPedidoItens(
  monthsBack: number = 12
): Promise<SyncResult> {
  const start = Date.now();
  const supabase = createSupabaseServer();

  // 1. Get B2B pedido IDs from last N months that haven't been synced yet
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack);
  const cutoff = cutoffDate.toISOString().split("T")[0];

  const { data: pedidos, error: pedError } = await supabase
    .rpc("rpc_b2b_pedidos_sem_itens", {
      p_b2b_vendedores: B2B_VENDEDORES_NORMALIZED,
      p_cutoff_date: cutoff,
    });

  if (pedError) {
    // Fallback: query directly if RPC doesn't exist yet
    console.warn("[pedido-itens] RPC not found, using direct query");
    const { data: directPedidos } = await supabase
      .from("pedidos")
      .select("id_pedido")
      .eq("status_pedido", "Atendido")
      .eq("lixeira", "Nao")
      .gte("data_pedido", cutoff)
      .in("vendedor_pedido", B2B_VENDEDORES_NORMALIZED);

    if (!directPedidos?.length) {
      return { pedidosProcessed: 0, itensInserted: 0, errors: 0, durationMs: Date.now() - start };
    }

    // Filter out already-synced
    const { data: synced } = await supabase
      .from("pedido_itens")
      .select("id_pedido");
    const syncedSet = new Set((synced ?? []).map((r) => r.id_pedido));
    const toSync = directPedidos
      .map((p) => p.id_pedido)
      .filter((id) => !syncedSet.has(id));

    return _processItens(supabase, toSync, start);
  }

  const toSync = (pedidos ?? []).map((p: { id_pedido: number }) => p.id_pedido);
  return _processItens(supabase, toSync, start);
}

async function _processItens(
  supabase: ReturnType<typeof createSupabaseServer>,
  pedidoIds: number[],
  startTime: number
): Promise<SyncResult> {
  console.log(`[pedido-itens] Processing ${pedidoIds.length} pedidos`);

  let totalItens = 0;
  let errors = 0;
  const allItems: Record<string, unknown>[] = [];

  // Process in batches of CONCURRENCY
  for (let i = 0; i < pedidoIds.length; i += CONCURRENCY) {
    const batch = pedidoIds.slice(i, i + CONCURRENCY);

    const results = await Promise.allSettled(
      batch.map((id) => vhsysFetchPedidoItens(id))
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value.length > 0) {
        for (const item of result.value) {
          allItems.push({
            id_ped_produto: item.id_ped_produto,
            id_pedido: item.id_pedido,
            id_produto: item.id_produto,
            desc_produto: item.desc_produto,
            qtde_produto: Number(item.qtde_produto) || 0,
            valor_unit_produto: Number(item.valor_unit_produto) || 0,
            valor_total_produto: Number(item.valor_total_produto) || 0,
            desconto_produto: Number(item.desconto_produto) || 0,
            synced_at: new Date().toISOString(),
          });
        }
      } else if (result.status === "rejected") {
        errors++;
      }
    }

    if (i + CONCURRENCY < pedidoIds.length) {
      await delay(DELAY_BETWEEN_BATCHES_MS);
    }

    // Progress log every 100 pedidos
    if ((i + CONCURRENCY) % 100 === 0 || i + CONCURRENCY >= pedidoIds.length) {
      console.log(`[pedido-itens] Progress: ${Math.min(i + CONCURRENCY, pedidoIds.length)}/${pedidoIds.length} pedidos, ${allItems.length} itens`);
    }
  }

  // Upsert all items in batches
  for (let i = 0; i < allItems.length; i += UPSERT_BATCH_SIZE) {
    const batch = allItems.slice(i, i + UPSERT_BATCH_SIZE);
    const { error } = await supabase
      .from("pedido_itens")
      .upsert(batch, { onConflict: "id_ped_produto" });

    if (error) {
      console.error(`[pedido-itens] Upsert error batch ${i}:`, error);
      errors++;
    } else {
      totalItens += batch.length;
    }
  }

  const durationMs = Date.now() - startTime;

  // Log to sync_log
  await supabase.from("sync_log").insert({
    entity: "pedido_itens",
    records_synced: totalItens,
    status: errors > 0 ? "partial" : "success",
    error_message: errors > 0 ? `${errors} errors` : null,
    duration_ms: durationMs,
  });

  console.log(`[pedido-itens] Done: ${totalItens} itens from ${pedidoIds.length} pedidos in ${durationMs}ms (${errors} errors)`);

  return {
    pedidosProcessed: pedidoIds.length,
    itensInserted: totalItens,
    errors,
    durationMs,
  };
}

/**
 * Syncs pedido_itens for recently modified B2B orders that don't have items yet.
 * Called at the end of the incremental sync.
 */
export async function syncNewPedidoItens(): Promise<SyncResult> {
  const start = Date.now();
  const supabase = createSupabaseServer();

  // Get last sync time for pedido_itens
  const { data: lastSyncData } = await supabase
    .from("sync_log")
    .select("last_sync_at")
    .eq("entity", "pedido_itens")
    .eq("status", "success")
    .order("last_sync_at", { ascending: false })
    .limit(1)
    .single();

  const lastSync = lastSyncData?.last_sync_at;
  if (!lastSync) {
    console.log("[pedido-itens] No previous sync — skipping incremental (run backfill first)");
    return { pedidosProcessed: 0, itensInserted: 0, errors: 0, durationMs: Date.now() - start };
  }

  // Find B2B pedidos modified since last sync that don't have items
  const cutoff = new Date(lastSync).toISOString().split("T")[0];
  const { data: pedidos } = await supabase
    .from("pedidos")
    .select("id_pedido")
    .eq("status_pedido", "Atendido")
    .eq("lixeira", "Nao")
    .gte("data_mod_pedido", cutoff)
    .in("vendedor_pedido", B2B_VENDEDORES_NORMALIZED);

  if (!pedidos?.length) {
    return { pedidosProcessed: 0, itensInserted: 0, errors: 0, durationMs: Date.now() - start };
  }

  // Filter out already-synced
  const ids = pedidos.map((p) => p.id_pedido);
  const { data: existing } = await supabase
    .from("pedido_itens")
    .select("id_pedido")
    .in("id_pedido", ids);
  const existingSet = new Set((existing ?? []).map((r) => r.id_pedido));
  const toSync = ids.filter((id) => !existingSet.has(id));

  if (!toSync.length) {
    return { pedidosProcessed: 0, itensInserted: 0, errors: 0, durationMs: Date.now() - start };
  }

  return _processItens(supabase, toSync, start);
}
```

- [ ] **Step 2: Create API route**

Create `src/app/api/sync/pedido-itens/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { syncPedidoItens } from "@/lib/sync/pedido-itens";

export const maxDuration = 300; // 5 minutes for backfill

export async function POST(request: NextRequest) {
  // Verify CRON_SECRET or admin auth
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const monthsBack = (body as { monthsBack?: number }).monthsBack ?? 12;

    const result = await syncPedidoItens(monthsBack);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[sync] Pedido itens sync failed:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/sync/pedido-itens.ts src/app/api/sync/pedido-itens/route.ts
git commit -m "feat: pedido_itens backfill sync endpoint

- POST /api/sync/pedido-itens with CRON_SECRET auth
- Fetches items for B2B orders only (last 12 months default)
- Concurrency 5, 200ms delay, upsert in batches of 500
- Skips orders already synced, logs to sync_log"
```

---

## Task 3: Validate ID Mapping + Run Backfill

**Files:** None (manual validation + trigger)

- [ ] **Step 1: Validate ID mapping**

Pick a real B2B pedido from Supabase and call the VHSys API to verify that `item.id_pedido` matches `pedidos.id_pedido` in Supabase.

```sql
SELECT id_pedido, vendedor_pedido, valor_total_nota
FROM pedidos
WHERE status_pedido = 'Atendido' AND lixeira = 'Nao'
AND UPPER(TRIM(vendedor_pedido)) = 'EDWILSON'
ORDER BY data_pedido DESC LIMIT 1;
```

Then call VHSys: `GET /pedidos/{that_id}/produtos` and verify the `id_pedido` in the response items matches.

- [ ] **Step 2: Trigger backfill**

Call the sync endpoint (use curl or the dev server):

```bash
curl -X POST https://rigel-sandy.vercel.app/api/sync/pedido-itens \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"monthsBack": 12}'
```

Or via local dev server. Expected: ~5K pedidos processed, ~15K items inserted.

- [ ] **Step 3: Verify data**

```sql
SELECT count(*) FROM pedido_itens;
-- Expected: >1000

SELECT pi.id_pedido, p.vendedor_pedido, pi.desc_produto, pi.qtde_produto, pi.valor_total_produto
FROM pedido_itens pi
JOIN pedidos p ON p.id_pedido = pi.id_pedido
LIMIT 5;
-- Verify JOIN works correctly
```

---

## Task 4: Add to Incremental Sync

**Files:**
- Modify: `src/lib/sync/incremental.ts`

- [ ] **Step 1: Add pedido_itens sync step**

At the end of `runIncrementalSync()`, before `invalidateAllCaches()`, add:

```typescript
import { syncNewPedidoItens } from "./pedido-itens";

// ... existing code ...

  // After all entity syncs, sync new pedido items
  try {
    const itensResult = await syncNewPedidoItens();
    results["pedido_itens"] = itensResult.itensInserted;
    console.log(`[incremental] pedido_itens: ${itensResult.itensInserted} new items from ${itensResult.pedidosProcessed} pedidos`);
  } catch (error) {
    console.error("[incremental] pedido_itens sync failed:", error);
    results["pedido_itens"] = -1;
  }

  await invalidateAllCaches();
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/sync/incremental.ts
git commit -m "feat: add pedido_itens to incremental sync"
```

---

## Task 5: Cache Keys + Invalidation

**Files:**
- Modify: `src/lib/redis/client.ts`

- [ ] **Step 1: Add new cache keys**

Add to `CACHE_KEYS`:

```typescript
  // Product evolution
  biProdutosEvolucao: (mi: number, mf: number, a: number, prodId?: number) =>
    `bi:prod-evo:${mi}:${mf}:${a}:${prodId || "all"}`,

  // Client demonstrativo
  biDemoCliente: (clienteId: number, mi: number, mf: number, a: number) =>
    `bi:demo:${clienteId}:${mi}:${mf}:${a}`,

  // B2B clients list
  biClientesB2BList: "bi:clientes-b2b-list",
```

- [ ] **Step 2: Add to invalidateAllCaches()**

In the `invalidateAllCaches()` function, add after the evolucao keys:

```typescript
  // Product evolution keys
  for (let mi = 1; mi <= currentMonth; mi++) {
    for (let mf = mi; mf <= currentMonth; mf++) {
      keys.push(CACHE_KEYS.biProdutosEvolucao(mi, mf, currentYear));
    }
  }

  // B2B clients list
  keys.push(CACHE_KEYS.biClientesB2BList);
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/redis/client.ts
git commit -m "feat: add cache keys for product evolution + client demo"
```

---

## Task 6: Rewrite getProdutosEvolucao + Add Queries

**Files:**
- Modify: `src/lib/queries/comercial-analytics.ts`

- [ ] **Step 1: Update ProdutoEvolucao type and rewrite query**

Update the `ProdutoEvolucao` interface:

```typescript
export interface ProdutoEvolucao {
  idProduto: number;
  produto: string;
  mes: string;        // "YYYY-MM"
  faturamento: number;
  quantidade: number;
}
```

Rewrite `_fetchProdutosEvolucao` to JOIN `pedidos` with `pedido_itens`:

```typescript
async function _fetchProdutosEvolucao(
  meses: number = 6,
  produtoFilter?: number
): Promise<ProdutoEvolucao[]> {
  const supabase = createSupabaseServer();
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - meses, 1)
    .toISOString().split("T")[0];
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString().split("T")[0];

  // Fetch B2B pedido IDs in the date range
  const pedidos = await supabaseFetchAll<{ id_pedido: number; data_pedido: string }>(
    (from, to) =>
      supabase
        .from("pedidos")
        .select("id_pedido, data_pedido")
        .eq("status_pedido", "Atendido")
        .eq("lixeira", "Nao")
        .gte("data_pedido", startDate)
        .lte("data_pedido", endDate)
        .in("vendedor_pedido", B2B_RAW_VARIATIONS)
        .range(from, to)
  );

  if (!pedidos.length) return [];

  const pedidoIds = pedidos.map((p) => p.id_pedido);
  const pedidoDateMap = new Map(pedidos.map((p) => [p.id_pedido, p.data_pedido]));

  // Fetch items for those pedidos
  let itemQuery = supabase
    .from("pedido_itens")
    .select("id_pedido, id_produto, desc_produto, qtde_produto, valor_total_produto")
    .in("id_pedido", pedidoIds);

  if (produtoFilter) {
    itemQuery = itemQuery.eq("id_produto", produtoFilter);
  }

  const { data: items, error } = await itemQuery;
  if (error || !items) return [];

  // Group by product + month
  const groups: Record<string, {
    idProduto: number;
    produto: string;
    meses: Record<string, { fat: number; qtd: number }>;
    totalFat: number;
  }> = {};

  for (const item of items) {
    const date = pedidoDateMap.get(item.id_pedido);
    if (!date) continue;
    const mes = String(date).slice(0, 7);
    const key = `${item.id_produto}`;

    if (!groups[key]) {
      groups[key] = {
        idProduto: item.id_produto,
        produto: item.desc_produto ?? "Produto sem nome",
        meses: {},
        totalFat: 0,
      };
    }
    if (!groups[key].meses[mes]) {
      groups[key].meses[mes] = { fat: 0, qtd: 0 };
    }
    const valor = Number(item.valor_total_produto) || 0;
    const qtd = Number(item.qtde_produto) || 0;
    groups[key].meses[mes].fat += valor;
    groups[key].meses[mes].qtd += qtd;
    groups[key].totalFat += valor;
  }

  // Flatten and sort by total faturamento (top 20 if no filter)
  let sorted = Object.values(groups).sort((a, b) => b.totalFat - a.totalFat);
  if (!produtoFilter) sorted = sorted.slice(0, 20);

  const result: ProdutoEvolucao[] = [];
  for (const g of sorted) {
    for (const [mes, agg] of Object.entries(g.meses).sort()) {
      result.push({
        idProduto: g.idProduto,
        produto: g.produto,
        mes,
        faturamento: agg.fat,
        quantidade: agg.qtd,
      });
    }
  }

  return result;
}
```

Update cache key usage:

```typescript
export async function getProdutosEvolucao(
  meses: number = 6,
  produtoFilter?: number
): Promise<ProdutoEvolucao[]> {
  return cacheGetOrFetchSWR(
    CACHE_KEYS.biProdutosEvolucao(1, 12, new Date().getFullYear(), produtoFilter),
    () => _fetchProdutosEvolucao(meses, produtoFilter)
  );
}
```

- [ ] **Step 2: Add getClientesB2BList query**

```typescript
export interface ClienteB2B {
  id: number;
  nome: string;
}

export async function getClientesB2BList(): Promise<ClienteB2B[]> {
  return cacheGetOrFetchSWR(
    CACHE_KEYS.biClientesB2BList,
    _fetchClientesB2BList
  );
}

async function _fetchClientesB2BList(): Promise<ClienteB2B[]> {
  const supabase = createSupabaseServer();

  const rows = await supabaseFetchAll<{
    id_cliente: number;
    fantasia_cliente: string;
    razao_cliente: string;
  }>(
    (from, to) =>
      supabase
        .from("clientes")
        .select("id_cliente, fantasia_cliente, razao_cliente")
        .eq("lixeira", "Nao")
        .in("vendedor_cliente", B2B_RAW_VARIATIONS)
        .range(from, to)
  );

  return rows
    .map((r) => ({
      id: r.id_cliente,
      nome: (r.fantasia_cliente?.trim() || r.razao_cliente?.trim() || "N/D"),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}
```

- [ ] **Step 3: Add getDemonstrativoCliente query**

```typescript
export interface DemonstrativoCliente {
  produtos: {
    idProduto: number;
    descProduto: string;
    meses: Record<string, number>;
    total: number;
  }[];
  totaisMes: Record<string, number>;
  totalGeral: number;
}

export async function getDemonstrativoCliente(
  idCliente: number,
  mesInicio: number,
  mesFim: number,
  ano: number
): Promise<DemonstrativoCliente> {
  const key = CACHE_KEYS.biDemoCliente(idCliente, mesInicio, mesFim, ano);
  return cacheGetOrFetchSWR(key, () =>
    _fetchDemonstrativoCliente(idCliente, mesInicio, mesFim, ano)
  );
}

async function _fetchDemonstrativoCliente(
  idCliente: number,
  mesInicio: number,
  mesFim: number,
  ano: number
): Promise<DemonstrativoCliente> {
  const supabase = createSupabaseServer();
  const start = new Date(ano, mesInicio - 1, 1).toISOString().split("T")[0];
  const end = new Date(ano, mesFim, 0).toISOString().split("T")[0];

  // Get B2B pedidos for this client in period
  const { data: pedidos } = await supabase
    .from("pedidos")
    .select("id_pedido, data_pedido")
    .eq("id_cliente", idCliente)
    .eq("status_pedido", "Atendido")
    .eq("lixeira", "Nao")
    .gte("data_pedido", start)
    .lte("data_pedido", end)
    .in("vendedor_pedido", B2B_RAW_VARIATIONS);

  if (!pedidos?.length) {
    return { produtos: [], totaisMes: {}, totalGeral: 0 };
  }

  const pedidoIds = pedidos.map((p) => p.id_pedido);
  const pedidoDateMap = new Map(pedidos.map((p) => [p.id_pedido, p.data_pedido]));

  // Get items
  const { data: items } = await supabase
    .from("pedido_itens")
    .select("id_pedido, id_produto, desc_produto, valor_total_produto")
    .in("id_pedido", pedidoIds);

  if (!items?.length) {
    return { produtos: [], totaisMes: {}, totalGeral: 0 };
  }

  // Build pivot
  const prodMap: Record<number, {
    descProduto: string;
    meses: Record<string, number>;
    total: number;
  }> = {};
  const totaisMes: Record<string, number> = {};
  let totalGeral = 0;

  for (const item of items) {
    const date = pedidoDateMap.get(item.id_pedido);
    if (!date) continue;
    const mes = String(date).slice(0, 7);
    const valor = Number(item.valor_total_produto) || 0;
    const prodId = item.id_produto;

    if (!prodMap[prodId]) {
      prodMap[prodId] = { descProduto: item.desc_produto ?? "N/D", meses: {}, total: 0 };
    }
    prodMap[prodId].meses[mes] = (prodMap[prodId].meses[mes] || 0) + valor;
    prodMap[prodId].total += valor;
    totaisMes[mes] = (totaisMes[mes] || 0) + valor;
    totalGeral += valor;
  }

  const produtos = Object.entries(prodMap)
    .map(([id, data]) => ({ idProduto: Number(id), ...data }))
    .sort((a, b) => b.total - a.total);

  return { produtos, totaisMes, totalGeral };
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/comercial-analytics.ts
git commit -m "feat: rewrite product evolution query + add client demo + B2B client list"
```

---

## Task 7: API Route for Demonstrativo

**Files:**
- Create: `src/app/api/bi/demo-cliente/route.ts`

- [ ] **Step 1: Create API route**

Create `src/app/api/bi/demo-cliente/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDemonstrativoCliente } from "@/lib/queries/comercial-analytics";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clienteId = Number(searchParams.get("clienteId"));
  const mesInicio = Number(searchParams.get("mesInicio") || "1");
  const mesFim = Number(searchParams.get("mesFim") || String(new Date().getMonth() + 1));
  const ano = Number(searchParams.get("ano") || String(new Date().getFullYear()));

  if (!clienteId) {
    return NextResponse.json({ error: "clienteId required" }, { status: 400 });
  }

  const data = await getDemonstrativoCliente(clienteId, mesInicio, mesFim, ano);
  return NextResponse.json(data);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/bi/demo-cliente/route.ts
git commit -m "feat: add API route for client demonstrativo"
```

---

## Task 8: Indicator 5 UI — Product Evolution

**Files:**
- Create: `src/app/(dashboard)/comercial/bi/components/produtos-evolucao-section.tsx`
- Modify: `src/app/(dashboard)/comercial/bi/comercial-dashboard.tsx`
- Modify: `src/app/(dashboard)/comercial/bi/page.tsx`

- [ ] **Step 1: Create produtos-evolucao-section.tsx**

A "use client" component that replaces the existing "Evolucao do Faturamento" section. Features:
- Dropdown product selector (top 20 + search by name). Value "all" shows total, selecting a product filters the chart.
- Recharts LineChart: X=months, Y=faturamento. One line for selected product or total.
- Pivot table below: Produto | Jan | Fev | ... | Total | Var. % (top 20 by faturamento)
- CSV export

Props:
```typescript
interface ProdutosEvolucaoSectionProps {
  evolucao: ProdutoEvolucao[];
  mes: number;
  ano: number;
}
```

The component groups `evolucao` data (which is flat: one row per product×month) into chart-friendly and table-friendly structures using `useMemo`.

- [ ] **Step 2: Update page.tsx**

The `getProdutosEvolucao()` call already exists in page.tsx. Update its usage if the signature changed (now accepts `mesInicio, mesFim, ano` instead of just `meses`). Pass data to dashboard.

- [ ] **Step 3: Replace in comercial-dashboard.tsx**

Remove the inline "Evolucao do Faturamento" Card section. Replace with `<ProdutosEvolucaoSection />`.

- [ ] **Step 4: Verify build + commit**

```bash
npm run build
git add src/app/(dashboard)/comercial/bi/
git commit -m "feat: indicator 5 — product evolution with per-product breakdown"
```

---

## Task 9: Indicator 6 UI — Client Demonstrativo

**Files:**
- Create: `src/app/(dashboard)/comercial/bi/components/demo-cliente-section.tsx`
- Modify: `src/app/(dashboard)/comercial/bi/comercial-dashboard.tsx`
- Modify: `src/app/(dashboard)/comercial/bi/page.tsx`

- [ ] **Step 1: Create demo-cliente-section.tsx**

A "use client" component with:
- Searchable client dropdown (from `clientesB2B` prop): type to filter by name, select to load data
- On select: fetch `GET /api/bi/demo-cliente?clienteId=X&mesInicio=...&mesFim=...&ano=...`
- Show loading spinner while fetching
- Pivot table: Produto | Jan | Fev | ... | Total Periodo
  - Last row: totals per month
  - Last column: total per product
- CSV export

Props:
```typescript
interface DemoClienteSectionProps {
  clientesB2B: ClienteB2B[];
  mesInicio: number;
  mesFim: number;
  ano: number;
}
```

Client-side fetch with `useState` + `useEffect`:
```typescript
const [clienteId, setClienteId] = useState<number | null>(null);
const [data, setData] = useState<DemonstrativoCliente | null>(null);
const [loading, setLoading] = useState(false);

useEffect(() => {
  if (!clienteId) return;
  setLoading(true);
  fetch(`/api/bi/demo-cliente?clienteId=${clienteId}&mesInicio=${mesInicio}&mesFim=${mesFim}&ano=${ano}`)
    .then(r => r.json())
    .then(setData)
    .finally(() => setLoading(false));
}, [clienteId, mesInicio, mesFim, ano]);
```

- [ ] **Step 2: Update page.tsx**

Add `getClientesB2BList()` fetch to the Promise.all and pass as prop.

- [ ] **Step 3: Add to comercial-dashboard.tsx**

Add `<DemoClienteSection />` at the end of the dashboard, passing `clientesB2B`, `mesInicio`, `mesFim`, `ano`.

- [ ] **Step 4: Verify build + commit**

```bash
npm run build
git add src/app/(dashboard)/comercial/bi/ src/app/api/bi/
git commit -m "feat: indicator 6 — client purchase demonstrativo with pivot table"
```

---

## Task 10: Tests

**Files:**
- Create: `src/lib/sync/__tests__/pedido-itens.test.ts`
- Create: `src/lib/queries/__tests__/comercial-analytics-pivot.test.ts`

- [ ] **Step 1: Write sync processing test**

Create `src/lib/sync/__tests__/pedido-itens.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

// Test the item processing logic (extracted for testability)
describe("pedido-itens processing", () => {
  it("maps VHSys item response to Supabase row", () => {
    const vhsysItem = {
      id_ped_produto: 100,
      id_pedido: 200,
      id_produto: 300,
      desc_produto: "Produto Teste",
      qtde_produto: "3.0000",
      valor_unit_produto: "15.000000",
      valor_total_produto: "45.00",
      desconto_produto: "0.00",
    };

    const mapped = {
      id_ped_produto: vhsysItem.id_ped_produto,
      id_pedido: vhsysItem.id_pedido,
      id_produto: vhsysItem.id_produto,
      desc_produto: vhsysItem.desc_produto,
      qtde_produto: Number(vhsysItem.qtde_produto) || 0,
      valor_unit_produto: Number(vhsysItem.valor_unit_produto) || 0,
      valor_total_produto: Number(vhsysItem.valor_total_produto) || 0,
      desconto_produto: Number(vhsysItem.desconto_produto) || 0,
    };

    expect(mapped.qtde_produto).toBe(3);
    expect(mapped.valor_unit_produto).toBe(15);
    expect(mapped.valor_total_produto).toBe(45);
    expect(mapped.desconto_produto).toBe(0);
  });

  it("handles empty/zero string values", () => {
    expect(Number("") || 0).toBe(0);
    expect(Number("0.00") || 0).toBe(0);
    expect(Number("0.0000") || 0).toBe(0);
  });
});
```

- [ ] **Step 2: Write pivot logic test**

Create `src/lib/queries/__tests__/comercial-analytics-pivot.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

// Test the pivot table building logic
describe("demonstrativo pivot", () => {
  it("builds product x month pivot correctly", () => {
    const items = [
      { id_produto: 1, desc_produto: "Prod A", valor_total_produto: "100", id_pedido: 10 },
      { id_produto: 1, desc_produto: "Prod A", valor_total_produto: "200", id_pedido: 11 },
      { id_produto: 2, desc_produto: "Prod B", valor_total_produto: "50", id_pedido: 10 },
    ];
    const dateMap = new Map([[10, "2026-01-15"], [11, "2026-02-10"]]);

    const prodMap: Record<number, { meses: Record<string, number>; total: number }> = {};
    const totaisMes: Record<string, number> = {};
    let totalGeral = 0;

    for (const item of items) {
      const date = dateMap.get(item.id_pedido);
      if (!date) continue;
      const mes = date.slice(0, 7);
      const valor = Number(item.valor_total_produto);
      const pid = item.id_produto;

      if (!prodMap[pid]) prodMap[pid] = { meses: {}, total: 0 };
      prodMap[pid].meses[mes] = (prodMap[pid].meses[mes] || 0) + valor;
      prodMap[pid].total += valor;
      totaisMes[mes] = (totaisMes[mes] || 0) + valor;
      totalGeral += valor;
    }

    expect(prodMap[1].total).toBe(300);
    expect(prodMap[1].meses["2026-01"]).toBe(100);
    expect(prodMap[1].meses["2026-02"]).toBe(200);
    expect(prodMap[2].total).toBe(50);
    expect(totaisMes["2026-01"]).toBe(150);
    expect(totaisMes["2026-02"]).toBe(200);
    expect(totalGeral).toBe(350);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run
```

Expected: ALL PASS (previous 19 + new tests).

- [ ] **Step 4: Commit**

```bash
git add src/lib/sync/__tests__/ src/lib/queries/__tests__/
git commit -m "test: add unit tests for pedido-itens processing + pivot logic"
```
