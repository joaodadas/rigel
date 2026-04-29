// Gerador da narrativa exibida no card "Resumo Executivo · Análise Automatizada".
// Retorna fragmentos com classes (`pos`, `neg`, `strong`) — o consumidor renderiza
// via dangerouslySetInnerHTML porque o texto é todo controlado por nós.

import type { EmpresaCode } from "./empresas";
import { EMPRESA_BY_CODE } from "./empresas";
import { MES_NOME } from "./meses";
import type { DreSnapshot } from "./computacoes";
import { fmt, pct } from "./format";

interface Args {
  empresa: EmpresaCode;
  modo: "mes" | "acumulado";
  mesNum?: number;          // 1..12 — só pra modo "mes"
  ano: number;
  snap: DreSnapshot;
  prev?: DreSnapshot | null;
  semInvest: boolean;
  primeiroMesComDados: number; // pra detectar "mês de abertura"
}

const semClass = (v: number) => (v >= 0 ? "pos" : "neg");

export function gerarResumo(args: Args): string {
  const { empresa, modo, mesNum, ano, snap, prev, semInvest, primeiroMesComDados } = args;
  const lucro = semInvest ? snap.lucroSemInv : snap.lucroComInv;
  const nomeEmpresa = EMPRESA_BY_CODE[empresa].label;

  // Caso 1: Medical sem faturamento
  if (empresa === "medical" && snap.fat === 0 && (snap.cpv > 0 || snap.fixas > 0)) {
    const periodoLabel = modo === "acumulado"
      ? `no acumulado de ${ano}`
      : `em ${MES_NOME[mesNum!].toLowerCase()}/${String(ano).slice(-2)}`;
    return (
      `<strong>${nomeEmpresa}</strong> opera via <strong>Simples Nacional</strong> ` +
      `e não apresentou faturamento direto ${periodoLabel} — a operação absorveu custos de ` +
      `<strong>${fmt(snap.cpv)}</strong> em CPV e <strong>${fmt(snap.fixas)}</strong> em despesas ` +
      `fixas, resultando em <span class="neg">prejuízo de ${fmt(Math.abs(lucro))}</span>. ` +
      `A filial precisa de receita própria ou revisão do modelo de rateio para atingir viabilidade.`
    );
  }

  // Caso 2: Acumulado
  if (modo === "acumulado") {
    return (
      `<strong>${nomeEmpresa}</strong> acumulou <strong>${fmt(snap.fat)}</strong> em faturamento ` +
      `no ano de ${ano}, gerando margem de contribuição de <strong>${pct(snap.margemCtb, snap.fat)}</strong> ` +
      `e resultado operacional de <span class="${semClass(snap.resOp ?? 0)}">${fmt(snap.resOp ?? 0)}</span>. ` +
      `O lucro líquido ${semInvest ? "sem investimentos" : "com investimentos"} totalizou ` +
      `<span class="${semClass(lucro)}">${fmt(lucro)}</span>, equivalente a ` +
      `<strong>${pct(lucro, snap.fat)}</strong> da receita bruta. Carga tributária efetiva do período: ` +
      `<strong>${pct(snap.imp, snap.fat)}</strong>.`
    );
  }

  // Caso 3: Mês de abertura (primeiro mês com dados)
  if (mesNum === primeiroMesComDados || !prev) {
    return (
      `<strong>${nomeEmpresa}</strong> fechou ${MES_NOME[mesNum!].toLowerCase()} com faturamento bruto de ` +
      `<strong>${fmt(snap.fat)}</strong>, margem de contribuição em <strong>${pct(snap.margemCtb, snap.fat)}</strong> ` +
      `e resultado operacional de <span class="${semClass(snap.resOp ?? 0)}">${fmt(snap.resOp ?? 0)}</span>. ` +
      `O lucro líquido ${semInvest ? "(sem investimentos)" : "(com investimentos)"} ficou em ` +
      `<span class="${semClass(lucro)}">${fmt(lucro)}</span>, representando ` +
      `<strong>${pct(lucro, snap.fat)}</strong> da receita bruta. ` +
      `${snap.fixas > 0 ? `Despesas fixas em <strong>${pct(snap.fixas, snap.fat)}</strong> do faturamento.` : ""}`
    );
  }

  // Caso 4: Mês com mês anterior (comparativo)
  const prevLucro = semInvest ? prev.lucroSemInv : prev.lucroComInv;
  const variaLucro = prevLucro ? ((lucro - prevLucro) / Math.abs(prevLucro)) * 100 : 0;
  const variaFat = prev.fat ? ((snap.fat - prev.fat) / prev.fat) * 100 : 0;
  const mesAnteriorIdx = mesNum! - 1;
  const mesAnteriorLabel = MES_NOME[mesAnteriorIdx]?.slice(0, 3) ?? "anterior";
  const resOp = snap.resOp ?? 0;

  return (
    `<strong>${nomeEmpresa}</strong> registrou <strong>${fmt(snap.fat)}</strong> em faturamento ` +
    `(<span class="${variaFat >= 0 ? "pos" : "neg"}">${variaFat >= 0 ? "+" : ""}${variaFat.toFixed(1).replace(".", ",")}% vs. ${mesAnteriorLabel}</span>), ` +
    (resOp < 0
      ? `mas o <strong>resultado operacional</strong> <span class="neg">mergulhou para ${fmt(resOp)}</span>`
      : `e o <strong>resultado operacional</strong> ficou em <span class="pos">${fmt(resOp)}</span>`) +
    `. O lucro ${semInvest ? "sem investimentos" : "com investimentos"} fechou em ` +
    `<span class="${semClass(lucro)}">${fmt(lucro)}</span> ` +
    `(<span class="${variaLucro >= 0 ? "pos" : "neg"}">${variaLucro >= 0 ? "+" : ""}${variaLucro.toFixed(0)}% vs. ${mesAnteriorLabel}</span>).`
  );
}
