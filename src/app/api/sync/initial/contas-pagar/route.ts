// src/app/api/sync/initial/contas-pagar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/auth/cron";
import { runInitialContasPagarSync } from "@/lib/sync/initial";
import { isEmpresaSlug } from "@/lib/empresas";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const empresa = req.nextUrl.searchParams.get("empresa");
  if (!empresa || !isEmpresaSlug(empresa)) {
    return NextResponse.json(
      { error: `Query param 'empresa' inválido ou ausente. Use rigel_fabricante, rigel_medical ou hdslim.` },
      { status: 400 },
    );
  }

  try {
    const result = await runInitialContasPagarSync(empresa);
    return NextResponse.json({ success: true, empresa, ...result });
  } catch (error) {
    console.error(`[sync:${empresa}] Initial contas_pagar sync failed:`, error);
    return NextResponse.json(
      { success: false, empresa, error: String(error) },
      { status: 500 },
    );
  }
}
