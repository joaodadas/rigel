import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { invalidateAllCaches } from "@/lib/redis/client";

export const runtime = "nodejs";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  await invalidateAllCaches();
  return NextResponse.json({ ok: true });
}
