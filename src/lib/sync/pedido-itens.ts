import { createSupabaseServer } from "@/lib/supabase/client";
import { getPgPool } from "@/lib/db/pg";
import { VHSYS_BASE_URL } from "@/lib/vhsys/endpoints";
import { MARKETPLACE_VENDEDOR_IDS } from "@/lib/config/vendedores-map";

// Tunings: cabe em ~30s no pior caso (60s de budget na Vercel).
const BATCH_SIZE = 200;
const CONCURRENCY = 2;
const REQUEST_DELAY_MS = 300;

// Se o VHSys responder com erro upstream (403 com data string ou 200 com data
// não-array) em 30 chamadas consecutivas, aborta o run pra não queimar
// função/quota até a API voltar ao normal.
const UPSTREAM_FAILURE_ABORT_THRESHOLD = 30;

// Schema espelha o que o sync anterior populou (e o que a API VHSys retorna).
interface PedidoItemAPI {
  id_ped_produto: number;
  id_pedido: number;
  id_produto: number | null;
  desc_produto: string | null;
  qtde_produto: number | string | null;
  valor_unit_produto: number | string | null;
  valor_total_produto: number | string | null;
  desconto_produto: number | string | null;
}

export interface PedidoItensSyncStats {
  backfilled: number;
  processed: number;
  itensUpserted: number;
  errors: number;
  upstreamFailures: number;
  aborted: boolean;
  remaining: number;
  durationMs: number;
}

class VHSysUpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VHSysUpstreamError";
  }
}

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

async function fetchPedidoItens(idPedido: number): Promise<PedidoItemAPI[]> {
  const url = `${VHSYS_BASE_URL}/pedidos/${idPedido}/produtos`;
  // TODO multi-empresa: hoje só opera na Rigel Fabricante (lê env direto, sem usar o client multi-tenant).
  // Quando outras empresas sincronizarem pedidos, refatorar para usar vhsysGet(empresa, ...) e injetar `empresa` no upsert de pedido_itens.
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "access-token": process.env.VHSYS_ACCESS_TOKEN!,
      "secret-access-token": process.env.VHSYS_SECRET_ACCESS_TOKEN!,
      "Content-Type": "application/json",
      "User-Agent": "Rigel/1.0",
    },
  });

  // 404 = pedido excluído na origem; trata como vazio.
  if (res.status === 404) return [];

  let json: { data?: unknown } = {};
  try {
    json = (await res.json()) as { data?: unknown };
  } catch {
    throw new Error(`VHSys ${url} returned non-JSON body (status ${res.status})`);
  }

  // VHSys responde 403 com `data` string ("Nenhum produto para o pedido encontrado!")
  // mesmo pra pedidos que comprovadamente têm itens — não dá pra confiar como "vazio".
  // Trata como erro upstream para o pedido permanecer pendente e retentar depois.
  if (res.status === 403) {
    throw new VHSysUpstreamError(
      `VHSys 403 ${idPedido}: ${String(json.data).slice(0, 80)}`,
    );
  }

  if (!res.ok) {
    throw new Error(`VHSys ${url} failed: ${res.status} ${res.statusText}`);
  }

  // 200 com `data` não-array (string como "No query results for model...") indica
  // erro/bug do servidor VHSys vazado como sucesso. Trata como falha upstream.
  if (!Array.isArray(json.data)) {
    throw new VHSysUpstreamError(
      `VHSys 200/non-array ${idPedido}: ${String(json.data).slice(0, 80)}`,
    );
  }

  return json.data as PedidoItemAPI[];
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
  let upstreamFailures = 0;
  let consecutiveUpstreamFailures = 0;
  let aborted = false;

  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < ids.length) {
      if (consecutiveUpstreamFailures >= UPSTREAM_FAILURE_ABORT_THRESHOLD) {
        aborted = true;
        break;
      }

      const idx = cursor++;
      const idPedido = ids[idx];

      try {
        const itens = await fetchPedidoItens(idPedido);
        consecutiveUpstreamFailures = 0;

        if (itens.length > 0) {
          const rows = itens.map((it) => ({
            id_ped_produto: it.id_ped_produto,
            id_pedido: it.id_pedido,
            id_produto: it.id_produto,
            desc_produto: it.desc_produto,
            qtde_produto: num(it.qtde_produto),
            valor_unit_produto: num(it.valor_unit_produto),
            valor_total_produto: num(it.valor_total_produto),
            desconto_produto: num(it.desconto_produto),
          }));

          const { error: upsertError } = await supabase
            .from("pedido_itens")
            .upsert(rows, { onConflict: "id_ped_produto" });

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
        if (err instanceof VHSysUpstreamError) {
          upstreamFailures++;
          consecutiveUpstreamFailures++;
          // Loga só nas primeiras pra evitar spam quando o problema é sistêmico.
          if (upstreamFailures <= 3) {
            console.warn(`[sync-itens] upstream: ${err.message}`);
          }
        } else {
          console.error(`[sync-itens] pedido ${idPedido} failed:`, err);
        }
      }

      await delay(REQUEST_DELAY_MS);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  if (aborted) {
    console.warn(
      `[sync-itens] aborted after ${UPSTREAM_FAILURE_ABORT_THRESHOLD}+ consecutive upstream failures — VHSys API issue with /pedidos/{id}/produtos`,
    );
  }

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
    upstreamFailures,
    aborted,
    remaining: remainingCount ?? 0,
    durationMs: Date.now() - t0,
  };

  console.log(`[sync-itens] done:`, stats);
  return stats;
}
