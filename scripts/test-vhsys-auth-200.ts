// Teste one-off: a VHSys responde HTTP 200 com {"code":401,"status":"error",...}
// quando os tokens são inválidos. O client deve lançar erro nesse caso, não
// devolver o corpo de erro como se fosse resposta válida.
//
// USO:
//   npx tsx --env-file=.env.local scripts/test-vhsys-auth-200.ts
import { vhsysGet } from "../src/lib/vhsys/client";

async function main() {
  process.env.VHSYS_RIGEL_FABRICANTE_ACCESS_TOKEN = "token-invalido";
  process.env.VHSYS_RIGEL_FABRICANTE_SECRET_ACCESS_TOKEN = "token-invalido";

  let res: unknown;
  try {
    res = await vhsysGet("rigel_fabricante", "/vendedores", { limit: "1" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/401/.test(msg)) throw new Error(`erro sem indicar 401: ${msg}`);
    console.log("PASS: auth inválida (HTTP 200 + code 401 no corpo) vira erro:", msg);
    return;
  }
  throw new Error(`esperado throw, mas retornou corpo: ${JSON.stringify(res).slice(0, 200)}`);
}

main().catch((e) => {
  console.error("FAIL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
