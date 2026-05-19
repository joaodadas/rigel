import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/client";
import { vhsysGet } from "@/lib/vhsys/client";
import { ENDPOINTS, MAX_PAGE_SIZE } from "@/lib/vhsys/endpoints";
import { isAuthorizedCron } from "@/lib/auth/cron";

export const maxDuration = 300;

const FIELDS = ["id_pedido", "id_ped", "id_cliente", "nome_cliente", "vendedor_pedido", "vendedor_pedido_id", "valor_total_produtos", "desconto_pedido", "frete_pedido", "valor_total_nota", "status_pedido", "data_pedido", "obs_pedido", "contas_pedido", "estoque_pedido", "data_cad_pedido", "data_mod_pedido", "lixeira"];

function pickFields(item: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in item) {
      let value = item[field];
      if (typeof value === "string" && /^0000-00-00/.test(value)) value = null;
      result[field] = value;
    }
  }
  return result;
}

export async function POST(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServer();
  let offset = 0;
  let total = Infinity;
  let synced = 0;

  try {
    while (offset < total) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await vhsysGet<any>("rigel_fabricante", ENDPOINTS.pedidos, {
        limit: String(MAX_PAGE_SIZE),
        offset: String(offset),
      });

      if (res.paging) total = res.paging.total;
      const items: Record<string, unknown>[] = Array.isArray(res.data) ? res.data : [];
      if (items.length === 0) break;

      // Deduplicate
      const seen = new Set<unknown>();
      const deduped = items.filter((item) => {
        const key = item.id_pedido;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const batch = deduped.map((item) => ({
        ...pickFields(item, FIELDS),
        synced_at: new Date().toISOString(),
      }));

      // Retry 3x
      let success = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { error } = await supabase.from("pedidos").upsert(batch, { onConflict: "id_pedido" });
        if (!error) { success = true; break; }
        const msg = String(error.message || "");
        if (msg.includes("fetch failed") || msg.includes("ECONNRESET")) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        console.error(`[sync-pedidos] Error at offset ${offset}:`, error);
        return NextResponse.json({ success: false, error: error.message, synced }, { status: 500 });
      }

      if (!success) {
        return NextResponse.json({ success: false, error: "Failed after 3 retries", synced }, { status: 500 });
      }

      synced += deduped.length;
      offset += MAX_PAGE_SIZE;
      if (synced % 5000 === 0 || synced === deduped.length) {
        console.log(`[sync-pedidos] ${synced}/${total}`);
      }

      if (offset < total) await new Promise((r) => setTimeout(r, 100));
    }

    console.log(`[sync-pedidos] DONE: ${synced} records`);
    return NextResponse.json({ success: true, synced, total });
  } catch (error) {
    console.error("[sync-pedidos] Failed:", error);
    return NextResponse.json({ success: false, error: String(error), synced }, { status: 500 });
  }
}
