// Backfill (full re-sync) de entidades single-tenant da Rigel Fabricante, para
// fechar gaps detectados pelo monitor de divergência (checkDivergence).
//
// Reaproveita o `syncEntity` do sync inicial: upsert idempotente por PK (NÃO
// deleta nada), filtra `lixeira=Nao`, paginação em streaming (250/página) com
// retry em erro de conexão, e grava `sync_log` ao final (avança o watermark).
//
// Roda LOCAL — não cabe nos 60s da Vercel (clientes ~214k ≈ 13min; pedidos
// ~304k ≈ 14min). Escreve direto no Supabase de produção (service role do
// .env.local). Como é idempotente, pode ser re-executado com segurança.
//
// USO:
//   npx tsx --env-file=.env.local scripts/run-backfill.ts                   # default: clientes + contas_receber
//   npx tsx --env-file=.env.local scripts/run-backfill.ts clientes          # só clientes
//   npx tsx --env-file=.env.local scripts/run-backfill.ts pedidos clientes  # vários
import { createSupabaseServer } from "../src/lib/supabase/client";
import { syncEntity } from "../src/lib/sync/initial";
import { ENDPOINTS } from "../src/lib/vhsys/endpoints";

const EMPRESA = "rigel_fabricante" as const;

// Entidades single-tenant da Rigel Fabricante e suas PKs.
// (contas_pagar é multi-empresa e tem seu próprio runInitialContasPagarSync.)
const BACKFILLABLE: Record<string, { endpoint: string; pk: string }> = {
  clientes: { endpoint: ENDPOINTS.clientes, pk: "id_cliente" },
  produtos: { endpoint: ENDPOINTS.produtos, pk: "id_produto" },
  pedidos: { endpoint: ENDPOINTS.pedidos, pk: "id_pedido" },
  vendedores: { endpoint: ENDPOINTS.vendedores, pk: "id_vendedor" },
  contas_receber: { endpoint: ENDPOINTS.contasReceber, pk: "id_conta_rec" },
};

const DEFAULT_ENTITIES = ["clientes", "contas_receber"];

async function main() {
  const args = process.argv.slice(2);
  const entities = args.length > 0 ? args : DEFAULT_ENTITIES;

  const invalid = entities.filter((e) => !(e in BACKFILLABLE));
  if (invalid.length) {
    console.error(
      `Entidades inválidas: ${invalid.join(", ")}. Disponíveis: ${Object.keys(BACKFILLABLE).join(", ")}`,
    );
    process.exit(1);
  }

  const supabase = createSupabaseServer();
  console.log(`[backfill] empresa=${EMPRESA} entidades=${entities.join(", ")}`);

  const results: Record<string, number> = {};
  for (const entity of entities) {
    const { endpoint, pk } = BACKFILLABLE[entity];
    const t0 = Date.now();
    const synced = await syncEntity(supabase, EMPRESA, entity, endpoint, pk);
    results[entity] = synced;
    console.log(`[backfill] ✓ ${entity}: ${synced} registros em ${Math.round((Date.now() - t0) / 1000)}s`);
  }

  console.log("[backfill] concluído:", results);
}

main().catch((e) => {
  console.error("[backfill] FALHOU:", e);
  process.exit(1);
});
