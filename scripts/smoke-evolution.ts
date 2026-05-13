// Envia uma mensagem de teste pelo WhatsApp via Evolution.
// Confirma que envs estão certas e o endpoint funciona.
// USO: npx tsx --env-file=.env.local scripts/smoke-evolution.ts

import { sendWhatsAppText } from "../src/lib/evolution/client";

async function main() {
  const stamp = new Date().toISOString();
  const text =
    `🧪 *Smoke test Evolution*\n\n` +
    `Timestamp: ${stamp}\n` +
    `Se você está lendo isto, o cliente está OK.`;
  console.log("Enviando mensagem de teste...");
  await sendWhatsAppText(text);
  console.log("✓ Enviado com sucesso.");
}

main().catch((err) => {
  console.error("✗ Falhou:", err);
  process.exit(1);
});
