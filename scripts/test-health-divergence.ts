// Testa evaluateDivergence (lógica pura).
// USO: npx tsx --env-file=.env.local scripts/test-health-divergence.ts
import { evaluateDivergence } from "../src/lib/sync/health";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function main() {
  // faltando > tolerância (2%) → flag
  const missing = evaluateDivergence(190115, 180000);
  assert(missing !== null, "deveria flagar falta acima da tolerância");
  assert(missing!.deltaPct < 0, "deltaPct deveria ser negativo");

  // dentro da tolerância (gap < 2%) → não flag
  assert(evaluateDivergence(190115, 188420) === null, "gap dentro da tolerância não deveria flagar");

  // excedente (temos mais que a VHSys) → não flag
  assert(evaluateDivergence(190115, 195000) === null, "excedente não deveria flagar");

  // conjunto minúsculo (< 50) → ignorado
  assert(evaluateDivergence(40, 0) === null, "conjunto < 50 deveria ser ignorado");

  console.log("PASS: evaluateDivergence");
}

main();
