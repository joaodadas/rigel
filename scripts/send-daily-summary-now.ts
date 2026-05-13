// Executa AGORA o mesmo fluxo do cron daily-summary: queries → format → envia
// via WhatsApp para WHATSAPP_RECIPIENT_NUMBER. Útil para teste manual.
// USO: npx tsx --env-file=.env.local scripts/send-daily-summary-now.ts

import { fetchDailySummary } from "../src/lib/queries/daily-summary";
import { formatDailySummary } from "../src/lib/notifications/daily-summary";
import { sendWhatsAppText } from "../src/lib/evolution/client";

async function main() {
  console.log("Buscando dados...");
  const data = await fetchDailySummary();
  const msg = formatDailySummary(data);
  console.log(`Mensagem montada (${msg.length} chars). Enviando...`);
  await sendWhatsAppText(msg);
  console.log("✓ Enviado.");
}

main().catch((err) => {
  console.error("✗ Falhou:", err);
  process.exit(1);
});
