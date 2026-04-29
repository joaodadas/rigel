import { createSupabaseServer } from "@/lib/supabase/client";
import { supabaseFetchAll } from "@/lib/supabase/fetch-all";
import type { Categoria } from "@/lib/dre/linhas";
import type { EmpresaCode } from "@/lib/dre/empresas";

export interface DreLancamento {
  periodo: string;
  empresa: EmpresaCode;
  regime_tributario: "lucro_presumido" | "simples_nacional" | "na";
  categoria: Categoria;
  sub_categoria: string;
  descricao: string;
  valor: number;
  pct_sobre_faturamento: number | null;
}

export interface MesesDisponiveisResult {
  ano: number;
  meses: number[]; // 1..12, ordenados crescentes
}

/**
 * Retorna o ano mais recente em dre_uploads (status=sucesso) e a união de
 * meses processados — usado pela UI para habilitar/desabilitar pills de mês.
 */
export async function getMesesDisponiveis(): Promise<MesesDisponiveisResult | null> {
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("dre_uploads")
    .select("ano_referencia, meses_processados")
    .eq("status", "sucesso")
    .order("ano_referencia", { ascending: false });

  if (error) {
    console.error("[dre/getMesesDisponiveis]", error);
    return null;
  }
  if (!data || data.length === 0) return null;

  const ano = data[0].ano_referencia;
  const meses = new Set<number>();
  for (const row of data) {
    if (row.ano_referencia !== ano) continue;
    for (const m of row.meses_processados ?? []) meses.add(m);
  }
  return { ano, meses: [...meses].sort((a, b) => a - b) };
}

/**
 * Lê todos os lançamentos de um conjunto de meses + empresa.
 * `meses`: array de 1..12 dentro de `ano`. Vazio = sem retorno.
 */
export async function getLancamentos(opts: {
  ano: number;
  meses: number[];
  empresa?: EmpresaCode;
}): Promise<DreLancamento[]> {
  if (opts.meses.length === 0) return [];

  const supabase = createSupabaseServer();
  const periodos = opts.meses.map((m) => `${opts.ano}-${String(m).padStart(2, "0")}-01`);

  // Paginar — Supabase tem hard limit de 1000 rows por response.
  // Volume típico: 225 rows × empresas × meses, pode passar de 1000 facilmente.
  return supabaseFetchAll<DreLancamento>((from, to) => {
    let query = supabase
      .from("dre_lancamentos")
      .select(
        "periodo, empresa, regime_tributario, categoria, sub_categoria, descricao, valor, pct_sobre_faturamento",
      )
      .in("periodo", periodos)
      .range(from, to);
    if (opts.empresa) query = query.eq("empresa", opts.empresa);
    return query;
  });
}
