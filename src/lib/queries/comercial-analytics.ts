import { createSupabaseServer } from "@/lib/supabase/client";
import { supabaseFetchAll } from "@/lib/supabase/fetch-all";
import { cacheGetOrFetchSWR, CACHE_KEYS } from "@/lib/redis/client";
import {
  METAS_VENDEDORES,
  getMetaMensal,
} from "@/lib/config/metas-2026";
import {
  resolveVendedor,
  MARKETPLACE_VENDEDOR_IDS,
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
  tipo: "vendas_internas" | "representante" | "outros";
  valorTotal: number;
  ticketMedio: number;
  qtdPedidos: number;
  meta: number;
  pctMeta: number;
  /** % variação vs mesmo período do mês anterior (null se sem base). */
  deltaMesAnterior: number | null;
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

export interface TopCliente {
  posicao: number;
  cliente: string;
  vendedor: string;
  uf: string;
  valorTotal: number;
  qtdPedidos: number;
  ticketMedio: number;
}

interface PedidoB2B {
  id_cliente: string;
  vendedor: string; // canonical
  valor: number;
  data: string; // YYYY-MM-DD
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function buildDateRange(
  mesInicio: number,
  mesFim: number,
  ano: number,
): { start: string; end: string } {
  const start = toDateStr(new Date(ano, mesInicio - 1, 1));
  const end = toDateStr(new Date(ano, mesFim, 0));
  return { start, end };
}

/** Tipo do vendedor na config de metas (vendas_internas | representante). */
function tipoVendedor(canonical: string): PedidoVendedor["tipo"] {
  const meta = METAS_VENDEDORES.find(
    (v) => v.nome.toLowerCase() === canonical.toLowerCase(),
  );
  if (!meta) return "outros";
  return meta.tipo;
}

function metaAnualDe(canonical: string): number {
  const meta = METAS_VENDEDORES.find(
    (v) => v.nome.toLowerCase() === canonical.toLowerCase(),
  );
  return meta?.meta_2026 ?? 0;
}

/** Soma meta acumulada de TODOS os vendedores entre dois meses. */
function sumMetaAllVendedores(mesInicio: number, mesFim: number): number {
  let total = 0;
  for (const v of METAS_VENDEDORES) {
    for (let m = mesInicio; m <= mesFim; m++) {
      total += getMetaMensal(v.meta_2026, m);
    }
  }
  return total;
}

/** Soma meta acumulada de UM vendedor canonical entre dois meses. */
function sumMetaVendedor(canonical: string, mesInicio: number, mesFim: number): number {
  const meta = METAS_VENDEDORES.find(
    (v) => v.nome.toLowerCase() === canonical.toLowerCase(),
  );
  if (!meta) return 0;
  let total = 0;
  for (let m = mesInicio; m <= mesFim; m++) {
    total += getMetaMensal(meta.meta_2026, m);
  }
  return total;
}

/** Lista de IDs de marketplace para excluir no Postgres. */
const MARKETPLACE_IDS_LIST = `(${Array.from(MARKETPLACE_VENDEDOR_IDS).join(",")})`;

// ---------------------------------------------------------------------------
// Base: fetch pedidos B2B do range (exclui marketplaces, normaliza vendedor)
// ---------------------------------------------------------------------------

async function fetchPedidosB2B(
  start: string,
  end: string,
  vendedor?: string | null,
): Promise<PedidoB2B[]> {
  const supabase = createSupabaseServer();

  const rows = await supabaseFetchAll<{
    id_cliente: string;
    vendedor_pedido: string | null;
    vendedor_pedido_id: number | string | null;
    valor_total_nota: string;
    data_pedido: string;
  }>((from, to) =>
    supabase
      .from("pedidos")
      .select("id_cliente, vendedor_pedido, vendedor_pedido_id, valor_total_nota, data_pedido")
      .eq("status_pedido", "Atendido")
      .eq("lixeira", "Nao")
      .gte("data_pedido", start)
      .lte("data_pedido", end)
      .not("vendedor_pedido_id", "in", MARKETPLACE_IDS_LIST)
      .range(from, to),
  );

  const result: PedidoB2B[] = [];
  for (const r of rows) {
    const canonical = resolveVendedor(r.vendedor_pedido_id, r.vendedor_pedido);
    if (!canonical) continue; // marketplaces residuais ou desconhecidos
    if (vendedor && canonical !== vendedor) continue;
    result.push({
      id_cliente: String(r.id_cliente),
      vendedor: canonical,
      valor: Number(r.valor_total_nota) || 0,
      data: String(r.data_pedido).slice(0, 10),
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// 1. KPIs comerciais
// ---------------------------------------------------------------------------

export async function getComercialKPIs(
  mesInicio: number,
  mesFim: number,
  ano: number,
  vendedor?: string | null,
): Promise<ComercialKPIs> {
  return cacheGetOrFetchSWR(
    CACHE_KEYS.biKpis(mesInicio, mesFim, ano, vendedor || undefined),
    () => _fetchComercialKPIs(mesInicio, mesFim, ano, vendedor),
  );
}

async function _fetchComercialKPIs(
  mesInicio: number,
  mesFim: number,
  ano: number,
  vendedor?: string | null,
): Promise<ComercialKPIs> {
  const { start, end } = buildDateRange(mesInicio, mesFim, ano);

  const [pedidos, stats] = await Promise.all([
    fetchPedidosB2B(start, end, vendedor),
    _fetchClientesStats(end, vendedor),
  ]);

  const faturamentoB2B = pedidos.reduce((s, p) => s + p.valor, 0);
  const totalPedidos = pedidos.length;
  const ticketMedio = totalPedidos > 0 ? faturamentoB2B / totalPedidos : 0;
  const metaB2BAcumulada = vendedor
    ? sumMetaVendedor(vendedor, mesInicio, mesFim)
    : sumMetaAllVendedores(mesInicio, mesFim);
  const pctAtingimento =
    metaB2BAcumulada > 0 ? (faturamentoB2B / metaB2BAcumulada) * 100 : 0;

  return {
    faturamentoB2B,
    metaB2BAcumulada,
    pctAtingimento,
    ticketMedio,
    totalPedidos,
    clientesAtivos: stats.ativos,
    clientesInativos: stats.inativos,
    baseTotal: stats.baseTotal,
  };
}

// ---------------------------------------------------------------------------
// Clientes stats: base B2B = qualquer cliente que comprou B2B em <=24 meses
// Ativos = comprou B2B nos últimos 6 meses (a partir de "end")
// ---------------------------------------------------------------------------

async function _fetchClientesStats(
  endDate: string,
  vendedor?: string | null,
): Promise<{ baseTotal: number; ativos: number; inativos: number }> {
  return cacheGetOrFetchSWR(
    `bi:clientes-stats:${endDate}:${vendedor || "_all"}`,
    () => _doFetchClientesStats(endDate, vendedor),
  );
}

async function _doFetchClientesStats(
  endDate: string,
  vendedor?: string | null,
): Promise<{ baseTotal: number; ativos: number; inativos: number }> {
  const supabase = createSupabaseServer();
  const end = new Date(endDate + "T00:00:00Z");
  const start24 = toDateStr(new Date(end.getFullYear() - 2, end.getMonth(), end.getDate()));
  const start6 = toDateStr(new Date(end.getFullYear(), end.getMonth() - 6, end.getDate()));

  const rows = await supabaseFetchAll<{
    id_cliente: string;
    vendedor_pedido_id: number | string | null;
    vendedor_pedido: string | null;
    data_pedido: string;
  }>((from, to) =>
    supabase
      .from("pedidos")
      .select("id_cliente, vendedor_pedido_id, vendedor_pedido, data_pedido")
      .eq("status_pedido", "Atendido")
      .eq("lixeira", "Nao")
      .gte("data_pedido", start24)
      .lte("data_pedido", endDate)
      .not("vendedor_pedido_id", "in", MARKETPLACE_IDS_LIST)
      .range(from, to),
  );

  const base = new Set<string>();
  const ativos = new Set<string>();
  for (const r of rows) {
    const canonical = resolveVendedor(r.vendedor_pedido_id, r.vendedor_pedido);
    if (!canonical) continue;
    if (vendedor && canonical !== vendedor) continue;
    const id = String(r.id_cliente);
    if (!id || id === "0") continue;
    base.add(id);
    if (r.data_pedido >= start6) ativos.add(id);
  }
  const baseTotal = base.size;
  const ativosCount = ativos.size;
  return {
    baseTotal,
    ativos: ativosCount,
    inativos: Math.max(0, baseTotal - ativosCount),
  };
}

// ---------------------------------------------------------------------------
// 2. Pedidos por vendedor (com Δ vs mês anterior)
// ---------------------------------------------------------------------------

export async function getPedidosPorVendedor(
  mesInicio: number,
  mesFim: number,
  ano: number,
  vendedor?: string | null,
): Promise<PedidoVendedor[]> {
  return cacheGetOrFetchSWR(
    CACHE_KEYS.biVendedor(mesInicio, mesFim, ano, vendedor || undefined),
    () => _fetchPedidosPorVendedor(mesInicio, mesFim, ano, vendedor),
  );
}

async function _fetchPedidosPorVendedor(
  mesInicio: number,
  mesFim: number,
  ano: number,
  vendedor?: string | null,
): Promise<PedidoVendedor[]> {
  const { start, end } = buildDateRange(mesInicio, mesFim, ano);

  // Range do "mês anterior" (mesmo span, deslocado 1 mês pra trás)
  const prevAno = mesInicio === 1 ? ano - 1 : ano;
  const prevMesInicio = mesInicio === 1 ? 12 : mesInicio - 1;
  const prevMesFim = mesFim === 1 ? 12 : mesFim - 1;
  const { start: prevStart, end: prevEnd } = buildDateRange(prevMesInicio, prevMesFim, prevAno);

  const [pedidos, pedidosAnt] = await Promise.all([
    fetchPedidosB2B(start, end, vendedor),
    fetchPedidosB2B(prevStart, prevEnd, vendedor),
  ]);

  type Agg = { total: number; count: number };
  const groups: Record<string, Agg> = {};
  const groupsAnt: Record<string, Agg> = {};

  for (const p of pedidos) {
    if (!groups[p.vendedor]) groups[p.vendedor] = { total: 0, count: 0 };
    groups[p.vendedor].total += p.valor;
    groups[p.vendedor].count += 1;
  }
  for (const p of pedidosAnt) {
    if (!groupsAnt[p.vendedor]) groupsAnt[p.vendedor] = { total: 0, count: 0 };
    groupsAnt[p.vendedor].total += p.valor;
    groupsAnt[p.vendedor].count += 1;
  }

  const result: PedidoVendedor[] = Object.entries(groups).map(
    ([vendedor, agg]) => {
      const metaAnual = metaAnualDe(vendedor);
      let meta = 0;
      for (let m = mesInicio; m <= mesFim; m++) meta += getMetaMensal(metaAnual, m);
      const ant = groupsAnt[vendedor]?.total ?? 0;
      const delta = ant > 0 ? ((agg.total - ant) / ant) * 100 : null;
      return {
        vendedor,
        tipo: tipoVendedor(vendedor),
        valorTotal: agg.total,
        ticketMedio: agg.count > 0 ? agg.total / agg.count : 0,
        qtdPedidos: agg.count,
        meta,
        pctMeta: meta > 0 ? (agg.total / meta) * 100 : 0,
        deltaMesAnterior: delta,
      };
    },
  );

  return result.sort((a, b) => b.valorTotal - a.valorTotal);
}

// ---------------------------------------------------------------------------
// 3. Pedidos por região
// ---------------------------------------------------------------------------

export async function getPedidosPorRegiao(
  mesInicio: number,
  mesFim: number,
  ano: number,
  vendedor?: string | null,
): Promise<PedidoRegiao[]> {
  return cacheGetOrFetchSWR(
    CACHE_KEYS.biRegiao(mesInicio, mesFim, ano, vendedor || undefined),
    () => _fetchPedidosPorRegiao(mesInicio, mesFim, ano, vendedor),
  );
}

async function _fetchPedidosPorRegiao(
  mesInicio: number,
  mesFim: number,
  ano: number,
  vendedor?: string | null,
): Promise<PedidoRegiao[]> {
  const supabase = createSupabaseServer();
  const { start, end } = buildDateRange(mesInicio, mesFim, ano);

  const [pedidos, clientes] = await Promise.all([
    fetchPedidosB2B(start, end, vendedor),
    supabaseFetchAll<{ id_cliente: string; uf_cliente: string }>((from, to) =>
      supabase
        .from("clientes")
        .select("id_cliente, uf_cliente")
        .eq("lixeira", "Nao")
        .range(from, to),
    ),
  ]);

  const ufMap: Record<string, string> = {};
  for (const c of clientes) {
    if (c.id_cliente && c.uf_cliente) ufMap[String(c.id_cliente)] = String(c.uf_cliente);
  }

  const groups: Record<string, { total: number; count: number }> = {};
  for (const p of pedidos) {
    const uf = ufMap[p.id_cliente] ?? "N/D";
    if (!groups[uf]) groups[uf] = { total: 0, count: 0 };
    groups[uf].total += p.valor;
    groups[uf].count += 1;
  }

  return Object.entries(groups)
    .map(([uf, agg]) => ({ uf, valorTotal: agg.total, qtdPedidos: agg.count }))
    .sort((a, b) => b.valorTotal - a.valorTotal);
}

// ---------------------------------------------------------------------------
// 4. Status de clientes por vendedor (B2B, baseado em pedidos)
// ---------------------------------------------------------------------------

export async function getClientesAtivosVendedor(): Promise<ClienteVendedorStatus[]> {
  return cacheGetOrFetchSWR(
    CACHE_KEYS.biClientesStatus,
    _fetchClientesAtivosVendedor,
  );
}

async function _fetchClientesAtivosVendedor(): Promise<ClienteVendedorStatus[]> {
  const supabase = createSupabaseServer();
  const now = new Date();
  const start24 = toDateStr(new Date(now.getFullYear() - 2, now.getMonth(), now.getDate()));
  const start6 = toDateStr(new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()));
  const today = toDateStr(now);

  const rows = await supabaseFetchAll<{
    id_cliente: string;
    vendedor_pedido_id: number | string | null;
    vendedor_pedido: string | null;
    data_pedido: string;
  }>((from, to) =>
    supabase
      .from("pedidos")
      .select("id_cliente, vendedor_pedido_id, vendedor_pedido, data_pedido")
      .eq("status_pedido", "Atendido")
      .eq("lixeira", "Nao")
      .gte("data_pedido", start24)
      .lte("data_pedido", today)
      .not("vendedor_pedido_id", "in", MARKETPLACE_IDS_LIST)
      .range(from, to),
  );

  // Para cada vendedor, pega o conjunto de clientes únicos e classifica ativo/inativo
  // Vendedor "do cliente" = vendedor do último pedido B2B daquele cliente
  type Row = { vendedor: string; data: string };
  const byCliente: Record<string, Row> = {};
  for (const r of rows) {
    const canonical = resolveVendedor(r.vendedor_pedido_id, r.vendedor_pedido);
    if (!canonical) continue;
    const id = String(r.id_cliente);
    if (!id || id === "0") continue;
    const data = String(r.data_pedido).slice(0, 10);
    const cur = byCliente[id];
    if (!cur || cur.data < data) byCliente[id] = { vendedor: canonical, data };
  }

  const groups: Record<string, { total: number; ativos: number }> = {};
  for (const { vendedor, data } of Object.values(byCliente)) {
    if (!groups[vendedor]) groups[vendedor] = { total: 0, ativos: 0 };
    groups[vendedor].total += 1;
    if (data >= start6) groups[vendedor].ativos += 1;
  }

  return Object.entries(groups)
    .map(([vendedor, g]) => ({
      vendedor,
      total: g.total,
      ativos: g.ativos,
      inativos: g.total - g.ativos,
      pctAtivacao: g.total > 0 ? (g.ativos / g.total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

// ---------------------------------------------------------------------------
// 5. Lista de clientes inativos (6+ meses sem pedido B2B)
// ---------------------------------------------------------------------------

export async function getClientesInativos(): Promise<ClienteInativo[]> {
  return cacheGetOrFetchSWR(
    CACHE_KEYS.biClientesInativos,
    _fetchClientesInativos,
  );
}

async function _fetchClientesInativos(): Promise<ClienteInativo[]> {
  const supabase = createSupabaseServer();
  const now = new Date();
  const today = toDateStr(now);
  const cutoff6 = toDateStr(new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()));
  const start24 = toDateStr(new Date(now.getFullYear() - 2, now.getMonth(), now.getDate()));

  const [pedidos, clientes] = await Promise.all([
    supabaseFetchAll<{
      id_cliente: string;
      vendedor_pedido_id: number | string | null;
      vendedor_pedido: string | null;
      valor_total_nota: string;
      data_pedido: string;
    }>((from, to) =>
      supabase
        .from("pedidos")
        .select("id_cliente, vendedor_pedido_id, vendedor_pedido, valor_total_nota, data_pedido")
        .eq("status_pedido", "Atendido")
        .eq("lixeira", "Nao")
        .gte("data_pedido", start24)
        .lte("data_pedido", today)
        .not("vendedor_pedido_id", "in", MARKETPLACE_IDS_LIST)
        .range(from, to),
    ),

    supabaseFetchAll<{
      id_cliente: string;
      razao_cliente: string;
      fantasia_cliente: string;
    }>((from, to) =>
      supabase
        .from("clientes")
        .select("id_cliente, razao_cliente, fantasia_cliente")
        .eq("lixeira", "Nao")
        .range(from, to),
    ),
  ]);

  const clienteMap: Record<string, string> = {};
  for (const c of clientes) {
    if (!c.id_cliente) continue;
    clienteMap[String(c.id_cliente)] = String(c.fantasia_cliente || c.razao_cliente || "(sem nome)");
  }

  type Row = { vendedor: string; data: string; valor: number };
  const byCliente: Record<string, Row> = {};
  for (const p of pedidos) {
    const canonical = resolveVendedor(p.vendedor_pedido_id, p.vendedor_pedido);
    if (!canonical) continue;
    const id = String(p.id_cliente);
    if (!id || id === "0") continue;
    const data = String(p.data_pedido).slice(0, 10);
    const valor = Number(p.valor_total_nota) || 0;
    const cur = byCliente[id];
    if (!cur || cur.data < data) byCliente[id] = { vendedor: canonical, data, valor };
  }

  const result: ClienteInativo[] = [];
  for (const [id, info] of Object.entries(byCliente)) {
    if (info.data >= cutoff6) continue; // ativo
    const dias = Math.floor(
      (now.getTime() - new Date(info.data + "T00:00:00Z").getTime()) / 86400000,
    );
    result.push({
      nome: clienteMap[id] ?? `(cliente ${id})`,
      vendedor: info.vendedor,
      ultimoPedido: info.data,
      valorUltimoPedido: info.valor,
      diasSemCompra: dias,
    });
  }
  return result.sort((a, b) => b.diasSemCompra - a.diasSemCompra);
}

// ---------------------------------------------------------------------------
// 6. Evolução de faturamento (mensal) — produtos virá em fase posterior
// ---------------------------------------------------------------------------

export async function getProdutosEvolucao(
  meses: number = 6,
  vendedor?: string | null,
): Promise<ProdutoEvolucao[]> {
  return cacheGetOrFetchSWR(
    `${CACHE_KEYS.biEvolucao(meses)}:${vendedor || "_all"}`,
    () => _fetchProdutosEvolucao(meses, vendedor),
  );
}

async function _fetchProdutosEvolucao(
  meses: number,
  vendedor?: string | null,
): Promise<ProdutoEvolucao[]> {
  const now = new Date();
  const start = toDateStr(new Date(now.getFullYear(), now.getMonth() - meses, 1));
  const end = toDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const pedidos = await fetchPedidosB2B(start, end, vendedor);

  const groups: Record<string, { faturamento: number; quantidade: number }> = {};
  for (const p of pedidos) {
    const mes = p.data.slice(0, 7);
    if (!groups[mes]) groups[mes] = { faturamento: 0, quantidade: 0 };
    groups[mes].faturamento += p.valor;
    groups[mes].quantidade += 1;
  }

  return Object.entries(groups)
    .map(([mes, agg]) => ({
      produto: "Total",
      mes,
      faturamento: agg.faturamento,
      quantidade: agg.quantidade,
    }))
    .sort((a, b) => a.mes.localeCompare(b.mes));
}

// ---------------------------------------------------------------------------
// 7. Top 20 clientes (Fase 6)
// ---------------------------------------------------------------------------

export type CanalTopClientes = "geral" | "vendas_internas";

export async function getTopClientes(
  mesInicio: number,
  mesFim: number,
  ano: number,
  canal: CanalTopClientes = "geral",
  limit = 20,
  vendedor?: string | null,
): Promise<TopCliente[]> {
  const key = `bi:top-clientes:${canal}:${mesInicio}:${mesFim}:${ano}:${limit}:${vendedor || "_all"}`;
  return cacheGetOrFetchSWR(key, () =>
    _fetchTopClientes(mesInicio, mesFim, ano, canal, limit, vendedor),
  );
}

async function _fetchTopClientes(
  mesInicio: number,
  mesFim: number,
  ano: number,
  canal: CanalTopClientes,
  limit: number,
  vendedor?: string | null,
): Promise<TopCliente[]> {
  const supabase = createSupabaseServer();
  const { start, end } = buildDateRange(mesInicio, mesFim, ano);

  const pedidos = await fetchPedidosB2B(start, end, vendedor);
  const filtered = canal === "vendas_internas"
    ? pedidos.filter((p) => p.vendedor === "Vendas Internas")
    : pedidos;

  type Agg = { vendedorUlt: string; total: number; count: number; lastDate: string };
  const groups: Record<string, Agg> = {};
  for (const p of filtered) {
    if (!groups[p.id_cliente]) {
      groups[p.id_cliente] = { vendedorUlt: p.vendedor, total: 0, count: 0, lastDate: p.data };
    }
    groups[p.id_cliente].total += p.valor;
    groups[p.id_cliente].count += 1;
    if (p.data > groups[p.id_cliente].lastDate) {
      groups[p.id_cliente].lastDate = p.data;
      groups[p.id_cliente].vendedorUlt = p.vendedor;
    }
  }

  const top = Object.entries(groups)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, limit);

  if (top.length === 0) return [];

  const ids = top.map(([id]) => id);
  const clientes = await supabaseFetchAll<{
    id_cliente: string;
    razao_cliente: string;
    fantasia_cliente: string;
    uf_cliente: string;
  }>((from, to) =>
    supabase
      .from("clientes")
      .select("id_cliente, razao_cliente, fantasia_cliente, uf_cliente")
      .in("id_cliente", ids)
      .range(from, to),
  );
  const clienteMap: Record<string, { nome: string; uf: string }> = {};
  for (const c of clientes) {
    clienteMap[String(c.id_cliente)] = {
      nome: String(c.fantasia_cliente || c.razao_cliente || "(sem nome)"),
      uf: String(c.uf_cliente || ""),
    };
  }

  return top.map(([id, agg], idx) => ({
    posicao: idx + 1,
    cliente: clienteMap[id]?.nome ?? `(cliente ${id})`,
    vendedor: agg.vendedorUlt,
    uf: clienteMap[id]?.uf ?? "",
    valorTotal: agg.total,
    qtdPedidos: agg.count,
    ticketMedio: agg.count > 0 ? agg.total / agg.count : 0,
  }));
}
