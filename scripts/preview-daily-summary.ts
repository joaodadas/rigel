// Preview da mensagem final (queries reais + formatter) SEM enviar via WhatsApp.
// USO: npx tsx --env-file=.env.local scripts/preview-daily-summary.ts

import { fetchDailySummary } from "../src/lib/queries/daily-summary";
import { formatDailySummary } from "../src/lib/notifications/daily-summary";

async function main() {
  console.log("Gerando preview...\n");
  const data = await fetchDailySummary();
  const msg = formatDailySummary(data);
  console.log(msg);
  console.log(`\n--- length: ${msg.length} chars ---`);
}

main().catch((err) => {
  console.error("✗ Falhou:", err);
  process.exit(1);
});
