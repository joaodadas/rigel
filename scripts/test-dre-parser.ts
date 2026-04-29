// Roda o parser na planilha real e imprime sumário + amostra de lançamentos.
// Uso: npx tsx scripts/test-dre-parser.ts "C:\\Users\\misae\\Documents\\Dev\\Ashmont\\Rigel\\files\\DRE 2026 Rigel.xlsx"

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseDRE } from "../src/lib/dre/parser";

const arg = process.argv[2];
if (!arg) {
  console.error("Uso: npx tsx scripts/test-dre-parser.ts <caminho-da-planilha.xlsx>");
  process.exit(1);
}

const fullPath = resolve(arg);
console.log(`Lendo: ${fullPath}`);

const buffer = readFileSync(fullPath);
const result = parseDRE(buffer);

console.log("\n=== SUMÁRIO ===");
console.log("Ano de referência:", result.anoReferencia);
console.log("Meses processados:", result.mesesProcessados);
console.log("Total de lançamentos:", result.lancamentos.length);
console.log("Warnings:", result.warnings.length);

if (result.warnings.length > 0) {
  console.log("\n=== WARNINGS ===");
  for (const w of result.warnings) console.log("  -", w);
}

console.log("\n=== AMOSTRA: primeiro mês, empresa CONSOLIDADO ===");
const primeiroMes = result.mesesProcessados[0];
const periodoStr = `${result.anoReferencia}-${String(primeiroMes).padStart(2, "0")}-01`;
const amostra = result.lancamentos.filter(
  (l) => l.periodo === periodoStr && l.empresa === "consolidado",
);
console.table(amostra.map((l) => ({
  cat: l.categoria,
  sub: l.sub_categoria,
  valor: l.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
  pct: l.pct_sobre_faturamento !== null ? (l.pct_sobre_faturamento * 100).toFixed(2) + "%" : "—",
})));

console.log("\n✓ Parser executou sem erros.");
