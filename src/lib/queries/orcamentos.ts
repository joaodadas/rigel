import { createSupabaseServer } from "@/lib/supabase/client";
import { cacheList, CACHE_KEYS } from "@/lib/redis/client";

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

export interface OrcamentosResult {
  data: OrcamentoRow[];
  total: number;
}

export async function getOrcamentos(
  page = 1,
  pageSize = 50,
  search?: string
): Promise<OrcamentosResult> {
  return cacheList(
    CACHE_KEYS.list("orcamentos", page, pageSize, search || ""),
    () => _fetchOrcamentos(page, pageSize, search)
  );
}

async function _fetchOrcamentos(
  page = 1,
  pageSize = 50,
  search?: string
): Promise<OrcamentosResult> {
  const supabase = createSupabaseServer();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("orcamentos")
    .select(
      "id_orcamento, nome_cliente, vendedor_pedido, valor_total_nota, status_pedido, data_pedido, validade_orcamento, lixeira",
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
    console.error("Error fetching orcamentos:", error);
    return { data: [], total: 0 };
  }

  return { data: data as OrcamentoRow[], total: count ?? 0 };
}
