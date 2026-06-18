// DIAGNÓSTICO TEMPORÁRIO — descobrir o que destrava o /pedidos na Vercel.
// Testa a matriz DOMÍNIO (.com vs .com.br) × USER-AGENT (Rigel/1.0 vs nenhum),
// devolvendo a resposta crua da VHSys (status, headers, corpo). Lê os logs em
// [debug-pedidos]. Remover depois.
import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/auth/cron";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const DOM_COM = "https://api.vhsys.com/v2";
const DOM_COMBR = "https://api.vhsys.com.br/v2";
// Endpoint representativo do bloqueio (/pedidos foi o que falhou na Vercel).
const PEDIDOS_PATH = "/pedidos?limit=250&offset=0";

async function probe(label: string, base: string, path: string, ua: string | null) {
  const access = process.env.VHSYS_RIGEL_FABRICANTE_ACCESS_TOKEN;
  const secret = process.env.VHSYS_RIGEL_FABRICANTE_SECRET_ACCESS_TOKEN;
  const headers: Record<string, string> = {
    "access-token": access ?? "",
    "secret-access-token": secret ?? "",
    "Content-Type": "application/json",
  };
  if (ua) headers["User-Agent"] = ua; // sem UA = não envia o header (igual ao rigelcontrol)

  const t0 = Date.now();
  try {
    const res = await fetch(`${base}${path}`, { headers });
    const latencyMs = Date.now() - t0;
    const h: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      h[k] = v;
    });
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
      cfRay: h["cf-ray"],
      server: h["server"],
      bodyPreview: body.slice(0, 200),
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

  const results = [];
  // Matriz domínio × User-Agent no /pedidos:
  results.push(await probe("A .com.br + Rigel/1.0 (estado atual)", DOM_COMBR, PEDIDOS_PATH, "Rigel/1.0"));
  results.push(await probe("B .com.br + SEM UA", DOM_COMBR, PEDIDOS_PATH, null));
  results.push(await probe("C .com + Rigel/1.0", DOM_COM, PEDIDOS_PATH, "Rigel/1.0"));
  results.push(await probe("D .com + SEM UA (estratégia do rigelcontrol)", DOM_COM, PEDIDOS_PATH, null));
  // Controle: clientes no .com.br (funciona no cron normal)
  results.push(await probe("E .com.br + clientes (controle)", DOM_COMBR, "/clientes?limit=1", "Rigel/1.0"));

  for (const r of results) {
    console.log("[debug-pedidos]", JSON.stringify(r));
  }

  return NextResponse.json({ ranAt: new Date().toISOString(), results }, { status: 200 });
}
