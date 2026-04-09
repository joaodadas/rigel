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

export interface NotasFiscaisResult {
  data: NotaFiscalRow[];
  total: number;
}

export async function getNotasFiscais(
  page = 1,
  pageSize = 50,
  search?: string
): Promise<NotasFiscaisResult> {
  const supabase = createSupabaseServer();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("notas_fiscais")
    .select(
      "id_venda, serie_nota, nome_cliente, valor_total_nota, status_pedido, nota_emitida, nota_chave, data_pedido, lixeira",
      { count: "exact" }
    )
    .eq("lixeira", "Nao");

  if (search && search.trim()) {
    query = query.ilike("nome_cliente", `%${search.trim()}%`);
  }

  const { data, error, count } = await query
    .order("data_pedido", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("Error fetching notas fiscais:", error);
    return { data: [], total: 0 };
  }

  return { data: data as NotaFiscalRow[], total: count ?? 0 };
}
