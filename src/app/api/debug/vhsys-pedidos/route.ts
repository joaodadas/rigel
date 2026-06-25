// DIAGNÓSTICO TEMPORÁRIO — confirmar se o bloqueio do /pedidos na Vercel é
// específico do NOSSO token (rigel_fabricante) vs outro token da MESMA conta.
// Domínio e User-Agent já foram descartados (ambos falham). Remover depois.
//
// Para a probe do token ALT: setar no Vercel as envs
//   VHSYS_ALT_ACCESS_TOKEN / VHSYS_ALT_SECRET_ACCESS_TOKEN
// (o token do outro sistema, mesma conta). Sem hardcode de segredo aqui.
import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/auth/cron";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const BASE = "https://api.vhsys.com.br/v2"; // domínio é indiferente (já testado)
const PEDIDOS = "/pedidos?limit=250&offset=0";

async function probe(label: string, path: string, access?: string, secret?: string) {
  if (!access || !secret) return { label, skipped: "token ausente (env não setada)" };
  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "access-token": access, "secret-access-token": secret, "Content-Type": "application/json" },
    });
    const latencyMs = Date.now() - t0;
    const body = await res.text();
    let bodyCode: unknown;
    try {
      bodyCode = JSON.parse(body).code;
    } catch {
      bodyCode = "(não-JSON)";
    }
    return {
      label,
      httpStatus: res.status,
      bodyCode,
      latencyMs,
      cfRay: res.headers.get("cf-ray"),
      bodyPreview: body.slice(0, 160),
    };
  } catch (e) {
    return { label, error: String(e), latencyMs: Date.now() - t0 };
  }
}

export async function GET(req: NextRequest) {
  const secretParam = req.nextUrl.searchParams.get("secret");
  const okByParam = !!process.env.CRON_SECRET && secretParam === process.env.CRON_SECRET;
  if (!isAuthorizedCron(req) && !okByParam) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ours = {
    a: process.env.VHSYS_RIGEL_FABRICANTE_ACCESS_TOKEN,
    s: process.env.VHSYS_RIGEL_FABRICANTE_SECRET_ACCESS_TOKEN,
  };
  const alt = {
    a: process.env.VHSYS_ALT_ACCESS_TOKEN,
    s: process.env.VHSYS_ALT_SECRET_ACCESS_TOKEN,
  };

  const results = [];
  // 1. NOSSO token no /pedidos (controle — deve dar code 404 / bloqueado)
  results.push(await probe("1 NOSSO token + /pedidos", PEDIDOS, ours.a, ours.s));
  // 2. Token ALT (outro app da MESMA conta) no /pedidos — O TESTE
  results.push(await probe("2 ALT token + /pedidos (o teste)", PEDIDOS, alt.a, alt.s));
  // 3. NOSSO token no /clientes (controle — deve funcionar, code 200)
  results.push(await probe("3 NOSSO token + /clientes (controle ok)", "/clientes?limit=1", ours.a, ours.s));

  for (const r of results) {
    console.log("[debug-pedidos]", JSON.stringify(r));
  }

  return NextResponse.json({ ranAt: new Date().toISOString(), results }, { status: 200 });
}
