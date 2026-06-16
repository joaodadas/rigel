import { NextRequest, NextResponse } from "next/server";
import { runIncrementalSync } from "@/lib/sync/incremental";
import { isAuthorizedCron } from "@/lib/auth/cron";

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
