import { createSupabaseServer } from "@/lib/supabase/client";
import { cacheList, CACHE_KEYS } from "@/lib/redis/client";

export interface ClienteRow {
  id_cliente: number;
  razao_cliente: string;
  fantasia_cliente: string | null;
  cnpj_cliente: string | null;
  cidade_cliente: string | null;
  uf_cliente: string | null;
  fone_cliente: string | null;
  email_cliente: string | null;
  situacao_cliente: string;
  data_cad_cliente: string | null;
  lixeira: string;
}

export interface ClientesResult {
  data: ClienteRow[];
  total: number;
}

export async function getClientes(
  page = 1,
  pageSize = 50,
  search?: string
): Promise<ClientesResult> {
  return cacheList(
    CACHE_KEYS.list("clientes", page, pageSize, search || ""),
    () => _fetchClientes(page, pageSize, search)
  );
}

async function _fetchClientes(
  page = 1,
  pageSize = 50,
  search?: string
): Promise<ClientesResult> {
  const supabase = createSupabaseServer();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("clientes")
    .select(
      "id_cliente, razao_cliente, fantasia_cliente, cnpj_cliente, cidade_cliente, uf_cliente, fone_cliente, email_cliente, situacao_cliente, data_cad_cliente, lixeira",
      { count: "exact" }
    )
    .eq("lixeira", "Nao");

  if (search && search.trim()) {
    query = query.ilike("razao_cliente", `%${search.trim()}%`);
  }

  const { data, error, count } = await query
    .order("razao_cliente", { ascending: true })
    .range(from, to);

  if (error) {
    console.error("Error fetching clientes:", error);
    return { data: [], total: 0 };
  }

  return { data: data as ClienteRow[], total: count ?? 0 };
}
