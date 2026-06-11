// Loop local de backfill de pedido_itens: roda runPedidoItensSync (a mesma
// função do cron da Vercel) até a fila zerar. Idempotente e retomável — se o
// processo cair, basta rodar de novo que continua de onde parou.
//
// uso: npx tsx --env-file=.env.local scripts/run-pedido-itens-backfill.ts

import { runPedidoItensSync } from "../src/lib/sync/pedido-itens";

async function main() {
  let run = 0;
  for (;;) {
    run++;
    const stats = await runPedidoItensSync();
    console.log(
      `[backfill] run ${run}: processed=${stats.processed} itens=${stats.itensUpserted} ` +
      `errors=${stats.errors} remaining=${stats.remaining} (${Math.round(stats.durationMs / 1000)}s)`,
    );

    if (stats.remaining === 0) {
      console.log("[backfill] fila zerada — done.");
      break;
    }

    // Fila não anda (só erros persistentes ou abort upstream): para em vez de
    // martelar a API para sempre.
    if (stats.processed === 0) {
      console.error("[backfill] nenhum pedido processado nesta rodada — parando. Verifique os erros acima.");
      process.exit(1);
    }
  }
}

main().catch((e) => {
  console.error("[backfill] falha:", e);
  process.exit(1);
});
