// src/lib/sync/incremental.ts
import { createSupabaseServer } from "@/lib/supabase/client";
import { vhsysFetchAll } from "@/lib/vhsys/client";
import { ENDPOINTS } from "@/lib/vhsys/endpoints";
import { invalidateAllCaches } from "@/lib/redis/client";
import { TABLE_FIELDS, pickFields } from "@/lib/sync/initial";
import { EMPRESAS, type EmpresaSlug } from "@/lib/empresas";
import { TABLES_WITH_EMPRESA_PK, onConflictFor } from "@/lib/sync/multi-empresa";

const BATCH_SIZE = 500;

const ENTITIES = [
  { name: "vendedores", endpoint: ENDPOINTS.vendedores, pk: "id_vendedor", dateField: "data_mod_vendedor" },
  { name: "clientes", endpoint: ENDPOINTS.clientes, pk: "id_cliente", dateField: "data_mod_cliente" },
  { name: "produtos", endpoint: ENDPOINTS.produtos, pk: "id_produto", dateField: "data_mod_produto" },
  { name: "pedidos", endpoint: ENDPOINTS.pedidos, pk: "id_pedido", dateField: "data_mod_pedido" },
  { name: "contas_pagar", endpoint: ENDPOINTS.contasPagar, pk: "id_conta_pag", dateField: "data_mod_pag" },
  { name: "contas_receber", endpoint: ENDPOINTS.contasReceber, pk: "id_conta_rec", dateField: "data_mod_rec" },
] as const;

function entitiesForEmpresa(empresa: EmpresaSlug): typeof ENTITIES[number][] {
  // Rigel Fabricante sincroniza tudo. Demais empresas: só contas_pagar nesta entrega.
  if (empresa === "rigel_fabricante") return [...ENTITIES];
  return ENTITIES.filter((e) => e.name === "contas_pagar");
}

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
  empresa: EmpresaSlug,
  entity: string,
  dateField: string,
): Promise<string | null> {
  // Prefer sync_log for the most precise watermark
  const { data: logRow } = await supabase
    .from("sync_log")
    .select("last_sync_at")
    .eq("entity", entity)
    .eq("empresa", empresa)
    .eq("status", "success")
    .order("last_sync_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (logRow?.last_sync_at) return logRow.last_sync_at as string;

  // Fallback: derive from MAX(date_field) of the entity table.
  // Para tabelas multi-empresa, filtra por empresa também.
  let query = supabase
    .from(entity)
    .select(dateField)
    .not(dateField, "is", null);

  if (TABLES_WITH_EMPRESA_PK.has(entity)) {
    query = query.eq("empresa", empresa);
  }

  const { data: maxRow } = await query
    .order(dateField, { ascending: false })
    .limit(1)
    .maybeSingle();

  const value = (maxRow as Record<string, unknown> | null)?.[dateField];
  return typeof value === "string" ? value : null;
}

export async function runIncrementalSync(): Promise<Record<string, Record<string, number>>> {
  const supabase = createSupabaseServer();
  const results: Record<string, Record<string, number>> = {};

  for (const empresaConfig of EMPRESAS) {
    const empresa = empresaConfig.slug;
    results[empresa] = {};

    for (const entity of entitiesForEmpresa(empresa)) {
      const start = Date.now();

      try {
        const lastSync = await getLastSyncTime(supabase, empresa, entity.name, entity.dateField);
        console.log(`[incremental:${empresa}] ${entity.name} last sync: ${lastSync ?? "never"}`);

        if (!lastSync) {
          console.log(`[incremental:${empresa}] Skipping ${entity.name} — no previous sync, no data in table`);
          results[empresa][entity.name] = 0;
          continue;
        }

        const params: Record<string, string> = {
          data_modificacao: lastSync.split("T")[0],
        };

        const items = await vhsysFetchAll<Record<string, unknown>>(empresa, entity.endpoint, params);
        console.log(`[incremental:${empresa}] Fetched ${items.length} ${entity.name} modified since ${lastSync}`);

        if (items.length > 0) {
          const fields = TABLE_FIELDS[entity.name];
          const writesEmpresaColumn = TABLES_WITH_EMPRESA_PK.has(entity.name);

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
              ...(writesEmpresaColumn ? { empresa } : {}),
              synced_at: new Date().toISOString(),
            }));

            const { error } = await supabase
              .from(entity.name)
              .upsert(batch, { onConflict: onConflictFor(entity.name, entity.pk) });

            if (error) {
              console.error(`[incremental:${empresa}] Error upserting ${entity.name} batch ${i}:`, error);
              throw error;
            }
          }
        }

        const duration = Date.now() - start;
        results[empresa][entity.name] = items.length;

        await supabase.from("sync_log").insert({
          entity: entity.name,
          empresa,
          records_synced: items.length,
          status: "success",
          duration_ms: duration,
        });

        console.log(`[incremental:${empresa}] ${entity.name} done: ${items.length} records in ${duration}ms`);
      } catch (error) {
        const duration = Date.now() - start;
        const message = formatError(error);
        console.error(`[incremental:${empresa}] ${entity.name} failed:`, message);

        await supabase.from("sync_log").insert({
          entity: entity.name,
          empresa,
          records_synced: 0,
          status: "error",
          error_message: message,
          duration_ms: duration,
        });

        results[empresa][entity.name] = -1;
      }
    }
  }

  await invalidateAllCaches();
  console.log("[incremental] Sync complete:", results);

  return results;
}
