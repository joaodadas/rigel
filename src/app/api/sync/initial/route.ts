import { NextRequest, NextResponse } from "next/server";
import { runInitialSync } from "@/lib/sync/initial";
import { isAuthorizedCron } from "@/lib/auth/cron";

export const maxDuration = 300; // 5 minutes for Vercel

export async function POST(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await runInitialSync();
    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("[sync] Initial sync failed:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
