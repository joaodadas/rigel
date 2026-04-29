// 7 sinais financeiros derivados do snapshot atual + anterior. Funções puras,
// retornam lista de Alerta. Spec §9 + §13 (Fase 3).

import type { EmpresaCode } from "./empresas";
import type { DreSnapshot } from "./computacoes";
import { fmt, pct, pctNum } from "./format";

export type AlertaTipo = "pos" | "neg" | "info";

export interface Alerta {
  tipo: AlertaTipo;
  icon: string;     // "▲" | "▼" | "⚠" | "◆"
  html: string;     // texto com <strong>...</strong>
}

interface Args {
  snap: DreSnapshot;
  prev: DreSnapshot | null;
  empresa: EmpresaCode;
  semInvest: boolean;
}

export function computeAlertas({ snap, prev, empresa, semInvest }: Args): Alerta[] {
  const alertas: Alerta[] = [];

  // 1. Salto > 30% em despesas fixas MoM
  if (prev && prev.fixas > 0) {
    const deltaFixas = ((snap.fixas - prev.fixas) / prev.fixas) * 100;
    if (deltaFixas > 30) {
      alertas.push({
        tipo: "neg",
        icon: "▼",
        html:
          `<strong>Despesas fixas explodiram ${deltaFixas.toFixed(0)}%</strong> ` +
          `vs mês anterior (${fmt(prev.fixas)} → ${fmt(snap.fixas)}). ` +
          `Investigar lançamento pontual ou erro de apropriação.`,
      });
    }
  }

  // 2. Resultado operacional virou negativo (era positivo)
  if (prev && snap.resOp !== null && prev.resOp !== null && snap.resOp < 0 && prev.resOp > 0) {
    alertas.push({
      tipo: "neg",
      icon: "⚠",
      html:
        `<strong>Resultado operacional virou negativo</strong> ` +
        `(${fmt(snap.resOp)}) após mês anterior positivo (${fmt(prev.resOp)}). ` +
        `Verificar combinação de queda de receita com salto em custos.`,
    });
  }

  // 3. Medical sem faturamento próprio + custos relevantes
  if (empresa === "medical" && snap.fat === 0 && snap.cpv + snap.fixas > 0) {
    alertas.push({
      tipo: "neg",
      icon: "⚠",
      html:
        `<strong>Rigel Medical sem faturamento próprio</strong> ` +
        `e consome ${fmt(snap.fixas + snap.cpv)} entre CPV e despesas fixas. ` +
        `A operação precisa gerar receita ou ter o modelo de rateio revisto entre as empresas do grupo.`,
    });
  }

  // 4. Margem de contribuição saudável (> 58%)
  if (snap.fat > 0 && snap.margemCtb / snap.fat > 0.58) {
    alertas.push({
      tipo: "pos",
      icon: "▲",
      html:
        `<strong>Margem de contribuição saudável</strong> em ${pct(snap.margemCtb, snap.fat)}. ` +
        `Cada real de venda contribui com ${pct(snap.margemCtb, snap.fat)} para cobrir despesas fixas e gerar lucro.`,
    });
  }

  // 5. Concentração em Mercado Livre (> 40% das despesas fixas)
  if (snap.fixas > 0 && snap.ccML / snap.fixas > 0.4) {
    alertas.push({
      tipo: "info",
      icon: "◆",
      html:
        `<strong>Concentração em Mercado Livre:</strong> ` +
        `${pct(snap.ccML, snap.fixas)} das despesas fixas vêm de um único canal. ` +
        `Considerar diversificação para reduzir risco de dependência.`,
    });
  }

  // 6. Carga tributária elevada (> 3,5%)
  if (snap.fat > 0 && snap.imp / snap.fat > 0.035) {
    alertas.push({
      tipo: "info",
      icon: "◆",
      html:
        `<strong>Carga tributária de ${pct(snap.imp, snap.fat)}</strong> sobre faturamento. ` +
        `Avaliar estudo de elisão fiscal para os regimes Lucro Presumido das empresas tributadas.`,
    });
  }

  // 7. Margem operacional alta (> 15%)
  if (snap.fat > 0 && snap.resOp !== null && pctNum(snap.resOp, snap.fat) > 15) {
    const margem = pctNum(snap.resOp, snap.fat);
    alertas.push({
      tipo: "pos",
      icon: "▲",
      html:
        `<strong>Margem operacional de ${margem.toFixed(1).replace(".", ",")}%</strong>` +
        ` ${empresa === "consolidado" ? "no consolidado do grupo" : "para esta empresa"} — ` +
        `forte capacidade de gerar lucro a partir das operações ${semInvest ? "(visão sem investimentos)" : ""}.`,
    });
  }

  if (alertas.length === 0) {
    alertas.push({
      tipo: "pos",
      icon: "◆",
      html:
        `<strong>Nenhum sinal de alerta</strong> para o período e empresa selecionados. ` +
        `Operação dentro dos parâmetros esperados.`,
    });
  }

  return alertas;
}
