import { createSupabaseServer } from "@/lib/supabase/client";
import { cacheList, CACHE_KEYS } from "@/lib/redis/client";

export interface VendedorRow {
  id_vendedor: number;
  razao_vendedor: string;
  fantasia_vendedor: string | null;
  cidade_vendedor: string | null;
  uf_vendedor: string | null;
  fone_vendedor: string | null;
  email_vendedor: string | null;
  situacao_vendedor: string;
  comissao_usuario: number | null;
}

export interface VendedoresResult {
  data: VendedorRow[];
  total: number;
}

export async function getVendedores(
  page = 1,
  pageSize = 50,
  search?: string
): Promise<VendedoresResult> {
  return cacheList(
    CACHE_KEYS.list("vendedores", page, pageSize, search || ""),
    () => _fetchVendedores(page, pageSize, search)
  );
}

async function _fetchVendedores(
  page = 1,
  pageSize = 50,
  search?: string
): Promise<VendedoresResult> {
  const supabase = createSupabaseServer();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("vendedores")
    .select(
      "id_vendedor, razao_vendedor, fantasia_vendedor, cidade_vendedor, uf_vendedor, fone_vendedor, email_vendedor, situacao_vendedor, comissao_usuario",
      { count: "exact" }
    )
    .eq("lixeira", "Nao");

  if (search && search.trim()) {
    query = query.ilike("razao_vendedor", `%${search.trim()}%`);
  }

  const { data, error, count } = await query
    .order("razao_vendedor", { ascending: true })
    .range(from, to);

  if (error) {
    console.error("Error fetching vendedores:", error);
    return { data: [], total: 0 };
  }

  return { data: data as VendedorRow[], total: count ?? 0 };
}
