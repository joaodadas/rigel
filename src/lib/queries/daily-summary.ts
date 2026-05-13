import { createSupabaseServer } from "@/lib/supabase/client";
import { supabaseFetchAll } from "@/lib/supabase/fetch-all";
import {
  MARKETPLACE_VENDEDOR_IDS,
  VENDEDOR_ID_TO_MARKETPLACE_NAME,
} from "@/lib/config/vendedores-map";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VendasCanal {
  canal: string;
  valorTotal: number;
  qtdPedidos: number;
}

export interface ContaPagarItem {
  fornecedor: string;
  valor: number;
  vencimento: string; // YYYY-MM-DD
  diasAtraso?: number; // só para atrasadas
}

export interface ContasPagarBloco {
  total: number;
  qtd: number;
  itens: ContaPagarItem[];
}

export interface DailySummaryData {
  dataReferencia: string; // D-1 em ISO YYYY-MM-DD
  vendas: {
    totalValor: number;
    totalPedidos: number;
    porCanal: VendasCanal[]; // sempre 8 linhas em ordem fixa
  };
  contasPagar: {
    venceHoje: ContasPagarBloco;
    proximos7Dias: ContasPagarBloco;
    atrasadas: ContasPagarBloco;
  };
}

// Ordem fixa dos canais (B2B primeiro, marketplaces em ordem alfabética).
const CANAIS_ORDEM = [
  "B2B",
  "MERCADOFULL",
  "MERCADOLIVRE",
  "SHEIN",
  "SHOPEE",
  "SHOPEEFULL",
  "SITE OPTA SAUDE",
  "SITE RIGEL",
];

// ---------------------------------------------------------------------------
// Date helpers (sempre em America/Sao_Paulo)
// ---------------------------------------------------------------------------

/** Retorna a data atual em BRT como YYYY-MM-DD. */
export function todayBRT(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}

/** Soma `days` (positivo ou negativo) a uma data ISO YYYY-MM-DD. Independente de TZ. */
export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Diferença em dias entre duas datas ISO (a - b). Independente de TZ. */
export function diffDaysISO(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const ms =
    Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd);
  return Math.floor(ms / 86_400_000);
}

// ---------------------------------------------------------------------------
// Vendas D-1
// ---------------------------------------------------------------------------

interface PedidoRow {
  vendedor_pedido_id: number | string | null;
  valor_total_nota: string | number | null;
}

async function fetchVendasPorCanal(d1: string): Promise<{
  totalValor: number;
  totalPedidos: number;
  porCanal: VendasCanal[];
}> {
  const supabase = createSupabaseServer();
  const rows = await supabaseFetchAll<PedidoRow>((from, to) =>
    supabase
      .from("pedidos")
      .select("vendedor_pedido_id, valor_total_nota")
      .eq("status_pedido", "Atendido")
      .eq("lixeira", "Nao")
      .gte("data_pedido", d1)
      .lte("data_pedido", d1)
      .range(from, to),
  );

  // Agrega: inicializa zerado para os 8 canais
  const acc = new Map<string, { valor: number; qtd: number }>();
  for (const c of CANAIS_ORDEM) acc.set(c, { valor: 0, qtd: 0 });

  let totalValor = 0;
  let totalPedidos = 0;

  for (const row of rows) {
    const id = row.vendedor_pedido_id != null ? Number(row.vendedor_pedido_id) : 0;
    const canal =
      MARKETPLACE_VENDEDOR_IDS.has(id)
        ? VENDEDOR_ID_TO_MARKETPLACE_NAME[id] ?? "B2B"
        : "B2B";
    const valor = Number(row.valor_total_nota) || 0;
    const bucket = acc.get(canal) ?? acc.get("B2B")!;
    bucket.valor += valor;
    bucket.qtd += 1;
    totalValor += valor;
    totalPedidos += 1;
  }

  const porCanal: VendasCanal[] = CANAIS_ORDEM.map((c) => {
    const b = acc.get(c)!;
    return { canal: c, valorTotal: b.valor, qtdPedidos: b.qtd };
  });

  return { totalValor, totalPedidos, porCanal };
}

// ---------------------------------------------------------------------------
// Contas a pagar
// ---------------------------------------------------------------------------

interface ContaPagarRow {
  nome_conta: string;
  nome_fornecedor: string | null;
  vencimento_pag: string | null;
  valor_pag: string | number | null;
}

async function fetchContasPagar(hoje: string): Promise<{
  venceHoje: ContasPagarBloco;
  proximos7Dias: ContasPagarBloco;
  atrasadas: ContasPagarBloco;
}> {
  const supabase = createSupabaseServer();
  const limiteSuperior = addDaysISO(hoje, 7);

  const rows = await supabaseFetchAll<ContaPagarRow>((from, to) =>
    supabase
      .from("contas_pagar")
      .select("nome_conta, nome_fornecedor, vencimento_pag, valor_pag")
      .eq("lixeira", "Nao")
      .eq("liquidado_pag", "Nao")
      .lte("vencimento_pag", limiteSuperior)
      .order("vencimento_pag", { ascending: true })
      .range(from, to),
  );

  const atrasadas: ContaPagarItem[] = [];
  const venceHoje: ContaPagarItem[] = [];
  const prox7: ContaPagarItem[] = [];

  for (const r of rows) {
    if (!r.vencimento_pag) continue;
    const venc = String(r.vencimento_pag).slice(0, 10);
    const valor = Number(r.valor_pag) || 0;
    const fornecedor = (r.nome_fornecedor ?? r.nome_conta ?? "").trim() || "(sem nome)";

    if (venc < hoje) {
      atrasadas.push({
        fornecedor,
        valor,
        vencimento: venc,
        diasAtraso: diffDaysISO(hoje, venc),
      });
    } else if (venc === hoje) {
      venceHoje.push({ fornecedor, valor, vencimento: venc });
    } else if (venc <= limiteSuperior) {
      prox7.push({ fornecedor, valor, vencimento: venc });
    }
  }

  // Ordenação
  atrasadas.sort((a, b) => (b.diasAtraso ?? 0) - (a.diasAtraso ?? 0));
  venceHoje.sort((a, b) => b.valor - a.valor);
  prox7.sort((a, b) => {
    if (a.vencimento !== b.vencimento) return a.vencimento < b.vencimento ? -1 : 1;
    return b.valor - a.valor;
  });

  function bloco(itens: ContaPagarItem[]): ContasPagarBloco {
    return {
      total: itens.reduce((s, i) => s + i.valor, 0),
      qtd: itens.length,
      itens,
    };
  }

  return {
    atrasadas: bloco(atrasadas),
    venceHoje: bloco(venceHoje),
    proximos7Dias: bloco(prox7),
  };
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export async function fetchDailySummary(
  now: Date = new Date(),
): Promise<DailySummaryData> {
  const hoje = todayBRT(now);
  const d1 = addDaysISO(hoje, -1);

  const [vendas, contasPagar] = await Promise.all([
    fetchVendasPorCanal(d1),
    fetchContasPagar(hoje),
  ]);

  return {
    dataReferencia: d1,
    vendas,
    contasPagar,
  };
}
