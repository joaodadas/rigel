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

export async function getPedidos(): Promise<PedidoRow[]> {
  const supabase = createSupabaseServer();

  const { data, error } = await supabase
    .from("pedidos")
    .select(
      "id_pedido, nome_cliente, vendedor_pedido, valor_total_nota, status_pedido, data_pedido, data_cad_pedido, lixeira"
    )
    .eq("lixeira", "Nao")
    .order("data_cad_pedido", { ascending: false })
    .limit(1000);

  if (error) {
    console.error("Error fetching pedidos:", error);
    return [];
  }

  return data as PedidoRow[];
}
