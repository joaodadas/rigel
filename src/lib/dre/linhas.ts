// Mapa de linhas das abas DRE mensais.
// Chave = número da linha no xlsx; valor = como classificar o registro.
// Categorias devem casar com o CHECK constraint em dre_lancamentos.

export type Categoria =
  | "faturamento"
  | "imposto"
  | "variavel"
  | "cpv"
  | "despesa_fixa"
  | "nao_operacional"
  | "resultado";

export interface LinhaConfig {
  categoria: Categoria;
  subCategoria: string;
  descricao: string;
}

export const LINHAS: Record<number, LinhaConfig> = {
  10: { categoria: "faturamento", subCategoria: "mercado_interno", descricao: "Faturamento Bruto Mercado Interno" },
  11: { categoria: "faturamento", subCategoria: "mercado_externo", descricao: "Faturamento Bruto Mercado Externo" },
  12: { categoria: "faturamento", subCategoria: "devolucoes",      descricao: "Devoluções" },

  14: { categoria: "imposto", subCategoria: "total",             descricao: "Impostos (Total)" },
  15: { categoria: "imposto", subCategoria: "icms",              descricao: "ICMS Normal + DIFAL" },
  16: { categoria: "imposto", subCategoria: "pis_cofins",        descricao: "PIS/COFINS" },
  17: { categoria: "imposto", subCategoria: "simples_nacional",  descricao: "Simples Nacional" },
  18: { categoria: "imposto", subCategoria: "irpj_csll",         descricao: "Previsão IRPJ/CSLL" },

  20: { categoria: "resultado", subCategoria: "receita_liquida", descricao: "Receita Líquida" },

  22: { categoria: "variavel", subCategoria: "total",    descricao: "Variáveis de Venda (Total)" },
  23: { categoria: "variavel", subCategoria: "comissao", descricao: "Comissão" },
  24: { categoria: "variavel", subCategoria: "frete",    descricao: "Frete (s/ vendas)" },
  25: { categoria: "variavel", subCategoria: "pdd",      descricao: "Provisão Dev. Duvidosos" },

  27: { categoria: "cpv", subCategoria: "total",              descricao: "Custo do Produto Vendido (Total)" },
  28: { categoria: "cpv", subCategoria: "materia_prima",      descricao: "Matéria Prima" },
  29: { categoria: "cpv", subCategoria: "mao_de_obra_direta", descricao: "Mão de Obra Direta" },
  30: { categoria: "cpv", subCategoria: "terceiros",          descricao: "Serviço de Terceiros" },
  31: { categoria: "cpv", subCategoria: "faccao",             descricao: "Facção" },
  32: { categoria: "cpv", subCategoria: "embalagens",         descricao: "Embalagens" },
  33: { categoria: "cpv", subCategoria: "energia",            descricao: "Energia Elétrica" },

  35: { categoria: "resultado", subCategoria: "margem_contribuicao", descricao: "Margem de Contribuição" },

  37: { categoria: "despesa_fixa", subCategoria: "total",             descricao: "Custos/Despesas Fixas (Total)" },
  38: { categoria: "despesa_fixa", subCategoria: "administrativo",    descricao: "Administrativo" },
  39: { categoria: "despesa_fixa", subCategoria: "cis",               descricao: "CIS" },
  40: { categoria: "despesa_fixa", subCategoria: "comercial",         descricao: "Comercial" },
  41: { categoria: "despesa_fixa", subCategoria: "corte_laser",       descricao: "Corte / Laser" },
  42: { categoria: "despesa_fixa", subCategoria: "costura",           descricao: "Costura" },
  43: { categoria: "despesa_fixa", subCategoria: "ecommerce",         descricao: "E-Commerce" },
  44: { categoria: "despesa_fixa", subCategoria: "estoque_expedicao", descricao: "Estoque / Expedição" },
  45: { categoria: "despesa_fixa", subCategoria: "marketing",         descricao: "Marketing" },
  46: { categoria: "despesa_fixa", subCategoria: "personalizacao",    descricao: "Personalização" },
  47: { categoria: "despesa_fixa", subCategoria: "placas",            descricao: "Placas" },
  48: { categoria: "despesa_fixa", subCategoria: "qualidade",         descricao: "Qualidade" },
  49: { categoria: "despesa_fixa", subCategoria: "rigel_sense",       descricao: "Rigel Sense" },
  50: { categoria: "despesa_fixa", subCategoria: "seamless",          descricao: "Seamless" },
  51: { categoria: "despesa_fixa", subCategoria: "tecidos",           descricao: "Tecidos" },
  52: { categoria: "despesa_fixa", subCategoria: "galpao_2026",       descricao: "Construção Galpão 2026" },
  53: { categoria: "despesa_fixa", subCategoria: "mercado_livre",     descricao: "Mercado Livre" },
  54: { categoria: "despesa_fixa", subCategoria: "shoppe",            descricao: "Shoppe" },
  55: { categoria: "despesa_fixa", subCategoria: "amazon",            descricao: "Amazon" },
  56: { categoria: "despesa_fixa", subCategoria: "shein",             descricao: "Shein" },
  57: { categoria: "despesa_fixa", subCategoria: "diversas",          descricao: "Despesas Diversas" },

  59: { categoria: "resultado",       subCategoria: "operacional",            descricao: "Resultado Operacional" },

  61: { categoria: "nao_operacional", subCategoria: "total_receita_despesa",  descricao: "Total Receita/Despesa Não Op." },
  71: { categoria: "nao_operacional", subCategoria: "total_despesa",          descricao: "Total Despesa Não Operacional" },

  82: { categoria: "resultado", subCategoria: "lucro_com_investimentos", descricao: "Lucro Líquido (com investimentos)" },
  83: { categoria: "resultado", subCategoria: "lucro_sem_investimentos", descricao: "Lucro Líquido (sem investimentos)" },
  85: { categoria: "resultado", subCategoria: "investimentos",           descricao: "Montante Pago em Investimentos" },
};

// Linhas usadas como base de % (faturamento bruto = L10 + L11)
export const LINHAS_FATURAMENTO_BRUTO = [10, 11];
