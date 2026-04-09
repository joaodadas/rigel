// Mapeamento: nome do vendedor na API VHSys → nome na tabela de metas
// Necessario porque os nomes podem nao coincidir exatamente
// Configuravel: adicione mapeamentos conforme necessario

export const VENDEDOR_MAP: Record<string, string> = {
  // Formato: "nome_na_api": "nome_na_meta"
  // Adicione mapeamentos aqui conforme encontrar divergencias
  // Exemplo:
  // "EDWILSON SILVA": "Edwilson",
  // "JESSICA SOUZA": "Jéssica",
};

// Normaliza o nome do vendedor da API para o nome da meta
export function mapVendedorToMeta(nomeApi: string | null): string | null {
  if (!nomeApi) return null;
  const trimmed = nomeApi.trim();
  // Primeiro tenta mapeamento direto
  if (VENDEDOR_MAP[trimmed]) return VENDEDOR_MAP[trimmed];
  // Tenta case-insensitive
  const lower = trimmed.toLowerCase();
  for (const [key, value] of Object.entries(VENDEDOR_MAP)) {
    if (key.toLowerCase() === lower) return value;
  }
  // Retorna o nome original se nao encontrar mapeamento
  return trimmed;
}
