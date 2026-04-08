import { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase/client";
import { vhsysFetchAll } from "@/lib/vhsys/client";
import { ENDPOINTS } from "@/lib/vhsys/endpoints";
import { cacheSet, CACHE_KEYS } from "@/lib/redis/client";
import type {
  VHSysVendedor,
  VHSysCliente,
  VHSysProduto,
  VHSysPedido,
  VHSysContaPagar,
  VHSysContaReceber,
} from "@/lib/vhsys/types";

const BATCH_SIZE = 500;

async function syncEntity<T extends object>(
  supabase: SupabaseClient,
  entity: string,
  endpoint: string,
  primaryKey: string
): Promise<T[]> {
  const start = Date.now();
  console.log(`[sync] Starting ${entity}...`);

  const items = await vhsysFetchAll<T>(endpoint);
  console.log(`[sync] Fetched ${items.length} ${entity}`);

  // Upsert in batches of 500
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE).map((item) => ({
      ...item,
      synced_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from(entity)
      .upsert(batch, { onConflict: primaryKey });

    if (error) {
      console.error(`[sync] Error upserting ${entity} batch ${i}:`, error);
      throw error;
    }
  }

  const duration = Date.now() - start;
  console.log(`[sync] ${entity} done: ${items.length} records in ${duration}ms`);

  // Log sync
  await supabase.from("sync_log").insert({
    entity,
    records_synced: items.length,
    status: "success",
    duration_ms: duration,
  });

  return items;
}

export async function runInitialSync(): Promise<Record<string, number>> {
  const supabase = createSupabaseServer();
  const results: Record<string, number> = {};

  try {
    // Sync in order: entities without FK first
    const vendedores = await syncEntity<VHSysVendedor>(
      supabase,
      "vendedores",
      ENDPOINTS.vendedores,
      "id_vendedor"
    );
    results.vendedores = vendedores.length;

    const clientes = await syncEntity<VHSysCliente>(
      supabase,
      "clientes",
      ENDPOINTS.clientes,
      "id_cliente"
    );
    results.clientes = clientes.length;

    const produtos = await syncEntity<VHSysProduto>(
      supabase,
      "produtos",
      ENDPOINTS.produtos,
      "id_produto"
    );
    results.produtos = produtos.length;

    const pedidos = await syncEntity<VHSysPedido>(
      supabase,
      "pedidos",
      ENDPOINTS.pedidos,
      "id_pedido"
    );
    results.pedidos = pedidos.length;

    const contasPagar = await syncEntity<VHSysContaPagar>(
      supabase,
      "contas_pagar",
      ENDPOINTS.contasPagar,
      "id_conta_pag"
    );
    results.contas_pagar = contasPagar.length;

    const contasReceber = await syncEntity<VHSysContaReceber>(
      supabase,
      "contas_receber",
      ENDPOINTS.contasReceber,
      "id_conta_rec"
    );
    results.contas_receber = contasReceber.length;

    // Cache vendedores ativos in Redis (reuse already-fetched data)
    const vendedoresAtivos = vendedores.filter(
      (v) => v.situacao_vendedor === "Ativo"
    );
    await cacheSet(CACHE_KEYS.vendedoresAtivos, vendedoresAtivos);
    console.log(
      `[sync] Cached ${vendedoresAtivos.length} vendedores ativos in Redis`
    );
  } catch (error) {
    // Log the failure to sync_log
    await supabase.from("sync_log").insert({
      entity: "initial_sync",
      records_synced: 0,
      status: "error",
      error_message: String(error),
    });
    throw error;
  }

  return results;
}
