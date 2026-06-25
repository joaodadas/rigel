import { createSupabaseServer } from "@/lib/supabase/client";
import { cacheList, CACHE_KEYS } from "@/lib/redis/client";

export interface PedidoRow {
  id_pedido: number;
  nome_cliente: string;
  vendedor_pedido: string | null;
  valor_total_nota: number | null;
  status_pedido: string;
  data_pedido: string | null;
  data_cad_pedido: string | null;
  lixeira: string;
}

export interface PedidosResult {
  data: PedidoRow[];
  total: number;
}

export async function getPedidos(
  page = 1,
  pageSize = 50,
  search?: string
): Promise<PedidosResult> {
  return cacheList(
    CACHE_KEYS.list("pedidos", page, pageSize, search || ""),
    () => _fetchPedidos(page, pageSize, search)
  );
}

export function prefetchNextPage(page: number, pageSize: number, search?: string) {
  void cacheList(
    CACHE_KEYS.list("pedidos", page + 1, pageSize, search || ""),
    () => _fetchPedidos(page + 1, pageSize, search)
  );
}

/** Última vez que os pedidos foram sincronizados com sucesso (lê do sync_log).
 *  Como o /pedidos é sincronizado FORA da Vercel (bloqueio de IP no datacenter),
 *  isso mostra ao time quão fresca está a base de pedidos. Não cacheado (1 query leve). */
export async function getPedidosLastSync(): Promise<string | null> {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("sync_log")
    .select("last_sync_at")
    .eq("entity", "pedidos")
    .eq("empresa", "rigel_fabricante")
    .eq("status", "success")
    .order("last_sync_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.last_sync_at as string | undefined) ?? null;
}

async function _fetchPedidos(
  page = 1,
  pageSize = 50,
  search?: string
): Promise<PedidosResult> {
  const supabase = createSupabaseServer();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("pedidos")
    .select(
      "id_pedido, nome_cliente, vendedor_pedido, valor_total_nota, status_pedido, data_pedido, data_cad_pedido, lixeira",
      { count: "exact" }
    )
    .eq("lixeira", "Nao");

  if (search && search.trim()) {
    query = query.ilike("nome_cliente", `%${search.trim()}%`);
  }

  const { data, error, count } = await query
    .order("data_cad_pedido", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("Error fetching pedidos:", error);
    return { data: [], total: 0 };
  }

  return { data: data as PedidoRow[], total: count ?? 0 };
}
