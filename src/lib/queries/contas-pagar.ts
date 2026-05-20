// src/lib/queries/contas-pagar.ts
import { createSupabaseServer } from "@/lib/supabase/client";
import { cacheList, CACHE_KEYS } from "@/lib/redis/client";
import { EMPRESA_SLUGS, type EmpresaSlug } from "@/lib/empresas";

export interface ContaPagarRow {
  id_conta_pag: number;
  empresa: EmpresaSlug;
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

function effectiveEmpresas(empresas?: EmpresaSlug[]): readonly EmpresaSlug[] {
  if (!empresas || empresas.length === 0) return EMPRESA_SLUGS;
  return empresas;
}

export async function getContasPagar(
  page = 1,
  pageSize = 50,
  search?: string,
  empresas?: EmpresaSlug[],
): Promise<ContasPagarResult> {
  return cacheList(
    CACHE_KEYS.list("contas-pagar", page, pageSize, search || "", empresas),
    () => _fetchContasPagar(page, pageSize, search, empresas),
  );
}

export function prefetchNextPage(
  page: number,
  pageSize: number,
  search?: string,
  empresas?: EmpresaSlug[],
) {
  void cacheList(
    CACHE_KEYS.list("contas-pagar", page + 1, pageSize, search || "", empresas),
    () => _fetchContasPagar(page + 1, pageSize, search, empresas),
  );
}

async function _fetchContasPagar(
  page = 1,
  pageSize = 50,
  search?: string,
  empresas?: EmpresaSlug[],
): Promise<ContasPagarResult> {
  const supabase = createSupabaseServer();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const targetEmpresas = effectiveEmpresas(empresas);

  let query = supabase
    .from("contas_pagar")
    .select(
      "id_conta_pag, empresa, nome_conta, nome_fornecedor, categoria_pag, vencimento_pag, valor_pag, valor_pago, liquidado_pag, forma_pagamento, data_pagamento, lixeira",
      { count: "exact" },
    )
    .eq("lixeira", "Nao")
    .in("empresa", targetEmpresas as unknown as string[]);

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
