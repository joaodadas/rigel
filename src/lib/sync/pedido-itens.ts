import { createSupabaseServer } from "@/lib/supabase/client";
import { supabaseFetchAll } from "@/lib/supabase/fetch-all";
import { vhsysFetchPedidoItens } from "@/lib/vhsys/client";
import { B2B_VENDEDORES_NORMALIZED } from "@/lib/config/vendedores-map";

const CONCURRENCY = 5;
const DELAY_BETWEEN_BATCHES_MS = 200;
const UPSERT_BATCH_SIZE = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface SyncResult {
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

  // 1. Compute cutoff date
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack);
  const cutoff = cutoffDate.toISOString().split("T")[0];

  // 2. Query ALL B2B pedidos — need BOTH id_pedido (our PK/FK) and id_ped (VHSys API ID)
  const directPedidos = await supabaseFetchAll<{ id_pedido: number; id_ped: number }>(
    (from, to) =>
      supabase
        .from("pedidos")
        .select("id_pedido, id_ped")
        .eq("status_pedido", "Atendido")
        .eq("lixeira", "Nao")
        .gte("data_pedido", cutoff)
        .in("vendedor_pedido", B2B_VENDEDORES_NORMALIZED)
        .range(from, to)
  );

  if (!directPedidos.length) {
    return { pedidosProcessed: 0, itensInserted: 0, errors: 0, durationMs: Date.now() - start };
  }

  // 3. Filter out pedidos that already have items synced
  const synced = await supabaseFetchAll<{ id_pedido: number }>(
    (from, to) =>
      supabase
        .from("pedido_itens")
        .select("id_pedido")
        .range(from, to)
  );
  const syncedSet = new Set(synced.map((r) => r.id_pedido));
  console.log(`[pedido-itens] Found ${directPedidos.length} B2B pedidos, ${syncedSet.size} already synced`);
  const toSync = directPedidos
    .filter((p) => !syncedSet.has(p.id_pedido))
    .map((p) => ({ idPedido: p.id_pedido, idPed: p.id_ped }));

  return _processItens(supabase, toSync, start);
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
    .select("created_at")
    .eq("entity", "pedido_itens")
    .eq("status", "success")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const lastSync = lastSyncData?.created_at;
  if (!lastSync) {
    console.log("[pedido-itens] No previous sync — skipping incremental (run backfill first)");
    return { pedidosProcessed: 0, itensInserted: 0, errors: 0, durationMs: Date.now() - start };
  }

  // Find B2B pedidos modified since last sync that don't have items
  const cutoff = new Date(lastSync).toISOString().split("T")[0];
  const { data: pedidos } = await supabase
    .from("pedidos")
    .select("id_pedido, id_ped")
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
  const toSync = pedidos
    .filter((p) => !existingSet.has(p.id_pedido))
    .map((p) => ({ idPedido: p.id_pedido as number, idPed: p.id_ped as number }));

  if (!toSync.length) {
    return { pedidosProcessed: 0, itensInserted: 0, errors: 0, durationMs: Date.now() - start };
  }

  return _processItens(supabase, toSync, start);
}

interface PedidoRef {
  idPedido: number; // Supabase PK (pedidos.id_pedido) — used as FK in pedido_itens
  idPed: number;    // VHSys internal ID (pedidos.id_ped) — used in API URL
}

async function _processItens(
  supabase: ReturnType<typeof createSupabaseServer>,
  pedidos: PedidoRef[],
  startTime: number
): Promise<SyncResult> {
  console.log(`[pedido-itens] Processing ${pedidos.length} pedidos`);

  let totalItens = 0;
  let errors = 0;
  const allItems: Record<string, unknown>[] = [];

  // Process in batches of CONCURRENCY
  for (let i = 0; i < pedidos.length; i += CONCURRENCY) {
    const batch = pedidos.slice(i, i + CONCURRENCY);

    const results = await Promise.allSettled(
      batch.map((p) => vhsysFetchPedidoItens(p.idPed)) // Use id_ped for VHSys API
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const pedido = batch[j];
      if (result.status === "fulfilled" && result.value.length > 0) {
        for (const item of result.value) {
          allItems.push({
            id_ped_produto: item.id_ped_produto,
            id_pedido: pedido.idPedido, // Use OUR Supabase PK as FK, not VHSys's id_pedido
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

    if (i + CONCURRENCY < pedidos.length) {
      await delay(DELAY_BETWEEN_BATCHES_MS);
    }

    // Progress log every 100 pedidos
    if ((i + CONCURRENCY) % 100 === 0 || i + CONCURRENCY >= pedidos.length) {
      console.log(`[pedido-itens] Progress: ${Math.min(i + CONCURRENCY, pedidos.length)}/${pedidos.length} pedidos, ${allItems.length} itens`);
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

  console.log(`[pedido-itens] Done: ${totalItens} itens from ${pedidos.length} pedidos in ${durationMs}ms (${errors} errors)`);

  return {
    pedidosProcessed: pedidos.length,
    itensInserted: totalItens,
    errors,
    durationMs,
  };
}
