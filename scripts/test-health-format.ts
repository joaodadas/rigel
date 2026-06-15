// Testa formatHealthReport (lógica pura).
// USO: npx tsx --env-file=.env.local scripts/test-health-format.ts
import { formatHealthReport, type StaleEntity, type DivergedEntity } from "../src/lib/sync/health";

const now = new Date("2026-06-15T09:00:00.000Z");

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const stale: StaleEntity[] = [
  { empresa: "rigel_fabricante", entity: "pedidos", source: "incremental",
    lastSuccessAt: "2026-06-15T04:40:00.000Z", staleForMs: 260 * 60_000,
    lastError: "code 404 — Erro ao comunicar com a API" },
  { empresa: "rigel_fabricante", entity: "pedido_itens", source: "pedido_itens",
    lastSuccessAt: null, staleForMs: Infinity, lastError: null },
];
const diverged: DivergedEntity[] = [
  { empresa: "rigel_fabricante", entity: "clientes", vhsysTotal: 190115, supabaseCount: 180000, deltaPct: -0.0532 },
];

function main() {
  // tudo saudável → null
  assert(formatHealthReport([], [], [], now) === null, "saudável deveria retornar null");

  // só travadas
  const onlyStale = formatHealthReport(stale, [], [], now)!;
  assert(onlyStale.includes("Travadas:"), "deveria ter seção Travadas");
  assert(onlyStale.includes("[rigel_fabricante] pedidos"), "deveria listar pedidos");
  assert(onlyStale.includes("code 404"), "deveria mostrar último erro");
  assert(onlyStale.includes("sem sucesso registrado"), "pedido_itens nunca sincronizou");
  assert(!onlyStale.includes("divergência"), "não deveria ter divergência");
  assert(onlyStale.includes("09:00 UTC"), "deveria ter o rodapé com hora");

  // só divergência
  const onlyDiv = formatHealthReport([], diverged, [], now)!;
  assert(onlyDiv.includes("Suspeita de divergência"), "deveria ter seção de divergência");
  assert(onlyDiv.includes("clientes"), "deveria listar clientes");

  // com erro do próprio monitor
  const withErr = formatHealthReport([], [], ["staleness: boom"], now)!;
  assert(withErr.includes("Falhas no monitor:"), "deveria ter seção de falhas do monitor");

  console.log("PASS: formatHealthReport");
}

main();
