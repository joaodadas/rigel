import { createSupabaseServer } from "@/lib/supabase/client";

export interface AdminKPIs {
  faturamentoMes: number;
  pedidosMes: number;
  clientesAtivos: number;
  clientesInativos: number;
  contasReceberAberto: number;
  contasPagarVencendo: number;
  vendedoresAtivos: number;
}

export async function getAdminKPIs(): Promise<AdminKPIs> {
  const supabase = createSupabaseServer();

  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  const today = now.toISOString().split("T")[0];
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const [
    faturamentoResult,
    pedidosResult,
    clientesAtivosResult,
    clientesInativosResult,
    contasReceberResult,
    contasPagarResult,
    vendedoresResult,
  ] = await Promise.all([
    // 1. Faturamento do Mes - SUM valor_total_nota from pedidos (Atendido, current month)
    supabase
      .from("pedidos")
      .select("valor_total_nota")
      .eq("status_pedido", "Atendido")
      .eq("lixeira", "Nao")
      .gte("data_pedido", firstDayOfMonth)
      .lte("data_pedido", lastDayOfMonth),

    // 2. Pedidos do Mes - COUNT pedidos (current month)
    supabase
      .from("pedidos")
      .select("id", { count: "exact", head: true })
      .eq("lixeira", "Nao")
      .gte("data_pedido", firstDayOfMonth)
      .lte("data_pedido", lastDayOfMonth),

    // 3. Clientes Ativos
    supabase
      .from("clientes")
      .select("id", { count: "exact", head: true })
      .eq("lixeira", "Nao")
      .eq("situacao_cliente", "Ativo"),

    // 4. Clientes Inativos
    supabase
      .from("clientes")
      .select("id", { count: "exact", head: true })
      .eq("lixeira", "Nao")
      .neq("situacao_cliente", "Ativo"),

    // 5. Contas a Receber em Aberto - SUM valor_rec
    supabase
      .from("contas_receber")
      .select("valor_rec")
      .eq("liquidado_rec", "Nao")
      .eq("lixeira", "Nao"),

    // 6. Contas a Pagar Vencendo (proximos 7 dias) - SUM valor_pag
    supabase
      .from("contas_pagar")
      .select("valor_pag")
      .eq("liquidado_pag", "Nao")
      .eq("lixeira", "Nao")
      .gte("vencimento_pag", today)
      .lte("vencimento_pag", sevenDaysFromNow),

    // 7. Vendedores Ativos
    supabase
      .from("vendedores")
      .select("id", { count: "exact", head: true })
      .eq("situacao_vendedor", "Ativo")
      .eq("lixeira", "Nao"),
  ]);

  // Calculate faturamento (sum of valor_total_nota)
  const faturamentoMes = (faturamentoResult.data ?? []).reduce(
    (sum, row) => sum + (Number(row.valor_total_nota) || 0),
    0
  );

  // Pedidos count
  const pedidosMes = pedidosResult.count ?? 0;

  // Clientes counts
  const clientesAtivos = clientesAtivosResult.count ?? 0;
  const clientesInativos = clientesInativosResult.count ?? 0;

  // Contas a receber (sum of valor_rec)
  const contasReceberAberto = (contasReceberResult.data ?? []).reduce(
    (sum, row) => sum + (Number(row.valor_rec) || 0),
    0
  );

  // Contas a pagar vencendo (sum of valor_pag)
  const contasPagarVencendo = (contasPagarResult.data ?? []).reduce(
    (sum, row) => sum + (Number(row.valor_pag) || 0),
    0
  );

  // Vendedores ativos count
  const vendedoresAtivos = vendedoresResult.count ?? 0;

  return {
    faturamentoMes,
    pedidosMes,
    clientesAtivos,
    clientesInativos,
    contasReceberAberto,
    contasPagarVencendo,
    vendedoresAtivos,
  };
}
