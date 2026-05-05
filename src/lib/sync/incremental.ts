import { createSupabaseServer } from "@/lib/supabase/client";
import { vhsysFetchAll } from "@/lib/vhsys/client";
import { ENDPOINTS } from "@/lib/vhsys/endpoints";
import { invalidateAllCaches } from "@/lib/redis/client";
import { TABLE_FIELDS, pickFields } from "@/lib/sync/initial";

const BATCH_SIZE = 500;

const ENTITIES = [
  { name: "vendedores", endpoint: ENDPOINTS.vendedores, pk: "id_vendedor", dateField: "data_mod_vendedor" },
  { name: "clientes", endpoint: ENDPOINTS.clientes, pk: "id_cliente", dateField: "data_mod_cliente" },
  { name: "produtos", endpoint: ENDPOINTS.produtos, pk: "id_produto", dateField: "data_mod_produto" },
  { name: "pedidos", endpoint: ENDPOINTS.pedidos, pk: "id_pedido", dateField: "data_mod_pedido" },
  { name: "contas_pagar", endpoint: ENDPOINTS.contasPagar, pk: "id_conta_pag", dateField: "data_mod_pag" },
  { name: "contas_receber", endpoint: ENDPOINTS.contasReceber, pk: "id_conta_rec", dateField: "data_mod_rec" },
] as const;

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

async function getLastSyncTime(
  supabase: ReturnType<typeof createSupabaseServer>,
  entity: string,
  dateField: string,
): Promise<string | null> {
  // Prefer sync_log for the most precise watermark
  const { data: logRow } = await supabase
    .from("sync_log")
    .select("last_sync_at")
    .eq("entity", entity)
    .eq("status", "success")
    .order("last_sync_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (logRow?.last_sync_at) return logRow.last_sync_at as string;

  // Fallback: derive from MAX(date_field) of the entity table.
  // This handles the case where the table was bulk-populated outside the
  // incremental flow (e.g. via /api/sync/pedidos) and sync_log has no entry yet.
  const { data: maxRow } = await supabase
    .from(entity)
    .select(dateField)
    .not(dateField, "is", null)
    .order(dateField, { ascending: false })
    .limit(1)
    .maybeSingle();

  const value = (maxRow as Record<string, unknown> | null)?.[dateField];
  return typeof value === "string" ? value : null;
}

export async function runIncrementalSync(): Promise<Record<string, number>> {
  const supabase = createSupabaseServer();
  const results: Record<string, number> = {};

  for (const entity of ENTITIES) {
    const start = Date.now();

    try {
      const lastSync = await getLastSyncTime(supabase, entity.name, entity.dateField);
      console.log(`[incremental] ${entity.name} last sync: ${lastSync ?? "never"}`);

      if (!lastSync) {
        console.log(`[incremental] Skipping ${entity.name} — no previous sync found and no data in table`);
        results[entity.name] = 0;
        continue;
      }

      // VHSys data_modificacao filter: returns records modified after this date (YYYY-MM-DD).
      const params: Record<string, string> = {
        data_modificacao: lastSync.split("T")[0],
      };

      const items = await vhsysFetchAll<Record<string, unknown>>(entity.endpoint, params);
      console.log(`[incremental] Fetched ${items.length} ${entity.name} modified since ${lastSync}`);

      if (items.length > 0) {
        const fields = TABLE_FIELDS[entity.name];

        // VHSys can return duplicate rows across pages (especially on data_modificacao queries).
        // Postgres' ON CONFLICT DO UPDATE rejects batches that touch the same row twice.
        const seen = new Set<unknown>();
        const deduped = items.filter((item) => {
          const key = item[entity.pk];
          if (key === undefined || seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
          const batch = deduped.slice(i, i + BATCH_SIZE).map((item) => ({
            ...(fields ? pickFields(item, fields) : item),
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

      await supabase.from("sync_log").insert({
        entity: entity.name,
        records_synced: items.length,
        status: "success",
        duration_ms: duration,
      });

      console.log(`[incremental] ${entity.name} done: ${items.length} records in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - start;
      const message = formatError(error);
      console.error(`[incremental] ${entity.name} failed:`, message);

      await supabase.from("sync_log").insert({
        entity: entity.name,
        records_synced: 0,
        status: "error",
        error_message: message,
        duration_ms: duration,
      });

      results[entity.name] = -1;
    }
  }

  await invalidateAllCaches();
  console.log("[incremental] Sync complete:", results);

  return results;
}
