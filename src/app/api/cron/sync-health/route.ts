import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/auth/cron";
import { createSupabaseServer } from "@/lib/supabase/client";
import {
  checkStaleness,
  checkDivergence,
  formatHealthReport,
  type StaleEntity,
  type DivergedEntity,
} from "@/lib/sync/health";
import { sendWhatsAppTextTo } from "@/lib/evolution/client";

// gru1 = São Paulo: a checagem de divergência chama a VHSys (Brasil). Colocalizar
// evita os timeouts de gateway que ocorrem quando chamada dos EUA (região default).
export const preferredRegion = "gru1";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Hora UTC em que a checagem de divergência (mais cara) roda, 1×/dia, antes do
// daily-summary das 10h UTC.
const DIVERGENCE_HOUR_UTC = 9;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServer();
  const now = new Date();
  const monitorErrors: string[] = [];

  let stale: StaleEntity[] = [];
  try {
    stale = await checkStaleness(supabase, now);
  } catch (e) {
    monitorErrors.push(`staleness: ${String(e)}`);
  }

  let diverged: DivergedEntity[] = [];
  if (now.getUTCHours() === DIVERGENCE_HOUR_UTC) {
    try {
      diverged = await checkDivergence(supabase);
    } catch (e) {
      monitorErrors.push(`divergence: ${String(e)}`);
    }
  }

  const report = formatHealthReport(stale, diverged, monitorErrors, now);
  if (report) {
    const recipient = process.env.WHATSAPP_TECH_ALERT_NUMBER;
    if (recipient) {
      try {
        await sendWhatsAppTextTo(recipient, report);
      } catch (e) {
        console.error("[sync-health] envio do alerta falhou:", e);
      }
    } else {
      console.warn("[sync-health] WHATSAPP_TECH_ALERT_NUMBER não configurado, pulando envio");
    }
  }

  return NextResponse.json({ healthy: report === null, stale, diverged, monitorErrors });
}
