// Pivota a lista plana de DreLancamento (do Supabase) em snapshots por
// (empresa, periodo) e em acumulado, no shape esperado pelos componentes do dashboard.

import type { DreLancamento } from "@/lib/queries/dre";
import type { EmpresaCode } from "./empresas";

export interface DreSnapshot {
  // Faturamento
  fat: number;       // mercado_interno + mercado_externo (faturamento bruto)
  fatMI: number;
  fatME: number;
  devol: number;
  // Impostos
  imp: number;
  icms: number;
  pisCofins: number;
  simples: number;
  irpjCsll: number;
  // Resultados
  rcLiq: number;
  // Variáveis
  variaveis: number; // L22 (não pode chamar `var`, palavra reservada)
  comissao: number;
  frete: number;
  pdd: number;
  // CPV
  cpv: number;
  mp: number;
  mod: number;
  terc: number;
  faccao: number;
  embal: number;
  energia: number;
  // Margem de contribuição
  margemCtb: number;
  // Despesas Fixas
  fixas: number;
  ccAdmin: number;
  ccCIS: number;
  ccCom: number;
  ccCorte: number;
  ccCost: number;
  ccEcom: number;
  ccEstoque: number;
  ccMkt: number;
  ccPers: number;
  ccPlacas: number;
  ccQual: number;
  ccSense: number;
  ccSeamless: number;
  ccTec: number;
  ccGalpao: number;
  ccML: number;
  ccShoppe: number;
  ccAmazon: number;
  ccShein: number;
  ccDiv: number;
  // Resultado op + lucro
  resOp: number | null;
  nonOp: number;
  lucroSemInv: number;
  lucroComInv: number;
  invest: number;
}

const ZERO_SNAPSHOT: DreSnapshot = {
  fat: 0, fatMI: 0, fatME: 0, devol: 0,
  imp: 0, icms: 0, pisCofins: 0, simples: 0, irpjCsll: 0,
  rcLiq: 0,
  variaveis: 0, comissao: 0, frete: 0, pdd: 0,
  cpv: 0, mp: 0, mod: 0, terc: 0, faccao: 0, embal: 0, energia: 0,
  margemCtb: 0,
  fixas: 0,
  ccAdmin: 0, ccCIS: 0, ccCom: 0, ccCorte: 0, ccCost: 0, ccEcom: 0,
  ccEstoque: 0, ccMkt: 0, ccPers: 0, ccPlacas: 0, ccQual: 0, ccSense: 0,
  ccSeamless: 0, ccTec: 0, ccGalpao: 0, ccML: 0, ccShoppe: 0, ccAmazon: 0,
  ccShein: 0, ccDiv: 0,
  resOp: null, nonOp: 0, lucroSemInv: 0, lucroComInv: 0, invest: 0,
};

// Mapa categoria.sub_categoria → chave do snapshot. As linhas que entram em
// "fat" (faturamento bruto = MI + ME) somam tanto na chave específica quanto
// na chave agregada `fat` — isso é feito explicitamente no aplicar().
const KEY_MAP: Record<string, keyof DreSnapshot> = {
  "faturamento.mercado_interno": "fatMI",
  "faturamento.mercado_externo": "fatME",
  "faturamento.devolucoes": "devol",
  "imposto.total": "imp",
  "imposto.icms": "icms",
  "imposto.pis_cofins": "pisCofins",
  "imposto.simples_nacional": "simples",
  "imposto.irpj_csll": "irpjCsll",
  "resultado.receita_liquida": "rcLiq",
  "variavel.total": "variaveis",
  "variavel.comissao": "comissao",
  "variavel.frete": "frete",
  "variavel.pdd": "pdd",
  "cpv.total": "cpv",
  "cpv.materia_prima": "mp",
  "cpv.mao_de_obra_direta": "mod",
  "cpv.terceiros": "terc",
  "cpv.faccao": "faccao",
  "cpv.embalagens": "embal",
  "cpv.energia": "energia",
  "resultado.margem_contribuicao": "margemCtb",
  "despesa_fixa.total": "fixas",
  "despesa_fixa.administrativo": "ccAdmin",
  "despesa_fixa.cis": "ccCIS",
  "despesa_fixa.comercial": "ccCom",
  "despesa_fixa.corte_laser": "ccCorte",
  "despesa_fixa.costura": "ccCost",
  "despesa_fixa.ecommerce": "ccEcom",
  "despesa_fixa.estoque_expedicao": "ccEstoque",
  "despesa_fixa.marketing": "ccMkt",
  "despesa_fixa.personalizacao": "ccPers",
  "despesa_fixa.placas": "ccPlacas",
  "despesa_fixa.qualidade": "ccQual",
  "despesa_fixa.rigel_sense": "ccSense",
  "despesa_fixa.seamless": "ccSeamless",
  "despesa_fixa.tecidos": "ccTec",
  "despesa_fixa.galpao_2026": "ccGalpao",
  "despesa_fixa.mercado_livre": "ccML",
  "despesa_fixa.shoppe": "ccShoppe",
  "despesa_fixa.amazon": "ccAmazon",
  "despesa_fixa.shein": "ccShein",
  "despesa_fixa.diversas": "ccDiv",
  "nao_operacional.total_receita_despesa": "nonOp",
  "resultado.lucro_com_investimentos": "lucroComInv",
  "resultado.lucro_sem_investimentos": "lucroSemInv",
  "resultado.investimentos": "invest",
  // resultado.operacional é tratado à parte porque pode ser null (mês sem dado)
};

function aplicar(snap: DreSnapshot, l: DreLancamento): void {
  const key = `${l.categoria}.${l.sub_categoria}`;
  if (key === "resultado.operacional") {
    snap.resOp = (snap.resOp ?? 0) + l.valor;
    return;
  }
  const target = KEY_MAP[key];
  if (!target) return; // sub_categoria desconhecida — ignora
  // Tipos numéricos do snap (todos exceto resOp); usamos cast pra burlar o índice.
  (snap as unknown as Record<string, number>)[target] += l.valor;
  // fat = soma de mercado interno + externo
  if (target === "fatMI" || target === "fatME") snap.fat += l.valor;
}

/**
 * Constrói snapshot pra um (empresa, periodo) específico.
 * `lancamentos` deve já vir filtrado ou ser do conjunto inteiro — filtramos aqui.
 */
export function buildSnapshot(
  lancamentos: DreLancamento[],
  empresa: EmpresaCode,
  periodo: string,
): DreSnapshot {
  const snap: DreSnapshot = { ...ZERO_SNAPSHOT };
  for (const l of lancamentos) {
    if (l.empresa !== empresa) continue;
    if (l.periodo !== periodo) continue;
    aplicar(snap, l);
  }
  return snap;
}

/**
 * Snapshot acumulado do ano: soma todos os meses fornecidos pra mesma empresa.
 */
export function buildAcumulado(
  lancamentos: DreLancamento[],
  empresa: EmpresaCode,
  periodos: string[],
): DreSnapshot {
  const snap: DreSnapshot = { ...ZERO_SNAPSHOT };
  const periodosSet = new Set(periodos);
  for (const l of lancamentos) {
    if (l.empresa !== empresa) continue;
    if (!periodosSet.has(l.periodo)) continue;
    aplicar(snap, l);
  }
  return snap;
}

/**
 * Helper: descobre se a empresa tem qualquer lançamento no periodo. Útil pra
 * desabilitar pills de mês quando a empresa selecionada não tem dado.
 */
export function temDadosNoPeriodo(
  lancamentos: DreLancamento[],
  empresa: EmpresaCode,
  periodo: string,
): boolean {
  for (const l of lancamentos) {
    if (l.empresa === empresa && l.periodo === periodo) return true;
  }
  return false;
}

export function periodoISO(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}-01`;
}
