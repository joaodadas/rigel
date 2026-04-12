import { createSupabaseServer } from "@/lib/supabase/client";
import { cacheList, CACHE_KEYS } from "@/lib/redis/client";

export interface ContaPagarRow {
  id_conta_pag: number;
  nome_conta: string;
  nome_fornecedor: string | null;
  categoria_pag: string | null;
  vencimento_pag: string | null;
  valor_pag: number | null;
  valor_pago: number | null;
  liquidado_pag: string;
  forma_pagamento: string | null;
  data_pagamento: string | null;
  lixeira: string;
}

export interface ContasPagarResult {
  data: ContaPagarRow[];
  total: number;
}

export async function getContasPagar(
  page = 1,
  pageSize = 50,
  search?: string
): Promise<ContasPagarResult> {
  return cacheList(
    CACHE_KEYS.list("contas-pagar", page, pageSize, search || ""),
    () => _fetchContasPagar(page, pageSize, search)
  );
}

export function prefetchNextPage(page: number, pageSize: number, search?: string) {
  void cacheList(
    CACHE_KEYS.list("contas-pagar", page + 1, pageSize, search || ""),
    () => _fetchContasPagar(page + 1, pageSize, search)
  );
}

async function _fetchContasPagar(
  page = 1,
  pageSize = 50,
  search?: string
): Promise<ContasPagarResult> {
  const supabase = createSupabaseServer();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("contas_pagar")
    .select(
      "id_conta_pag, nome_conta, nome_fornecedor, categoria_pag, vencimento_pag, valor_pag, valor_pago, liquidado_pag, forma_pagamento, data_pagamento, lixeira",
      { count: "exact" }
    )
    .eq("lixeira", "Nao");

  if (search && search.trim()) {
    query = query.ilike("nome_conta", `%${search.trim()}%`);
  }

  const { data, error, count } = await query
    .order("vencimento_pag", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("Error fetching contas a pagar:", error);
    return { data: [], total: 0 };
  }

  return { data: data as ContaPagarRow[], total: count ?? 0 };
}
