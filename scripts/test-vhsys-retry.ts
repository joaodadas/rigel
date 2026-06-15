// Teste one-off: a VHSys retorna intermitentemente HTTP 200 com
// {"code":404,"status":"error","data":"Erro ao comunicar com a API"} — um erro
// transitório de servidor. vhsysGet deve RETENTAR esse caso (leitura idempotente)
// e NÃO retentar erros permanentes (auth code 401).
//
// USO:
//   npx tsx --env-file=.env.local scripts/test-vhsys-retry.ts
import { vhsysGet } from "../src/lib/vhsys/client";

process.env.VHSYS_RIGEL_FABRICANTE_ACCESS_TOKEN = "x";
process.env.VHSYS_RIGEL_FABRICANTE_SECRET_ACCESS_TOKEN = "x";

const realFetch = globalThis.fetch;

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function testRetriesTransient() {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    if (calls < 3) {
      return jsonResponse({ code: 404, status: "error", data: "Erro ao comunicar com a API" });
    }
    return jsonResponse({ code: 200, status: "success", data: [{ id_pedido: 1 }], paging: {} });
  }) as typeof fetch;

  const res = await vhsysGet("rigel_fabricante", "/pedidos", { limit: "1" });
  if (calls !== 3) throw new Error(`esperado 3 chamadas (2 retries), houve ${calls}`);
  if (!Array.isArray(res.data) || res.data.length !== 1) {
    throw new Error(`esperado data com 1 item, veio ${JSON.stringify(res.data)}`);
  }
  console.log(`PASS: erro transitório retentado e resolvido em ${calls} tentativas`);
}

async function testDoesNotRetryAuth() {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return jsonResponse({ code: 401, status: "error", data: "Access Token inválido" });
  }) as typeof fetch;

  try {
    await vhsysGet("rigel_fabricante", "/pedidos", { limit: "1" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/401/.test(msg)) throw new Error(`erro inesperado: ${msg}`);
    if (calls !== 1) throw new Error(`auth não deve ser retentada; houve ${calls} chamadas`);
    console.log(`PASS: erro de auth (401) não retentado, falhou em ${calls} chamada`);
    return;
  }
  throw new Error("esperado throw em auth 401");
}

async function main() {
  try {
    await testRetriesTransient();
    await testDoesNotRetryAuth();
  } finally {
    globalThis.fetch = realFetch;
  }
}

main().catch((e) => {
  console.error("FAIL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
