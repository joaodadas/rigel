import { createSupabaseServer } from "@/lib/supabase/client";
import { vhsysFetchAll } from "@/lib/vhsys/client";
import { ENDPOINTS } from "@/lib/vhsys/endpoints";
import { invalidateAllCaches } from "@/lib/redis/client";
import { syncNewPedidoItens } from "./pedido-itens";

const BATCH_SIZE = 500;

const ENTITIES = [
  { name: "vendedores", endpoint: ENDPOINTS.vendedores, pk: "id_vendedor", dateField: "data_mod_vendedor" },
  { name: "clientes", endpoint: ENDPOINTS.clientes, pk: "id_cliente", dateField: "data_mod_cliente" },
  { name: "produtos", endpoint: ENDPOINTS.produtos, pk: "id_produto", dateField: "data_mod_produto" },
  { name: "pedidos", endpoint: ENDPOINTS.pedidos, pk: "id_pedido", dateField: "data_mod_pedido" },
  { name: "contas_pagar", endpoint: ENDPOINTS.contasPagar, pk: "id_conta_pag", dateField: "data_mod_pag" },
  { name: "contas_receber", endpoint: ENDPOINTS.contasReceber, pk: "id_conta_rec", dateField: "data_mod_rec" },
] as const;

async function getLastSyncTime(
  supabase: ReturnType<typeof createSupabaseServer>,
  entity: string
): Promise<string | null> {
  const { data } = await supabase
    .from("sync_log")
    .select("created_at")
    .eq("entity", entity)
    .eq("status", "success")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return data?.created_at ?? null;
}

export async function runIncrementalSync(): Promise<Record<string, number>> {
  const supabase = createSupabaseServer();
  const results: Record<string, number> = {};

  for (const entity of ENTITIES) {
    const start = Date.now();

    try {
      const lastSync = await getLastSyncTime(supabase, entity.name);
      console.log(`[incremental] ${entity.name} last sync: ${lastSync ?? "never"}`);

      // If never synced, skip (initial sync should run first)
      if (!lastSync) {
        console.log(`[incremental] Skipping ${entity.name} — no previous sync found`);
        results[entity.name] = 0;
        continue;
      }

      // Fetch records modified since last sync
      const params: Record<string, string> = {
        data_modificacao: lastSync.split("T")[0], // VHSys uses YYYY-MM-DD format
      };

      const items = await vhsysFetchAll<Record<string, unknown>>(entity.endpoint, params);
      console.log(`[incremental] Fetched ${items.length} ${entity.name} modified since ${lastSync}`);

      if (items.length > 0) {
        // Upsert in batches
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
          const batch = items.slice(i, i + BATCH_SIZE).map((item) => ({
            ...item,
            synced_at: new Date().toISOString(),
          }));

          const { error } = await supabase
            .from(entity.name)
            .upsert(batch, { onConflict: entity.pk });

          if (error) {
            console.error(`[incremental] Error upserting ${entity.name} batch ${i}:`, error);
            throw error;
          }
        }
      }

      const duration = Date.now() - start;
      results[entity.name] = items.length;

      // Log sync
      await supabase.from("sync_log").insert({
        entity: entity.name,
        records_synced: items.length,
        status: "success",
        duration_ms: duration,
      });

      console.log(`[incremental] ${entity.name} done: ${items.length} records in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - start;
      console.error(`[incremental] ${entity.name} failed:`, error);

      await supabase.from("sync_log").insert({
        entity: entity.name,
        records_synced: 0,
        status: "error",
        error_message: String(error),
        duration_ms: duration,
      });

      results[entity.name] = -1; // Signal error
    }
  }

  // Sync new pedido items for B2B orders
  try {
    const itensResult = await syncNewPedidoItens();
    results["pedido_itens"] = itensResult.itensInserted;
    console.log(`[incremental] pedido_itens: ${itensResult.itensInserted} new items from ${itensResult.pedidosProcessed} pedidos`);
  } catch (error) {
    console.error("[incremental] pedido_itens sync failed:", error);
    results["pedido_itens"] = -1;
  }

  await invalidateAllCaches();
  console.log("[incremental] Sync complete:", results);

  return results;
}
