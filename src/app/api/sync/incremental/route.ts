import { NextResponse } from "next/server";
import { runIncrementalSync } from "@/lib/sync/incremental";

export const maxDuration = 60;

export async function GET() {
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
