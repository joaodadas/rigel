// Chama fetchDailySummary contra dados reais e imprime o resultado para inspeção.
// USO: npx tsx --env-file=.env.local scripts/test-daily-summary-data.ts

import { fetchDailySummary } from "../src/lib/queries/daily-summary";

async function main() {
  console.log("Chamando fetchDailySummary()...\n");
  const data = await fetchDailySummary();
  console.log(JSON.stringify(data, null, 2));

  console.log("\n=== CHECKS ===");
  console.log("dataReferencia:", data.dataReferencia);
  console.log("vendas.porCanal.length (esperado: 8):", data.vendas.porCanal.length);
  console.log("vendas.totalPedidos:", data.vendas.totalPedidos);
  console.log("contas.atrasadas.qtd:", data.contasPagar.atrasadas.qtd);
  console.log("contas.venceHoje.qtd:", data.contasPagar.venceHoje.qtd);
  console.log("contas.proximos7Dias.qtd:", data.contasPagar.proximos7Dias.qtd);

  if (data.vendas.porCanal.length !== 8) {
    console.error("✗ Esperava 8 canais.");
    process.exit(1);
  }
  const canais = data.vendas.porCanal.map((c) => c.canal).join(",");
  const esperado = "B2B,MERCADOFULL,MERCADOLIVRE,SHEIN,SHOPEE,SHOPEEFULL,SITE OPTA SAUDE,SITE RIGEL";
  if (canais !== esperado) {
    console.error("✗ Ordem dos canais inesperada:", canais);
    process.exit(1);
  }
  console.log("✓ Ordem e quantidade de canais OK.");
}

main().catch((err) => {
  console.error("✗ Falhou:", err);
  process.exit(1);
});
