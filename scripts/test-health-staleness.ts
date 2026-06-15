// Testa evaluateStaleness (lógica pura, sem DB).
// USO: npx tsx --env-file=.env.local scripts/test-health-staleness.ts
import { evaluateStaleness, syncTargets, type StaleEntity } from "../src/lib/sync/health";

const now = new Date("2026-06-15T14:00:00.000Z");
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();

function findStale(stale: StaleEntity[], entity: string): StaleEntity | undefined {
  return stale.find((s) => s.entity === entity && s.empresa === "rigel_fabricante");
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function main() {
  const targets = syncTargets();

  // 1. sucesso recente em todas as entidades incrementais → nada travado
  const allRecent = targets.map((t) => ({
    entity: t.entity, empresa: t.empresa, status: "success",
    error_message: null, last_sync_at: minutesAgo(10),
  }));
  assert(evaluateStaleness(targets, allRecent, now).length === 0, "sucesso recente não deveria travar");

  // 2. pedidos sem sucesso há 120min (> limiar 90min do incremental) → travado, com último erro
  const pedidosStale = [
    ...allRecent.filter((r) => r.entity !== "pedidos"),
    { entity: "pedidos", empresa: "rigel_fabricante", status: "error",
      error_message: "code 404 — Erro ao comunicar com a API", last_sync_at: minutesAgo(5) },
    { entity: "pedidos", empresa: "rigel_fabricante", status: "success",
      error_message: null, last_sync_at: minutesAgo(120) },
  ];
  const r2 = evaluateStaleness(targets, pedidosStale, now);
  const p = findStale(r2, "pedidos");
  assert(!!p, "pedidos deveria estar travado");
  assert(p!.lastError === "code 404 — Erro ao comunicar com a API", "deveria anexar último erro");

  // 3. erro recente MAS sucesso recente → saudável (prova auto-cura)
  const recentErrorButSuccess = [
    ...allRecent.filter((r) => r.entity !== "clientes"),
    { entity: "clientes", empresa: "rigel_fabricante", status: "error",
      error_message: "blip", last_sync_at: minutesAgo(2) },
    { entity: "clientes", empresa: "rigel_fabricante", status: "success",
      error_message: null, last_sync_at: minutesAgo(20) },
  ];
  assert(!findStale(evaluateStaleness(targets, recentErrorButSuccess, now), "clientes"),
    "sucesso recente apesar de erro recente não deveria travar");

  // 4. nunca houve sucesso → travado
  const noSuccess = allRecent.filter((r) => r.entity !== "produtos");
  const r4 = evaluateStaleness(targets, noSuccess, now);
  const prod = findStale(r4, "produtos");
  assert(!!prod, "entidade sem sucesso deveria travar");
  assert(prod!.lastSuccessAt === null, "lastSuccessAt deveria ser null");

  console.log("PASS: evaluateStaleness");
}

main();
