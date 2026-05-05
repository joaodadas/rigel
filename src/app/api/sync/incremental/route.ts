import { NextRequest, NextResponse } from "next/server";
import { runIncrementalSync } from "@/lib/sync/incremental";
import { isAuthorizedCron } from "@/lib/auth/cron";

export const maxDuration = 60;

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
