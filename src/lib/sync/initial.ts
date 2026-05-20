// src/lib/sync/initial.ts
import { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase/client";
import { vhsysGet } from "@/lib/vhsys/client";
import { ENDPOINTS, MAX_PAGE_SIZE } from "@/lib/vhsys/endpoints";
import type { EmpresaSlug } from "@/lib/empresas";
import { TABLES_WITH_EMPRESA_PK, onConflictFor } from "@/lib/sync/multi-empresa";

// Only keep fields that exist in our Supabase tables
export const TABLE_FIELDS: Record<string, string[]> = {
  vendedores: ["id_vendedor", "razao_vendedor", "tipo_pessoa", "cnpj_vendedor", "fantasia_vendedor", "cidade_vendedor", "uf_vendedor", "fone_vendedor", "email_vendedor", "situacao_vendedor", "comissao_usuario", "data_cad_vendedor", "data_mod_vendedor", "lixeira"],
  clientes: ["id_cliente", "id_registro", "tipo_pessoa", "tipo_cadastro", "cnpj_cliente", "razao_cliente", "fantasia_cliente", "endereco_cliente", "numero_cliente", "bairro_cliente", "cep_cliente", "cidade_cliente", "cidade_cliente_cod", "uf_cliente", "contato_cliente", "fone_cliente", "celular_cliente", "email_cliente", "insc_estadual_cliente", "situacao_cliente", "vendedor_cliente", "vendedor_cliente_id", "observacoes_cliente", "data_nasc_cliente", "data_cad_cliente", "data_mod_cliente", "lixeira"],
  produtos: ["id_produto", "id_categoria", "cod_produto", "marca_produto", "desc_produto", "estoque_produto", "unidade_produto", "valor_produto", "valor_custo_produto", "ncm_produto", "codigo_barra_produto", "status_produto", "data_cad_produto", "data_mod_produto", "lixeira"],
  pedidos: ["id_pedido", "id_ped", "id_cliente", "nome_cliente", "vendedor_pedido", "vendedor_pedido_id", "valor_total_produtos", "desconto_pedido", "frete_pedido", "valor_total_nota", "status_pedido", "data_pedido", "obs_pedido", "contas_pedido", "estoque_pedido", "data_cad_pedido", "data_mod_pedido", "lixeira"],
  contas_pagar: ["id_conta_pag", "nome_conta", "id_categoria", "categoria_pag", "id_banco", "id_fornecedor", "nome_fornecedor", "vencimento_pag", "valor_pag", "valor_pago", "liquidado_pag", "data_pagamento", "forma_pagamento", "data_emissao", "n_documento_pag", "observacoes_pag", "id_centro_custos", "centro_custos_pag", "data_cad_pag", "data_mod_pag", "lixeira"],
  contas_receber: ["id_conta_rec", "nome_conta", "id_categoria", "categoria_rec", "id_banco", "id_cliente", "nome_cliente", "vencimento_rec", "valor_rec", "valor_pago", "liquidado_rec", "data_pagamento", "forma_pagamento", "tipo_conta", "data_emissao", "n_documento_rec", "observacoes_rec", "id_centro_custos", "centro_custos_rec", "data_cad_rec", "data_mod_rec", "lixeira"],
};

export function pickFields(item: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in item) {
      let value = item[field];
      // VHSys uses "0000-00-00" for null dates - Postgres rejects this
      if (typeof value === "string" && /^0000-00-00/.test(value)) {
        value = null;
      }
      result[field] = value;
    }
  }
  return result;
}

// Stream sync: fetch page -> upsert -> next page (no memory accumulation)
async function syncEntity(
  supabase: SupabaseClient,
  empresa: EmpresaSlug,
  entity: string,
  endpoint: string,
  primaryKey: string,
): Promise<number> {
  const start = Date.now();
  const fields = TABLE_FIELDS[entity];
  let offset = 0;
  let total = Infinity;
  let synced = 0;
  const writesEmpresaColumn = TABLES_WITH_EMPRESA_PK.has(entity);

  console.log(`[sync:${empresa}] Starting ${entity}...`);

  while (offset < total) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await vhsysGet<any>(empresa, endpoint, {
      limit: String(MAX_PAGE_SIZE),
      offset: String(offset),
      lixeira: "Nao",
    });

    if (res.paging) {
      total = res.paging.total;
    }

    const rawData = res.data;
    const items: Record<string, unknown>[] = Array.isArray(rawData) ? rawData : [];
    if (items.length === 0) break;

    // Deduplicate by primary key (VHSys can return dupes in same page)
    const seen = new Set<unknown>();
    const deduped = items.filter((item) => {
      const key = item[primaryKey];
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const batch = deduped.map((item) => ({
      ...(fields ? pickFields(item, fields) : item),
      ...(writesEmpresaColumn ? { empresa } : {}),
      synced_at: new Date().toISOString(),
    }));

    // Retry up to 3 times on connection errors
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await supabase
        .from(entity)
        .upsert(batch, { onConflict: onConflictFor(entity, primaryKey) });

      if (!error) {
        lastError = null;
        break;
      }

      lastError = error;
      const msg = typeof error === "object" && error !== null && "message" in error ? (error as { message: string }).message : String(error);
      if (msg.includes("fetch failed") || msg.includes("ECONNRESET")) {
        console.warn(`[sync:${empresa}] Retry ${attempt + 1}/3 for ${entity} at offset ${offset}`);
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      // Non-retryable error
      console.error(`[sync:${empresa}] Error upserting ${entity} at offset ${offset}:`, error);
      throw error;
    }

    if (lastError) {
      console.error(`[sync:${empresa}] Failed after 3 retries ${entity} at offset ${offset}:`, lastError);
      throw lastError;
    }

    synced += items.length;
    offset += MAX_PAGE_SIZE;
    console.log(`[sync:${empresa}] ${entity}: ${synced}/${total} synced`);

    if (offset < total) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  const duration = Date.now() - start;
  console.log(`[sync:${empresa}] ${entity} done: ${synced} records in ${duration}ms`);

  await supabase.from("sync_log").insert({
    entity,
    empresa,
    records_synced: synced,
    status: "success",
    duration_ms: duration,
  });

  return synced;
}

/** Sync inicial completo da Rigel Fabricante — comportamento legado preservado. */
export async function runInitialSync(): Promise<Record<string, number>> {
  const supabase = createSupabaseServer();
  const empresa: EmpresaSlug = "rigel_fabricante";
  const results: Record<string, number> = {};

  try {
    // Group 1: No FK dependencies - run in parallel
    console.log(`[sync:${empresa}] Group 1: vendedores + clientes + produtos (parallel)`);
    const [vendedores, clientes, produtos] = await Promise.all([
      syncEntity(supabase, empresa, "vendedores", ENDPOINTS.vendedores, "id_vendedor"),
      syncEntity(supabase, empresa, "clientes", ENDPOINTS.clientes, "id_cliente"),
      syncEntity(supabase, empresa, "produtos", ENDPOINTS.produtos, "id_produto"),
    ]);
    results.vendedores = vendedores;
    results.clientes = clientes;
    results.produtos = produtos;

    // Group 2: Depend on clientes - run in parallel
    console.log(`[sync:${empresa}] Group 2: pedidos + contas_pagar + contas_receber (parallel)`);
    const [pedidos, contasPagar, contasReceber] = await Promise.all([
      syncEntity(supabase, empresa, "pedidos", ENDPOINTS.pedidos, "id_pedido"),
      syncEntity(supabase, empresa, "contas_pagar", ENDPOINTS.contasPagar, "id_conta_pag"),
      syncEntity(supabase, empresa, "contas_receber", ENDPOINTS.contasReceber, "id_conta_rec"),
    ]);
    results.pedidos = pedidos;
    results.contas_pagar = contasPagar;
    results.contas_receber = contasReceber;

    console.log(`[sync:${empresa}] All entities synced:`, results);
  } catch (error) {
    await supabase.from("sync_log").insert({
      entity: "initial_sync",
      empresa,
      records_synced: 0,
      status: "error",
      error_message: String(error),
    });
    throw error;
  }

  return results;
}

/** Sync inicial apenas de contas_pagar para uma empresa específica.
 *  Usado uma vez por empresa nova (Rigel Medical, HD Slim) no rollout. */
export async function runInitialContasPagarSync(
  empresa: EmpresaSlug,
): Promise<{ synced: number; durationMs: number }> {
  const supabase = createSupabaseServer();
  const start = Date.now();
  console.log(`[sync:${empresa}] Initial contas_pagar sync starting...`);
  try {
    const synced = await syncEntity(
      supabase,
      empresa,
      "contas_pagar",
      ENDPOINTS.contasPagar,
      "id_conta_pag",
    );
    const durationMs = Date.now() - start;
    console.log(`[sync:${empresa}] Initial contas_pagar done: ${synced} records in ${durationMs}ms`);
    return { synced, durationMs };
  } catch (error) {
    await supabase.from("sync_log").insert({
      entity: "contas_pagar",
      empresa,
      records_synced: 0,
      status: "error",
      error_message: String(error),
      duration_ms: Date.now() - start,
    });
    throw error;
  }
}
