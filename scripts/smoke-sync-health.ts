// Smoke read-only do monitor de saúde contra DB/VHSys reais. Não envia WhatsApp,
// não escreve nada. Use pra inspecionar o que o cron veria agora.
// USO: npx tsx --env-file=.env.local scripts/smoke-sync-health.ts
import { createSupabaseServer } from "../src/lib/supabase/client";
import { checkStaleness, checkDivergence, formatHealthReport } from "../src/lib/sync/health";

async function main() {
  const supabase = createSupabaseServer();
  const now = new Date();

  const stale = await checkStaleness(supabase, now);
  console.log("Travadas:", JSON.stringify(stale, null, 2));

  // Roda divergência sempre no smoke (ignora o gate de hora) pra dar visibilidade.
  const diverged = await checkDivergence(supabase);
  console.log("Divergências:", JSON.stringify(diverged, null, 2));

  const report = formatHealthReport(stale, diverged, [], now);
  console.log("\n--- Mensagem que seria enviada ---");
  console.log(report ?? "(saudável — nenhum alerta)");
}

main().catch((e) => {
  console.error("smoke falhou:", e);
  process.exit(1);
});
