// Mapa de empresas e suas colunas correspondentes em cada aba DRE mensal.
// Cada aba tem 5 pares (Valor + %) — ver spec seção 5.

export type EmpresaCode = "matriz" | "filial" | "hdslim" | "medical" | "consolidado";

export type RegimeTributario = "lucro_presumido" | "simples_nacional" | "na";

export interface EmpresaConfig {
  code: EmpresaCode;
  label: string;
  regime: RegimeTributario;
  colValor: string; // letra da coluna no xlsx (ex: "B")
  colPct: string;   // letra da coluna do %
}

export const EMPRESAS: EmpresaConfig[] = [
  { code: "matriz",      label: "Rigel Matriz",       regime: "lucro_presumido",  colValor: "B", colPct: "C" },
  { code: "filial",      label: "Rigel Filial SP",    regime: "lucro_presumido",  colValor: "D", colPct: "E" },
  { code: "hdslim",      label: "HD Slim",            regime: "lucro_presumido",  colValor: "F", colPct: "G" },
  { code: "medical",     label: "Rigel Medical",      regime: "simples_nacional", colValor: "H", colPct: "I" },
  { code: "consolidado", label: "Consolidado",        regime: "na",               colValor: "J", colPct: "K" },
];

export const EMPRESAS_OPERACIONAIS: EmpresaCode[] = ["matriz", "filial", "hdslim", "medical"];

export const EMPRESA_BY_CODE: Record<EmpresaCode, EmpresaConfig> =
  Object.fromEntries(EMPRESAS.map((e) => [e.code, e])) as Record<EmpresaCode, EmpresaConfig>;
