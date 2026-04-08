import { createSupabaseServer } from "@/lib/supabase/client";

export interface OrcamentoRow {
  id_orcamento: number;
  nome_cliente: string;
  vendedor_pedido: string | null;
  valor_total_nota: number | null;
  status_pedido: string;
  data_pedido: string | null;
  validade_orcamento: string | null;
  lixeira: string;
}

export async function getOrcamentos(): Promise<OrcamentoRow[]> {
  const supabase = createSupabaseServer();

  const { data, error } = await supabase
    .from("orcamentos")
    .select(
      "id_orcamento, nome_cliente, vendedor_pedido, valor_total_nota, status_pedido, data_pedido, validade_orcamento, lixeira"
    )
    .eq("lixeira", "Nao")
    .order("data_pedido", { ascending: false })
    .limit(1000);

  if (error) {
    console.error("Error fetching orcamentos:", error);
    return [];
  }

  return data as OrcamentoRow[];
}
