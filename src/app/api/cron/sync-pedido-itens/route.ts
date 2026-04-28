import { NextResponse } from "next/server";
import { runPedidoItensSync } from "@/lib/sync/pedido-itens";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = await runPedidoItensSync();
    return NextResponse.json({ success: true, ...stats });
  } catch (error) {
    console.error("[cron] sync-pedido-itens failed:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
