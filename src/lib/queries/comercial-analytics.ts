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
  idProduto: number;
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

export async function getProdutosEvolucao(
  meses: number = 6,
  produtoFilter?: number
): Promise<ProdutoEvolucao[]> {
  const now = new Date();
  return cacheGetOrFetchSWR(
    CACHE_KEYS.biProdutosEvolucao(1, 12, now.getFullYear(), produtoFilter),
    () => _fetchProdutosEvolucao(meses, produtoFilter)
  );
}

async function _fetchProdutosEvolucao(
  meses: number = 6,
  produtoFilter?: number
): Promise<ProdutoEvolucao[]> {
  const supabase = createSupabaseServer();
  const now = new Date();

  const startDate = toDateStr(
    new Date(now.getFullYear(), now.getMonth() - meses, 1)
  );
  const endDate = toDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  // Step 1: Fetch B2B pedido IDs + dates
  const pedidos = await supabaseFetchAll<{
    id_pedido: string;
    data_pedido: string;
  }>(
    (from, to) =>
      supabase
        .from("pedidos")
        .select("id_pedido, data_pedido")
        .eq("status_pedido", "Atendido")
        .eq("lixeira", "Nao")
        .gte("data_pedido", startDate)
        .lte("data_pedido", endDate)
        .in("vendedor_pedido", B2B_RAW_VARIATIONS)
        .range(from, to)
  );

  if (pedidos.length === 0) return [];

  // Build pedido ID → date map
  const pedidoDateMap: Record<string, string> = {};
  for (const p of pedidos) {
    pedidoDateMap[String(p.id_pedido)] = String(p.data_pedido ?? "");
  }
  const pedidoIds = Object.keys(pedidoDateMap).map(Number);

  // Step 2: Fetch items from pedido_itens
  // Batch in chunks of 500 to avoid URL length limits
  const CHUNK_SIZE = 500;
  let allItems: {
    id_pedido: number;
    id_produto: number;
    desc_produto: string;
    qtde_produto: number;
    valor_total_produto: number;
  }[] = [];

  for (let i = 0; i < pedidoIds.length; i += CHUNK_SIZE) {
    const chunk = pedidoIds.slice(i, i + CHUNK_SIZE);
    let query = supabase
      .from("pedido_itens")
      .select(
        "id_pedido, id_produto, desc_produto, qtde_produto, valor_total_produto"
      )
      .in("id_pedido", chunk);

    if (produtoFilter != null) {
      query = query.eq("id_produto", produtoFilter);
    }

    const { data, error } = await query;
    if (!error && data) {
      allItems = allItems.concat(data as typeof allItems);
    }
  }

  // Fallback: if pedido_itens is empty (backfill hasn't run), aggregate from pedidos
  if (allItems.length === 0) {
    const pedidoRows = await supabaseFetchAll<{
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

    const groups: Record<string, { faturamento: number; quantidade: number }> =
      {};
    for (const row of pedidoRows) {
      const date = String(row.data_pedido ?? "");
      const mes = date.slice(0, 7);
      if (!mes) continue;
      if (!groups[mes]) groups[mes] = { faturamento: 0, quantidade: 0 };
      groups[mes].faturamento += Number(row.valor_total_nota) || 0;
      groups[mes].quantidade += 1;
    }

    return Object.entries(groups)
      .map(([mes, agg]) => ({
        idProduto: 0,
        produto: "Total",
        mes,
        faturamento: agg.faturamento,
        quantidade: agg.quantidade,
      }))
      .sort((a, b) => a.mes.localeCompare(b.mes));
  }

  // Step 3: Group by id_produto + desc_produto + month
  const groups: Record<
    string,
    {
      idProduto: number;
      descProduto: string;
      meses: Record<string, { faturamento: number; quantidade: number }>;
      totalFaturamento: number;
    }
  > = {};

  for (const item of allItems) {
    const pedidoDate = pedidoDateMap[String(item.id_pedido)] ?? "";
    const mes = pedidoDate.slice(0, 7);
    if (!mes) continue;

    const key = String(item.id_produto);
    if (!groups[key]) {
      groups[key] = {
        idProduto: Number(item.id_produto),
        descProduto: String(item.desc_produto ?? ""),
        meses: {},
        totalFaturamento: 0,
      };
    }

    const g = groups[key];
    if (!g.meses[mes]) g.meses[mes] = { faturamento: 0, quantidade: 0 };
    const valor = Number(item.valor_total_produto) || 0;
    const qtde = Number(item.qtde_produto) || 0;
    g.meses[mes].faturamento += valor;
    g.meses[mes].quantidade += qtde;
    g.totalFaturamento += valor;
  }

  // Step 4: Sort by total faturamento DESC, take top 20 if no filter
  let sortedProducts = Object.values(groups).sort(
    (a, b) => b.totalFaturamento - a.totalFaturamento
  );
  if (produtoFilter == null) {
    sortedProducts = sortedProducts.slice(0, 20);
  }

  // Step 5: Flatten to ProdutoEvolucao[]
  const result: ProdutoEvolucao[] = [];
  for (const prod of sortedProducts) {
    for (const [mes, agg] of Object.entries(prod.meses)) {
      result.push({
        idProduto: prod.idProduto,
        produto: prod.descProduto,
        mes,
        faturamento: agg.faturamento,
        quantidade: agg.quantidade,
      });
    }
  }

  return result.sort((a, b) => a.mes.localeCompare(b.mes));
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

// ---------------------------------------------------------------------------
// 8. getClientesB2BList  (JS logic, Redis cache)
// ---------------------------------------------------------------------------

export interface ClienteB2B {
  id: number;
  nome: string;
}

export async function getClientesB2BList(): Promise<ClienteB2B[]> {
  return cacheGetOrFetchSWR(CACHE_KEYS.biClientesB2BList, _fetchClientesB2BList);
}

async function _fetchClientesB2BList(): Promise<ClienteB2B[]> {
  const supabase = createSupabaseServer();

  const rows = await supabaseFetchAll<{
    id_cliente: string;
    fantasia_cliente: string;
    razao_cliente: string;
  }>(
    (from, to) =>
      supabase
        .from("clientes")
        .select("id_cliente, fantasia_cliente, razao_cliente")
        .eq("lixeira", "Nao")
        .in("vendedor_cliente", B2B_RAW_VARIATIONS)
        .range(from, to)
  );

  return rows
    .map((r) => ({
      id: Number(r.id_cliente),
      nome: String(r.fantasia_cliente || r.razao_cliente || ""),
    }))
    .filter((c) => c.nome.length > 0)
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

// ---------------------------------------------------------------------------
// 9. getDemonstrativoCliente  (JS logic, Redis cache)
// ---------------------------------------------------------------------------

export interface DemonstrativoCliente {
  produtos: {
    idProduto: number;
    descProduto: string;
    meses: Record<string, number>;
    total: number;
  }[];
  totaisMes: Record<string, number>;
  totalGeral: number;
}

export async function getDemonstrativoCliente(
  idCliente: number,
  mesInicio: number,
  mesFim: number,
  ano: number
): Promise<DemonstrativoCliente> {
  return cacheGetOrFetchSWR(
    CACHE_KEYS.biDemoCliente(idCliente, mesInicio, mesFim, ano),
    () => _fetchDemonstrativoCliente(idCliente, mesInicio, mesFim, ano)
  );
}

async function _fetchDemonstrativoCliente(
  idCliente: number,
  mesInicio: number,
  mesFim: number,
  ano: number
): Promise<DemonstrativoCliente> {
  const supabase = createSupabaseServer();
  const { start, end } = buildDateRange(mesInicio, mesFim, ano);

  // Step 1: Fetch B2B pedidos for this client in the date range
  const pedidos = await supabaseFetchAll<{
    id_pedido: string;
    data_pedido: string;
  }>(
    (from, to) =>
      supabase
        .from("pedidos")
        .select("id_pedido, data_pedido")
        .eq("status_pedido", "Atendido")
        .eq("lixeira", "Nao")
        .eq("id_cliente", idCliente)
        .gte("data_pedido", start)
        .lte("data_pedido", end)
        .in("vendedor_pedido", B2B_RAW_VARIATIONS)
        .range(from, to)
  );

  if (pedidos.length === 0) {
    return { produtos: [], totaisMes: {}, totalGeral: 0 };
  }

  // Build pedido ID → date map
  const pedidoDateMap: Record<string, string> = {};
  for (const p of pedidos) {
    pedidoDateMap[String(p.id_pedido)] = String(p.data_pedido ?? "");
  }
  const pedidoIds = Object.keys(pedidoDateMap).map(Number);

  // Step 2: Fetch items from pedido_itens
  const CHUNK_SIZE = 500;
  let allItems: {
    id_pedido: number;
    id_produto: number;
    desc_produto: string;
    valor_total_produto: number;
  }[] = [];

  for (let i = 0; i < pedidoIds.length; i += CHUNK_SIZE) {
    const chunk = pedidoIds.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase
      .from("pedido_itens")
      .select("id_pedido, id_produto, desc_produto, valor_total_produto")
      .in("id_pedido", chunk);

    if (!error && data) {
      allItems = allItems.concat(data as typeof allItems);
    }
  }

  if (allItems.length === 0) {
    return { produtos: [], totaisMes: {}, totalGeral: 0 };
  }

  // Step 3: Build pivot — group by id_produto + desc_produto, then by month
  const productMap: Record<
    string,
    {
      idProduto: number;
      descProduto: string;
      meses: Record<string, number>;
      total: number;
    }
  > = {};
  const totaisMes: Record<string, number> = {};
  let totalGeral = 0;

  for (const item of allItems) {
    const pedidoDate = pedidoDateMap[String(item.id_pedido)] ?? "";
    const mes = pedidoDate.slice(0, 7); // YYYY-MM
    if (!mes) continue;

    const valor = Number(item.valor_total_produto) || 0;
    const key = String(item.id_produto);

    if (!productMap[key]) {
      productMap[key] = {
        idProduto: Number(item.id_produto),
        descProduto: String(item.desc_produto ?? ""),
        meses: {},
        total: 0,
      };
    }

    const prod = productMap[key];
    prod.meses[mes] = (prod.meses[mes] || 0) + valor;
    prod.total += valor;

    totaisMes[mes] = (totaisMes[mes] || 0) + valor;
    totalGeral += valor;
  }

  // Step 4: Sort products by total DESC
  const produtos = Object.values(productMap).sort(
    (a, b) => b.total - a.total
  );

  return { produtos, totaisMes, totalGeral };
}
