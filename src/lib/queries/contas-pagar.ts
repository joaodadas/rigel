import { createSupabaseServer } from "@/lib/supabase/client";

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

export async function getContasPagar(): Promise<ContaPagarRow[]> {
  const supabase = createSupabaseServer();

  const { data, error } = await supabase
    .from("contas_pagar")
    .select(
      "id_conta_pag, nome_conta, nome_fornecedor, categoria_pag, vencimento_pag, valor_pag, valor_pago, liquidado_pag, forma_pagamento, data_pagamento, lixeira"
    )
    .eq("lixeira", "Nao")
    .order("vencimento_pag", { ascending: false })
    .limit(1000);

  if (error) {
    console.error("Error fetching contas a pagar:", error);
    return [];
  }

  return data as ContaPagarRow[];
}
