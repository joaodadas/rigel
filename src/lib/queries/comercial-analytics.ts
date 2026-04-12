import { createSupabaseServer } from "@/lib/supabase/client";
import { supabaseFetchAll } from "@/lib/supabase/fetch-all";
import { cacheGetOrFetchSWR, CACHE_KEYS } from "@/lib/redis/client";
import {
  METAS_VENDEDORES,
  getMetaMensal,
} from "@/lib/config/metas-2026";
import { mapVendedorToMeta } from "@/lib/config/vendedores-map";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComercialKPIs {
  faturamentoB2B: number;
  metaB2BAcumulada: number;
  pctAtingimento: number;
  ticketMedio: number;
  totalPedidos: number;
  clientesAtivos: number;
  clientesInativos: number;
  baseTotal: number;
}

export interface PedidoVendedor {
  vendedor: string;
  valorTotal: number;
  ticketMedio: number;
  qtdPedidos: number;
  meta: number;
  pctMeta: number;
}

export interface PedidoRegiao {
  uf: string;
  valorTotal: number;
  qtdPedidos: number;
}

export interface ClienteVendedorStatus {
  vendedor: string;
  total: number;
  ativos: number;
  inativos: number;
  pctAtivacao: number;
}

export interface ClienteInativo {
  nome: string;
  vendedor: string;
  ultimoPedido: string | null;
  valorUltimoPedido: number;
  diasSemCompra: number;
}

export interface ProdutoEvolucao {
  produto: string;
  mes: string;
  faturamento: number;
  quantidade: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

/** Build start/end ISO date strings for a month range in a given year. */
function buildDateRange(
  mesInicio: number,
  mesFim: number,
  ano: number
): { start: string; end: string } {
  const start = toDateStr(new Date(ano, mesInicio - 1, 1));
  const end = toDateStr(new Date(ano, mesFim, 0)); // last day of mesFim
  return { start, end };
}

/** Sum meta acumulada for ALL vendedores from mesInicio to mesFim. */
function sumMetaAllVendedores(mesInicio: number, mesFim: number): number {
  let total = 0;
  for (const v of METAS_VENDEDORES) {
    for (let m = mesInicio; m <= mesFim; m++) {
      total += getMetaMensal(v.meta_2026, m);
    }
  }
  return total;
}

/** Find the meta_2026 for a vendedor name (after mapping). */
function findMetaAnual(nomeVendedor: string): number {
  const mapped = mapVendedorToMeta(nomeVendedor);
  if (!mapped) return 0;
  const lower = mapped.toLowerCase();
  const found = METAS_VENDEDORES.find(
    (v) => v.nome.toLowerCase() === lower
  );
  return found?.meta_2026 ?? 0;
}

// ---------------------------------------------------------------------------
// 1. getComercialKPIs  (RPC-based)
// ---------------------------------------------------------------------------

export async function getComercialKPIs(
  mesInicio: number,
  mesFim: number,
  ano: number
): Promise<ComercialKPIs> {
  return cacheGetOrFetchSWR(
    CACHE_KEYS.biKpis(mesInicio, mesFim, ano),
    () => _fetchComercialKPIs(mesInicio, mesFim, ano)
  );
}

async function _fetchComercialKPIs(
  mesInicio: number,
  mesFim: number,
  ano: number
): Promise<ComercialKPIs> {
  const supabase = createSupabaseServer();
  const { start, end } = buildDateRange(mesInicio, mesFim, ano);

  const { data, error } = await supabase.rpc("rpc_comercial_kpis", {
    p_start_date: start,
    p_end_date: end,
  });

  if (error) throw new Error(`rpc_comercial_kpis failed: ${error.message}`);

  const row = Array.isArray(data) ? data[0] : data;
  const faturamentoB2B = Number(row.faturamento) || 0;
  const totalPedidos = Number(row.total_pedidos) || 0;
  const clientesAtivos = Number(row.clientes_ativos) || 0;
  const baseTotal = Number(row.base_total) || 0;

  const ticketMedio = totalPedidos > 0 ? faturamentoB2B / totalPedidos : 0;
  const metaB2BAcumulada = sumMetaAllVendedores(mesInicio, mesFim);
  const pctAtingimento =
    metaB2BAcumulada > 0 ? (faturamentoB2B / metaB2BAcumulada) * 100 : 0;
  const clientesInativos = Math.max(0, baseTotal - clientesAtivos);

  return {
    faturamentoB2B,
    metaB2BAcumulada,
    pctAtingimento,
    ticketMedio,
    totalPedidos,
    clientesAtivos,
    clientesInativos,
    baseTotal,
  };
}

// ---------------------------------------------------------------------------
// 2. getPedidosPorVendedor  (JS logic, Redis cache)
// ---------------------------------------------------------------------------

export async function getPedidosPorVendedor(
  mesInicio: number,
  mesFim: number,
  ano: number
): Promise<PedidoVendedor[]> {
  return cacheGetOrFetchSWR(
    CACHE_KEYS.biVendedor(mesInicio, mesFim, ano),
    () => _fetchPedidosPorVendedor(mesInicio, mesFim, ano)
  );
}

async function _fetchPedidosPorVendedor(
  mesInicio: number,
  mesFim: number,
  ano: number
): Promise<PedidoVendedor[]> {
  const supabase = createSupabaseServer();
  const { start, end } = buildDateRange(mesInicio, mesFim, ano);

  const rows = await supabaseFetchAll<{
    vendedor_pedido: string;
    valor_total_nota: string;
  }>(
    (from, to) =>
      supabase
        .from("pedidos")
        .select("vendedor_pedido, valor_total_nota")
        .eq("status_pedido", "Atendido")
        .eq("lixeira", "Nao")
        .gte("data_pedido", start)
        .lte("data_pedido", end)
        .range(from, to)
  );

  // Group by vendedor in JS
  const groups: Record<string, { total: number; count: number }> = {};
  for (const row of rows) {
    const vendedor = (row.vendedor_pedido as string) ?? "Sem vendedor";
    if (!groups[vendedor]) groups[vendedor] = { total: 0, count: 0 };
    groups[vendedor].total += Number(row.valor_total_nota) || 0;
    groups[vendedor].count += 1;
  }

  const result: PedidoVendedor[] = Object.entries(groups).map(
    ([vendedor, agg]) => {
      const metaAnual = findMetaAnual(vendedor);
      let meta = 0;
      for (let m = mesInicio; m <= mesFim; m++) {
        meta += getMetaMensal(metaAnual, m);
      }
      return {
        vendedor,
        valorTotal: agg.total,
        ticketMedio: agg.count > 0 ? agg.total / agg.count : 0,
        qtdPedidos: agg.count,
        meta,
        pctMeta: meta > 0 ? (agg.total / meta) * 100 : 0,
      };
    }
  );

  return result.sort((a, b) => b.valorTotal - a.valorTotal);
}

// ---------------------------------------------------------------------------
// 3. getPedidosPorRegiao  (JS logic, Redis cache)
// ---------------------------------------------------------------------------

export async function getPedidosPorRegiao(
  mesInicio: number,
  mesFim: number,
  ano: number
): Promise<PedidoRegiao[]> {
  return cacheGetOrFetchSWR(
    CACHE_KEYS.biRegiao(mesInicio, mesFim, ano),
    () => _fetchPedidosPorRegiao(mesInicio, mesFim, ano)
  );
}

async function _fetchPedidosPorRegiao(
  mesInicio: number,
  mesFim: number,
  ano: number
): Promise<PedidoRegiao[]> {
  const supabase = createSupabaseServer();
  const { start, end } = buildDateRange(mesInicio, mesFim, ano);

  // Fetch pedidos and clientes in parallel, then join in JS
  const [pedidos, clientes] = await Promise.all([
    supabaseFetchAll<{ id_cliente: string; valor_total_nota: string }>(
      (from, to) =>
        supabase
          .from("pedidos")
          .select("id_cliente, valor_total_nota")
          .eq("status_pedido", "Atendido")
          .eq("lixeira", "Nao")
          .gte("data_pedido", start)
          .lte("data_pedido", end)
          .range(from, to)
    ),

    supabaseFetchAll<{ id_cliente: string; uf_cliente: string }>(
      (from, to) =>
        supabase
          .from("clientes")
          .select("id_cliente, uf_cliente")
          .eq("lixeira", "Nao")
          .range(from, to)
    ),
  ]);

  // Build client -> UF map
  const ufMap: Record<string, string> = {};
  for (const c of clientes) {
    if (c.id_cliente && c.uf_cliente) {
      ufMap[String(c.id_cliente)] = String(c.uf_cliente);
    }
  }

  // Group by UF
  const groups: Record<string, { total: number; count: number }> = {};
  for (const p of pedidos) {
    const uf = ufMap[String(p.id_cliente)] ?? "N/D";
    if (!groups[uf]) groups[uf] = { total: 0, count: 0 };
    groups[uf].total += Number(p.valor_total_nota) || 0;
    groups[uf].count += 1;
  }

  return Object.entries(groups)
    .map(([uf, agg]) => ({
      uf,
      valorTotal: agg.total,
      qtdPedidos: agg.count,
    }))
    .sort((a, b) => b.valorTotal - a.valorTotal);
}

// ---------------------------------------------------------------------------
// 4. getClientesAtivosVendedor  (RPC-based)
// ---------------------------------------------------------------------------

export async function getClientesAtivosVendedor(): Promise<
  ClienteVendedorStatus[]
> {
  return cacheGetOrFetchSWR(
    CACHE_KEYS.biClientesStatus,
    _fetchClientesAtivosVendedor
  );
}

async function _fetchClientesAtivosVendedor(): Promise<
  ClienteVendedorStatus[]
> {
  const supabase = createSupabaseServer();

  const { data, error } = await supabase.rpc("rpc_clientes_status_vendedor");

  if (error)
    throw new Error(`rpc_clientes_status_vendedor failed: ${error.message}`);

  const rows = Array.isArray(data) ? data : [];
  return rows.map(
    (r: {
      vendedor: string;
      total: number | string;
      ativos: number | string;
      inativos: number | string;
      pct_ativacao: number | string;
    }) => ({
      vendedor: String(r.vendedor),
      total: Number(r.total) || 0,
      ativos: Number(r.ativos) || 0,
      inativos: Number(r.inativos) || 0,
      pctAtivacao: Number(r.pct_ativacao) || 0,
    })
  );
}

// ---------------------------------------------------------------------------
// 5. getClientesInativos  (RPC-based)
// ---------------------------------------------------------------------------

export async function getClientesInativos(
  vendedorFilter?: string
): Promise<ClienteInativo[]> {
  const key = vendedorFilter
    ? `${CACHE_KEYS.biClientesInativos}:${vendedorFilter}`
    : CACHE_KEYS.biClientesInativos;

  return cacheGetOrFetchSWR(key, () =>
    _fetchClientesInativos(vendedorFilter)
  );
}

async function _fetchClientesInativos(
  vendedorFilter?: string
): Promise<ClienteInativo[]> {
  const supabase = createSupabaseServer();

  const { data, error } = await supabase.rpc("rpc_clientes_inativos", {
    p_vendedor: vendedorFilter || null,
  });

  if (error)
    throw new Error(`rpc_clientes_inativos failed: ${error.message}`);

  const rows = Array.isArray(data) ? data : [];
  return rows.map(
    (r: {
      nome: string;
      vendedor: string;
      ultimo_pedido: string | null;
      valor_ultimo_pedido: number | string;
      dias_sem_compra: number | string;
    }) => ({
      nome: String(r.nome),
      vendedor: String(r.vendedor),
      ultimoPedido: r.ultimo_pedido ? String(r.ultimo_pedido) : null,
      valorUltimoPedido: Number(r.valor_ultimo_pedido) || 0,
      diasSemCompra: Number(r.dias_sem_compra) || 0,
    })
  );
}

// ---------------------------------------------------------------------------
// 6. getProdutosEvolucao  (JS logic, Redis cache)
// ---------------------------------------------------------------------------
// TODO: Product-level breakdown requires product-pedido relation table to be
//       synced. For now, returns monthly faturamento totals.

export async function getProdutosEvolucao(
  meses: number = 6,
  _produtoFilter?: string
): Promise<ProdutoEvolucao[]> {
  return cacheGetOrFetchSWR(
    CACHE_KEYS.biEvolucao(meses),
    () => _fetchProdutosEvolucao(meses, _produtoFilter)
  );
}

async function _fetchProdutosEvolucao(
  meses: number = 6,
  _produtoFilter?: string
): Promise<ProdutoEvolucao[]> {
  const supabase = createSupabaseServer();
  const now = new Date();

  const startDate = toDateStr(
    new Date(now.getFullYear(), now.getMonth() - meses, 1)
  );
  const endDate = toDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const rows = await supabaseFetchAll<{
    data_pedido: string;
    valor_total_nota: string;
  }>(
    (from, to) =>
      supabase
        .from("pedidos")
        .select("data_pedido, valor_total_nota")
        .eq("status_pedido", "Atendido")
        .eq("lixeira", "Nao")
        .gte("data_pedido", startDate)
        .lte("data_pedido", endDate)
        .range(from, to)
  );

  // Group by YYYY-MM
  const groups: Record<string, { faturamento: number; quantidade: number }> =
    {};
  for (const row of rows) {
    const date = String(row.data_pedido ?? "");
    const mes = date.slice(0, 7); // YYYY-MM
    if (!mes) continue;
    if (!groups[mes]) groups[mes] = { faturamento: 0, quantidade: 0 };
    groups[mes].faturamento += Number(row.valor_total_nota) || 0;
    groups[mes].quantidade += 1;
  }

  return Object.entries(groups)
    .map(([mes, agg]) => ({
      produto: "Total", // TODO: replace with product-level data
      mes,
      faturamento: agg.faturamento,
      quantidade: agg.quantidade,
    }))
    .sort((a, b) => a.mes.localeCompare(b.mes));
}
