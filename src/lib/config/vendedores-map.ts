import { METAS_VENDEDORES } from "./metas-2026";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// ---------------------------------------------------------------------------
// Mapping: raw API name → canonical display name
// ---------------------------------------------------------------------------

const VENDEDOR_DISPLAY_MAP: Record<string, string> = {
  "vendas internas": "Vendas Internas",
  "vendas internos": "Vendas Internas",
  "vendas onternas": "Vendas Internas",
  "claudio": "Claudio",
  "edwilson": "Edwilson",
  "jose roberto": "Jose Roberto",
  "jessica": "Jessica",
  "santos maia": "Santos Maia",
  "raquel": "Raquel",
  "deany": "Deany",
  "ana paula ramos": "Ana Paula Ramos",
  "francisco moreira": "Francisco Moreira",
  "francisco/sandy": "Francisco/Sandy",
  "djavan": "Djavan",
  "cgq": "CGQ",
  "lurdinha": "Lurdinha",
  "leticia": "Leticia",
  "francisco": "Francisco",
  "sergio": "Sergio",
  "pedro sergio": "Pedro Sergio",
  "santos maia - carla": "Santos Maia - Carla",
  "francisco cwb": "Francisco CWB",
  "rodrigo": "Rodrigo",
  "diego": "Diego",
  "kelly": "Kelly",
};

// ---------------------------------------------------------------------------
// B2B inclusion list (derived from METAS_VENDEDORES)
// ---------------------------------------------------------------------------

const B2B_SET = new Set<string>();
B2B_SET.add("Vendas Internas");
for (const v of METAS_VENDEDORES) {
  const stripped = stripAccents(v.nome.toLowerCase())
    .replace(/\s*\(vi-\d+\)\s*/g, "")
    .trim();
  const displayName = VENDEDOR_DISPLAY_MAP[stripped];
  if (displayName) B2B_SET.add(displayName);
}

export const B2B_VENDEDORES_NORMALIZED: string[] = (() => {
  const set = new Set<string>();
  for (const [lower, display] of Object.entries(VENDEDOR_DISPLAY_MAP)) {
    if (B2B_SET.has(display)) {
      set.add(lower.toUpperCase());
    }
  }
  set.add("VENDAS INTERNAS");
  return Array.from(set).sort();
})();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function normalizeVendedor(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) return "Sem vendedor";
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  return VENDEDOR_DISPLAY_MAP[lower] ?? trimmed;
}

export function isB2B(normalizedName: string): boolean {
  return B2B_SET.has(normalizedName);
}

export function getVendasInternasMetaCombinada(): number {
  return METAS_VENDEDORES.filter((v) => v.tipo === "vendas_internas").reduce(
    (sum, v) => sum + v.meta_2026,
    0
  );
}

export function findMetaAnualByDisplay(normalizedName: string): number {
  if (normalizedName === "Vendas Internas") {
    return getVendasInternasMetaCombinada();
  }
  const lower = stripAccents(normalizedName.toLowerCase());
  const found = METAS_VENDEDORES.find(
    (v) => stripAccents(v.nome.toLowerCase()) === lower
  );
  return found?.meta_2026 ?? 0;
}

// Legacy exports for backward compat
export const VENDEDOR_MAP = VENDEDOR_DISPLAY_MAP;

export function mapVendedorToMeta(nomeApi: string | null): string | null {
  if (!nomeApi) return null;
  return normalizeVendedor(nomeApi);
}
