import { createSupabaseServer } from "@/lib/supabase/client";

export interface ContaReceberRow {
  id_conta_rec: number;
  nome_conta: string;
  nome_cliente: string | null;
  categoria_rec: string | null;
  vencimento_rec: string | null;
  valor_rec: number | null;
  valor_pago: number | null;
  liquidado_rec: string;
  forma_pagamento: string | null;
  data_pagamento: string | null;
  lixeira: string;
}

export interface ContasReceberResult {
  data: ContaReceberRow[];
  total: number;
}

export async function getContasReceber(
  page = 1,
  pageSize = 50,
  search?: string
): Promise<ContasReceberResult> {
  const supabase = createSupabaseServer();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("contas_receber")
    .select(
      "id_conta_rec, nome_conta, nome_cliente, categoria_rec, vencimento_rec, valor_rec, valor_pago, liquidado_rec, forma_pagamento, data_pagamento, lixeira",
      { count: "exact" }
    )
    .eq("lixeira", "Nao");

  if (search && search.trim()) {
    query = query.ilike("nome_conta", `%${search.trim()}%`);
  }

  const { data, error, count } = await query
    .order("vencimento_rec", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("Error fetching contas a receber:", error);
    return { data: [], total: 0 };
  }

  return { data: data as ContaReceberRow[], total: count ?? 0 };
}
