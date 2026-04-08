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

// Only keep fields that exist in our Supabase tables
const TABLE_FIELDS: Record<string, string[]> = {
  vendedores: ["id_vendedor", "razao_vendedor", "tipo_pessoa", "cnpj_vendedor", "fantasia_vendedor", "cidade_vendedor", "uf_vendedor", "fone_vendedor", "email_vendedor", "situacao_vendedor", "comissao_usuario", "data_cad_vendedor", "data_mod_vendedor", "lixeira"],
  clientes: ["id_cliente", "id_registro", "tipo_pessoa", "tipo_cadastro", "cnpj_cliente", "razao_cliente", "fantasia_cliente", "endereco_cliente", "numero_cliente", "bairro_cliente", "cep_cliente", "cidade_cliente", "cidade_cliente_cod", "uf_cliente", "contato_cliente", "fone_cliente", "celular_cliente", "email_cliente", "insc_estadual_cliente", "situacao_cliente", "vendedor_cliente", "vendedor_cliente_id", "observacoes_cliente", "data_nasc_cliente", "data_cad_cliente", "data_mod_cliente", "lixeira"],
  produtos: ["id_produto", "id_categoria", "cod_produto", "marca_produto", "desc_produto", "estoque_produto", "unidade_produto", "valor_produto", "valor_custo_produto", "ncm_produto", "codigo_barra_produto", "status_produto", "data_cad_produto", "data_mod_produto", "lixeira"],
  pedidos: ["id_pedido", "id_ped", "id_cliente", "nome_cliente", "vendedor_pedido", "vendedor_pedido_id", "valor_total_produtos", "desconto_pedido", "frete_pedido", "valor_total_nota", "status_pedido", "data_pedido", "obs_pedido", "contas_pedido", "estoque_pedido", "data_cad_pedido", "data_mod_pedido", "lixeira"],
  contas_pagar: ["id_conta_pag", "nome_conta", "id_categoria", "categoria_pag", "id_banco", "id_fornecedor", "nome_fornecedor", "vencimento_pag", "valor_pag", "valor_pago", "liquidado_pag", "data_pagamento", "forma_pagamento", "data_emissao", "n_documento_pag", "observacoes_pag", "id_centro_custos", "centro_custos_pag", "data_cad_pag", "data_mod_pag", "lixeira"],
  contas_receber: ["id_conta_rec", "nome_conta", "id_categoria", "categoria_rec", "id_banco", "id_cliente", "nome_cliente", "vencimento_rec", "valor_rec", "valor_pago", "liquidado_rec", "data_pagamento", "forma_pagamento", "tipo_conta", "data_emissao", "n_documento_rec", "observacoes_rec", "id_centro_custos", "centro_custos_rec", "data_cad_rec", "data_mod_rec", "lixeira"],
};

function pickFields(item: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in item) {
      result[field] = item[field];
    }
  }
  return result;
}

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

  const fields = TABLE_FIELDS[entity];

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE).map((item) => ({
      ...(fields ? pickFields(item as unknown as Record<string, unknown>, fields) : item),
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
