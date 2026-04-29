import * as XLSX from "xlsx";
import { EMPRESAS, EMPRESAS_OPERACIONAIS, EmpresaCode } from "./empresas";
import { LINHAS, LINHAS_FATURAMENTO_BRUTO, Categoria } from "./linhas";

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export interface DreLancamentoParsed {
  periodo: string;          // ISO date "YYYY-MM-01"
  empresa: EmpresaCode;
  regime_tributario: "lucro_presumido" | "simples_nacional" | "na";
  categoria: Categoria;
  sub_categoria: string;
  descricao: string;
  valor: number;
  pct_sobre_faturamento: number | null;
}

export interface DreParseResult {
  anoReferencia: number;
  mesesProcessados: number[];     // [1..12]
  lancamentos: DreLancamentoParsed[];
  warnings: string[];
}

interface AbaDetectada {
  nomeAba: string;
  mes: number;        // 1..12
  ano: number;        // 4 dígitos (ex: 2026)
}

const REGEX_ABA = /^DRE\s+(Janeiro|Fevereiro|Março|Marco|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)\s+(\d{2,4})$/i;

function nomeMesParaIndice(nome: string): number {
  const norm = nome.toLowerCase().replace(/ç/g, "c");
  const idx = MESES_PT.findIndex((m) => m.toLowerCase().replace(/ç/g, "c") === norm);
  return idx + 1; // 1..12
}

function normalizaAno(raw: string): number {
  const n = parseInt(raw, 10);
  if (n < 100) return 2000 + n;
  return n;
}

function detectarAbas(workbook: XLSX.WorkBook): AbaDetectada[] {
  const found: AbaDetectada[] = [];
  for (const nomeAba of workbook.SheetNames) {
    const m = nomeAba.match(REGEX_ABA);
    if (!m) continue;
    found.push({
      nomeAba,
      mes: nomeMesParaIndice(m[1]),
      ano: normalizaAno(m[2]),
    });
  }
  return found;
}

function parseNumero(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const trim = raw.trim();
  if (trim === "") return null;
  // Formato BR: 1.234,56 → 1234.56
  const norm = trim.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(norm);
  return Number.isFinite(n) ? n : null;
}

function periodoISO(ano: number, mes: number): string {
  const mm = String(mes).padStart(2, "0");
  return `${ano}-${mm}-01`;
}

function calcularFaturamentoBruto(
  sheet: XLSX.WorkSheet,
  colValor: string,
): number {
  let total = 0;
  for (const linha of LINHAS_FATURAMENTO_BRUTO) {
    const cell = sheet[`${colValor}${linha}`];
    const v = parseNumero(cell?.v);
    if (v !== null) total += v;
  }
  return total;
}

function parseAba(
  sheet: XLSX.WorkSheet,
  ano: number,
  mes: number,
  warnings: string[],
): { lancamentos: DreLancamentoParsed[]; teveDado: boolean } {
  const lancamentos: DreLancamentoParsed[] = [];
  const periodo = periodoISO(ano, mes);

  // Calcula faturamento bruto por empresa para % sobre faturamento
  const fatBrutoPorEmpresa: Record<string, number> = {};
  for (const emp of EMPRESAS) {
    fatBrutoPorEmpresa[emp.code] = calcularFaturamentoBruto(sheet, emp.colValor);
  }

  let teveAlgumValor = false;

  for (const [linhaStr, meta] of Object.entries(LINHAS)) {
    const linha = parseInt(linhaStr, 10);
    for (const empresa of EMPRESAS) {
      // L85 (investimentos) só vem na coluna consolidada
      if (linha === 85 && empresa.code !== "consolidado") continue;

      const cellRef = `${empresa.colValor}${linha}`;
      const raw = sheet[cellRef]?.v;
      const valor = parseNumero(raw);
      if (valor === null) continue;

      teveAlgumValor = true;

      const fatBruto = fatBrutoPorEmpresa[empresa.code];
      const pct = fatBruto > 0 ? Number((valor / fatBruto).toFixed(4)) : null;

      lancamentos.push({
        periodo,
        empresa: empresa.code,
        regime_tributario: empresa.regime,
        categoria: meta.categoria,
        sub_categoria: meta.subCategoria,
        descricao: meta.descricao,
        valor: Number(valor.toFixed(2)),
        pct_sobre_faturamento: pct,
      });
    }
  }

  if (teveAlgumValor) {
    validarMatematica(lancamentos, mes, warnings);
  }

  return { lancamentos, teveDado: teveAlgumValor };
}

function validarMatematica(
  lancamentos: DreLancamentoParsed[],
  mes: number,
  warnings: string[],
): void {
  const TOL = 0.01;
  // Chave inclui categoria porque sub_categoria "total" colide entre
  // imposto/variavel/cpv/despesa_fixa.
  const keyOf = (empresa: string, categoria: string, sub: string) =>
    `${empresa}:${categoria}:${sub}`;

  const byKey = new Map<string, DreLancamentoParsed>();
  for (const l of lancamentos) {
    byKey.set(keyOf(l.empresa, l.categoria, l.sub_categoria), l);
  }

  // 1. Faturamento − Devoluções − Impostos ≈ Receita Líquida
  for (const empresa of EMPRESAS) {
    const fatInt = byKey.get(keyOf(empresa.code, "faturamento", "mercado_interno"))?.valor ?? 0;
    const fatExt = byKey.get(keyOf(empresa.code, "faturamento", "mercado_externo"))?.valor ?? 0;
    const dev = byKey.get(keyOf(empresa.code, "faturamento", "devolucoes"))?.valor ?? 0;
    const imp = byKey.get(keyOf(empresa.code, "imposto", "total"))?.valor ?? 0;
    const rl = byKey.get(keyOf(empresa.code, "resultado", "receita_liquida"))?.valor;
    if (rl === undefined) continue;
    const calc = fatInt + fatExt - dev - imp;
    if (Math.abs(calc - rl) > TOL) {
      warnings.push(
        `[mes=${mes} empresa=${empresa.code}] Receita Líquida divergente: calc=${calc.toFixed(2)} planilha=${rl.toFixed(2)}`,
      );
    }
  }

  // 2. Consolidado ≈ soma das 4 empresas operacionais (linha por linha)
  for (const [linhaStr, meta] of Object.entries(LINHAS)) {
    const linha = parseInt(linhaStr, 10);
    if (linha === 85) continue; // só consolidado
    const cons = byKey.get(keyOf("consolidado", meta.categoria, meta.subCategoria));
    if (!cons) continue;
    const soma = EMPRESAS_OPERACIONAIS.reduce((acc, code) => {
      return acc + (byKey.get(keyOf(code, meta.categoria, meta.subCategoria))?.valor ?? 0);
    }, 0);
    if (Math.abs(soma - cons.valor) > TOL) {
      warnings.push(
        `[mes=${mes} linha=${linha} ${meta.categoria}.${meta.subCategoria}] Consolidado divergente: soma=${soma.toFixed(2)} planilha=${cons.valor.toFixed(2)}`,
      );
    }
  }
}

export function parseDRE(buffer: Buffer | ArrayBuffer): DreParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const abas = detectarAbas(workbook);

  if (abas.length === 0) {
    throw new Error("Nenhuma aba DRE detectada (esperado: 'DRE Janeiro 26', 'DRE Fevereiro 26', etc.)");
  }

  const anos = new Set(abas.map((a) => a.ano));
  if (anos.size > 1) {
    throw new Error(`Planilha contém múltiplos anos (${[...anos].join(", ")}). Esperado: um ano só.`);
  }
  const ano = [...anos][0];

  const todosLancamentos: DreLancamentoParsed[] = [];
  const mesesProcessados: number[] = [];
  const warnings: string[] = [];

  for (const aba of abas) {
    const sheet = workbook.Sheets[aba.nomeAba];
    const { lancamentos, teveDado } = parseAba(sheet, aba.ano, aba.mes, warnings);
    if (teveDado) {
      todosLancamentos.push(...lancamentos);
      mesesProcessados.push(aba.mes);
    }
  }

  mesesProcessados.sort((a, b) => a - b);

  return {
    anoReferencia: ano,
    mesesProcessados,
    lancamentos: todosLancamentos,
    warnings,
  };
}
