// Normalização de vendedores: API VHSys → nome canonical usado em metas e UI.
// Estratégia:
//   1) Se o pedido tem vendedor_pedido_id > 0, mapeia pelo ID (mais confiável).
//   2) Caso contrário (id = 0/null), normaliza pelo nome textual (uppercase + trim).
//   3) Marketplaces e canais e-commerce são excluídos do BI Comercial (B2B).

// ---------------------------------------------------------------------------
// IDs dos vendedores cadastrados na VHSys
// ---------------------------------------------------------------------------

export const VENDEDOR_ID_TO_CANONICAL: Record<number, string> = {
  244502: "Ana Paula Ramos",
  255799: "CGQ",
  237210: "Claudio",
  230021: "Deany",
  254989: "Djavan",
  230015: "Edwilson",
  263817: "Evento",
  230018: "Francisco Moreira",
  237211: "Jéssica",
  230017: "José Roberto",
  263229: "Loja São Paulo",
  230016: "Lurdinha",
  255722: "Prime Med",
  254664: "Raquel",
  259500: "Rodrigo",
  230019: "Santos Maia",
  230020: "Sérgio",
  207727: "Vendas Internas",
  266629: "Vendas Internas 2",
}

// ---------------------------------------------------------------------------
// IDs de canais e-commerce/marketplace (EXCLUÍDOS do BI Comercial B2B)
// ---------------------------------------------------------------------------

export const MARKETPLACE_VENDEDOR_IDS = new Set<number>([
  248324, // MERCADOFULL
  207185, // MERCADOLIVRE
  230194, // SHOPEE
  262101, // SHOPEEFULL
  262945, // SHEIN
  212745, // SITE OPTA SAUDE
  239225, // SITE RIGEL
])

// Nomes textuais que indicam canal e-commerce (quando id = 0)
const MARKETPLACE_NAME_PATTERNS = [
  "MERCADO", "SHOPEE", "SHOPPE", "SHEIN", "FULL", "AMERICANAS", "SOPEE",
  "SITE", "OPTA",
]

// ---------------------------------------------------------------------------
// Mapeamento por nome textual (fallback quando id = 0)
// ---------------------------------------------------------------------------

const NAME_TO_CANONICAL: Record<string, string> = {
  // Vendas internas (várias variações)
  "VENDAS INTERNAS 2": "Vendas Internas 2",
  "VENDAS INTERNA 2": "Vendas Internas 2",
  "VI 2": "Vendas Internas 2",
  "VI-2": "Vendas Internas 2",
  "VENDAS INTERNAS": "Vendas Internas",
  "VENDAS INTERNA": "Vendas Internas",
  "VENDAS": "Vendas Internas",
  "VENDAS INTERNOS": "Vendas Internas",
  "VENDAS ONTERNAS": "Vendas Internas",

  // Representantes principais (id 0 mas tem meta)
  "EDWILSON": "Edwilson",
  "CLAUDIO": "Claudio",
  "JOSE ROBERTO": "José Roberto",
  "JOSE ROBERTO NUNES": "José Roberto",
  "JOSE ROBERTO NUNES SALVADOR": "José Roberto",
  "JOSE R. N. SALVADOR": "José Roberto",
  "JESSICA": "Jéssica",
  "RAQUEL": "Raquel",
  "RODRIGO": "Rodrigo",
  "DJAVAN": "Djavan",
  "DEANY": "Deany",
  "LURDINHA": "Lurdinha",
  "FRANCISCO MOREIRA": "Francisco Moreira",
  "ANA PAULA RAMOS": "Ana Paula Ramos",
  "SANTOS MAIA": "Santos Maia",
  "SANTOS MAIA - CARLA": "Santos Maia - Carla",
  "SERGIO": "Sérgio",
  "SÉRGIO HENRIQUE": "Sérgio",
  "PEDRO SERGIO": "Pedro Sérgio",
  "CGQ": "CGQ",
  "FRANCISCO/SANDY": "Francisco/Sandy",
  "FRANCISCO CWB": "Francisco CWB",
  "FRANCISCO": "Francisco",
  "LETICIA": "Letícia",
  "DIEGO": "Diego",
  "KELLY": "Kelly",

  // Outros canais com cadastro
  "EVENTO": "Evento",
  "PRIME MED": "Prime Med",
  "PRIME": "Prime Med",
  "LOJA SÃO PAULO": "Loja São Paulo",
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/** Retorna o nome canonical do vendedor, ou null se for marketplace ou desconhecido. */
export function resolveVendedor(
  vendedorId: number | string | null | undefined,
  vendedorNome: string | null | undefined,
): string | null {
  const id = vendedorId != null ? Number(vendedorId) : 0

  if (id > 0) {
    if (MARKETPLACE_VENDEDOR_IDS.has(id)) return null
    const canonical = VENDEDOR_ID_TO_CANONICAL[id]
    if (canonical) return canonical
    // ID conhecido mas não mapeado — usa o nome
  }

  const nome = (vendedorNome ?? "").trim()
  if (!nome) return null

  const upper = nome.toUpperCase()

  // Filtro de marketplace por nome (quando id = 0)
  for (const pat of MARKETPLACE_NAME_PATTERNS) {
    if (upper.includes(pat)) return null
  }

  if (NAME_TO_CANONICAL[upper]) return NAME_TO_CANONICAL[upper]

  // Tenta match parcial — checa "2" antes para não cair no canonical antigo
  if (upper.startsWith("VENDAS INTERNAS 2")) return "Vendas Internas 2"
  if (upper.startsWith("VENDAS INTERNAS")) return "Vendas Internas"

  return null // desconhecido — não conta no BI
}

/** Mantida por compatibilidade. Aplica resolveVendedor só pelo nome (id desconhecido). */
export function mapVendedorToMeta(nomeApi: string | null): string | null {
  return resolveVendedor(null, nomeApi)
}
