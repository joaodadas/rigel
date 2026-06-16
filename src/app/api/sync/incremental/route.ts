import { NextRequest, NextResponse } from "next/server";
import { runIncrementalSync } from "@/lib/sync/incremental";
import { isAuthorizedCron } from "@/lib/auth/cron";

// gru1 = São Paulo: colocaliza esta função com a VHSys (Brasil). O endpoint
// /pedidos é lento e o gateway da VHSys estourava timeout quando chamado dos
// EUA (região default da Vercel, perto do Supabase em us-east-1). Rodando do
// Brasil, a latência cai e os "Erro ao comunicar com a API" desaparecem — é a
// causa raiz de "funciona local (BR), falha na prod (US)".
export const preferredRegion = "gru1";

// 300s (Vercel Pro): o /pedidos da VHSys é lento (~3,8s/página) e a janela de
// overlap diária são ~6-8 páginas (~30s) — 60s era apertado e estourava em
// surtos do gateway da VHSys. O soft deadline em incremental.ts (250s) para
// limpo bem antes deste teto.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await runIncrementalSync();
    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("[sync] Incremental sync failed:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
