// Metas 2026 por vendedor - definidas pela gestora comercial Raquel
// Usadas no comparativo Realizado vs Meta do dashboard comercial

export const SAZONALIDADE_MENSAL: Record<string, number> = {
  "Jan": 7.5, "Fev": 5.1, "Mar": 6.7, "Abr": 6.8,
  "Mai": 7.3, "Jun": 8.9, "Jul": 10.4, "Ago": 8.8,
  "Set": 8.7, "Out": 9.8, "Nov": 11.0, "Dez": 8.8,
};

// Index por numero do mes (1-12)
export const SAZONALIDADE_POR_MES: Record<number, number> = {
  1: 7.5, 2: 5.1, 3: 6.7, 4: 6.8,
  5: 7.3, 6: 8.9, 7: 10.4, 8: 8.8,
  9: 8.7, 10: 9.8, 11: 11.0, 12: 8.8,
};

export interface MetaVendedor {
  nome: string;
  tipo: "vendas_internas" | "representante";
  fat_2025?: number;
  meta_2026: number;
  crescimento: string;
  status?: string;
}

export const METAS_VENDEDORES: MetaVendedor[] = [
  // Vendas Internas — split conforme PROMPT_V2_BI_COMERCIAL_RIGEL.md (Bloco 10):
  //   "Vendas Internas"   (id VHSys 207727) → Aline   (VI-01, pedidos reativos) — R$ 3.000.000
  //   "Vendas Internas 2" (id VHSys 266629) → Fátima  (VI-02, vendas novas)     — R$   646.425
  // Atribuição ID↔pessoa baseada na cronologia (207727 ativo desde 2021; 266629 criado em 16/04/2026)
  // — pendente de confirmação com a gestora Raquel; se invertido, basta trocar os meta_2026.
  { nome: "Vendas Internas", tipo: "vendas_internas", meta_2026: 3000000, crescimento: "N/A" },
  { nome: "Vendas Internas 2", tipo: "vendas_internas", meta_2026: 646425, crescimento: "N/A" },
  // Representantes
  { nome: "Edwilson", tipo: "representante", fat_2025: 2470091, meta_2026: 3119621, crescimento: "26.3%" },
  { nome: "Claudio", tipo: "representante", fat_2025: 2365313, meta_2026: 2365313, crescimento: "0%", status: "mantido" },
  { nome: "José Roberto", tipo: "representante", fat_2025: 2236554, meta_2026: 2824673, crescimento: "26.3%" },
  { nome: "Jéssica", tipo: "representante", fat_2025: 690579, meta_2026: 690579, crescimento: "0%", status: "mantido" },
  { nome: "Santos Maia", tipo: "representante", fat_2025: 464878, meta_2026: 587121, crescimento: "26.3%" },
  { nome: "Raquel", tipo: "representante", fat_2025: 286059, meta_2026: 361280, crescimento: "26.3%" },
  { nome: "Deany", tipo: "representante", fat_2025: 251617, meta_2026: 317782, crescimento: "26.3%" },
  { nome: "Ana Paula Ramos", tipo: "representante", fat_2025: 160565, meta_2026: 202787, crescimento: "26.3%" },
  { nome: "Francisco Moreira", tipo: "representante", fat_2025: 102649, meta_2026: 129641, crescimento: "26.3%" },
  { nome: "Francisco/Sandy", tipo: "representante", fat_2025: 94256, meta_2026: 119041, crescimento: "26.3%" },
  { nome: "Djavan", tipo: "representante", fat_2025: 91479, meta_2026: 115534, crescimento: "26.3%" },
  { nome: "CGQ", tipo: "representante", fat_2025: 83261, meta_2026: 105155, crescimento: "26.3%" },
  { nome: "Lurdinha", tipo: "representante", fat_2025: 68394, meta_2026: 86379, crescimento: "26.3%" },
  { nome: "Letícia", tipo: "representante", fat_2025: 60569, meta_2026: 76496, crescimento: "26.3%" },
  { nome: "Francisco", tipo: "representante", fat_2025: 56244, meta_2026: 71034, crescimento: "26.3%" },
  { nome: "Sérgio", tipo: "representante", fat_2025: 54899, meta_2026: 69335, crescimento: "26.3%" },
  { nome: "Pedro Sérgio", tipo: "representante", fat_2025: 49064, meta_2026: 61966, crescimento: "26.3%" },
  { nome: "Santos Maia - Carla", tipo: "representante", fat_2025: 40861, meta_2026: 51606, crescimento: "26.3%" },
  { nome: "Francisco CWB", tipo: "representante", fat_2025: 20580, meta_2026: 25992, crescimento: "26.3%" },
  { nome: "Rodrigo", tipo: "representante", fat_2025: 15862, meta_2026: 20033, crescimento: "26.3%" },
  { nome: "Diego", tipo: "representante", fat_2025: 15114, meta_2026: 19088, crescimento: "26.3%" },
  { nome: "Kelly", tipo: "representante", fat_2025: 7607, meta_2026: 9607, crescimento: "26.3%" },
];

export const TOTAL_B2B = {
  fat_2025: 12776686,
  meta_2026: 15076489,
  crescimento: "18%",
};

// Calcula meta mensal de um vendedor baseado na sazonalidade
export function getMetaMensal(metaAnual: number, mes: number): number {
  const pct = SAZONALIDADE_POR_MES[mes] ?? 0;
  return (metaAnual * pct) / 100;
}

// Calcula meta acumulada ate um determinado mes
export function getMetaAcumulada(metaAnual: number, ateMes: number): number {
  let total = 0;
  for (let m = 1; m <= ateMes; m++) {
    total += getMetaMensal(metaAnual, m);
  }
  return total;
}
