import { NextRequest, NextResponse } from "next/server";
import { syncPedidoItens } from "@/lib/sync/pedido-itens";

export const maxDuration = 300; // 5 minutes for backfill

export async function POST(request: NextRequest) {
  // Verify CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const monthsBack = (body as { monthsBack?: number }).monthsBack ?? 12;

    const result = await syncPedidoItens(monthsBack);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[sync] Pedido itens sync failed:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
