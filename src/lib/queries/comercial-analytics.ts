import { createSupabaseServer } from "@/lib/supabase/client";
import { supabaseFetchAll } from "@/lib/supabase/fetch-all";
import { cacheGetOrFetchSWR, CACHE_KEYS } from "@/lib/redis/client";
import {
  METAS_VENDEDORES,
  getMetaMensal,
} from "@/lib/config/metas-2026";
import {
  normalizeVendedor,
  isB2B,
  B2B_VENDEDORES_NORMALIZED,
  findMetaAnualByDisplay,
} from "@/lib/config/vendedores-map";

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
  cidade: string;
  uf: string;
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

const B2B_RAW_VARIATIONS: string[] = (() => {
  const variations = new Set<string>();
  for (const name of B2B_VENDEDORES_NORMALIZED) {
    variations.add(name);
    variations.add(name.toLowerCase());
    variations.add(name.toLowerCase() + " ");
  }
  variations.add("vendas internos ");
  variations.add("vendas onternas");
  return Array.from(variations);
})();

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
    p_b2b_vendedores: B2B_VENDEDORES_NORMALIZED,
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
        .in("vendedor_pedido", B2B_RAW_VARIATIONS)
        .range(from, to)
  );

  // Group by normalized vendedor name
  const groups: Record<string, { total: number; count: number }> = {};
  for (const row of rows) {
    const vendedor = normalizeVendedor(row.vendedor_pedido);
    if (!isB2B(vendedor)) continue;
    if (!groups[vendedor]) groups[vendedor] = { total: 0, count: 0 };
    groups[vendedor].total += Number(row.valor_total_nota) || 0;
    groups[vendedor].count += 1;
  }

  const result: PedidoVendedor[] = Object.entries(groups).map(
    ([vendedor, agg]) => {
      const metaAnual = findMetaAnualByDisplay(vendedor);
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
          .in("vendedor_pedido", B2B_RAW_VARIATIONS)
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

  const { data, error } = await supabase.rpc("rpc_clientes_status_vendedor", {
    p_b2b_vendedores: B2B_VENDEDORES_NORMALIZED,
  });

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
      vendedor: normalizeVendedor(r.vendedor),
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
    p_vendedor: vendedorFilter ? vendedorFilter.toUpperCase().trim() : null,
    p_b2b_vendedores: B2B_VENDEDORES_NORMALIZED,
    p_limit: 5000,
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
      cidade?: string;
      uf?: string;
    }) => ({
      nome: String(r.nome),
      vendedor: normalizeVendedor(r.vendedor),
      ultimoPedido: r.ultimo_pedido ? String(r.ultimo_pedido) : null,
      valorUltimoPedido: Number(r.valor_ultimo_pedido) || 0,
      diasSemCompra: Number(r.dias_sem_compra) || 0,
      cidade: r.cidade ?? "",
      uf: r.uf ?? "",
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
        .in("vendedor_pedido", B2B_RAW_VARIATIONS)
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

// ---------------------------------------------------------------------------
// 7. getTop20Clientes  (JS logic, Redis cache)
// ---------------------------------------------------------------------------

export interface TopCliente {
  posicao: number;
  nome: string;
  vendedor: string;
  valorTotal: number;
  qtdPedidos: number;
  ticketMedio: number;
  uf: string;
}

export async function getTop20Clientes(
  mesInicio: number,
  mesFim: number,
  ano: number,
  apenasVendasInternas: boolean = false
): Promise<TopCliente[]> {
  const key = apenasVendasInternas
    ? CACHE_KEYS.biTop20VI(mesInicio, mesFim, ano)
    : CACHE_KEYS.biTop20(mesInicio, mesFim, ano);
  return cacheGetOrFetchSWR(key, () =>
    _fetchTop20Clientes(mesInicio, mesFim, ano, apenasVendasInternas)
  );
}

async function _fetchTop20Clientes(
  mesInicio: number,
  mesFim: number,
  ano: number,
  apenasVendasInternas: boolean
): Promise<TopCliente[]> {
  const supabase = createSupabaseServer();
  const { start, end } = buildDateRange(mesInicio, mesFim, ano);

  // Determine which vendedor variations to include
  const vendasInternasVariations = [
    "vendas internas",
    "vendas internas ",
    "VENDAS INTERNAS",
    "vendas internos ",
    "vendas onternas",
    "Vendas Internas",
  ];
  const vendedorFilter = apenasVendasInternas
    ? vendasInternasVariations
    : B2B_RAW_VARIATIONS;

  // Fetch pedidos and clientes in parallel
  const [pedidos, clientes] = await Promise.all([
    supabaseFetchAll<{
      id_cliente: string;
      valor_total_nota: string;
      vendedor_pedido: string;
    }>(
      (from, to) =>
        supabase
          .from("pedidos")
          .select("id_cliente, valor_total_nota, vendedor_pedido")
          .eq("status_pedido", "Atendido")
          .eq("lixeira", "Nao")
          .gte("data_pedido", start)
          .lte("data_pedido", end)
          .in("vendedor_pedido", vendedorFilter)
          .range(from, to)
    ),

    supabaseFetchAll<{
      id_cliente: string;
      nome_cliente: string;
      uf_cliente: string;
      vendedor: string;
    }>(
      (from, to) =>
        supabase
          .from("clientes")
          .select("id_cliente, nome_cliente, uf_cliente, vendedor")
          .eq("lixeira", "Nao")
          .range(from, to)
    ),
  ]);

  // Build client lookup map
  const clienteMap: Record<
    string,
    { nome: string; uf: string; vendedor: string }
  > = {};
  for (const c of clientes) {
    if (c.id_cliente) {
      clienteMap[String(c.id_cliente)] = {
        nome: String(c.nome_cliente ?? ""),
        uf: String(c.uf_cliente ?? ""),
        vendedor: normalizeVendedor(c.vendedor),
      };
    }
  }

  // Group pedidos by id_cliente
  const groups: Record<string, { total: number; count: number }> = {};
  for (const p of pedidos) {
    const id = String(p.id_cliente);
    if (!groups[id]) groups[id] = { total: 0, count: 0 };
    groups[id].total += Number(p.valor_total_nota) || 0;
    groups[id].count += 1;
  }

  // Join, sort, take top 20
  const ranked = Object.entries(groups)
    .map(([id, agg]) => {
      const info = clienteMap[id] ?? { nome: id, uf: "", vendedor: "" };
      return {
        posicao: 0,
        nome: info.nome,
        vendedor: info.vendedor,
        valorTotal: agg.total,
        qtdPedidos: agg.count,
        ticketMedio: agg.count > 0 ? agg.total / agg.count : 0,
        uf: info.uf,
      };
    })
    .sort((a, b) => b.valorTotal - a.valorTotal)
    .slice(0, 20);

  // Assign 1-indexed position
  return ranked.map((item, idx) => ({ ...item, posicao: idx + 1 }));
}
