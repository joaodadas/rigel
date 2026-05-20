// src/lib/empresas.ts
// Registry estático das contas VHSys sincronizadas pelo projeto.
// O slug entra na coluna `empresa` das tabelas multi-tenant e na querystring da UI.
// NOTE: distinto de src/lib/dre/empresas.ts, que mapeia colunas do DRE (matriz/filial/medical/hdslim/consolidado).

export const EMPRESAS = [
  { slug: "rigel_fabricante", nome: "Rigel Fabricante", envPrefix: "VHSYS_RIGEL_FABRICANTE" },
  { slug: "rigel_medical",    nome: "Rigel Medical",    envPrefix: "VHSYS_RIGEL_MEDICAL" },
  { slug: "hdslim",           nome: "HD Slim",          envPrefix: "VHSYS_HDSLIM" },
] as const;

export type Empresa = (typeof EMPRESAS)[number]
export type EmpresaSlug = Empresa["slug"]

export const EMPRESA_SLUGS = EMPRESAS.map((e) => e.slug) as readonly EmpresaSlug[]

export function isEmpresaSlug(value: string): value is EmpresaSlug {
  return (EMPRESA_SLUGS as readonly string[]).includes(value)
}

export function getEmpresa(slug: EmpresaSlug): Empresa {
  const found = EMPRESAS.find((e) => e.slug === slug)
  if (!found) throw new Error(`Empresa desconhecida: ${slug}`)
  return found
}

export function getEmpresaNome(slug: EmpresaSlug): string {
  return getEmpresa(slug).nome
}

/** Parsea o param `empresa` da querystring (CSV) em uma lista de slugs válidos.
 *  Vazio/undefined → array vazio (interpretado como "todos" pelas queries). */
export function parseEmpresasParam(raw: string | undefined): EmpresaSlug[] {
  if (!raw) return []
  const valid = raw.split(",").map((s) => s.trim()).filter(isEmpresaSlug)
  return Array.from(new Set(valid))
}
