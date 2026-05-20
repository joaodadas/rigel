// src/lib/sync/multi-empresa.ts
// Helpers compartilhados pelas tabelas multi-tenant.
// Hoje só contas_pagar tem PK composta (empresa, id_<pk>); quando outras tabelas
// migrarem para o mesmo modelo, adicione o nome aqui — todos os consumidores
// (sync inicial, incremental, webhook) usam essa mesma lista.

export const TABLES_WITH_EMPRESA_PK: ReadonlySet<string> = new Set(["contas_pagar"]);

export function onConflictFor(entity: string, primaryKey: string): string {
  return TABLES_WITH_EMPRESA_PK.has(entity) ? `empresa,${primaryKey}` : primaryKey;
}
