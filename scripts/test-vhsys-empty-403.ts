// Teste one-off: VHSys retorna HTTP 403 {"data":"Nenhum X encontrado!"} quando a
// consulta não encontra registros (não é erro de autorização — auth inválida volta
// como HTTP 200 com code 401 no corpo). O client deve tratar esse 403 como lista vazia.
//
// USO:
//   npx tsx --env-file=.env.local scripts/test-vhsys-empty-403.ts
import { vhsysFetchAll } from "../src/lib/vhsys/client";

async function main() {
  // Data futura: garantidamente zero registros modificados → dispara o 403 "vazio"
  const items = await vhsysFetchAll("rigel_fabricante", "/vendedores", {
    data_modificacao: "2030-01-01",
  });
  if (!Array.isArray(items) || items.length !== 0) {
    throw new Error(`esperado lista vazia, veio ${JSON.stringify(items).slice(0, 200)}`);
  }
  console.log("PASS: 403 'Nenhum vendedor encontrado' tratado como lista vazia");
}

main().catch((e) => {
  console.error("FAIL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
