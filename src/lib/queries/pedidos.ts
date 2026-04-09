import { createSupabaseServer } from "@/lib/supabase/client";

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
