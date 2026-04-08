# Rigel Phase 2: Data Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the data layer: Supabase schema, VHSys API client, Upstash Redis cache, sync jobs (initial + webhook + cron), and Supabase Realtime subscriptions.

**Architecture:** VHSys API -> sync layer -> Supabase Postgres (heavy data) + Upstash Redis (light data/KPIs). Webhooks from VHSys trigger updates. Supabase Realtime pushes changes to browser. Cron safety net every 30min.

**Tech Stack:** Supabase (Postgres + Realtime), Upstash Redis, VHSys API v2, Next.js API Routes

---

## File Structure

```
src/
├── lib/
│   ├── vhsys/
│   │   ├── client.ts               # VHSys API HTTP client (typed)
│   │   ├── types.ts                # VHSys response types
│   │   └── endpoints.ts            # Endpoint constants & helpers
│   ├── supabase/
│   │   ├── client.ts               # Supabase server client
│   │   ├── client-browser.ts       # Supabase browser client (realtime)
│   │   └── types.ts                # Database types (generated)
│   ├── redis/
│   │   └── client.ts               # Upstash Redis client + helpers
│   └── sync/
│       ├── initial.ts              # Full initial sync job
│       ├── webhook-handler.ts      # Process incoming VHSys webhooks
│       ├── incremental.ts          # Cron-based incremental sync
│       └── cache.ts                # Redis cache invalidation + KPI calc
├── app/
│   └── api/
│       ├── webhooks/
│       │   └── vhsys/
│       │       └── route.ts        # Webhook receiver endpoint
│       └── sync/
│           ├── initial/
│           │   └── route.ts        # Trigger initial sync
│           └── incremental/
│               └── route.ts        # Trigger incremental sync (cron)
supabase/
└── migrations/
    └── 001_create_tables.sql       # All VHSys cache tables
```

---

### Task 1: Create Supabase Schema

**Files:**
- Create: `supabase/migrations/001_create_tables.sql`

- [ ] **Step 1: Write migration SQL**

Create `supabase/migrations/001_create_tables.sql`:

```sql
-- Clientes
CREATE TABLE IF NOT EXISTS clientes (
  id_cliente INTEGER PRIMARY KEY,
  id_registro INTEGER,
  tipo_pessoa TEXT DEFAULT 'PJ',
  tipo_cadastro TEXT DEFAULT 'Cliente',
  cnpj_cliente TEXT,
  razao_cliente TEXT NOT NULL,
  fantasia_cliente TEXT,
  endereco_cliente TEXT,
  numero_cliente TEXT,
  bairro_cliente TEXT,
  cep_cliente TEXT,
  cidade_cliente TEXT,
  cidade_cliente_cod INTEGER,
  uf_cliente TEXT,
  contato_cliente TEXT,
  fone_cliente TEXT,
  celular_cliente TEXT,
  email_cliente TEXT,
  insc_estadual_cliente TEXT,
  situacao_cliente TEXT DEFAULT 'Ativo',
  vendedor_cliente TEXT,
  vendedor_cliente_id INTEGER,
  observacoes_cliente TEXT,
  data_nasc_cliente DATE,
  data_cad_cliente TIMESTAMPTZ,
  data_mod_cliente TIMESTAMPTZ,
  lixeira TEXT DEFAULT 'Nao',
  ultima_atividade TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clientes_razao ON clientes (razao_cliente);
CREATE INDEX idx_clientes_cnpj ON clientes (cnpj_cliente);
CREATE INDEX idx_clientes_situacao ON clientes (situacao_cliente);
CREATE INDEX idx_clientes_mod ON clientes (data_mod_cliente);

-- Pedidos
CREATE TABLE IF NOT EXISTS pedidos (
  id_pedido INTEGER PRIMARY KEY,
  id_ped INTEGER,
  id_cliente INTEGER REFERENCES clientes(id_cliente),
  nome_cliente TEXT,
  vendedor_pedido TEXT,
  vendedor_pedido_id INTEGER,
  valor_total_produtos NUMERIC(14,2),
  desconto_pedido NUMERIC(14,2),
  frete_pedido NUMERIC(14,2),
  valor_total_nota NUMERIC(14,2),
  status_pedido TEXT DEFAULT 'Em Aberto',
  data_pedido DATE,
  obs_pedido TEXT,
  contas_pedido INTEGER DEFAULT 0,
  estoque_pedido INTEGER DEFAULT 0,
  data_cad_pedido TIMESTAMPTZ,
  data_mod_pedido TIMESTAMPTZ,
  lixeira TEXT DEFAULT 'Nao',
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pedidos_cliente ON pedidos (id_cliente);
CREATE INDEX idx_pedidos_status ON pedidos (status_pedido);
CREATE INDEX idx_pedidos_data ON pedidos (data_pedido);
CREATE INDEX idx_pedidos_vendedor ON pedidos (vendedor_pedido_id);
CREATE INDEX idx_pedidos_mod ON pedidos (data_mod_pedido);

-- Produtos
CREATE TABLE IF NOT EXISTS produtos (
  id_produto INTEGER PRIMARY KEY,
  id_categoria INTEGER,
  cod_produto TEXT,
  marca_produto TEXT,
  desc_produto TEXT NOT NULL,
  estoque_produto NUMERIC(14,4),
  unidade_produto TEXT,
  valor_produto NUMERIC(14,6),
  valor_custo_produto NUMERIC(14,6),
  ncm_produto TEXT,
  codigo_barra_produto TEXT,
  status_produto TEXT DEFAULT 'Ativo',
  data_cad_produto TIMESTAMPTZ,
  data_mod_produto TIMESTAMPTZ,
  lixeira TEXT DEFAULT 'Nao',
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_produtos_desc ON produtos (desc_produto);
CREATE INDEX idx_produtos_cod ON produtos (cod_produto);
CREATE INDEX idx_produtos_mod ON produtos (data_mod_produto);

-- Contas a Pagar (Despesas)
CREATE TABLE IF NOT EXISTS contas_pagar (
  id_conta_pag INTEGER PRIMARY KEY,
  nome_conta TEXT NOT NULL,
  id_categoria INTEGER,
  categoria_pag TEXT,
  id_banco INTEGER,
  id_fornecedor INTEGER,
  nome_fornecedor TEXT,
  vencimento_pag DATE,
  valor_pag NUMERIC(14,2),
  valor_pago NUMERIC(14,2),
  liquidado_pag TEXT DEFAULT 'Nao',
  data_pagamento DATE,
  forma_pagamento TEXT,
  data_emissao DATE,
  n_documento_pag TEXT,
  observacoes_pag TEXT,
  id_centro_custos INTEGER,
  centro_custos_pag TEXT,
  data_cad_pag TIMESTAMPTZ,
  data_mod_pag TIMESTAMPTZ,
  lixeira TEXT DEFAULT 'Nao',
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contas_pagar_venc ON contas_pagar (vencimento_pag);
CREATE INDEX idx_contas_pagar_liq ON contas_pagar (liquidado_pag);
CREATE INDEX idx_contas_pagar_mod ON contas_pagar (data_mod_pag);

-- Contas a Receber (Receitas)
CREATE TABLE IF NOT EXISTS contas_receber (
  id_conta_rec INTEGER PRIMARY KEY,
  nome_conta TEXT NOT NULL,
  id_categoria INTEGER,
  categoria_rec TEXT,
  id_banco INTEGER,
  id_cliente INTEGER,
  nome_cliente TEXT,
  vencimento_rec DATE,
  valor_rec NUMERIC(14,2),
  valor_pago NUMERIC(14,2),
  liquidado_rec TEXT DEFAULT 'Nao',
  data_pagamento DATE,
  forma_pagamento TEXT,
  tipo_conta TEXT,
  data_emissao DATE,
  n_documento_rec TEXT,
  observacoes_rec TEXT,
  id_centro_custos INTEGER,
  centro_custos_rec TEXT,
  data_cad_rec TIMESTAMPTZ,
  data_mod_rec TIMESTAMPTZ,
  lixeira TEXT DEFAULT 'Nao',
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contas_receber_venc ON contas_receber (vencimento_rec);
CREATE INDEX idx_contas_receber_liq ON contas_receber (liquidado_rec);
CREATE INDEX idx_contas_receber_mod ON contas_receber (data_mod_rec);

-- Orcamentos
CREATE TABLE IF NOT EXISTS orcamentos (
  id_orcamento INTEGER PRIMARY KEY,
  id_pedido INTEGER,
  id_cliente INTEGER REFERENCES clientes(id_cliente),
  nome_cliente TEXT,
  vendedor_pedido TEXT,
  vendedor_pedido_id INTEGER,
  valor_total_nota NUMERIC(14,2),
  desconto_pedido NUMERIC(14,2),
  status_pedido TEXT DEFAULT 'Em Aberto',
  data_pedido DATE,
  validade_orcamento DATE,
  obs_pedido TEXT,
  data_cad_pedido TIMESTAMPTZ,
  data_mod_pedido TIMESTAMPTZ,
  lixeira TEXT DEFAULT 'Nao',
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orcamentos_cliente ON orcamentos (id_cliente);
CREATE INDEX idx_orcamentos_status ON orcamentos (status_pedido);
CREATE INDEX idx_orcamentos_mod ON orcamentos (data_mod_pedido);

-- Notas Fiscais (NF-e)
CREATE TABLE IF NOT EXISTS notas_fiscais (
  id_venda INTEGER PRIMARY KEY,
  serie_nota INTEGER,
  id_pedido INTEGER,
  id_cliente INTEGER REFERENCES clientes(id_cliente),
  nome_cliente TEXT,
  vendedor_pedido TEXT,
  vendedor_pedido_id INTEGER,
  valor_total_nota NUMERIC(14,2),
  status_pedido TEXT,
  nota_emitida TEXT,
  nota_chave TEXT,
  nota_protocolo TEXT,
  ambiente INTEGER,
  data_pedido DATE,
  data_cad_pedido TIMESTAMPTZ,
  data_mod_pedido TIMESTAMPTZ,
  lixeira TEXT DEFAULT 'Nao',
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_nfe_cliente ON notas_fiscais (id_cliente);
CREATE INDEX idx_nfe_status ON notas_fiscais (status_pedido);
CREATE INDEX idx_nfe_mod ON notas_fiscais (data_mod_pedido);

-- Extratos
CREATE TABLE IF NOT EXISTS extratos (
  id SERIAL PRIMARY KEY,
  id_banco INTEGER,
  nome_conta TEXT,
  tipo_fluxo TEXT,
  valor_fluxo NUMERIC(14,2),
  data_fluxo DATE,
  data_emissao DATE,
  observacoes_fluxo TEXT,
  categoria_fluxo TEXT,
  forma_pagamento TEXT,
  data_cad_fluxo TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendedores
CREATE TABLE IF NOT EXISTS vendedores (
  id_vendedor INTEGER PRIMARY KEY,
  razao_vendedor TEXT NOT NULL,
  tipo_pessoa TEXT DEFAULT 'PF',
  cnpj_vendedor TEXT,
  fantasia_vendedor TEXT,
  cidade_vendedor TEXT,
  uf_vendedor TEXT,
  fone_vendedor TEXT,
  email_vendedor TEXT,
  situacao_vendedor TEXT DEFAULT 'Ativo',
  comissao_usuario NUMERIC(8,2),
  data_cad_vendedor TIMESTAMPTZ,
  data_mod_vendedor TIMESTAMPTZ,
  lixeira TEXT DEFAULT 'Nao',
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vendedores_situacao ON vendedores (situacao_vendedor);

-- Sync Log
CREATE TABLE IF NOT EXISTS sync_log (
  id SERIAL PRIMARY KEY,
  entity TEXT NOT NULL,
  last_sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_modified_at TIMESTAMPTZ,
  records_synced INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success',
  error_message TEXT,
  duration_ms INTEGER
);

CREATE INDEX idx_sync_log_entity ON sync_log (entity);

-- Enable Realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE clientes;
ALTER PUBLICATION supabase_realtime ADD TABLE pedidos;
ALTER PUBLICATION supabase_realtime ADD TABLE contas_pagar;
ALTER PUBLICATION supabase_realtime ADD TABLE contas_receber;
ALTER PUBLICATION supabase_realtime ADD TABLE notas_fiscais;
ALTER PUBLICATION supabase_realtime ADD TABLE vendedores;
ALTER PUBLICATION supabase_realtime ADD TABLE produtos;
```

- [ ] **Step 2: Apply migration in Supabase**

Run this SQL in the Supabase SQL Editor (Dashboard > SQL Editor > New Query).

Expected: All tables created, indexes applied, realtime enabled.

- [ ] **Step 3: Commit**

```bash
git add supabase/
git commit -m "feat: create Supabase schema for VHSys data cache"
```

---

### Task 2: VHSys API Client

**Files:**
- Create: `src/lib/vhsys/types.ts`
- Create: `src/lib/vhsys/endpoints.ts`
- Create: `src/lib/vhsys/client.ts`

- [ ] **Step 1: Create VHSys types**

Create `src/lib/vhsys/types.ts`:

```typescript
export interface VHSysResponse<T> {
  code: number;
  status: string;
  data: T;
  paging?: {
    total_count: number;
    total: number;
    offset: number;
    limit: number;
    limit_max: number;
  };
}

export interface VHSysCliente {
  id_cliente: number;
  id_registro: number;
  tipo_pessoa: string;
  tipo_cadastro: string;
  cnpj_cliente: string | null;
  razao_cliente: string;
  fantasia_cliente: string | null;
  endereco_cliente: string | null;
  numero_cliente: string | null;
  bairro_cliente: string | null;
  cep_cliente: string | null;
  cidade_cliente: string | null;
  cidade_cliente_cod: number | null;
  uf_cliente: string | null;
  contato_cliente: string | null;
  fone_cliente: string | null;
  celular_cliente: string | null;
  email_cliente: string | null;
  insc_estadual_cliente: string | null;
  situacao_cliente: string;
  vendedor_cliente: string | null;
  vendedor_cliente_id: number | null;
  observacoes_cliente: string | null;
  data_nasc_cliente: string | null;
  data_cad_cliente: string;
  data_mod_cliente: string;
  lixeira: string;
}

export interface VHSysPedido {
  id_pedido: number;
  id_ped: number;
  id_cliente: number;
  nome_cliente: string;
  vendedor_pedido: string | null;
  vendedor_pedido_id: number | null;
  valor_total_produtos: string | null;
  desconto_pedido: string | null;
  frete_pedido: string | null;
  valor_total_nota: string | null;
  status_pedido: string;
  data_pedido: string | null;
  obs_pedido: string | null;
  contas_pedido: number;
  estoque_pedido: number;
  data_cad_pedido: string;
  data_mod_pedido: string;
  lixeira: string;
}

export interface VHSysProduto {
  id_produto: number;
  id_categoria: number | null;
  cod_produto: string | null;
  marca_produto: string | null;
  desc_produto: string;
  estoque_produto: string | null;
  unidade_produto: string | null;
  valor_produto: string | null;
  valor_custo_produto: string | null;
  ncm_produto: string | null;
  codigo_barra_produto: string | null;
  status_produto: string;
  data_cad_produto: string;
  data_mod_produto: string;
  lixeira: string;
}

export interface VHSysContaPagar {
  id_conta_pag: number;
  nome_conta: string;
  id_categoria: number | null;
  categoria_pag: string | null;
  id_banco: number | null;
  id_fornecedor: number | null;
  nome_fornecedor: string | null;
  vencimento_pag: string;
  valor_pag: string;
  valor_pago: string | null;
  liquidado_pag: string;
  data_pagamento: string | null;
  forma_pagamento: string | null;
  data_emissao: string | null;
  n_documento_pag: string | null;
  observacoes_pag: string | null;
  id_centro_custos: number | null;
  centro_custos_pag: string | null;
  data_cad_pag: string;
  data_mod_pag: string;
  lixeira: string;
}

export interface VHSysContaReceber {
  id_conta_rec: number;
  nome_conta: string;
  id_categoria: number | null;
  categoria_rec: string | null;
  id_banco: number | null;
  id_cliente: number | null;
  nome_cliente: string | null;
  vencimento_rec: string;
  valor_rec: string;
  valor_pago: string | null;
  liquidado_rec: string;
  data_pagamento: string | null;
  forma_pagamento: string | null;
  tipo_conta: string | null;
  data_emissao: string | null;
  n_documento_rec: string | null;
  observacoes_rec: string | null;
  id_centro_custos: number | null;
  centro_custos_rec: string | null;
  data_cad_rec: string;
  data_mod_rec: string;
  lixeira: string;
}

export interface VHSysVendedor {
  id_vendedor: number;
  razao_vendedor: string;
  tipo_pessoa: string;
  cnpj_vendedor: string | null;
  fantasia_vendedor: string | null;
  cidade_vendedor: string | null;
  uf_vendedor: string | null;
  fone_vendedor: string | null;
  email_vendedor: string | null;
  situacao_vendedor: string;
  comissao_usuario: number | null;
  data_cad_vendedor: string;
  data_mod_vendedor: string;
  lixeira: string;
}
```

- [ ] **Step 2: Create endpoints constants**

Create `src/lib/vhsys/endpoints.ts`:

```typescript
export const VHSYS_BASE_URL = "https://api.vhsys.com.br/v2";

export const ENDPOINTS = {
  clientes: "/clientes",
  pedidos: "/pedidos",
  produtos: "/produtos",
  contasPagar: "/contas-pagar",
  contasReceber: "/contas-receber",
  notasFiscais: "/notas-fiscais",
  orcamentos: "/orcamentos",
  extratos: "/extratos",
  vendedores: "/vendedores",
  contasBancarias: "/contas-bancarias",
  centrosCusto: "/centros-custo",
  categoriasFinanceiras: "/categorias-financeiras",
  webhooks: "/webhooks",
} as const;

export const MAX_PAGE_SIZE = 250;
```

- [ ] **Step 3: Create VHSys HTTP client**

Create `src/lib/vhsys/client.ts`:

```typescript
import { VHSYS_BASE_URL, MAX_PAGE_SIZE } from "./endpoints";
import type { VHSysResponse } from "./types";

function getHeaders(): HeadersInit {
  return {
    "access-token": process.env.VHSYS_ACCESS_TOKEN!,
    "secret-access-token": process.env.VHSYS_SECRET_ACCESS_TOKEN!,
    "Content-Type": "application/json",
    "User-Agent": "Rigel/1.0",
    "Cache-Control": "no-cache",
  };
}

export async function vhsysGet<T>(
  endpoint: string,
  params?: Record<string, string>
): Promise<VHSysResponse<T>> {
  const url = new URL(`${VHSYS_BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: getHeaders(),
  });

  if (!res.ok) {
    throw new Error(`VHSys GET ${endpoint} failed: ${res.status}`);
  }

  return res.json();
}

export async function vhsysPost<T>(
  endpoint: string,
  body: Record<string, unknown>
): Promise<VHSysResponse<T>> {
  const res = await fetch(`${VHSYS_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`VHSys POST ${endpoint} failed: ${res.status}`);
  }

  return res.json();
}

export async function vhsysPut<T>(
  endpoint: string,
  body: Record<string, unknown>
): Promise<VHSysResponse<T>> {
  const res = await fetch(`${VHSYS_BASE_URL}${endpoint}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`VHSys PUT ${endpoint} failed: ${res.status}`);
  }

  return res.json();
}

export async function vhsysDelete<T>(
  endpoint: string
): Promise<VHSysResponse<T>> {
  const res = await fetch(`${VHSYS_BASE_URL}${endpoint}`, {
    method: "DELETE",
    headers: getHeaders(),
  });

  if (!res.ok) {
    throw new Error(`VHSys DELETE ${endpoint} failed: ${res.status}`);
  }

  return res.json();
}

export async function vhsysFetchAll<T>(
  endpoint: string,
  extraParams?: Record<string, string>
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const params: Record<string, string> = {
      limit: String(MAX_PAGE_SIZE),
      offset: String(offset),
      lixeira: "Nao",
      ...extraParams,
    };

    const res = await vhsysGet<T[]>(endpoint, params);

    if (res.paging) {
      total = res.paging.total;
    }

    const items = Array.isArray(res.data) ? res.data : [res.data];
    all.push(...items);
    offset += MAX_PAGE_SIZE;

    // Rate limiting: small delay between pages
    if (offset < total) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return all;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/vhsys/
git commit -m "feat: create typed VHSys API client with pagination support"
```

---

### Task 3: Supabase Client Setup

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/client-browser.ts`

- [ ] **Step 1: Install Supabase client**

```bash
npm install @supabase/supabase-js
```

- [ ] **Step 2: Create server client**

Create `src/lib/supabase/client.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

export function createSupabaseServer() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

- [ ] **Step 3: Create browser client (for Realtime)**

Create `src/lib/supabase/client-browser.ts`:

```typescript
"use client";

import { createClient } from "@supabase/supabase-js";

let client: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowser() {
  if (client) return client;

  client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return client;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/
git commit -m "feat: create Supabase server and browser clients"
```

---

### Task 4: Upstash Redis Client

**Files:**
- Create: `src/lib/redis/client.ts`

- [ ] **Step 1: Install Upstash Redis**

```bash
npm install @upstash/redis
```

- [ ] **Step 2: Create Redis client with helpers**

Create `src/lib/redis/client.ts`:

```typescript
import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const DEFAULT_TTL = 60 * 60 * 24; // 24 hours

export async function cacheGet<T>(key: string): Promise<T | null> {
  return redis.get<T>(key);
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttl: number = DEFAULT_TTL
): Promise<void> {
  await redis.set(key, value, { ex: ttl });
}

export async function cacheDelete(key: string): Promise<void> {
  await redis.del(key);
}

export async function cacheGetOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = DEFAULT_TTL
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;

  const fresh = await fetcher();
  await cacheSet(key, fresh, ttl);
  return fresh;
}

// KPI cache keys
export const CACHE_KEYS = {
  kpiAdmin: "kpi:admin",
  kpiComercial: "kpi:comercial",
  kpiFinanceiro: "kpi:financeiro",
  kpiRh: "kpi:rh",
  vendedoresAtivos: "cache:vendedores-ativos",
  categoriasFinanceiras: "cache:categorias-financeiras",
  centrosCusto: "cache:centros-custo",
  contasBancarias: "cache:contas-bancarias",
  categoriasProduto: "cache:categorias-produto",
  transportadoras: "cache:transportadoras",
} as const;

export async function invalidateKPIs(): Promise<void> {
  await Promise.all([
    cacheDelete(CACHE_KEYS.kpiAdmin),
    cacheDelete(CACHE_KEYS.kpiComercial),
    cacheDelete(CACHE_KEYS.kpiFinanceiro),
    cacheDelete(CACHE_KEYS.kpiRh),
  ]);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/redis/
git commit -m "feat: create Upstash Redis client with cache helpers and KPI keys"
```

---

### Task 5: Initial Sync Job

**Files:**
- Create: `src/lib/sync/initial.ts`
- Create: `src/app/api/sync/initial/route.ts`

- [ ] **Step 1: Create initial sync logic**

Create `src/lib/sync/initial.ts`:

```typescript
import { createSupabaseServer } from "@/lib/supabase/client";
import { vhsysFetchAll } from "@/lib/vhsys/client";
import { ENDPOINTS } from "@/lib/vhsys/endpoints";
import { cacheSet, CACHE_KEYS } from "@/lib/redis/client";
import type {
  VHSysCliente,
  VHSysPedido,
  VHSysProduto,
  VHSysContaPagar,
  VHSysContaReceber,
  VHSysVendedor,
} from "@/lib/vhsys/types";

async function syncEntity<T extends Record<string, unknown>>(
  supabase: ReturnType<typeof createSupabaseServer>,
  entity: string,
  endpoint: string,
  primaryKey: string
) {
  const start = Date.now();
  console.log(`[sync] Starting ${entity}...`);

  const items = await vhsysFetchAll<T>(endpoint);
  console.log(`[sync] Fetched ${items.length} ${entity}`);

  // Upsert in batches of 500
  const BATCH_SIZE = 500;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE).map((item) => ({
      ...item,
      synced_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from(entity)
      .upsert(batch, { onConflict: primaryKey });

    if (error) {
      console.error(`[sync] Error upserting ${entity} batch ${i}:`, error);
      throw error;
    }
  }

  const duration = Date.now() - start;
  console.log(`[sync] ${entity} done: ${items.length} records in ${duration}ms`);

  // Log sync
  await supabase.from("sync_log").insert({
    entity,
    records_synced: items.length,
    status: "success",
    duration_ms: duration,
  });

  return items.length;
}

export async function runInitialSync() {
  const supabase = createSupabaseServer();
  const results: Record<string, number> = {};

  // Sync in order: entities without FK first
  results.vendedores = await syncEntity<VHSysVendedor>(
    supabase, "vendedores", ENDPOINTS.vendedores, "id_vendedor"
  );

  results.clientes = await syncEntity<VHSysCliente>(
    supabase, "clientes", ENDPOINTS.clientes, "id_cliente"
  );

  results.produtos = await syncEntity<VHSysProduto>(
    supabase, "produtos", ENDPOINTS.produtos, "id_produto"
  );

  results.pedidos = await syncEntity<VHSysPedido>(
    supabase, "pedidos", ENDPOINTS.pedidos, "id_pedido"
  );

  results.contas_pagar = await syncEntity<VHSysContaPagar>(
    supabase, "contas_pagar", ENDPOINTS.contasPagar, "id_conta_pag"
  );

  results.contas_receber = await syncEntity<VHSysContaReceber>(
    supabase, "contas_receber", ENDPOINTS.contasReceber, "id_conta_rec"
  );

  // Cache light data in Redis
  const vendedoresAtivos = (
    await vhsysFetchAll<VHSysVendedor>(ENDPOINTS.vendedores)
  ).filter((v) => v.situacao_vendedor === "Ativo");

  await cacheSet(CACHE_KEYS.vendedoresAtivos, vendedoresAtivos);

  return results;
}
```

- [ ] **Step 2: Create API route to trigger sync**

Create `src/app/api/sync/initial/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { runInitialSync } from "@/lib/sync/initial";

export const maxDuration = 300; // 5 minutes for Vercel

export async function POST() {
  try {
    const results = await runInitialSync();
    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("[sync] Initial sync failed:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Test initial sync (start small)**

Run with dev server running:
```bash
curl -X POST http://localhost:3000/api/sync/initial
```

Expected: JSON response with record counts per entity. May take several minutes for 264k+ records.

- [ ] **Step 4: Commit**

```bash
git add src/lib/sync/initial.ts src/app/api/sync/
git commit -m "feat: create initial sync job (VHSys -> Supabase)"
```

---

### Task 6: Webhook Receiver

**Files:**
- Create: `src/lib/sync/webhook-handler.ts`
- Create: `src/app/api/webhooks/vhsys/route.ts`

- [ ] **Step 1: Create webhook handler logic**

Create `src/lib/sync/webhook-handler.ts`:

```typescript
import { createSupabaseServer } from "@/lib/supabase/client";
import { invalidateKPIs } from "@/lib/redis/client";

type WebhookEvent = {
  event: string;
  data: Record<string, unknown>;
};

const ENTITY_MAP: Record<string, { table: string; pk: string }> = {
  clientes: { table: "clientes", pk: "id_cliente" },
  pedidos: { table: "pedidos", pk: "id_pedido" },
  produtos: { table: "produtos", pk: "id_produto" },
  "contas-pagar": { table: "contas_pagar", pk: "id_conta_pag" },
  "contas-receber": { table: "contas_receber", pk: "id_conta_rec" },
  "notas-fiscais": { table: "notas_fiscais", pk: "id_venda" },
  orcamentos: { table: "orcamentos", pk: "id_orcamento" },
  vendedores: { table: "vendedores", pk: "id_vendedor" },
};

export async function handleVHSysWebhook(payload: WebhookEvent) {
  const supabase = createSupabaseServer();

  // Extract entity from event name (e.g., "clientes.create" -> "clientes")
  const [entityKey, action] = payload.event.split(".");
  const mapping = ENTITY_MAP[entityKey];

  if (!mapping) {
    console.warn(`[webhook] Unknown entity: ${entityKey}`);
    return { handled: false };
  }

  const record = {
    ...payload.data,
    synced_at: new Date().toISOString(),
  };

  if (action === "delete") {
    const pkValue = payload.data[mapping.pk];
    const { error } = await supabase
      .from(mapping.table)
      .update({ lixeira: "Sim", synced_at: new Date().toISOString() })
      .eq(mapping.pk, pkValue);

    if (error) throw error;
  } else {
    const { error } = await supabase
      .from(mapping.table)
      .upsert(record, { onConflict: mapping.pk });

    if (error) throw error;
  }

  // Update ultima_atividade for client if pedido/orcamento/nfe changed
  if (["pedidos", "orcamentos", "notas-fiscais"].includes(entityKey)) {
    const clientId = payload.data.id_cliente as number;
    if (clientId) {
      await supabase
        .from("clientes")
        .update({ ultima_atividade: new Date().toISOString() })
        .eq("id_cliente", clientId);
    }
  }

  // Invalidate KPI caches
  await invalidateKPIs();

  return { handled: true, entity: entityKey, action };
}
```

- [ ] **Step 2: Create webhook API route**

Create `src/app/api/webhooks/vhsys/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { handleVHSysWebhook } from "@/lib/sync/webhook-handler";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    console.log("[webhook] Received:", JSON.stringify(payload).slice(0, 200));

    const result = await handleVHSysWebhook(payload);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[webhook] Error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/sync/webhook-handler.ts src/app/api/webhooks/
git commit -m "feat: create VHSys webhook receiver with Supabase upsert and Redis invalidation"
```

---

### Task 7: Incremental Sync (Cron Safety Net)

**Files:**
- Create: `src/lib/sync/incremental.ts`
- Create: `src/app/api/sync/incremental/route.ts`

- [ ] **Step 1: Create incremental sync logic**

Create `src/lib/sync/incremental.ts`:

```typescript
import { createSupabaseServer } from "@/lib/supabase/client";
import { vhsysGet } from "@/lib/vhsys/client";
import { ENDPOINTS, MAX_PAGE_SIZE } from "@/lib/vhsys/endpoints";
import { invalidateKPIs } from "@/lib/redis/client";
import type { VHSysResponse } from "@/lib/vhsys/types";

interface SyncTarget {
  entity: string;
  endpoint: string;
  pk: string;
}

const TARGETS: SyncTarget[] = [
  { entity: "clientes", endpoint: ENDPOINTS.clientes, pk: "id_cliente" },
  { entity: "pedidos", endpoint: ENDPOINTS.pedidos, pk: "id_pedido" },
  { entity: "produtos", endpoint: ENDPOINTS.produtos, pk: "id_produto" },
  { entity: "contas_pagar", endpoint: ENDPOINTS.contasPagar, pk: "id_conta_pag" },
  { entity: "contas_receber", endpoint: ENDPOINTS.contasReceber, pk: "id_conta_rec" },
  { entity: "vendedores", endpoint: ENDPOINTS.vendedores, pk: "id_vendedor" },
];

export async function runIncrementalSync() {
  const supabase = createSupabaseServer();
  const results: Record<string, number> = {};

  for (const target of TARGETS) {
    const start = Date.now();

    // Get last sync time for this entity
    const { data: lastSync } = await supabase
      .from("sync_log")
      .select("last_sync_at")
      .eq("entity", target.entity)
      .eq("status", "success")
      .order("last_sync_at", { ascending: false })
      .limit(1)
      .single();

    const since = lastSync?.last_sync_at
      ? new Date(lastSync.last_sync_at).toISOString().replace("T", " ").slice(0, 19)
      : undefined;

    // Fetch modified records since last sync
    const params: Record<string, string> = {
      limit: String(MAX_PAGE_SIZE),
      offset: "0",
    };

    if (since) {
      params.data_modificacao = since;
    }

    const res = await vhsysGet<Record<string, unknown>[]>(
      target.endpoint,
      params
    );

    const items = Array.isArray(res.data) ? res.data : [];

    if (items.length > 0) {
      const records = items.map((item) => ({
        ...item,
        synced_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from(target.entity)
        .upsert(records, { onConflict: target.pk });

      if (error) {
        console.error(`[incremental] Error syncing ${target.entity}:`, error);
      }
    }

    const duration = Date.now() - start;
    results[target.entity] = items.length;

    await supabase.from("sync_log").insert({
      entity: target.entity,
      records_synced: items.length,
      status: "success",
      duration_ms: duration,
      last_modified_at: since || null,
    });
  }

  // Invalidate KPIs after sync
  await invalidateKPIs();

  return results;
}
```

- [ ] **Step 2: Create API route for cron**

Create `src/app/api/sync/incremental/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { runIncrementalSync } from "@/lib/sync/incremental";

export const maxDuration = 60;

export async function GET() {
  try {
    const results = await runIncrementalSync();
    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("[sync] Incremental sync failed:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Add Vercel cron config**

Add to `vercel.json` (create if not exists):

```json
{
  "crons": [
    {
      "path": "/api/sync/incremental",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

- [ ] **Step 4: Test incremental sync**

```bash
curl http://localhost:3000/api/sync/incremental
```

Expected: JSON with record counts (should be 0 or small if initial sync just ran).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync/incremental.ts src/app/api/sync/incremental/ vercel.json
git commit -m "feat: create incremental sync with cron safety net (every 30min)"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Verify all clients are configured**

```bash
npm run dev
```

Check console for no import errors.

- [ ] **Step 2: Test VHSys client**

```bash
curl http://localhost:3000/api/sync/initial -X POST
```

Monitor logs for sync progress.

- [ ] **Step 3: Verify Supabase has data**

Check Supabase dashboard: Table Editor > clientes, pedidos, etc. should have rows.

- [ ] **Step 4: Verify Redis is caching**

Check Upstash dashboard: Data Browser > should see `cache:vendedores-ativos` key.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete Phase 2 - data infrastructure (VHSys sync, Supabase, Redis)"
```
