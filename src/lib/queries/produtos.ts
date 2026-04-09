import { createSupabaseServer } from "@/lib/supabase/client";

export interface ProdutoRow {
  id_produto: number;
  cod_produto: string | null;
  desc_produto: string;
  marca_produto: string | null;
  estoque_produto: number | null;
  unidade_produto: string | null;
  valor_produto: number | null;
  status_produto: string;
  lixeira: string;
}

export interface ProdutosResult {
  data: ProdutoRow[];
  total: number;
}

export async function getProdutos(
  page = 1,
  pageSize = 50,
  search?: string
): Promise<ProdutosResult> {
  const supabase = createSupabaseServer();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("produtos")
    .select(
      "id_produto, cod_produto, desc_produto, marca_produto, estoque_produto, unidade_produto, valor_produto, status_produto, lixeira",
      { count: "exact" }
    )
    .eq("lixeira", "Nao");

  if (search && search.trim()) {
    query = query.ilike("desc_produto", `%${search.trim()}%`);
  }

  const { data, error, count } = await query
    .order("desc_produto", { ascending: true })
    .range(from, to);

  if (error) {
    console.error("Error fetching produtos:", error);
    return { data: [], total: 0 };
  }

  return { data: data as ProdutoRow[], total: count ?? 0 };
}
