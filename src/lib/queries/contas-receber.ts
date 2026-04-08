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

export async function getContasReceber(): Promise<ContaReceberRow[]> {
  const supabase = createSupabaseServer();

  const { data, error } = await supabase
    .from("contas_receber")
    .select(
      "id_conta_rec, nome_conta, nome_cliente, categoria_rec, vencimento_rec, valor_rec, valor_pago, liquidado_rec, forma_pagamento, data_pagamento, lixeira"
    )
    .eq("lixeira", "Nao")
    .order("vencimento_rec", { ascending: false })
    .limit(1000);

  if (error) {
    console.error("Error fetching contas a receber:", error);
    return [];
  }

  return data as ContaReceberRow[];
}
