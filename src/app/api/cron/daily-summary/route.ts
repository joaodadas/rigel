import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/auth/cron";
import { fetchDailySummary } from "@/lib/queries/daily-summary";
import { formatDailySummary } from "@/lib/notifications/daily-summary";
import { sendWhatsAppText } from "@/lib/evolution/client";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await fetchDailySummary();
    const msg = formatDailySummary(data);
    await sendWhatsAppText(msg);
    console.log("[cron] daily-summary sent", {
      ref: data.dataReferencia,
      chars: msg.length,
      pedidos: data.vendas.totalPedidos,
    });
    return NextResponse.json({ success: true, ref: data.dataReferencia });
  } catch (error) {
    console.error("[cron] daily-summary failed:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
