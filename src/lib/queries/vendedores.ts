import { createSupabaseServer } from "@/lib/supabase/client";

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

export async function getVendedores(): Promise<VendedorRow[]> {
  const supabase = createSupabaseServer();

  const { data, error } = await supabase
    .from("vendedores")
    .select(
      "id_vendedor, razao_vendedor, fantasia_vendedor, cidade_vendedor, uf_vendedor, fone_vendedor, email_vendedor, situacao_vendedor, comissao_usuario"
    )
    .eq("lixeira", "Nao")
    .order("razao_vendedor", { ascending: true });

  if (error) {
    console.error("Error fetching vendedores:", error);
    return [];
  }

  return data as VendedorRow[];
}
