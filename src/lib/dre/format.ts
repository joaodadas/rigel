// Helpers de formatação para o DRE — pt-BR, sem fração nos cards (compactos)
// e com fração de 2 casas só na tabela detalhada.

const fmtCompact = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const fmtFull2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Formato curto, parênteses pra negativos: "1.234.567" ou "(1.234.567)".
 * Usado em KPIs, waterfall, donut, ranking — onde o foco é magnitude.
 */
export function fmt(n: number): string {
  if (n < 0) return `(${fmtCompact.format(Math.abs(n))})`;
  return fmtCompact.format(n);
}

/**
 * Formato completo com 2 casas, prefixo R$. Usado na tabela DRE detalhada.
 */
export function fmtFull(n: number): string {
  if (n < 0) return `(R$ ${fmtFull2.format(Math.abs(n))})`;
  return `R$ ${fmtFull2.format(n)}`;
}

/**
 * Percentual sobre uma base, formato pt-BR ("23,4%"). Retorna "—" se base inválida.
 */
export function pct(val: number, base: number): string {
  if (!base || base === 0) return "—";
  const p = (val / base) * 100;
  return `${p.toFixed(1).replace(".", ",")}%`;
}

/**
 * Versão numérica de pct — útil pra semaforização e comparações.
 */
export function pctNum(val: number, base: number): number {
  if (!base || base === 0) return 0;
  return (val / base) * 100;
}

/**
 * Variação percentual entre dois valores. "—" quando base inválida.
 */
export function delta(curr: number, prev: number | null | undefined): string {
  if (prev === null || prev === undefined || prev === 0) return "—";
  const d = ((curr - prev) / Math.abs(prev)) * 100;
  const sign = d >= 0 ? "+" : "";
  return `${sign}${d.toFixed(1).replace(".", ",")}%`;
}
