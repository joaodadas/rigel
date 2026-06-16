// DIAGNÓSTICO TEMPORÁRIO — remover depois de descobrir por que /pedidos falha só
// na Vercel. Roda na Vercel e devolve a resposta CRUA da VHSys (status HTTP real,
// headers, corpo) para várias variações da requisição, revelando se há WAF/Cloudflare,
// rate-limit, 404 real, ou dependência de User-Agent/tamanho.
//
// USO: curl -H "Authorization: Bearer $CRON_SECRET" https://SEU-DOMINIO/api/debug/vhsys-pedidos
import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/auth/cron";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const BASE = "https://api.vhsys.com.br/v2";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function probe(label: string, path: string, ua: string) {
  const access = process.env.VHSYS_RIGEL_FABRICANTE_ACCESS_TOKEN;
  const secret = process.env.VHSYS_RIGEL_FABRICANTE_SECRET_ACCESS_TOKEN;
  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: {
        "access-token": access ?? "",
        "secret-access-token": secret ?? "",
        "User-Agent": ua,
        "Content-Type": "application/json",
      },
    });
    const latencyMs = Date.now() - t0;
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k] = v;
    });
    const body = await res.text();
    return {
      label,
      httpStatus: res.status,
      httpStatusText: res.statusText,
      latencyMs,
      // headers-chave para identificar WAF/CDN/rate-limit:
      server: headers["server"],
      via: headers["via"],
      cfRay: headers["cf-ray"],
      cacheStatus: headers["cf-cache-status"] ?? headers["x-cache"],
      retryAfter: headers["retry-after"],
      rateRemaining: headers["x-ratelimit-remaining"] ?? headers["ratelimit-remaining"],
      allHeaders: headers,
      bodyPreview: body.slice(0, 800),
    };
  } catch (e) {
    return { label, error: String(e), latencyMs: Date.now() - t0 };
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = [];
  // 1. O request EXATO que falha (pedidos, janela grande, UA Rigel)
  results.push(await probe("pedidos-grande-rigelUA", "/pedidos?data_modificacao=2026-06-14&limit=250&offset=0", "Rigel/1.0"));
  // 2. pedidos pequeno (limit=1) — tamanho/custo importa?
  results.push(await probe("pedidos-pequeno-rigelUA", "/pedidos?limit=1", "Rigel/1.0"));
  // 3. pedidos grande com User-Agent de navegador — WAF reage ao UA?
  results.push(await probe("pedidos-grande-browserUA", "/pedidos?data_modificacao=2026-06-14&limit=250&offset=0", BROWSER_UA));
  // 4. clientes (controle — funciona no cron)
  results.push(await probe("clientes-controle-rigelUA", "/clientes?limit=1", "Rigel/1.0"));

  return NextResponse.json({ ranAt: new Date().toISOString(), results }, { status: 200 });
}
