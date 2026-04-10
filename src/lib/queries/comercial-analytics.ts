import { createSupabaseServer } from "@/lib/supabase/client";
import { supabaseFetchAll } from "@/lib/supabase/fetch-all";
import {
  METAS_VENDEDORES,
  getMetaMensal,
  getMetaAcumulada,
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
// 1. getComercialKPIs
// ---------------------------------------------------------------------------

export async function getComercialKPIs(
  mesInicio: number,
  mesFim: number,
  ano: number
): Promise<ComercialKPIs> {
  const supabase = createSupabaseServer();
  const { start, end } = buildDateRange(mesInicio, mesFim, ano);

  // 6 months ago for "active client" threshold
  const now = new Date();
  const sixMonthsAgo = toDateStr(
    new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
  );

  const [pedidos, clientesAtivosRows, baseTotalResult] =
    await Promise.all([
      // Pedidos atendidos in the period (ALL rows, not just first 1000)
      supabaseFetchAll<{ valor_total_nota: string }>(
        (from, to) =>
          supabase
            .from("pedidos")
            .select("valor_total_nota")
            .eq("status_pedido", "Atendido")
            .eq("lixeira", "Nao")
            .gte("data_pedido", start)
            .lte("data_pedido", end)
            .range(from, to)
      ),

      // Clientes ativos: distinct id_cliente with pedido in last 6 months
      supabaseFetchAll<{ id_cliente: string }>(
        (from, to) =>
          supabase
            .from("pedidos")
            .select("id_cliente")
            .eq("status_pedido", "Atendido")
            .eq("lixeira", "Nao")
            .gte("data_pedido", sixMonthsAgo)
            .range(from, to)
      ),

      // Base total: all clients not in trash
      supabase
        .from("clientes")
        .select("*", { count: "exact", head: true })
        .eq("lixeira", "Nao"),
    ]);

  const faturamentoB2B = pedidos.reduce(
    (sum, row) => sum + (Number(row.valor_total_nota) || 0),
    0
  );
  const totalPedidos = pedidos.length;
  const ticketMedio = totalPedidos > 0 ? faturamentoB2B / totalPedidos : 0;

  const metaB2BAcumulada = sumMetaAllVendedores(mesInicio, mesFim);
  const pctAtingimento =
    metaB2BAcumulada > 0 ? (faturamentoB2B / metaB2BAcumulada) * 100 : 0;

  // Distinct active clients
  const activeClientIds = new Set(
    clientesAtivosRows.map((r) => r.id_cliente)
  );
  const clientesAtivos = activeClientIds.size;

  const baseTotal = baseTotalResult.count ?? 0;
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
// 2. getPedidosPorVendedor
// ---------------------------------------------------------------------------

export async function getPedidosPorVendedor(
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
// 3. getPedidosPorRegiao
// ---------------------------------------------------------------------------

export async function getPedidosPorRegiao(
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
// 4. getClientesAtivosVendedor
// ---------------------------------------------------------------------------

export async function getClientesAtivosVendedor(): Promise<
  ClienteVendedorStatus[]
> {
  const supabase = createSupabaseServer();
  const now = new Date();
  const sixMonthsAgo = toDateStr(
    new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
  );

  const [clientes, recentPedidos] = await Promise.all([
    // All clients with their vendedor
    supabaseFetchAll<{ id_cliente: string; vendedor_cliente: string }>(
      (from, to) =>
        supabase
          .from("clientes")
          .select("id_cliente, vendedor_cliente")
          .eq("lixeira", "Nao")
          .range(from, to)
    ),

    // Recent pedidos (last 6 months) to determine active clients
    supabaseFetchAll<{ id_cliente: string }>(
      (from, to) =>
        supabase
          .from("pedidos")
          .select("id_cliente")
          .eq("status_pedido", "Atendido")
          .eq("lixeira", "Nao")
          .gte("data_pedido", sixMonthsAgo)
          .range(from, to)
    ),
  ]);

  // Set of active client IDs
  const activeIds = new Set(
    recentPedidos.map((r: { id_cliente: string }) => String(r.id_cliente))
  );

  // Group by vendedor
  const groups: Record<string, { total: number; ativos: number }> = {};
  for (const c of clientes) {
    const vendedor =
      (c.vendedor_cliente as string)?.trim() || "Sem vendedor";
    if (!groups[vendedor]) groups[vendedor] = { total: 0, ativos: 0 };
    groups[vendedor].total += 1;
    if (activeIds.has(String(c.id_cliente))) {
      groups[vendedor].ativos += 1;
    }
  }

  return Object.entries(groups)
    .map(([vendedor, agg]) => ({
      vendedor,
      total: agg.total,
      ativos: agg.ativos,
      inativos: agg.total - agg.ativos,
      pctAtivacao: agg.total > 0 ? (agg.ativos / agg.total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

// ---------------------------------------------------------------------------
// 5. getClientesInativos
// ---------------------------------------------------------------------------

export async function getClientesInativos(
  vendedorFilter?: string
): Promise<ClienteInativo[]> {
  const supabase = createSupabaseServer();
  const now = new Date();
  const sixMonthsAgo = toDateStr(
    new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
  );

  // Fetch clients and pedidos in parallel (ALL rows via pagination)
  const [clientes, pedidos] = await Promise.all([
    supabaseFetchAll<{
      id_cliente: string;
      razao_cliente: string;
      fantasia_cliente: string | null;
      vendedor_cliente: string;
    }>((from, to) => {
      let q = supabase
        .from("clientes")
        .select("id_cliente, razao_cliente, fantasia_cliente, vendedor_cliente")
        .eq("lixeira", "Nao");
      if (vendedorFilter) {
        q = q.eq("vendedor_cliente", vendedorFilter);
      }
      return q.range(from, to);
    }),

    // All pedidos atendidos (we need the latest per client)
    supabaseFetchAll<{
      id_cliente: string;
      data_pedido: string;
      valor_total_nota: string;
    }>(
      (from, to) =>
        supabase
          .from("pedidos")
          .select("id_cliente, data_pedido, valor_total_nota")
          .eq("status_pedido", "Atendido")
          .eq("lixeira", "Nao")
          .order("data_pedido", { ascending: false })
          .range(from, to)
    ),
  ]);

  // Build last-pedido map per client
  const lastPedido: Record<
    string,
    { data: string; valor: number }
  > = {};
  for (const p of pedidos) {
    const cid = String(p.id_cliente);
    if (!lastPedido[cid]) {
      lastPedido[cid] = {
        data: String(p.data_pedido ?? ""),
        valor: Number(p.valor_total_nota) || 0,
      };
    }
  }

  const today = now.getTime();
  const result: ClienteInativo[] = [];

  for (const c of clientes) {
    const cid = String(c.id_cliente);
    const last = lastPedido[cid];

    // Inactive = no pedido OR last pedido > 6 months ago
    const isInactive =
      !last || !last.data || last.data < sixMonthsAgo;

    if (!isInactive) continue;

    const ultimoPedidoDate = last?.data || null;
    const diasSemCompra = ultimoPedidoDate
      ? Math.floor(
          (today - new Date(ultimoPedidoDate).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 9999; // never purchased

    result.push({
      nome: (c.fantasia_cliente || c.razao_cliente) ?? "",
      vendedor: (c.vendedor_cliente as string) ?? "",
      ultimoPedido: ultimoPedidoDate,
      valorUltimoPedido: last?.valor ?? 0,
      diasSemCompra,
    });
  }

  return result.sort((a, b) => b.diasSemCompra - a.diasSemCompra);
}

// ---------------------------------------------------------------------------
// 6. getProdutosEvolucao
// ---------------------------------------------------------------------------
// TODO: Product-level breakdown requires product-pedido relation table to be
//       synced. For now, returns monthly faturamento totals.

export async function getProdutosEvolucao(
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
