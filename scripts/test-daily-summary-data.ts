// Chama fetchDailySummary contra dados reais e imprime o resultado para inspeção.
// USO: npx tsx --env-file=.env.local scripts/test-daily-summary-data.ts

import { fetchDailySummary } from "../src/lib/queries/daily-summary";
import { EMPRESA_SLUGS } from "../src/lib/empresas";

async function main() {
  console.log("Chamando fetchDailySummary()...\n");
  const data = await fetchDailySummary();
  console.log(JSON.stringify(data, null, 2));

  console.log("\n=== CHECKS ===");
  console.log("dataReferencia:", data.dataReferencia);
  console.log("vendas.porCanal.length (esperado: 8):", data.vendas.porCanal.length);
  console.log("vendas.totalPedidos:", data.vendas.totalPedidos);
  console.log("contasPagar.length (esperado:", EMPRESA_SLUGS.length, "):", data.contasPagar.length);
  for (const bloco of data.contasPagar) {
    console.log(
      `  ${bloco.empresa} (${bloco.nome}): atrasadas=${bloco.atrasadas.qtd}, venceHoje=${bloco.venceHoje.qtd}, prox7=${bloco.proximos7Dias.qtd}`,
    );
  }

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

  if (data.contasPagar.length !== EMPRESA_SLUGS.length) {
    console.error(`✗ contasPagar deveria ter ${EMPRESA_SLUGS.length} entradas (uma por empresa).`);
    process.exit(1);
  }
  const slugsOrdem = data.contasPagar.map((b) => b.empresa).join(",");
  const slugsEsperados = EMPRESA_SLUGS.join(",");
  if (slugsOrdem !== slugsEsperados) {
    console.error(`✗ Ordem das empresas em contasPagar inesperada: ${slugsOrdem} (esperado ${slugsEsperados})`);
    process.exit(1);
  }
  console.log("✓ Ordem e quantidade de empresas em contasPagar OK.");
}

main().catch((err) => {
  console.error("✗ Falhou:", err);
  process.exit(1);
});
