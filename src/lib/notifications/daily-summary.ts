import type {
  DailySummaryData,
  VendasCanal,
  ContaPagarItem,
  ContasPagarBloco,
} from "@/lib/queries/daily-summary";

const MAX_LEN = 4000; // margem de 96 chars sobre o limite de 4096 do WhatsApp
const CANAL_PAD = 18;
const VALOR_PAD = 15; // "R$ 9.999.999,99" cabe sem quebrar o alinhamento das colunas
const QTD_PAD = 3;
const FORNECEDOR_MAX = 30;

// Zero-width space inserido em dígitos para quebrar a auto-linkificação
// no WhatsApp mobile (Android/iOS detectam valores monetários como R$ X.XXX,XX
// e os renderizam em azul/sublinhado). Invisível no Web e no mobile.
const ZWSP = "​";

// ---------------------------------------------------------------------------
// Helpers de formatação
// ---------------------------------------------------------------------------

function fmtBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function fmtDateLong(iso: string): string {
  const [y, m, d] = iso.split("-");
  // weekday: usa UTC para evitar shift; o dia ISO já é "absoluto"
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  const weekday = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    timeZone: "UTC",
  }).format(date);
  return `${d}${ZWSP}/${m}${ZWSP}/${y} (${weekday})`;
}

function fmtDateShort(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}${ZWSP}/${m}`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

function linhaCanal(c: VendasCanal): string {
  const nome = c.canal.padEnd(CANAL_PAD, ".");
  const valor = fmtBRL(c.valorTotal).padStart(VALOR_PAD);
  const qtd = String(c.qtdPedidos).padStart(QTD_PAD);
  return `• ${nome} ${valor} (${qtd})`;
}

function linhaContaHoje(c: ContaPagarItem): string {
  const nome = truncate(c.fornecedor, FORNECEDOR_MAX);
  return `• ${nome} — ${fmtBRL(c.valor)}`;
}

function linhaContaProxima(c: ContaPagarItem): string {
  const nome = truncate(c.fornecedor, FORNECEDOR_MAX);
  return `• ${nome} — ${fmtBRL(c.valor)} (${fmtDateShort(c.vencimento)})`;
}

function pluralContas(n: number): string {
  return n === 1 ? "conta" : "contas";
}

function blocoAtrasadas(bloco: ContasPagarBloco): string {
  // Sempre só o total — sem lista, mesmo quando qtd > 0.
  return `🔴 *Em atraso* — ${fmtBRL(bloco.total)} (${bloco.qtd} ${pluralContas(bloco.qtd)})`;
}

function blocoContas(
  emoji: string,
  titulo: string,
  bloco: ContasPagarBloco,
  linhaFn: (c: ContaPagarItem) => string,
): string[] {
  const header = `${emoji} *${titulo}* — ${fmtBRL(bloco.total)} (${bloco.qtd})`;
  if (bloco.qtd === 0) {
    return [header, "_(nenhuma)_"];
  }
  return [header, ...bloco.itens.map(linhaFn)];
}

function blocoContasCompacto(
  emoji: string,
  titulo: string,
  bloco: ContasPagarBloco,
): string {
  return `${emoji} *${titulo}* — ${fmtBRL(bloco.total)} (${bloco.qtd} ${pluralContas(bloco.qtd)})`;
}

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

function build(
  data: DailySummaryData,
  modo: "completo" | "compactarProx7" | "compactarProx7EHoje",
): string {
  const linhas: string[] = [];
  linhas.push("📊 *Resumo Diário Rigel*");
  linhas.push(`_Referência: ${fmtDateLong(data.dataReferencia)}_`);
  linhas.push("");
  linhas.push("━━━━━━━━━━━━━━━━━━━━━━");
  linhas.push("💰 *VENDAS D-1*");
  linhas.push("━━━━━━━━━━━━━━━━━━━━━━");
  linhas.push(
    `*Total:* ${fmtBRL(data.vendas.totalValor)} (${data.vendas.totalPedidos} pedidos)`,
  );
  linhas.push(`_Status considerado: Atendido_`);
  linhas.push("");
  for (const c of data.vendas.porCanal) linhas.push(linhaCanal(c));
  linhas.push("");
  linhas.push("━━━━━━━━━━━━━━━━━━━━━━");
  linhas.push("💸 *CONTAS A PAGAR*");
  linhas.push("━━━━━━━━━━━━━━━━━━━━━━");
  linhas.push("");

  // Em atraso: sempre só agregado.
  linhas.push(blocoAtrasadas(data.contasPagar.atrasadas));
  linhas.push("");

  if (modo === "compactarProx7EHoje") {
    linhas.push(blocoContasCompacto("🟡", "Vence hoje", data.contasPagar.venceHoje));
  } else {
    linhas.push(
      ...blocoContas("🟡", "Vence hoje", data.contasPagar.venceHoje, linhaContaHoje),
    );
  }
  linhas.push("");
  if (modo === "compactarProx7" || modo === "compactarProx7EHoje") {
    linhas.push(
      blocoContasCompacto("🔵", "Próximos 7 dias", data.contasPagar.proximos7Dias),
    );
  } else {
    linhas.push(
      ...blocoContas(
        "🔵",
        "Próximos 7 dias",
        data.contasPagar.proximos7Dias,
        linhaContaProxima,
      ),
    );
  }

  return linhas.join("\n");
}

/**
 * Quebra padrões que o WhatsApp mobile auto-linkifica em azul/sublinhado:
 *   - "$" recebe ZWSP imediatamente após (quebra "R$ X" como moeda).
 *   - dígito-separador-dígito recebe ZWSP entre o dígito e o separador
 *     (quebra "1.234,56" como número).
 * ZWSP (U+200B) é invisível em qualquer renderer (Web e mobile). Aplica
 * num passe final para evitar interferir nas larguras de padStart usadas
 * no alinhamento das colunas.
 */
function neutralizarLinkificacao(s: string): string {
  return s
    .replace(/\$/g, `$${ZWSP}`)
    .replace(/(\d)([.,])(\d)/g, `$1${ZWSP}$2$3`);
}

export function formatDailySummary(data: DailySummaryData): string {
  const completa = build(data, "completo");
  if (completa.length <= MAX_LEN) return neutralizarLinkificacao(completa);

  const compacta1 = build(data, "compactarProx7");
  if (compacta1.length <= MAX_LEN) return neutralizarLinkificacao(compacta1);

  return neutralizarLinkificacao(build(data, "compactarProx7EHoje"));
}
