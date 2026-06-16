import { NextRequest, NextResponse } from "next/server";
import { runPedidoItensSync } from "@/lib/sync/pedido-itens";
import { isAuthorizedCron } from "@/lib/auth/cron";

// gru1 = São Paulo: colocaliza com a VHSys (Brasil), que serve /pedidos/{id}/produtos
// lentamente. Dos EUA (default) o gateway da VHSys estoura timeout; do Brasil, não.
export const preferredRegion = "gru1";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
