import { Pool } from "pg";
import { createSupabaseServer } from "@/lib/supabase/client";
import { VHSYS_BASE_URL } from "@/lib/vhsys/endpoints";
import { MARKETPLACE_VENDEDOR_IDS } from "@/lib/config/vendedores-map";

// Tunings: cabe em ~30s no pior caso (60s de budget na Vercel).
const BATCH_SIZE = 200;
const CONCURRENCY = 5;
const REQUEST_DELAY_MS = 200;

interface PedidoItemAPI {
  id_pedido_produto: number;
  id_pedido: number;
  id_produto: number | null;
  desc_produto: string | null;
  cod_produto: string | null;
  quantidade: number | string | null;
  valor_unitario: number | string | null;
  valor_total: number | string | null;
  desconto: number | string | null;
}

export interface PedidoItensSyncStats {
  backfilled: number;
  processed: number;
  itensUpserted: number;
  errors: number;
  remaining: number;
  durationMs: number;
}

let pgPool: Pool | null = null;
function getPgPool(): Pool {
  if (!pgPool) {
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
    });
  }
  return pgPool;
}

// Marca como sincronizados pedidos que já possuem rows em pedido_itens (de syncs anteriores).
// Evita refetch das chamadas que já completaram. Idempotente: rodadas seguintes não atualizam nada.
async function backfillAlreadySynced(): Promise<number> {
  const pool = getPgPool();
  const result = await pool.query(`
    WITH already AS (SELECT DISTINCT id_pedido FROM pedido_itens)
    UPDATE pedidos p
    SET itens_sincronizados_em = now()
    FROM already a
    WHERE p.id_pedido = a.id_pedido
      AND p.itens_sincronizados_em IS NULL
  `);
  return result.rowCount ?? 0;
}

async function fetchPedidoItens(idPedido: number): Promise<PedidoItemAPI[] | null> {
  const url = `${VHSYS_BASE_URL}/pedidos/${idPedido}/produtos`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "access-token": process.env.VHSYS_ACCESS_TOKEN!,
      "secret-access-token": process.env.VHSYS_SECRET_ACCESS_TOKEN!,
      "Content-Type": "application/json",
    },
  });

  // 404 = pedido excluído na origem; trata como vazio pra não travar o cron.
  if (res.status === 404) return [];
  if (!res.ok) {
    throw new Error(`VHSys ${url} failed: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as { data?: PedidoItemAPI[] };
  return json.data ?? [];
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function runPedidoItensSync(): Promise<PedidoItensSyncStats> {
  const t0 = Date.now();
  const supabase = createSupabaseServer();

  const backfilled = await backfillAlreadySynced();
  if (backfilled > 0) {
    console.log(`[sync-itens] backfill: marked ${backfilled} pedidos with pre-existing itens`);
  }

  const marketplaceList = `(${Array.from(MARKETPLACE_VENDEDOR_IDS).join(",")})`;

  const { data: pendentes, error: queryError } = await supabase
    .from("pedidos")
    .select("id_pedido")
    .eq("status_pedido", "Atendido")
    .eq("lixeira", "Nao")
    .is("itens_sincronizados_em", null)
    .not("vendedor_pedido_id", "in", marketplaceList)
    .order("data_pedido", { ascending: false })
    .limit(BATCH_SIZE);

  if (queryError) throw queryError;

  const ids = (pendentes ?? []).map((p) => p.id_pedido as number);
  console.log(`[sync-itens] processing ${ids.length} pedidos (concurrency=${CONCURRENCY})`);

  let itensUpserted = 0;
  let errors = 0;
  let processed = 0;

  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < ids.length) {
      const idx = cursor++;
      const idPedido = ids[idx];

      try {
        const itens = await fetchPedidoItens(idPedido);

        if (itens && itens.length > 0) {
          const rows = itens.map((it) => ({
            id_pedido_produto: it.id_pedido_produto,
            id_pedido: it.id_pedido,
            id_produto: it.id_produto,
            desc_produto: it.desc_produto,
            cod_produto: it.cod_produto,
            quantidade: num(it.quantidade),
            valor_unitario: num(it.valor_unitario),
            valor_total: num(it.valor_total),
            desconto: num(it.desconto),
          }));

          const { error: upsertError } = await supabase
            .from("pedido_itens")
            .upsert(rows, { onConflict: "id_pedido_produto" });

          if (upsertError) throw upsertError;
          itensUpserted += rows.length;
        }

        const { error: markError } = await supabase
          .from("pedidos")
          .update({ itens_sincronizados_em: new Date().toISOString() })
          .eq("id_pedido", idPedido);

        if (markError) throw markError;
        processed++;
      } catch (err) {
        errors++;
        console.error(`[sync-itens] pedido ${idPedido} failed:`, err);
      }

      await delay(REQUEST_DELAY_MS);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const { count: remainingCount } = await supabase
    .from("pedidos")
    .select("id_pedido", { count: "exact", head: true })
    .eq("status_pedido", "Atendido")
    .eq("lixeira", "Nao")
    .is("itens_sincronizados_em", null)
    .not("vendedor_pedido_id", "in", marketplaceList);

  const stats: PedidoItensSyncStats = {
    backfilled,
    processed,
    itensUpserted,
    errors,
    remaining: remainingCount ?? 0,
    durationMs: Date.now() - t0,
  };

  console.log(`[sync-itens] done:`, stats);
  return stats;
}
