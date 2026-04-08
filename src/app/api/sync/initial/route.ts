import { NextResponse } from "next/server";
import { runInitialSync } from "@/lib/sync/initial";

export const maxDuration = 300; // 5 minutes for Vercel

export async function POST() {
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
