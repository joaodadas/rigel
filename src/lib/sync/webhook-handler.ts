import { createSupabaseServer } from "@/lib/supabase/client";
import { invalidateAllCaches } from "@/lib/redis/client";
import { TABLES_WITH_EMPRESA_PK, onConflictFor } from "@/lib/sync/multi-empresa";

type WebhookEvent = {
  event: string;
  data: Record<string, unknown>;
};

const ENTITY_MAP: Record<string, { table: string; pk: string }> = {
  clientes: { table: "clientes", pk: "id_cliente" },
  pedidos: { table: "pedidos", pk: "id_pedido" },
  produtos: { table: "produtos", pk: "id_produto" },
  "contas-pagar": { table: "contas_pagar", pk: "id_conta_pag" },
  "contas-receber": { table: "contas_receber", pk: "id_conta_rec" },
  "notas-fiscais": { table: "notas_fiscais", pk: "id_venda" },
  orcamentos: { table: "orcamentos", pk: "id_orcamento" },
  vendedores: { table: "vendedores", pk: "id_vendedor" },
};

export async function handleVHSysWebhook(payload: WebhookEvent) {
  const supabase = createSupabaseServer();
  const [entityKey, action] = payload.event.split(".");
  const mapping = ENTITY_MAP[entityKey];

  if (!mapping) {
    console.warn(`[webhook] Unknown entity: ${entityKey}`);
    return { handled: false };
  }

  // Webhooks atualmente só são recebidos da Rigel Fabricante (a única conta com webhook
  // potencialmente configurado). Quando webhook multi-tenant for habilitado, esta empresa
  // deve vir do payload ou do path da URL (/api/webhooks/vhsys/[empresa]).
  const empresa = "rigel_fabricante" as const;
  const writesEmpresaColumn = TABLES_WITH_EMPRESA_PK.has(mapping.table);

  const record = {
    ...payload.data,
    ...(writesEmpresaColumn ? { empresa } : {}),
    synced_at: new Date().toISOString(),
  };

  if (action === "delete") {
    const pkValue = payload.data[mapping.pk];
    let query = supabase
      .from(mapping.table)
      .update({ lixeira: "Sim", synced_at: new Date().toISOString() })
      .eq(mapping.pk, pkValue);
    if (writesEmpresaColumn) query = query.eq("empresa", empresa);
    await query;
  } else {
    const onConflict = onConflictFor(mapping.table, mapping.pk);
    await supabase.from(mapping.table).upsert(record, { onConflict });
  }

  // Update ultima_atividade for related client
  if (["pedidos", "orcamentos", "notas-fiscais"].includes(entityKey)) {
    const clientId = payload.data.id_cliente as number;
    if (clientId) {
      await supabase
        .from("clientes")
        .update({ ultima_atividade: new Date().toISOString() })
        .eq("id_cliente", clientId);
    }
  }

  await invalidateAllCaches();
  return { handled: true, entity: entityKey, action };
}
