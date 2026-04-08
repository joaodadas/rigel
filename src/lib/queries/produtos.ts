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

export async function getProdutos(): Promise<ProdutoRow[]> {
  const supabase = createSupabaseServer();

  const { data, error } = await supabase
    .from("produtos")
    .select(
      "id_produto, cod_produto, desc_produto, marca_produto, estoque_produto, unidade_produto, valor_produto, status_produto, lixeira"
    )
    .eq("lixeira", "Nao")
    .order("desc_produto", { ascending: true })
    .limit(1000);

  if (error) {
    console.error("Error fetching produtos:", error);
    return [];
  }

  return data as ProdutoRow[];
}
