import { NextRequest, NextResponse } from "next/server";
import { handleVHSysWebhook } from "@/lib/sync/webhook-handler";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    console.log("[webhook] Received:", JSON.stringify(payload).slice(0, 200));

    const result = await handleVHSysWebhook(payload);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[webhook] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
