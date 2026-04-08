import { createSupabaseServer } from "@/lib/supabase/client";

export interface NotaFiscalRow {
  id_venda: number;
  serie_nota: number | null;
  nome_cliente: string;
  valor_total_nota: number | null;
  status_pedido: string | null;
  nota_emitida: string | null;
  nota_chave: string | null;
  data_pedido: string | null;
  lixeira: string;
}

export async function getNotasFiscais(): Promise<NotaFiscalRow[]> {
  const supabase = createSupabaseServer();

  const { data, error } = await supabase
    .from("notas_fiscais")
    .select(
      "id_venda, serie_nota, nome_cliente, valor_total_nota, status_pedido, nota_emitida, nota_chave, data_pedido, lixeira"
    )
    .eq("lixeira", "Nao")
    .order("data_pedido", { ascending: false })
    .limit(1000);

  if (error) {
    console.error("Error fetching notas fiscais:", error);
    return [];
  }

  return data as NotaFiscalRow[];
}
