# VHSys multi-empresa — contas a pagar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sincronizar `contas_pagar` de duas instâncias VHSys adicionais (Rigel Medical e HD Slim) e expor filtro por empresa na UI, sem regressão para a Rigel Fabricante.

**Architecture:** Tabela `contas_pagar` (e `sync_log`) ganha coluna `empresa` com PK composta `(empresa, id_conta_pag)`. Cliente VHSys recebe `empresa: EmpresaSlug` como primeiro parâmetro. Cron incremental existente passa a iterar as 3 empresas, mas só `contas_pagar` é sincronizado para as duas novas. Demais tabelas ficam single-tenant. Filtro UI por querystring, sem persistência.

**Tech Stack:** Next.js 15 (App Router), Supabase Postgres (REST via `@supabase/supabase-js`), `@upstash/redis` (cache opcional), TanStack Table, shadcn/ui, TypeScript strict.

**Pre-requisite reading (engineer should skim before starting):**
- `docs/superpowers/specs/2026-05-19-vhsys-multi-empresa-contas-pagar-design.md` — design completo
- `CLAUDE.md` — convenções do projeto (Better-Auth, idioma, comandos)
- `src/lib/vhsys/client.ts`, `src/lib/sync/{initial,incremental}.ts`, `src/lib/queries/contas-pagar.ts` — código que vamos refatorar

**Como verificar (não há test framework):**
- `npm run lint` → ESLint
- `npm run build` → `next build` faz type-check completo (Turbopack)
- `npx tsx --env-file=.env.local scripts/vhsys-probe.ts --empresa <slug>` → probe read-only contra VHSys
- Verificação manual com `psql` ou Supabase SQL editor para checar dados após sync

---

## File structure

**Criar:**
- `src/lib/empresas.ts` — registry estático de tenants
- `supabase/migrations/0003_contas_pagar_multi_empresa.sql` — schema change
- `src/app/api/sync/initial/contas-pagar/route.ts` — endpoint manual para backfill de uma empresa específica

**Modificar:**
- `src/lib/vhsys/client.ts` — todas as funções ganham `empresa: EmpresaSlug` como 1º parâmetro
- `src/lib/sync/initial.ts` — `syncEntity` recebe empresa; nova função `runInitialContasPagarSync`
- `src/lib/sync/incremental.ts` — loop principal itera empresas
- `src/lib/sync/pedido-itens.ts` — adicionar comentário TODO (sem mudança funcional)
- `src/lib/sync/webhook-handler.ts` — upsert para `contas_pagar` injeta `empresa='rigel_fabricante'`
- `src/app/api/sync/pedidos/route.ts` — passa `empresa='rigel_fabricante'` no `vhsysGet`
- `src/lib/queries/contas-pagar.ts` — assinatura ganha `empresas?: EmpresaSlug[]`; row ganha `empresa`
- `src/lib/redis/client.ts` — `CACHE_KEYS.list` aceita empresas; `invalidateAllCaches` expande combinações
- `src/app/(dashboard)/admin/contas-pagar/page.tsx` — parsea `empresa` da querystring
- `src/app/(dashboard)/financeiro/contas-pagar/page.tsx` — idem
- `src/app/(dashboard)/admin/contas-pagar/contas-pagar-table.tsx` — renderiza `<Select>` de empresa
- `src/app/(dashboard)/admin/contas-pagar/columns.tsx` — coluna `Empresa` condicional

---

### Task 1: Criar registry de empresas

**Files:**
- Create: `src/lib/empresas.ts`

- [ ] **Step 1: Criar o arquivo**

```ts
// src/lib/empresas.ts
// Registry estático das contas VHSys sincronizadas pelo projeto.
// O slug entra na coluna `empresa` das tabelas multi-tenant e na querystring da UI.

export const EMPRESAS = [
  { slug: "rigel_fabricante", nome: "Rigel Fabricante", envPrefix: "VHSYS" },
  { slug: "rigel_medical",    nome: "Rigel Medical",    envPrefix: "VHSYS_RIGEL_MEDICAL" },
  { slug: "hdslim",           nome: "HD Slim",          envPrefix: "VHSYS_HDSLIM" },
] as const

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
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(isEmpresaSlug)
}
```

- [ ] **Step 2: Verificar lint + build**

Run: `npm run lint && npm run build`
Expected: PASS (sem erro novo — type-check valida o `as const`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/empresas.ts
git commit -m "feat(empresas): add tenant registry with EmpresaSlug type"
```

---

### Task 2: Criar e aplicar migration `0003_contas_pagar_multi_empresa.sql`

**Files:**
- Create: `supabase/migrations/0003_contas_pagar_multi_empresa.sql`

- [ ] **Step 1: Criar o arquivo SQL**

```sql
-- supabase/migrations/0003_contas_pagar_multi_empresa.sql
-- Adiciona coluna `empresa` em contas_pagar e sync_log para suportar
-- sincronização de múltiplas instâncias VHSys (Rigel Fabricante + Rigel Medical + HD Slim).
-- Backfill via DEFAULT garante que registros existentes virem 'rigel_fabricante'.

BEGIN;

-- contas_pagar: ganha empresa + CHECK
ALTER TABLE contas_pagar
  ADD COLUMN empresa text NOT NULL DEFAULT 'rigel_fabricante'
    CHECK (empresa IN ('rigel_fabricante', 'rigel_medical', 'hdslim'));

-- Remove DEFAULT para forçar inserts explícitos daqui pra frente
ALTER TABLE contas_pagar ALTER COLUMN empresa DROP DEFAULT;

-- Troca PK simples → composta (empresa, id_conta_pag)
ALTER TABLE contas_pagar DROP CONSTRAINT contas_pagar_pkey;
ALTER TABLE contas_pagar ADD PRIMARY KEY (empresa, id_conta_pag);

-- Índices para queries comuns (listagem por empresa ordenada por vencimento)
CREATE INDEX IF NOT EXISTS idx_contas_pagar_empresa_venc
  ON contas_pagar (empresa, vencimento_pag DESC);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_empresa_lixeira_venc
  ON contas_pagar (empresa, lixeira, vencimento_pag DESC)
  WHERE lixeira = 'Nao';

-- sync_log: ganha empresa para watermarks por tenant
ALTER TABLE sync_log
  ADD COLUMN empresa text NOT NULL DEFAULT 'rigel_fabricante'
    CHECK (empresa IN ('rigel_fabricante', 'rigel_medical', 'hdslim'));

ALTER TABLE sync_log ALTER COLUMN empresa DROP DEFAULT;

CREATE INDEX IF NOT EXISTS idx_sync_log_entity_empresa_time
  ON sync_log (entity, empresa, last_sync_at DESC);

COMMIT;
```

- [ ] **Step 2: Aplicar a migration localmente**

Run: `npx tsx --env-file=.env.local scripts/run-migration.ts supabase/migrations/0003_contas_pagar_multi_empresa.sql`
Expected output: `Migration applied OK.`

- [ ] **Step 3: Verificar o resultado no banco**

Run (PowerShell):
```pwsh
npx tsx --env-file=.env.local -e "import('pg').then(async (pg) => { const pool = new pg.default.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }); const r = await pool.query(`SELECT empresa, COUNT(*)::int FROM contas_pagar GROUP BY empresa`); console.log(r.rows); await pool.end(); })"
```
Expected: `[ { empresa: 'rigel_fabricante', count: 35813 } ]` (volume bate com o probe).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0003_contas_pagar_multi_empresa.sql
git commit -m "feat(db): migration 0003 — contas_pagar multi-empresa schema"
```

---

### Task 3: Refator `src/lib/vhsys/client.ts` para multi-tenant

**Files:**
- Modify: `src/lib/vhsys/client.ts`

- [ ] **Step 1: Substituir o conteúdo inteiro**

```ts
// src/lib/vhsys/client.ts
import { VHSYS_BASE_URL, MAX_PAGE_SIZE } from "./endpoints";
import type { VHSysResponse } from "./types";
import { getEmpresa, type EmpresaSlug } from "@/lib/empresas";

function getHeaders(empresa: EmpresaSlug): HeadersInit {
  const prefix = getEmpresa(empresa).envPrefix;
  const access = process.env[`${prefix}_ACCESS_TOKEN`];
  const secret = process.env[`${prefix}_SECRET_ACCESS_TOKEN`];
  if (!access || !secret) {
    throw new Error(
      `VHSys: tokens da empresa "${empresa}" não configurados ` +
      `(esperado ${prefix}_ACCESS_TOKEN e ${prefix}_SECRET_ACCESS_TOKEN).`,
    );
  }
  return {
    "access-token": access,
    "secret-access-token": secret,
    "Content-Type": "application/json",
    "User-Agent": "Rigel/1.0",
    "Cache-Control": "no-cache",
  };
}

function buildUrl(endpoint: string, params?: Record<string, string>): string {
  const url = new URL(`${VHSYS_BASE_URL}${endpoint}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

export async function vhsysGet<T>(
  empresa: EmpresaSlug,
  endpoint: string,
  params?: Record<string, string>,
): Promise<VHSysResponse<T>> {
  const res = await fetch(buildUrl(endpoint, params), {
    method: "GET",
    headers: getHeaders(empresa),
  });
  if (!res.ok) {
    throw new Error(`VHSys [${empresa}] GET ${endpoint} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<VHSysResponse<T>>;
}

export async function vhsysPost<T>(
  empresa: EmpresaSlug,
  endpoint: string,
  body: Record<string, unknown>,
): Promise<VHSysResponse<T>> {
  const res = await fetch(buildUrl(endpoint), {
    method: "POST",
    headers: getHeaders(empresa),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`VHSys [${empresa}] POST ${endpoint} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<VHSysResponse<T>>;
}

export async function vhsysPut<T>(
  empresa: EmpresaSlug,
  endpoint: string,
  body: Record<string, unknown>,
): Promise<VHSysResponse<T>> {
  const res = await fetch(buildUrl(endpoint), {
    method: "PUT",
    headers: getHeaders(empresa),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`VHSys [${empresa}] PUT ${endpoint} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<VHSysResponse<T>>;
}

export async function vhsysDelete<T>(
  empresa: EmpresaSlug,
  endpoint: string,
): Promise<VHSysResponse<T>> {
  const res = await fetch(buildUrl(endpoint), {
    method: "DELETE",
    headers: getHeaders(empresa),
  });
  if (!res.ok) {
    throw new Error(`VHSys [${empresa}] DELETE ${endpoint} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<VHSysResponse<T>>;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function vhsysFetchAll<T>(
  empresa: EmpresaSlug,
  endpoint: string,
  extraParams?: Record<string, string>,
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const params: Record<string, string> = {
      ...extraParams,
      limit: String(MAX_PAGE_SIZE),
      offset: String(offset),
    };

    const response = await vhsysGet<T>(empresa, endpoint, params);
    const items = response.data ?? [];
    all.push(...items);

    if (items.length < MAX_PAGE_SIZE) {
      hasMore = false;
    } else {
      offset += MAX_PAGE_SIZE;
      await delay(200);
    }
  }

  return all;
}
```

- [ ] **Step 2: Build (vai falhar nos call sites — esperado)**

Run: `npm run build 2>&1 | head -50`
Expected: errors em `src/lib/sync/initial.ts`, `src/lib/sync/incremental.ts`, `src/app/api/sync/pedidos/route.ts` reclamando que faltam argumentos. Isso confirma que o type-check pegou todos os call sites.

- [ ] **Step 3: NÃO commit ainda** — o projeto não compila até os call sites serem atualizados (Tasks 4-6). Continue na Task 4.

---

### Task 4: Refator `src/lib/sync/initial.ts`

**Files:**
- Modify: `src/lib/sync/initial.ts`

- [ ] **Step 1: Substituir o conteúdo inteiro**

```ts
// src/lib/sync/initial.ts
import { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase/client";
import { vhsysGet } from "@/lib/vhsys/client";
import { ENDPOINTS, MAX_PAGE_SIZE } from "@/lib/vhsys/endpoints";
import type { EmpresaSlug } from "@/lib/empresas";

// Only keep fields that exist in our Supabase tables
export const TABLE_FIELDS: Record<string, string[]> = {
  vendedores: ["id_vendedor", "razao_vendedor", "tipo_pessoa", "cnpj_vendedor", "fantasia_vendedor", "cidade_vendedor", "uf_vendedor", "fone_vendedor", "email_vendedor", "situacao_vendedor", "comissao_usuario", "data_cad_vendedor", "data_mod_vendedor", "lixeira"],
  clientes: ["id_cliente", "id_registro", "tipo_pessoa", "tipo_cadastro", "cnpj_cliente", "razao_cliente", "fantasia_cliente", "endereco_cliente", "numero_cliente", "bairro_cliente", "cep_cliente", "cidade_cliente", "cidade_cliente_cod", "uf_cliente", "contato_cliente", "fone_cliente", "celular_cliente", "email_cliente", "insc_estadual_cliente", "situacao_cliente", "vendedor_cliente", "vendedor_cliente_id", "observacoes_cliente", "data_nasc_cliente", "data_cad_cliente", "data_mod_cliente", "lixeira"],
  produtos: ["id_produto", "id_categoria", "cod_produto", "marca_produto", "desc_produto", "estoque_produto", "unidade_produto", "valor_produto", "valor_custo_produto", "ncm_produto", "codigo_barra_produto", "status_produto", "data_cad_produto", "data_mod_produto", "lixeira"],
  pedidos: ["id_pedido", "id_ped", "id_cliente", "nome_cliente", "vendedor_pedido", "vendedor_pedido_id", "valor_total_produtos", "desconto_pedido", "frete_pedido", "valor_total_nota", "status_pedido", "data_pedido", "obs_pedido", "contas_pedido", "estoque_pedido", "data_cad_pedido", "data_mod_pedido", "lixeira"],
  contas_pagar: ["id_conta_pag", "nome_conta", "id_categoria", "categoria_pag", "id_banco", "id_fornecedor", "nome_fornecedor", "vencimento_pag", "valor_pag", "valor_pago", "liquidado_pag", "data_pagamento", "forma_pagamento", "data_emissao", "n_documento_pag", "observacoes_pag", "id_centro_custos", "centro_custos_pag", "data_cad_pag", "data_mod_pag", "lixeira"],
  contas_receber: ["id_conta_rec", "nome_conta", "id_categoria", "categoria_rec", "id_banco", "id_cliente", "nome_cliente", "vencimento_rec", "valor_rec", "valor_pago", "liquidado_rec", "data_pagamento", "forma_pagamento", "tipo_conta", "data_emissao", "n_documento_rec", "observacoes_rec", "id_centro_custos", "centro_custos_rec", "data_cad_rec", "data_mod_rec", "lixeira"],
};

export function pickFields(item: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in item) {
      let value = item[field];
      // VHSys uses "0000-00-00" for null dates - Postgres rejects this
      if (typeof value === "string" && /^0000-00-00/.test(value)) {
        value = null;
      }
      result[field] = value;
    }
  }
  return result;
}

// Tabelas que já têm PK composta (empresa, <pk>) precisam de onConflict composto.
const TABLES_WITH_EMPRESA_PK: Set<string> = new Set(["contas_pagar"]);

function onConflictFor(entity: string, primaryKey: string): string {
  return TABLES_WITH_EMPRESA_PK.has(entity) ? `empresa,${primaryKey}` : primaryKey;
}

// Stream sync: fetch page -> upsert -> next page (no memory accumulation)
async function syncEntity(
  supabase: SupabaseClient,
  empresa: EmpresaSlug,
  entity: string,
  endpoint: string,
  primaryKey: string,
): Promise<number> {
  const start = Date.now();
  const fields = TABLE_FIELDS[entity];
  let offset = 0;
  let total = Infinity;
  let synced = 0;
  const writesEmpresaColumn = TABLES_WITH_EMPRESA_PK.has(entity);

  console.log(`[sync:${empresa}] Starting ${entity}...`);

  while (offset < total) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await vhsysGet<any>(empresa, endpoint, {
      limit: String(MAX_PAGE_SIZE),
      offset: String(offset),
      lixeira: "Nao",
    });

    if (res.paging) {
      total = res.paging.total;
    }

    const rawData = res.data;
    const items: Record<string, unknown>[] = Array.isArray(rawData) ? rawData : [];
    if (items.length === 0) break;

    // Deduplicate by primary key (VHSys can return dupes in same page)
    const seen = new Set<unknown>();
    const deduped = items.filter((item) => {
      const key = item[primaryKey];
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const batch = deduped.map((item) => ({
      ...(fields ? pickFields(item, fields) : item),
      ...(writesEmpresaColumn ? { empresa } : {}),
      synced_at: new Date().toISOString(),
    }));

    // Retry up to 3 times on connection errors
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await supabase
        .from(entity)
        .upsert(batch, { onConflict: onConflictFor(entity, primaryKey) });

      if (!error) {
        lastError = null;
        break;
      }

      lastError = error;
      const msg = typeof error === "object" && error !== null && "message" in error ? (error as { message: string }).message : String(error);
      if (msg.includes("fetch failed") || msg.includes("ECONNRESET")) {
        console.warn(`[sync:${empresa}] Retry ${attempt + 1}/3 for ${entity} at offset ${offset}`);
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      // Non-retryable error
      console.error(`[sync:${empresa}] Error upserting ${entity} at offset ${offset}:`, error);
      throw error;
    }

    if (lastError) {
      console.error(`[sync:${empresa}] Failed after 3 retries ${entity} at offset ${offset}:`, lastError);
      throw lastError;
    }

    synced += items.length;
    offset += MAX_PAGE_SIZE;
    console.log(`[sync:${empresa}] ${entity}: ${synced}/${total} synced`);

    if (offset < total) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  const duration = Date.now() - start;
  console.log(`[sync:${empresa}] ${entity} done: ${synced} records in ${duration}ms`);

  await supabase.from("sync_log").insert({
    entity,
    empresa,
    records_synced: synced,
    status: "success",
    duration_ms: duration,
  });

  return synced;
}

/** Sync inicial completo da Rigel Fabricante — comportamento legado preservado. */
export async function runInitialSync(): Promise<Record<string, number>> {
  const supabase = createSupabaseServer();
  const empresa: EmpresaSlug = "rigel_fabricante";
  const results: Record<string, number> = {};

  try {
    // Group 1: No FK dependencies - run in parallel
    console.log(`[sync:${empresa}] Group 1: vendedores + clientes + produtos (parallel)`);
    const [vendedores, clientes, produtos] = await Promise.all([
      syncEntity(supabase, empresa, "vendedores", ENDPOINTS.vendedores, "id_vendedor"),
      syncEntity(supabase, empresa, "clientes", ENDPOINTS.clientes, "id_cliente"),
      syncEntity(supabase, empresa, "produtos", ENDPOINTS.produtos, "id_produto"),
    ]);
    results.vendedores = vendedores;
    results.clientes = clientes;
    results.produtos = produtos;

    // Group 2: Depend on clientes - run in parallel
    console.log(`[sync:${empresa}] Group 2: pedidos + contas_pagar + contas_receber (parallel)`);
    const [pedidos, contasPagar, contasReceber] = await Promise.all([
      syncEntity(supabase, empresa, "pedidos", ENDPOINTS.pedidos, "id_pedido"),
      syncEntity(supabase, empresa, "contas_pagar", ENDPOINTS.contasPagar, "id_conta_pag"),
      syncEntity(supabase, empresa, "contas_receber", ENDPOINTS.contasReceber, "id_conta_rec"),
    ]);
    results.pedidos = pedidos;
    results.contas_pagar = contasPagar;
    results.contas_receber = contasReceber;

    console.log(`[sync:${empresa}] All entities synced:`, results);
  } catch (error) {
    await supabase.from("sync_log").insert({
      entity: "initial_sync",
      empresa,
      records_synced: 0,
      status: "error",
      error_message: String(error),
    });
    throw error;
  }

  return results;
}

/** Sync inicial apenas de contas_pagar para uma empresa específica.
 *  Usado uma vez por empresa nova (Rigel Medical, HD Slim) no rollout. */
export async function runInitialContasPagarSync(
  empresa: EmpresaSlug,
): Promise<{ synced: number; durationMs: number }> {
  const supabase = createSupabaseServer();
  const start = Date.now();
  console.log(`[sync:${empresa}] Initial contas_pagar sync starting...`);
  const synced = await syncEntity(
    supabase,
    empresa,
    "contas_pagar",
    ENDPOINTS.contasPagar,
    "id_conta_pag",
  );
  const durationMs = Date.now() - start;
  console.log(`[sync:${empresa}] Initial contas_pagar done: ${synced} records in ${durationMs}ms`);
  return { synced, durationMs };
}
```

- [ ] **Step 2: NÃO commit ainda** — `incremental.ts` e `route.ts` ainda quebram. Vá para Task 5.

---

### Task 5: Refator `src/lib/sync/incremental.ts`

**Files:**
- Modify: `src/lib/sync/incremental.ts`

- [ ] **Step 1: Substituir o conteúdo inteiro**

```ts
// src/lib/sync/incremental.ts
import { createSupabaseServer } from "@/lib/supabase/client";
import { vhsysFetchAll } from "@/lib/vhsys/client";
import { ENDPOINTS } from "@/lib/vhsys/endpoints";
import { invalidateAllCaches } from "@/lib/redis/client";
import { TABLE_FIELDS, pickFields } from "@/lib/sync/initial";
import { EMPRESAS, type EmpresaSlug } from "@/lib/empresas";

const BATCH_SIZE = 500;

const ENTITIES = [
  { name: "vendedores", endpoint: ENDPOINTS.vendedores, pk: "id_vendedor", dateField: "data_mod_vendedor" },
  { name: "clientes", endpoint: ENDPOINTS.clientes, pk: "id_cliente", dateField: "data_mod_cliente" },
  { name: "produtos", endpoint: ENDPOINTS.produtos, pk: "id_produto", dateField: "data_mod_produto" },
  { name: "pedidos", endpoint: ENDPOINTS.pedidos, pk: "id_pedido", dateField: "data_mod_pedido" },
  { name: "contas_pagar", endpoint: ENDPOINTS.contasPagar, pk: "id_conta_pag", dateField: "data_mod_pag" },
  { name: "contas_receber", endpoint: ENDPOINTS.contasReceber, pk: "id_conta_rec", dateField: "data_mod_rec" },
] as const;

const TABLES_WITH_EMPRESA_PK: Set<string> = new Set(["contas_pagar"]);

function onConflictFor(entity: string, primaryKey: string): string {
  return TABLES_WITH_EMPRESA_PK.has(entity) ? `empresa,${primaryKey}` : primaryKey;
}

function entitiesForEmpresa(empresa: EmpresaSlug): typeof ENTITIES[number][] {
  // Rigel Fabricante sincroniza tudo. Demais empresas: só contas_pagar nesta entrega.
  if (empresa === "rigel_fabricante") return [...ENTITIES];
  return ENTITIES.filter((e) => e.name === "contas_pagar");
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

async function getLastSyncTime(
  supabase: ReturnType<typeof createSupabaseServer>,
  empresa: EmpresaSlug,
  entity: string,
  dateField: string,
): Promise<string | null> {
  // Prefer sync_log for the most precise watermark
  const { data: logRow } = await supabase
    .from("sync_log")
    .select("last_sync_at")
    .eq("entity", entity)
    .eq("empresa", empresa)
    .eq("status", "success")
    .order("last_sync_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (logRow?.last_sync_at) return logRow.last_sync_at as string;

  // Fallback: derive from MAX(date_field) of the entity table.
  // Para tabelas multi-empresa, filtra por empresa também.
  let query = supabase
    .from(entity)
    .select(dateField)
    .not(dateField, "is", null);

  if (TABLES_WITH_EMPRESA_PK.has(entity)) {
    query = query.eq("empresa", empresa);
  }

  const { data: maxRow } = await query
    .order(dateField, { ascending: false })
    .limit(1)
    .maybeSingle();

  const value = (maxRow as Record<string, unknown> | null)?.[dateField];
  return typeof value === "string" ? value : null;
}

export async function runIncrementalSync(): Promise<Record<string, Record<string, number>>> {
  const supabase = createSupabaseServer();
  const results: Record<string, Record<string, number>> = {};

  for (const empresaConfig of EMPRESAS) {
    const empresa = empresaConfig.slug;
    results[empresa] = {};

    for (const entity of entitiesForEmpresa(empresa)) {
      const start = Date.now();

      try {
        const lastSync = await getLastSyncTime(supabase, empresa, entity.name, entity.dateField);
        console.log(`[incremental:${empresa}] ${entity.name} last sync: ${lastSync ?? "never"}`);

        if (!lastSync) {
          console.log(`[incremental:${empresa}] Skipping ${entity.name} — no previous sync, no data in table`);
          results[empresa][entity.name] = 0;
          continue;
        }

        const params: Record<string, string> = {
          data_modificacao: lastSync.split("T")[0],
        };

        const items = await vhsysFetchAll<Record<string, unknown>>(empresa, entity.endpoint, params);
        console.log(`[incremental:${empresa}] Fetched ${items.length} ${entity.name} modified since ${lastSync}`);

        if (items.length > 0) {
          const fields = TABLE_FIELDS[entity.name];
          const writesEmpresaColumn = TABLES_WITH_EMPRESA_PK.has(entity.name);

          const seen = new Set<unknown>();
          const deduped = items.filter((item) => {
            const key = item[entity.pk];
            if (key === undefined || seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
            const batch = deduped.slice(i, i + BATCH_SIZE).map((item) => ({
              ...(fields ? pickFields(item, fields) : item),
              ...(writesEmpresaColumn ? { empresa } : {}),
              synced_at: new Date().toISOString(),
            }));

            const { error } = await supabase
              .from(entity.name)
              .upsert(batch, { onConflict: onConflictFor(entity.name, entity.pk) });

            if (error) {
              console.error(`[incremental:${empresa}] Error upserting ${entity.name} batch ${i}:`, error);
              throw error;
            }
          }
        }

        const duration = Date.now() - start;
        results[empresa][entity.name] = items.length;

        await supabase.from("sync_log").insert({
          entity: entity.name,
          empresa,
          records_synced: items.length,
          status: "success",
          duration_ms: duration,
        });

        console.log(`[incremental:${empresa}] ${entity.name} done: ${items.length} records in ${duration}ms`);
      } catch (error) {
        const duration = Date.now() - start;
        const message = formatError(error);
        console.error(`[incremental:${empresa}] ${entity.name} failed:`, message);

        await supabase.from("sync_log").insert({
          entity: entity.name,
          empresa,
          records_synced: 0,
          status: "error",
          error_message: message,
          duration_ms: duration,
        });

        results[empresa][entity.name] = -1;
      }
    }
  }

  await invalidateAllCaches();
  console.log("[incremental] Sync complete:", results);

  return results;
}
```

- [ ] **Step 2: NÃO commit ainda** — outros call sites ainda quebram. Vá para Task 6.

---

### Task 6: Ajustar outros consumidores do client VHSys

**Files:**
- Modify: `src/app/api/sync/pedidos/route.ts`
- Modify: `src/lib/sync/pedido-itens.ts`
- Modify: `src/lib/sync/webhook-handler.ts`

- [ ] **Step 1: `src/app/api/sync/pedidos/route.ts` — passar empresa em vhsysGet**

Localize a linha (linha 36-39):
```ts
      const res = await vhsysGet<any>(ENDPOINTS.pedidos, {
        limit: String(MAX_PAGE_SIZE),
        offset: String(offset),
      });
```

Substitua por:
```ts
      const res = await vhsysGet<any>("rigel_fabricante", ENDPOINTS.pedidos, {
        limit: String(MAX_PAGE_SIZE),
        offset: String(offset),
      });
```

E ajuste o upsert (linha 62) para incluir `empresa` apenas se a tabela `pedidos` ainda for single-tenant — neste caso ela continua sendo, então **mantenha o upsert atual sem alterações**. Apenas a chamada do `vhsysGet` muda.

- [ ] **Step 2: `src/lib/sync/pedido-itens.ts` — adicionar comentário TODO**

Localize as linhas 63-69 (o `fetch` direto com `process.env`):
```ts
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "access-token": process.env.VHSYS_ACCESS_TOKEN!,
      "secret-access-token": process.env.VHSYS_SECRET_ACCESS_TOKEN!,
      "Content-Type": "application/json",
      "User-Agent": "Rigel/1.0",
    },
  });
```

Adicione um comentário acima:
```ts
  // TODO multi-empresa: hoje só opera na Rigel Fabricante (lê env direto, sem usar o client multi-tenant).
  // Quando outras empresas sincronizarem pedidos, refatorar para usar vhsysGet(empresa, ...) e injetar `empresa` no upsert de pedido_itens.
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "access-token": process.env.VHSYS_ACCESS_TOKEN!,
      "secret-access-token": process.env.VHSYS_SECRET_ACCESS_TOKEN!,
      "Content-Type": "application/json",
      "User-Agent": "Rigel/1.0",
    },
  });
```

- [ ] **Step 3: `src/lib/sync/webhook-handler.ts` — injetar empresa no upsert de contas_pagar**

Localize o bloco do upsert (linhas 30-42):
```ts
  const record = { ...payload.data, synced_at: new Date().toISOString() };

  if (action === "delete") {
    const pkValue = payload.data[mapping.pk];
    await supabase
      .from(mapping.table)
      .update({ lixeira: "Sim", synced_at: new Date().toISOString() })
      .eq(mapping.pk, pkValue);
  } else {
    await supabase
      .from(mapping.table)
      .upsert(record, { onConflict: mapping.pk });
  }
```

Substitua por:
```ts
  // Webhooks atualmente só são recebidos da Rigel Fabricante (a única conta com webhook
  // potencialmente configurado). Quando webhook multi-tenant for habilitado, esta empresa
  // deve vir do payload ou do path da URL (/api/webhooks/vhsys/[empresa]).
  const empresa = "rigel_fabricante" as const;
  const writesEmpresaColumn = mapping.table === "contas_pagar";

  const record = {
    ...payload.data,
    ...(writesEmpresaColumn ? { empresa } : {}),
    synced_at: new Date().toISOString(),
  };

  if (action === "delete") {
    const pkValue = payload.data[mapping.pk];
    let query = supabase
      .from(mapping.table)
      .update({ lixeira: "Sim", synced_at: new Date().toISOString() })
      .eq(mapping.pk, pkValue);
    if (writesEmpresaColumn) query = query.eq("empresa", empresa);
    await query;
  } else {
    const onConflict = writesEmpresaColumn ? `empresa,${mapping.pk}` : mapping.pk;
    await supabase.from(mapping.table).upsert(record, { onConflict });
  }
```

- [ ] **Step 4: Build + lint**

Run: `npm run lint && npm run build`
Expected: PASS sem erros.

- [ ] **Step 5: Commit do refator de client + sync layer**

```bash
git add src/lib/vhsys/client.ts src/lib/sync/initial.ts src/lib/sync/incremental.ts \
        src/lib/sync/pedido-itens.ts src/lib/sync/webhook-handler.ts \
        src/app/api/sync/pedidos/route.ts
git commit -m "feat(sync): multi-empresa VHSys client + sync layer

Cliente VHSys recebe empresa como 1º parâmetro; sync inicial/incremental
itera as 3 empresas (mas só contas_pagar sai pra Rigel Medical/HD Slim).
Demais call sites passam 'rigel_fabricante' explicitamente."
```

---

### Task 7: Endpoint manual `POST /api/sync/initial/contas-pagar`

**Files:**
- Create: `src/app/api/sync/initial/contas-pagar/route.ts`

- [ ] **Step 1: Criar o endpoint**

```ts
// src/app/api/sync/initial/contas-pagar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/auth/cron";
import { runInitialContasPagarSync } from "@/lib/sync/initial";
import { isEmpresaSlug } from "@/lib/empresas";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const empresa = req.nextUrl.searchParams.get("empresa");
  if (!empresa || !isEmpresaSlug(empresa)) {
    return NextResponse.json(
      { error: `Query param 'empresa' inválido ou ausente. Use rigel_fabricante, rigel_medical ou hdslim.` },
      { status: 400 },
    );
  }

  try {
    const result = await runInitialContasPagarSync(empresa);
    return NextResponse.json({ success: true, empresa, ...result });
  } catch (error) {
    console.error(`[sync:${empresa}] Initial contas_pagar sync failed:`, error);
    return NextResponse.json(
      { success: false, empresa, error: String(error) },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/sync/initial/contas-pagar/route.ts
git commit -m "feat(sync): endpoint manual para sync inicial de contas_pagar por empresa"
```

---

### Task 8: Queries e cache com filtro de empresa

**Files:**
- Modify: `src/lib/queries/contas-pagar.ts`
- Modify: `src/lib/redis/client.ts`

- [ ] **Step 1: Atualizar `src/lib/redis/client.ts` — CACHE_KEYS.list aceita empresas**

Localize o objeto `CACHE_KEYS` (linhas 106-137). Substitua a entrada `list:` (linha 135-136) por:

```ts
  // Listing queries (entity, page, pageSize, search, empresas)
  list: (entity: string, page: number, size: number, search?: string, empresas?: readonly string[]) => {
    const empresaTag = empresas && empresas.length > 0 ? [...empresas].sort().join(",") : "_all";
    return `list:${entity}:p${page}:s${size}:${search || "_"}:e${empresaTag}`;
  },
```

E substitua a função `invalidateAllCaches` (linhas 160-207) para invalidar variações de empresa em `contas-pagar`. Localize o trecho do loop de LIST_ENTITIES (linhas 188-196):

```ts
  // Listing keys for first 5 pages of each entity
  for (const entity of LIST_ENTITIES) {
    for (let page = 1; page <= 5; page++) {
      for (const size of COMMON_PAGE_SIZES) {
        keys.push(CACHE_KEYS.list(entity, page, size)); // no search
        keys.push(CACHE_KEYS.list(entity, page, size, "")); // empty search
      }
    }
  }
```

Substitua por:

```ts
  // Listing keys for first 5 pages of each entity.
  // Para contas-pagar, invalida todas as variações de empresa (3 isoladas + "todos").
  const EMPRESA_VARIANTS_FOR_LISTS: Record<string, readonly (readonly string[])[]> = {
    "contas-pagar": [
      [], // "todos"
      ["rigel_fabricante"],
      ["rigel_medical"],
      ["hdslim"],
    ],
  };

  for (const entity of LIST_ENTITIES) {
    const variants = EMPRESA_VARIANTS_FOR_LISTS[entity] ?? [[]];
    for (const empresas of variants) {
      for (let page = 1; page <= 5; page++) {
        for (const size of COMMON_PAGE_SIZES) {
          keys.push(CACHE_KEYS.list(entity, page, size, undefined, empresas));
          keys.push(CACHE_KEYS.list(entity, page, size, "", empresas));
        }
      }
    }
  }
```

- [ ] **Step 2: Substituir `src/lib/queries/contas-pagar.ts`**

```ts
// src/lib/queries/contas-pagar.ts
import { createSupabaseServer } from "@/lib/supabase/client";
import { cacheList, CACHE_KEYS } from "@/lib/redis/client";
import { EMPRESA_SLUGS, type EmpresaSlug } from "@/lib/empresas";

export interface ContaPagarRow {
  id_conta_pag: number;
  empresa: EmpresaSlug;
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

export interface ContasPagarResult {
  data: ContaPagarRow[];
  total: number;
}

function effectiveEmpresas(empresas?: EmpresaSlug[]): readonly EmpresaSlug[] {
  if (!empresas || empresas.length === 0) return EMPRESA_SLUGS;
  return empresas;
}

export async function getContasPagar(
  page = 1,
  pageSize = 50,
  search?: string,
  empresas?: EmpresaSlug[],
): Promise<ContasPagarResult> {
  return cacheList(
    CACHE_KEYS.list("contas-pagar", page, pageSize, search || "", empresas),
    () => _fetchContasPagar(page, pageSize, search, empresas),
  );
}

export function prefetchNextPage(
  page: number,
  pageSize: number,
  search?: string,
  empresas?: EmpresaSlug[],
) {
  void cacheList(
    CACHE_KEYS.list("contas-pagar", page + 1, pageSize, search || "", empresas),
    () => _fetchContasPagar(page + 1, pageSize, search, empresas),
  );
}

async function _fetchContasPagar(
  page = 1,
  pageSize = 50,
  search?: string,
  empresas?: EmpresaSlug[],
): Promise<ContasPagarResult> {
  const supabase = createSupabaseServer();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const targetEmpresas = effectiveEmpresas(empresas);

  let query = supabase
    .from("contas_pagar")
    .select(
      "id_conta_pag, empresa, nome_conta, nome_fornecedor, categoria_pag, vencimento_pag, valor_pag, valor_pago, liquidado_pag, forma_pagamento, data_pagamento, lixeira",
      { count: "exact" },
    )
    .eq("lixeira", "Nao")
    .in("empresa", targetEmpresas as unknown as string[]);

  if (search && search.trim()) {
    query = query.ilike("nome_conta", `%${search.trim()}%`);
  }

  const { data, error, count } = await query
    .order("vencimento_pag", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("Error fetching contas a pagar:", error);
    return { data: [], total: 0 };
  }

  return { data: data as ContaPagarRow[], total: count ?? 0 };
}
```

- [ ] **Step 3: Lint + build**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/queries/contas-pagar.ts src/lib/redis/client.ts
git commit -m "feat(queries): contas_pagar com filtro por empresa + cache key extension"
```

---

### Task 9: UI — filtro de empresa nas páginas de contas a pagar

**Files:**
- Modify: `src/app/(dashboard)/admin/contas-pagar/page.tsx`
- Modify: `src/app/(dashboard)/financeiro/contas-pagar/page.tsx`
- Modify: `src/app/(dashboard)/admin/contas-pagar/contas-pagar-table.tsx`
- Modify: `src/app/(dashboard)/admin/contas-pagar/columns.tsx`

- [ ] **Step 1: Atualizar `columns.tsx` — adicionar coluna `Empresa`**

No final do array `columns`, **antes** do `}`, adicione a coluna nova:

```tsx
  {
    accessorKey: "liquidado_pag",
    header: ({ column }) => <SortableHeader column={column} label="Status" />,
    cell: ({ row }) => {
      const liquidado = row.getValue("liquidado_pag") as string
      return liquidado === "Sim" ? (
        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          Liquidado
        </Badge>
      ) : (
        <Badge variant="secondary">Pendente</Badge>
      )
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: "empresa",
    header: () => <span className="text-xs uppercase tracking-wider font-medium">Empresa</span>,
    cell: ({ row }) => {
      const slug = row.getValue("empresa") as string
      const nome =
        slug === "rigel_fabricante" ? "Rigel Fabricante" :
        slug === "rigel_medical" ? "Rigel Medical" :
        slug === "hdslim" ? "HD Slim" : slug
      return <span className="text-xs text-muted-foreground whitespace-nowrap">{nome}</span>
    },
  },
]
```

(Ou seja: insira o novo objeto entre o último item existente — `liquidado_pag` — e o `]`. A visibilidade condicional vai ser controlada na `ContasPagarTable` via `columnVisibility`.)

- [ ] **Step 2: Reescrever `contas-pagar-table.tsx`**

```tsx
"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import type { ContaPagarRow } from "@/lib/queries/contas-pagar"
import { EMPRESAS, type EmpresaSlug } from "@/lib/empresas"
import { columns } from "./columns"
import { DataTable } from "@/components/data-table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ContasPagarTableProps {
  data: ContaPagarRow[]
  total: number
  page: number
  pageSize: number
  search: string
  empresas: EmpresaSlug[]
}

const SELECT_ALL_VALUE = "__all__"

export function ContasPagarTable({
  data,
  total,
  page,
  pageSize,
  search,
  empresas,
}: ContasPagarTableProps) {
  const router = useRouter()

  // Estado conceitual do select:
  //   - sem empresa selecionada (array vazio) → "Todos"
  //   - 1 empresa → mostra essa
  //   - 2+ empresas → também trata como "Todos" no select (filtro multi não tem UI nesta entrega)
  const selectedValue: string = empresas.length === 1 ? empresas[0] : SELECT_ALL_VALUE

  // Esconde a coluna "Empresa" quando o filtro está restrito a uma única empresa.
  const columnVisibility = useMemo(
    () => ({ empresa: empresas.length !== 1 }),
    [empresas.length],
  )

  function buildHref(params: Record<string, string | undefined>): string {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") sp.set(k, v)
    }
    const qs = sp.toString()
    return qs ? `?${qs}` : "?"
  }

  function navigate(newPage?: number, newSearch?: string) {
    router.push(
      buildHref({
        search: newSearch !== undefined ? newSearch : search,
        page: newSearch !== undefined ? "1" : newPage ? String(newPage) : undefined,
        pageSize: String(pageSize),
        empresa: empresas.length === 1 ? empresas[0] : undefined,
      }),
    )
  }

  function onEmpresaChange(value: string) {
    router.push(
      buildHref({
        search: search || undefined,
        page: "1",
        pageSize: String(pageSize),
        empresa: value === SELECT_ALL_VALUE ? undefined : value,
      }),
    )
  }

  const toolbar = (
    <div className="flex items-center gap-2">
      <Select value={selectedValue} onValueChange={onEmpresaChange}>
        <SelectTrigger className="h-9 w-[200px]">
          <SelectValue placeholder="Empresa" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SELECT_ALL_VALUE}>Todos os CNPJs</SelectItem>
          {EMPRESAS.map((e) => (
            <SelectItem key={e.slug} value={e.slug}>
              {e.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Buscar por nome da conta..."
      serverTotal={total}
      serverPage={page}
      serverPageSize={pageSize}
      serverSearch={search}
      onServerNavigate={navigate}
      columnVisibility={columnVisibility}
      toolbarLeft={toolbar}
    />
  )
}
```

⚠️ **Verifique se o `DataTable` (em `src/components/data-table.tsx`) suporta as props `columnVisibility` e `toolbarLeft`.** Se não suportar, adicione-as. Para isso, antes de seguir:

Run: `grep -n "columnVisibility\|toolbarLeft" src/components/data-table.tsx`

Se ambos retornarem **vazio**, abra `src/components/data-table.tsx` e:

1. Adicione no tipo de props:
   ```ts
   columnVisibility?: Record<string, boolean>
   toolbarLeft?: React.ReactNode
   ```
2. No `useReactTable({...})`, adicione `state: { columnVisibility }` (mesclando com state existente, se houver).
3. No JSX da toolbar/header da tabela, antes do campo de busca, renderize `{toolbarLeft}`.

Se a integração for complexa, **simplifique:** em vez de `columnVisibility` no DataTable, filtre o `columns` aqui mesmo:
```tsx
const visibleColumns = useMemo(
  () => empresas.length === 1 ? columns.filter(c => (c as any).accessorKey !== "empresa") : columns,
  [empresas.length],
)
```
e passe `visibleColumns` em vez de `columns`. Isso evita mexer no `DataTable`.

E para `toolbarLeft`: se não houver suporte, renderize o `<Select>` **fora** do `<DataTable>` no `return`, logo acima dele:
```tsx
return (
  <div className="space-y-3">
    {toolbar}
    <DataTable ... />
  </div>
)
```

- [ ] **Step 3: Atualizar `src/app/(dashboard)/admin/contas-pagar/page.tsx`**

```tsx
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getContasPagar, prefetchNextPage } from "@/lib/queries/contas-pagar";
import { parseEmpresasParam } from "@/lib/empresas";
import { ContasPagarTable } from "./contas-pagar-table";

interface Props {
  searchParams: Promise<{ page?: string; search?: string; pageSize?: string; empresa?: string }>;
}

export default async function ContasPagarPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const page = Number(params.page) || 1;
  const pageSize = Number(params.pageSize) || 50;
  const search = params.search || "";
  const empresas = parseEmpresasParam(params.empresa);

  const { data, total } = await getContasPagar(page, pageSize, search || undefined, empresas);
  if (data.length === pageSize) {
    prefetchNextPage(page, pageSize, search || undefined, empresas);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Contas a Pagar</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gerencie as contas a pagar</p>
      </div>
      <ContasPagarTable
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        search={search}
        empresas={empresas}
      />
    </div>
  );
}
```

- [ ] **Step 4: Atualizar `src/app/(dashboard)/financeiro/contas-pagar/page.tsx`**

```tsx
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getContasPagar, prefetchNextPage } from "@/lib/queries/contas-pagar";
import { parseEmpresasParam } from "@/lib/empresas";
import { ContasPagarTable } from "../../admin/contas-pagar/contas-pagar-table";

interface Props {
  searchParams: Promise<{ page?: string; search?: string; pageSize?: string; empresa?: string }>;
}

export default async function FinanceiroContasPagarPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const page = Number(params.page) || 1;
  const pageSize = Number(params.pageSize) || 50;
  const search = params.search || "";
  const empresas = parseEmpresasParam(params.empresa);

  const { data, total } = await getContasPagar(page, pageSize, search || undefined, empresas);
  if (data.length === pageSize) {
    prefetchNextPage(page, pageSize, search || undefined, empresas);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Contas a Pagar</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gerencie as contas a pagar</p>
      </div>
      <ContasPagarTable
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        search={search}
        empresas={empresas}
      />
    </div>
  );
}
```

- [ ] **Step 5: Lint + build**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 6: Smoke manual da UI**

Run (dev server):
```pwsh
npx portless rigel next dev --turbopack
```

Abra na URL do portless:
- `/admin/contas-pagar` → verifica que carrega, mostra dados (todos = Rigel Fabricante até o sync das novas), e o filtro renderiza com 4 opções.
- `/admin/contas-pagar?empresa=rigel_fabricante` → mostra só Rigel; coluna "Empresa" desaparece.
- `/admin/contas-pagar?empresa=hdslim` → mostra vazio (esperado antes do sync das novas).
- `/financeiro/contas-pagar` → mesmo comportamento.

Pare o dev server com Ctrl+C.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(dashboard\)/admin/contas-pagar/page.tsx \
        src/app/\(dashboard\)/financeiro/contas-pagar/page.tsx \
        src/app/\(dashboard\)/admin/contas-pagar/contas-pagar-table.tsx \
        src/app/\(dashboard\)/admin/contas-pagar/columns.tsx \
        src/components/data-table.tsx
git commit -m "feat(ui): filtro de empresa em /financeiro/contas-pagar e /admin/contas-pagar

Select com opções Todos/Rigel Fabricante/Rigel Medical/HD Slim controlado por
querystring (?empresa=). Coluna Empresa aparece só no modo Todos."
```

(Inclua `data-table.tsx` no commit apenas se você precisou modificá-lo no Step 2.)

---

### Task 10: Rollout em produção

**Files:** (nenhum arquivo do repositório — operações em produção)

- [ ] **Step 1: Pré-condições**

- PR com Tasks 1-9 mergeada em `main`.
- Deploy preview no Vercel passou (`build` + `lint`).
- Migration `0003_contas_pagar_multi_empresa.sql` **ainda não aplicada em produção**.

- [ ] **Step 2: Aplicar migration em produção**

Opções (escolha uma; nenhuma alterada pelo plano):
- Via script local apontando para `DATABASE_URL` de produção:
  ```pwsh
  $env:DATABASE_URL = "<URL_PROD>"
  npx tsx --env-file=.env.production scripts/run-migration.ts supabase/migrations/0003_contas_pagar_multi_empresa.sql
  ```
- Via Supabase SQL Editor: copiar o SQL inteiro do arquivo e executar.

Verifique:
```sql
SELECT empresa, COUNT(*) FROM contas_pagar GROUP BY empresa;
SELECT empresa, COUNT(*) FROM sync_log GROUP BY empresa;
```
Esperado: ambas com `rigel_fabricante` no total que já existia.

- [ ] **Step 3: Adicionar envs novas no Vercel**

Painel Vercel → Settings → Environment Variables (Production + Preview):
- `VHSYS_RIGEL_MEDICAL_ACCESS_TOKEN`
- `VHSYS_RIGEL_MEDICAL_SECRET_ACCESS_TOKEN`
- `VHSYS_HDSLIM_ACCESS_TOKEN`
- `VHSYS_HDSLIM_SECRET_ACCESS_TOKEN`

(Os valores já estão em `.env.local` localmente.)

- [ ] **Step 4: Sync inicial das duas novas empresas**

```pwsh
# substitua $PROD_URL pelo domínio do projeto em produção (ex.: https://rigel.ashmont.app)
# substitua $CRON_SECRET pelo valor do env CRON_SECRET em produção

curl.exe -X POST -H "Authorization: Bearer $CRON_SECRET" `
  "$PROD_URL/api/sync/initial/contas-pagar?empresa=rigel_medical"

curl.exe -X POST -H "Authorization: Bearer $CRON_SECRET" `
  "$PROD_URL/api/sync/initial/contas-pagar?empresa=hdslim"
```

Resposta esperada (cada uma):
```json
{ "success": true, "empresa": "rigel_medical", "synced": 1184, "durationMs": <number> }
{ "success": true, "empresa": "hdslim", "synced": 923, "durationMs": <number> }
```

(Os totais devem bater com o probe — pode haver +/- N se inserções aconteceram entre o probe e o sync.)

- [ ] **Step 5: Conferir no banco**

```sql
SELECT empresa, COUNT(*) FROM contas_pagar WHERE lixeira = 'Nao' GROUP BY empresa ORDER BY empresa;
```
Esperado (com pequena tolerância pelo passar do tempo):
```
hdslim           |  ~923
rigel_fabricante | ~35813
rigel_medical    | ~1184
```

- [ ] **Step 6: Confirmar a UI mostra as 3**

Acesse em produção: `/financeiro/contas-pagar`. Filtre cada uma das 4 opções (Todos, Rigel Fabricante, Rigel Medical, HD Slim) e confirme que:
- "Todos" mostra ~37.920 totais.
- "Rigel Medical" mostra ~1.184.
- "HD Slim" mostra ~923.
- Coluna "Empresa" só aparece no "Todos".

- [ ] **Step 7: Aguardar próximo cron incremental**

Próxima execução do cron `/api/sync/incremental` (a cada 30 min). Após rodar, verifique:
```sql
SELECT empresa, entity, status, last_sync_at
FROM sync_log
ORDER BY last_sync_at DESC
LIMIT 30;
```
Esperado: linhas de `sync_log` com `empresa` em `rigel_fabricante`, `rigel_medical`, `hdslim`.

- [ ] **Step 8: Flush manual do Redis (opcional)**

Para que os filtros mostrem dados frescos imediatamente sem esperar TTL de 1h, dispare `invalidateAllCaches`:
- Mais simples: aguardar — o próximo cron incremental já invalida.
- Opcional: rodar `await redis.flushdb()` via console Upstash, ou disparar manualmente o cron `GET /api/sync/incremental` com `CRON_SECRET`.

- [ ] **Step 9: Documentar conclusão**

Atualizar `CLAUDE.md` na seção "Environment Variables" para listar as duas novas envs (`VHSYS_RIGEL_MEDICAL_*`, `VHSYS_HDSLIM_*`) e mencionar o registry em `src/lib/empresas.ts`.

```bash
git add CLAUDE.md
git commit -m "docs: registrar envs e registry multi-empresa em CLAUDE.md"
```

---

## Self-review checklist

(O autor do plano percorreu o spec após escrever; o engineer pode usar este checklist para confirmar.)

- [x] Coluna `empresa` adicionada em `contas_pagar` + `sync_log` com CHECK constraint (Task 2). PK composta criada (Task 2). Sem mudanças em outras tabelas (decisão "mais mínimo").
- [x] Cliente VHSys multi-tenant (Task 3); todos os call sites passam empresa explicitamente (Tasks 4, 5, 6).
- [x] Sync inicial completo da Rigel Fabricante preservado; nova função para sync inicial só de `contas_pagar` de uma empresa específica (Task 4).
- [x] Sync incremental loop por empresa, contas_pagar para as 3 (Task 5).
- [x] Endpoint manual para rollout (Task 7).
- [x] Query `getContasPagar` aceita `empresas?: EmpresaSlug[]`; ausente/vazio = todas (Task 8).
- [x] Cache keys incluem empresa; `invalidateAllCaches` cobre variações (Task 8).
- [x] UI: filtro `<Select>` + coluna `Empresa` condicional + querystring; nas duas rotas (`/admin/contas-pagar` e `/financeiro/contas-pagar`) (Task 9).
- [x] Webhook intocado funcionalmente, mas upsert para `contas_pagar` injeta `empresa='rigel_fabricante'` (Task 6). Sem regressão.
- [x] `pedido-itens.ts` ganha comentário `TODO multi-empresa` (Task 6). Não funcional.
- [x] Rollout passo a passo com migration → envs → endpoint manual → verificação (Task 10).
- [x] Critérios de aceitação do spec: cobertos pelos passos de verificação ao longo das Tasks 2, 8 (smoke da UI no dev), 10.
