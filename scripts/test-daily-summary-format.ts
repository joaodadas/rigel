// Verifica o formatDailySummary contra 3 cenários: normal, tudo zero, lista
// extremamente longa que força modo compacto. Imprime e valida tamanhos.
// USO: npx tsx scripts/test-daily-summary-format.ts

import { formatDailySummary } from "../src/lib/notifications/daily-summary";
import type { DailySummaryData } from "../src/lib/queries/daily-summary";

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

function vendasZeradas() {
  return {
    totalValor: 0,
    totalPedidos: 0,
    porCanal: CANAIS_ORDEM.map((canal) => ({ canal, valorTotal: 0, qtdPedidos: 0 })),
  };
}

const fixtureNormal: DailySummaryData = {
  dataReferencia: "2026-05-12",
  vendas: {
    totalValor: 47823.5,
    totalPedidos: 23,
    porCanal: [
      { canal: "B2B", valorTotal: 38420, qtdPedidos: 15 },
      { canal: "MERCADOFULL", valorTotal: 0, qtdPedidos: 0 },
      { canal: "MERCADOLIVRE", valorTotal: 4150.3, qtdPedidos: 3 },
      { canal: "SHEIN", valorTotal: 0, qtdPedidos: 0 },
      { canal: "SHOPEE", valorTotal: 3890.2, qtdPedidos: 4 },
      { canal: "SHOPEEFULL", valorTotal: 0, qtdPedidos: 0 },
      { canal: "SITE OPTA SAUDE", valorTotal: 0, qtdPedidos: 0 },
      { canal: "SITE RIGEL", valorTotal: 1363, qtdPedidos: 1 },
    ],
  },
  contasPagar: {
    atrasadas: {
      total: 12450,
      qtd: 3,
      itens: [
        { fornecedor: "Fornecedor X", valor: 8200, vencimento: "2026-05-01", diasAtraso: 12 },
        { fornecedor: "Fornecedor Y", valor: 3100, vencimento: "2026-05-08", diasAtraso: 5 },
        { fornecedor: "Fornecedor Z", valor: 1150, vencimento: "2026-05-11", diasAtraso: 2 },
      ],
    },
    venceHoje: {
      total: 5800,
      qtd: 2,
      itens: [
        { fornecedor: "Fornecedor A", valor: 3500, vencimento: "2026-05-13" },
        { fornecedor: "Fornecedor B", valor: 2300, vencimento: "2026-05-13" },
      ],
    },
    proximos7Dias: {
      total: 24300,
      qtd: 2,
      itens: [
        { fornecedor: "Fornecedor C", valor: 12000, vencimento: "2026-05-14" },
        { fornecedor: "Fornecedor D Com Nome Que Tem Mais De Trinta Caracteres Aqui", valor: 12300, vencimento: "2026-05-18" },
      ],
    },
  },
};

const fixtureTudoZero: DailySummaryData = {
  dataReferencia: "2026-05-10", // domingo
  vendas: vendasZeradas(),
  contasPagar: {
    atrasadas: { total: 0, qtd: 0, itens: [] },
    venceHoje: { total: 0, qtd: 0, itens: [] },
    proximos7Dias: { total: 0, qtd: 0, itens: [] },
  },
};

function gerarContas(n: number, baseDate: string, atraso: boolean) {
  const itens = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const valor = 1000 + i * 17;
    total += valor;
    itens.push({
      fornecedor: `Fornecedor Longo Que Pode Estourar ${i + 1}`,
      valor,
      vencimento: baseDate,
      ...(atraso ? { diasAtraso: i + 1 } : {}),
    });
  }
  return { total, qtd: n, itens };
}

const fixtureExtremo: DailySummaryData = {
  dataReferencia: "2026-05-12",
  vendas: fixtureNormal.vendas,
  contasPagar: {
    atrasadas: gerarContas(60, "2026-04-15", true),
    venceHoje: { total: 0, qtd: 0, itens: [] },
    proximos7Dias: gerarContas(120, "2026-05-18", false),
  },
};

function runFixture(name: string, data: DailySummaryData, maxLen = 4096) {
  console.log(`\n========== ${name} ==========`);
  const out = formatDailySummary(data);
  console.log(out);
  console.log(`\n--- length: ${out.length} chars (max ${maxLen}) ---`);
  if (out.length > maxLen) {
    console.error(`✗ Mensagem excede limite do WhatsApp.`);
    process.exit(1);
  }
}

runFixture("FIXTURE 1 — normal", fixtureNormal);
runFixture("FIXTURE 2 — tudo zero (domingo)", fixtureTudoZero);
runFixture("FIXTURE 3 — extremo (60 atrasadas + 120 prox 7d)", fixtureExtremo);

console.log("\n✓ Todas as fixtures couberam no limite.");
