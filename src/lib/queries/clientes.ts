import { createSupabaseServer } from "@/lib/supabase/client";

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

export async function getClientes(): Promise<ClienteRow[]> {
  const supabase = createSupabaseServer();

  const { data, error } = await supabase
    .from("clientes")
    .select(
      "id_cliente, razao_cliente, fantasia_cliente, cnpj_cliente, cidade_cliente, uf_cliente, fone_cliente, email_cliente, situacao_cliente, data_cad_cliente, lixeira"
    )
    .eq("lixeira", "Nao")
    .order("razao_cliente", { ascending: true })
    .limit(1000);

  if (error) {
    console.error("Error fetching clientes:", error);
    return [];
  }

  return data as ClienteRow[];
}
