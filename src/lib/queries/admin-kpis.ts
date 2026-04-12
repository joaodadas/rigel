import { cacheGetOrFetchSWR, CACHE_KEYS } from "@/lib/redis/client";
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
  return cacheGetOrFetchSWR(CACHE_KEYS.kpiAdmin, _fetchAdminKPIs);
}

async function _fetchAdminKPIs(): Promise<AdminKPIs> {
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

  const { data, error } = await supabase.rpc("rpc_admin_kpis", {
    p_first_day: firstDayOfMonth,
    p_last_day: lastDayOfMonth,
    p_today: today,
    p_seven_days: sevenDaysFromNow,
  });

  if (error) {
    console.error("[rpc_admin_kpis] error:", error);
    return {
      faturamentoMes: 0,
      pedidosMes: 0,
      clientesAtivos: 0,
      clientesInativos: 0,
      contasReceberAberto: 0,
      contasPagarVencendo: 0,
      vendedoresAtivos: 0,
    };
  }

  const row = Array.isArray(data) ? data[0] : data;

  return {
    faturamentoMes: Number(row.faturamento_mes) || 0,
    pedidosMes: Number(row.pedidos_mes) || 0,
    clientesAtivos: Number(row.clientes_ativos) || 0,
    clientesInativos: Number(row.clientes_inativos) || 0,
    contasReceberAberto: Number(row.contas_receber_aberto) || 0,
    contasPagarVencendo: Number(row.contas_pagar_vencendo) || 0,
    vendedoresAtivos: Number(row.vendedores_ativos) || 0,
  };
}
