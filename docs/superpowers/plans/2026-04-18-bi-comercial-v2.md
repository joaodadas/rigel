# BI Comercial V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the BI Comercial dashboard to show only B2B data (excluding e-commerce channels), normalize vendor names, rewrite Supabase RPCs with B2B filtering, and implement missing indicators (base ativa, inativos, top 20, regiao map).

**Architecture:** Data flows from Supabase (synced from VHSys) through RPCs and app-side queries, filtered to B2B-only vendors via an inclusion list derived from `METAS_VENDEDORES`. Normalization happens in two layers: SQL (UPPER+TRIM for filtering) and JS (display names). The 950-line dashboard component is decomposed into focused sub-components.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Supabase (PostgreSQL RPCs), Upstash Redis (SWR cache), Recharts, shadcn/ui, Vitest (unit/integration), Playwright (E2E)

**Spec:** `docs/superpowers/specs/2026-04-18-bi-comercial-v2-design.md`

---

## Task 0: Test Infrastructure Setup

**Files:**
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `src/test/setup.ts`
- Modify: `package.json`

- [ ] **Step 1: Install test dependencies**

```bash
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test
```

- [ ] **Step 2: Create Vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 3: Create test setup file**

Create `src/test/setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Create Playwright config**

Create `playwright.config.ts`:

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
  ],
});
```

- [ ] **Step 5: Add test scripts to package.json**

Add to the `"scripts"` section in `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui",
"test:e2e": "playwright test"
```

- [ ] **Step 6: Verify Vitest runs**

```bash
npx vitest run
```

Expected: "No test files found" (success — config works, just no tests yet).

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts playwright.config.ts src/test/setup.ts package.json package-lock.json
git commit -m "chore: add Vitest and Playwright test infrastructure"
```

---

## Task 1: Vendor Name Normalization + B2B Filter

**Files:**
- Create: `src/lib/config/__tests__/vendedores-map.test.ts`
- Modify: `src/lib/config/vendedores-map.ts`
- Modify: `src/lib/config/metas-2026.ts`

- [ ] **Step 1: Write failing tests for normalizeVendedor()**

Create `src/lib/config/__tests__/vendedores-map.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  normalizeVendedor,
  isB2B,
  B2B_VENDEDORES_NORMALIZED,
  getVendasInternasMetaCombinada,
} from "../vendedores-map";

describe("normalizeVendedor", () => {
  it("trims whitespace", () => {
    expect(normalizeVendedor("CLAUDIO ")).toBe("Claudio");
    expect(normalizeVendedor(" EDWILSON ")).toBe("Edwilson");
  });

  it("normalizes VENDAS INTERNAS variants", () => {
    expect(normalizeVendedor("VENDAS INTERNAS")).toBe("Vendas Internas");
    expect(normalizeVendedor("vendas internas")).toBe("Vendas Internas");
    expect(normalizeVendedor("vendas internas ")).toBe("Vendas Internas");
    expect(normalizeVendedor("vendas internos ")).toBe("Vendas Internas");
    expect(normalizeVendedor("vendas onternas")).toBe("Vendas Internas");
    expect(normalizeVendedor("VENDAS INTERNAS ")).toBe("Vendas Internas");
  });

  it("normalizes ANA PAULA RAMOS variants", () => {
    expect(normalizeVendedor("ANA PAULA RAMOS")).toBe("Ana Paula Ramos");
    expect(normalizeVendedor("ANA PAULA RAMOS ")).toBe("Ana Paula Ramos");
  });

  it("normalizes known representantes to title case", () => {
    expect(normalizeVendedor("JOSE ROBERTO")).toBe("Jose Roberto");
    expect(normalizeVendedor("FRANCISCO MOREIRA")).toBe("Francisco Moreira");
    expect(normalizeVendedor("SANTOS MAIA - CARLA")).toBe("Santos Maia - Carla");
    expect(normalizeVendedor("FRANCISCO/SANDY")).toBe("Francisco/Sandy");
    expect(normalizeVendedor("PEDRO SERGIO")).toBe("Pedro Sergio");
    expect(normalizeVendedor("FRANCISCO CWB")).toBe("Francisco CWB");
  });

  it("preserves CGQ as uppercase", () => {
    expect(normalizeVendedor("CGQ")).toBe("CGQ");
  });

  it("returns original trimmed name for unknown vendedores", () => {
    expect(normalizeVendedor("MERCADOFULL")).toBe("MERCADOFULL");
    expect(normalizeVendedor("SHOPEE")).toBe("SHOPEE");
    expect(normalizeVendedor("Fast-martelinho")).toBe("Fast-martelinho");
  });

  it("handles null/empty", () => {
    expect(normalizeVendedor(null)).toBe("Sem vendedor");
    expect(normalizeVendedor("")).toBe("Sem vendedor");
    expect(normalizeVendedor("   ")).toBe("Sem vendedor");
  });
});

describe("isB2B", () => {
  it("returns true for known B2B vendedores", () => {
    expect(isB2B("Vendas Internas")).toBe(true);
    expect(isB2B("Claudio")).toBe(true);
    expect(isB2B("Edwilson")).toBe(true);
    expect(isB2B("Jose Roberto")).toBe(true);
    expect(isB2B("Jessica")).toBe(true);
    expect(isB2B("Kelly")).toBe(true);
  });

  it("returns false for e-commerce channels", () => {
    expect(isB2B("MERCADOFULL")).toBe(false);
    expect(isB2B("SHOPEE")).toBe(false);
    expect(isB2B("MERCADOLIVRE")).toBe(false);
    expect(isB2B("SHEIN")).toBe(false);
    expect(isB2B("SITE RIGEL")).toBe(false);
  });

  it("returns false for unknown vendedores", () => {
    expect(isB2B("Fast-martelinho")).toBe(false);
    expect(isB2B("KATLLYN")).toBe(false);
    expect(isB2B("Sem vendedor")).toBe(false);
  });
});

describe("B2B_VENDEDORES_NORMALIZED", () => {
  it("contains UPPER of all metas vendedores + Vendas Internas", () => {
    expect(B2B_VENDEDORES_NORMALIZED).toContain("VENDAS INTERNAS");
    expect(B2B_VENDEDORES_NORMALIZED).toContain("CLAUDIO");
    expect(B2B_VENDEDORES_NORMALIZED).toContain("EDWILSON");
    expect(B2B_VENDEDORES_NORMALIZED).toContain("JOSE ROBERTO");
    expect(B2B_VENDEDORES_NORMALIZED).toContain("JESSICA");
    expect(B2B_VENDEDORES_NORMALIZED).toContain("FRANCISCO/SANDY");
    expect(B2B_VENDEDORES_NORMALIZED).toContain("SANTOS MAIA - CARLA");
  });

  it("does not contain Aline or Fatima individually (they are Vendas Internas)", () => {
    const hasAline = B2B_VENDEDORES_NORMALIZED.some((v) => v.includes("ALINE"));
    expect(hasAline).toBe(false);
  });
});

describe("getVendasInternasMetaCombinada", () => {
  it("returns sum of Aline + Fatima metas", () => {
    expect(getVendasInternasMetaCombinada()).toBe(3646425);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/config/__tests__/vendedores-map.test.ts
```

Expected: FAIL — functions not exported yet.

- [ ] **Step 3: Implement vendedores-map.ts**

Replace `src/lib/config/vendedores-map.ts`:

```typescript
import { METAS_VENDEDORES } from "./metas-2026";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strips diacritical marks (accents) for matching. */
function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// ---------------------------------------------------------------------------
// Mapping: raw API name → canonical display name
// ---------------------------------------------------------------------------

/**
 * Maps known vendedor name variants (from VHSys) to their canonical form.
 * Keys are LOWERCASE + TRIMMED for matching. Values are display names.
 * Display names are UNACCENTED (matching API convention).
 */
const VENDEDOR_DISPLAY_MAP: Record<string, string> = {
  // Vendas Internas variants
  "vendas internas": "Vendas Internas",
  "vendas internos": "Vendas Internas",
  "vendas onternas": "Vendas Internas",

  // Representantes — API names are UPPERCASE, display is Title Case
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

/** Set of canonical B2B display names for O(1) lookup.
 * Derived from METAS_VENDEDORES via accent-insensitive matching. */
const B2B_SET = new Set<string>();
B2B_SET.add("Vendas Internas");
for (const v of METAS_VENDEDORES) {
  // Strip accents + remove (VI-01) suffix for matching against VENDEDOR_DISPLAY_MAP
  const stripped = stripAccents(v.nome.toLowerCase())
    .replace(/\s*\(vi-\d+\)\s*/g, "")
    .trim();
  const displayName = VENDEDOR_DISPLAY_MAP[stripped];
  if (displayName) B2B_SET.add(displayName);
}

/**
 * UPPER-cased B2B vendedor names for SQL filtering.
 * Passed as p_b2b_vendedores to RPCs.
 * Includes the canonical names that appear in vendedor_pedido / vendedor_cliente
 * after UPPER(TRIM(...)).
 */
export const B2B_VENDEDORES_NORMALIZED: string[] = (() => {
  const set = new Set<string>();
  for (const [lower, display] of Object.entries(VENDEDOR_DISPLAY_MAP)) {
    if (B2B_SET.has(display)) {
      set.add(lower.toUpperCase());
    }
  }
  // Ensure exact DB names are included
  set.add("VENDAS INTERNAS");
  return Array.from(set).sort();
})();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Normalizes a raw vendedor name from the API/DB to its canonical display form.
 * Returns "Sem vendedor" for null/empty/whitespace-only.
 */
export function normalizeVendedor(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) return "Sem vendedor";
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  return VENDEDOR_DISPLAY_MAP[lower] ?? trimmed;
}

/**
 * Returns true if the NORMALIZED (display) vendedor name is a B2B vendedor.
 * Uses inclusion list derived from METAS_VENDEDORES.
 */
export function isB2B(normalizedName: string): boolean {
  return B2B_SET.has(normalizedName);
}

/**
 * Returns combined meta_2026 for Vendas Internas (Aline + Fatima).
 */
export function getVendasInternasMetaCombinada(): number {
  return METAS_VENDEDORES.filter((v) => v.tipo === "vendas_internas").reduce(
    (sum, v) => sum + v.meta_2026,
    0
  );
}

/**
 * Finds the meta_2026 for a normalized (display) vendedor name.
 * For "Vendas Internas", returns combined Aline + Fatima.
 * Uses accent-insensitive matching against METAS_VENDEDORES.
 */
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

// Legacy export for backward compat (used by mapVendedorToMeta in old code)
export const VENDEDOR_MAP = VENDEDOR_DISPLAY_MAP;

export function mapVendedorToMeta(nomeApi: string | null): string | null {
  if (!nomeApi) return null;
  return normalizeVendedor(nomeApi);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/config/__tests__/vendedores-map.test.ts
```

Expected: ALL PASS.

- [ ] **Step 5: Add test for metas calculation**

Create `src/lib/config/__tests__/metas-2026.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  getMetaMensal,
  getMetaAcumulada,
  SAZONALIDADE_POR_MES,
  METAS_VENDEDORES,
  TOTAL_B2B,
} from "../metas-2026";

describe("getMetaMensal", () => {
  it("calculates monthly meta using seasonality", () => {
    // Aline meta_2026 = 3,000,000. Jan seasonality = 7.5%
    const janMeta = getMetaMensal(3000000, 1);
    expect(janMeta).toBe(225000); // 3M * 7.5 / 100
  });

  it("returns 0 for invalid month", () => {
    expect(getMetaMensal(1000000, 13)).toBe(0);
    expect(getMetaMensal(1000000, 0)).toBe(0);
  });
});

describe("getMetaAcumulada", () => {
  it("sums metas from Jan to given month", () => {
    const acum4 = getMetaAcumulada(1000000, 4);
    // 7.5 + 5.1 + 6.7 + 6.8 = 26.1%
    expect(acum4).toBeCloseTo(261000, 0);
  });
});

describe("SAZONALIDADE_POR_MES", () => {
  it("sums to ~100%", () => {
    const total = Object.values(SAZONALIDADE_POR_MES).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(100, 0);
  });
});

describe("METAS_VENDEDORES", () => {
  it("has vendas_internas entries for Aline and Fatima", () => {
    const vi = METAS_VENDEDORES.filter((v) => v.tipo === "vendas_internas");
    expect(vi).toHaveLength(2);
    expect(vi.map((v) => v.nome)).toContain("Aline (VI-01)");
  });

  it("total meta_2026 matches TOTAL_B2B", () => {
    const sum = METAS_VENDEDORES.reduce((s, v) => s + v.meta_2026, 0);
    expect(sum).toBe(TOTAL_B2B.meta_2026);
  });
});
```

- [ ] **Step 6: Run all tests**

```bash
npx vitest run src/lib/config/__tests__/
```

Expected: ALL PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/config/vendedores-map.ts src/lib/config/__tests__/vendedores-map.test.ts src/lib/config/__tests__/metas-2026.test.ts
git commit -m "feat: vendor name normalization + B2B inclusion filter with tests"
```

---

## Task 2: Rewrite Supabase RPCs

**Files:**
- Supabase migrations (applied via MCP)
- Modify: `src/lib/queries/comercial-analytics.ts`
- Modify: `src/lib/redis/client.ts` (add cache keys)

This task rewrites the 3 RPCs in Supabase to accept `p_b2b_vendedores text[]` and filter using `UPPER(TRIM(...))`.

- [ ] **Step 1: Create functional indexes for performance**

Apply via Supabase MCP `apply_migration`:

```sql
CREATE INDEX IF NOT EXISTS idx_pedidos_vendedor_norm
  ON pedidos (UPPER(TRIM(vendedor_pedido)));

CREATE INDEX IF NOT EXISTS idx_clientes_vendedor_norm
  ON clientes (UPPER(TRIM(vendedor_cliente)));
```

- [ ] **Step 2: Rewrite rpc_comercial_kpis**

Apply via Supabase MCP `apply_migration`:

```sql
CREATE OR REPLACE FUNCTION rpc_comercial_kpis(
  p_start_date date,
  p_end_date date,
  p_b2b_vendedores text[] DEFAULT NULL
)
RETURNS TABLE(
  faturamento numeric,
  total_pedidos bigint,
  clientes_ativos bigint,
  base_total bigint
)
LANGUAGE sql STABLE
AS $$
  SELECT
    COALESCE(ped.faturamento, 0) AS faturamento,
    COALESCE(ped.total_pedidos, 0) AS total_pedidos,
    COALESCE(ativos.clientes_ativos, 0) AS clientes_ativos,
    COALESCE(base.base_total, 0) AS base_total
  FROM
    (SELECT
      SUM(valor_total_nota::numeric) AS faturamento,
      COUNT(*) AS total_pedidos
     FROM pedidos
     WHERE status_pedido = 'Atendido'
       AND lixeira = 'Nao'
       AND data_pedido >= p_start_date
       AND data_pedido <= p_end_date
       AND (p_b2b_vendedores IS NULL
            OR UPPER(TRIM(vendedor_pedido)) = ANY(p_b2b_vendedores))
    ) ped,
    (SELECT COUNT(DISTINCT id_cliente) AS clientes_ativos
     FROM pedidos
     WHERE status_pedido = 'Atendido'
       AND lixeira = 'Nao'
       AND data_pedido >= (CURRENT_DATE - INTERVAL '6 months')
       AND (p_b2b_vendedores IS NULL
            OR UPPER(TRIM(vendedor_pedido)) = ANY(p_b2b_vendedores))
    ) ativos,
    (SELECT COUNT(*) AS base_total
     FROM clientes
     WHERE lixeira = 'Nao'
       AND (p_b2b_vendedores IS NULL
            OR UPPER(TRIM(vendedor_cliente)) = ANY(p_b2b_vendedores))
    ) base;
$$;
```

- [ ] **Step 3: Rewrite rpc_clientes_status_vendedor**

Apply via Supabase MCP `apply_migration`:

```sql
CREATE OR REPLACE FUNCTION rpc_clientes_status_vendedor(
  p_b2b_vendedores text[] DEFAULT NULL
)
RETURNS TABLE(
  vendedor text,
  total bigint,
  ativos bigint,
  inativos bigint,
  pct_ativacao numeric
)
LANGUAGE sql STABLE
AS $$
  WITH active_ids AS (
    SELECT DISTINCT id_cliente::text AS id_cliente
    FROM pedidos
    WHERE status_pedido = 'Atendido'
      AND lixeira = 'Nao'
      AND data_pedido >= (CURRENT_DATE - INTERVAL '6 months')
      AND (p_b2b_vendedores IS NULL
           OR UPPER(TRIM(vendedor_pedido)) = ANY(p_b2b_vendedores))
  ),
  grouped AS (
    SELECT
      UPPER(TRIM(COALESCE(NULLIF(TRIM(c.vendedor_cliente), ''), 'SEM VENDEDOR'))) AS vendedor_norm,
      COUNT(*) AS total,
      COUNT(a.id_cliente) AS ativos
    FROM clientes c
    LEFT JOIN active_ids a ON a.id_cliente = c.id_cliente::text
    WHERE c.lixeira = 'Nao'
      AND (p_b2b_vendedores IS NULL
           OR UPPER(TRIM(c.vendedor_cliente)) = ANY(p_b2b_vendedores))
    GROUP BY 1
  )
  SELECT
    vendedor_norm AS vendedor,
    total,
    ativos,
    total - ativos AS inativos,
    CASE WHEN total > 0 THEN ROUND(ativos * 100.0 / total, 1) ELSE 0 END AS pct_ativacao
  FROM grouped
  ORDER BY total DESC;
$$;
```

- [ ] **Step 4: Rewrite rpc_clientes_inativos**

Apply via Supabase MCP `apply_migration`:

```sql
CREATE OR REPLACE FUNCTION rpc_clientes_inativos(
  p_vendedor text DEFAULT NULL,
  p_b2b_vendedores text[] DEFAULT NULL,
  p_limit integer DEFAULT 5000
)
RETURNS TABLE(
  nome text,
  vendedor text,
  ultimo_pedido date,
  valor_ultimo_pedido numeric,
  dias_sem_compra integer,
  cidade text,
  uf text
)
LANGUAGE sql STABLE
AS $$
  WITH last_pedidos AS (
    SELECT DISTINCT ON (p.id_cliente)
      p.id_cliente::text AS id_cliente,
      p.data_pedido::date AS data_pedido,
      p.valor_total_nota::numeric AS valor_total_nota
    FROM pedidos p
    WHERE p.status_pedido = 'Atendido'
      AND p.lixeira = 'Nao'
      AND (p_b2b_vendedores IS NULL
           OR UPPER(TRIM(p.vendedor_pedido)) = ANY(p_b2b_vendedores))
    ORDER BY p.id_cliente, p.data_pedido DESC
  )
  SELECT
    COALESCE(NULLIF(c.fantasia_cliente, ''), c.razao_cliente) AS nome,
    UPPER(TRIM(COALESCE(NULLIF(TRIM(c.vendedor_cliente), ''), 'SEM VENDEDOR'))) AS vendedor,
    lp.data_pedido AS ultimo_pedido,
    COALESCE(lp.valor_total_nota, 0) AS valor_ultimo_pedido,
    CASE
      WHEN lp.data_pedido IS NOT NULL
        THEN (CURRENT_DATE - lp.data_pedido)::integer
      ELSE 9999
    END AS dias_sem_compra,
    c.cidade_cliente AS cidade,
    c.uf_cliente AS uf
  FROM clientes c
  LEFT JOIN last_pedidos lp ON lp.id_cliente = c.id_cliente::text
  WHERE c.lixeira = 'Nao'
    AND (p_b2b_vendedores IS NULL
         OR UPPER(TRIM(c.vendedor_cliente)) = ANY(p_b2b_vendedores))
    AND (p_vendedor IS NULL
         OR UPPER(TRIM(c.vendedor_cliente)) = p_vendedor)
    AND (lp.data_pedido IS NULL OR lp.data_pedido < (CURRENT_DATE - INTERVAL '6 months'))
  ORDER BY dias_sem_compra DESC
  LIMIT p_limit;
$$;
```

- [ ] **Step 5: Add new cache keys to redis client**

In `src/lib/redis/client.ts`, add to the `CACHE_KEYS` object:

```typescript
  // Top 20 clients
  biTop20: (mi: number, mf: number, a: number) => `bi:top20:${mi}:${mf}:${a}`,
  biTop20VI: (mi: number, mf: number, a: number) => `bi:top20vi:${mi}:${mf}:${a}`,

  // Previous month vendedor data (for delta calculation)
  biVendedorPrev: (mi: number, mf: number, a: number) =>
    `bi:vendedor-prev:${mi}:${mf}:${a}`,
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/redis/client.ts
git commit -m "feat: rewrite RPCs with B2B filtering + add cache keys

- rpc_comercial_kpis: accepts p_b2b_vendedores, filters pedidos + clientes
- rpc_clientes_status_vendedor: groups by normalized B2B vendedores only
- rpc_clientes_inativos: adds cidade/uf columns, B2B filter, increased limit
- Functional indexes on UPPER(TRIM(vendedor_*)) for performance
- New cache keys for top 20 and delta calculations"
```

---

## Task 3: Update comercial-analytics.ts Queries

**Files:**
- Modify: `src/lib/queries/comercial-analytics.ts`

This task updates all query functions to pass `B2B_VENDEDORES_NORMALIZED` to RPCs and filter app-side queries.

- [ ] **Step 1: Update imports and add B2B filter helper**

At the top of `src/lib/queries/comercial-analytics.ts`, replace the imports from vendedores-map:

```typescript
import {
  normalizeVendedor,
  isB2B,
  B2B_VENDEDORES_NORMALIZED,
  findMetaAnualByDisplay,
} from "@/lib/config/vendedores-map";
```

Remove the old `findMetaAnual` function and the old import of `mapVendedorToMeta`.

Add a helper to build Supabase OR filter for B2B vendedores:

```typescript
/** All known raw vendedor name variations that are B2B (for Supabase .in() filter). */
const B2B_RAW_VARIATIONS: string[] = (() => {
  // Include UPPER, lower, and known variants with trailing spaces
  const variations = new Set<string>();
  for (const name of B2B_VENDEDORES_NORMALIZED) {
    variations.add(name);
    variations.add(name.toLowerCase());
    // Known trailing-space variants
    variations.add(name.toLowerCase() + " ");
  }
  // Specific typo variants
  variations.add("vendas internos ");
  variations.add("vendas onternas");
  return Array.from(variations);
})();
```

- [ ] **Step 2: Update getComercialKPIs to pass B2B list**

Replace `_fetchComercialKPIs`:

```typescript
async function _fetchComercialKPIs(
  mesInicio: number,
  mesFim: number,
  ano: number
): Promise<ComercialKPIs> {
  const supabase = createSupabaseServer();
  const { start, end } = buildDateRange(mesInicio, mesFim, ano);

  const { data, error } = await supabase.rpc("rpc_comercial_kpis", {
    p_start_date: start,
    p_end_date: end,
    p_b2b_vendedores: B2B_VENDEDORES_NORMALIZED,
  });

  if (error) throw new Error(`rpc_comercial_kpis failed: ${error.message}`);

  const row = Array.isArray(data) ? data[0] : data;
  const faturamentoB2B = Number(row.faturamento) || 0;
  const totalPedidos = Number(row.total_pedidos) || 0;
  const clientesAtivos = Number(row.clientes_ativos) || 0;
  const baseTotal = Number(row.base_total) || 0;

  const ticketMedio = totalPedidos > 0 ? faturamentoB2B / totalPedidos : 0;
  const metaB2BAcumulada = sumMetaAllVendedores(mesInicio, mesFim);
  const pctAtingimento =
    metaB2BAcumulada > 0 ? (faturamentoB2B / metaB2BAcumulada) * 100 : 0;
  const clientesInativos = Math.max(0, baseTotal - clientesAtivos);

  return {
    faturamentoB2B,
    metaB2BAcumulada,
    pctAtingimento,
    ticketMedio,
    totalPedidos,
    clientesAtivos,
    clientesInativos,
    baseTotal,
  };
}
```

- [ ] **Step 3: Update getPedidosPorVendedor to filter B2B + normalize**

Replace `_fetchPedidosPorVendedor`:

```typescript
async function _fetchPedidosPorVendedor(
  mesInicio: number,
  mesFim: number,
  ano: number
): Promise<PedidoVendedor[]> {
  const supabase = createSupabaseServer();
  const { start, end } = buildDateRange(mesInicio, mesFim, ano);

  const rows = await supabaseFetchAll<{
    vendedor_pedido: string;
    valor_total_nota: string;
  }>(
    (from, to) =>
      supabase
        .from("pedidos")
        .select("vendedor_pedido, valor_total_nota")
        .eq("status_pedido", "Atendido")
        .eq("lixeira", "Nao")
        .gte("data_pedido", start)
        .lte("data_pedido", end)
        .in("vendedor_pedido", B2B_RAW_VARIATIONS)
        .range(from, to)
  );

  // Group by NORMALIZED vendedor name
  const groups: Record<string, { total: number; count: number }> = {};
  for (const row of rows) {
    const vendedor = normalizeVendedor(row.vendedor_pedido);
    if (!isB2B(vendedor)) continue; // extra safety
    if (!groups[vendedor]) groups[vendedor] = { total: 0, count: 0 };
    groups[vendedor].total += Number(row.valor_total_nota) || 0;
    groups[vendedor].count += 1;
  }

  const result: PedidoVendedor[] = Object.entries(groups).map(
    ([vendedor, agg]) => {
      const metaAnual = findMetaAnualByDisplay(vendedor);
      let meta = 0;
      for (let m = mesInicio; m <= mesFim; m++) {
        meta += getMetaMensal(metaAnual, m);
      }
      return {
        vendedor,
        valorTotal: agg.total,
        ticketMedio: agg.count > 0 ? agg.total / agg.count : 0,
        qtdPedidos: agg.count,
        meta,
        pctMeta: meta > 0 ? (agg.total / meta) * 100 : 0,
      };
    }
  );

  return result.sort((a, b) => b.valorTotal - a.valorTotal);
}
```

- [ ] **Step 4: Update getPedidosPorRegiao to filter B2B**

In `_fetchPedidosPorRegiao`, add `.in("vendedor_pedido", B2B_RAW_VARIATIONS)` to the pedidos query:

```typescript
    supabaseFetchAll<{ id_cliente: string; valor_total_nota: string }>(
      (from, to) =>
        supabase
          .from("pedidos")
          .select("id_cliente, valor_total_nota")
          .eq("status_pedido", "Atendido")
          .eq("lixeira", "Nao")
          .gte("data_pedido", start)
          .lte("data_pedido", end)
          .in("vendedor_pedido", B2B_RAW_VARIATIONS)
          .range(from, to)
    ),
```

- [ ] **Step 5: Update getClientesAtivosVendedor to pass B2B list**

Replace `_fetchClientesAtivosVendedor`:

```typescript
async function _fetchClientesAtivosVendedor(): Promise<
  ClienteVendedorStatus[]
> {
  const supabase = createSupabaseServer();

  const { data, error } = await supabase.rpc("rpc_clientes_status_vendedor", {
    p_b2b_vendedores: B2B_VENDEDORES_NORMALIZED,
  });

  if (error)
    throw new Error(`rpc_clientes_status_vendedor failed: ${error.message}`);

  const rows = Array.isArray(data) ? data : [];
  return rows.map(
    (r: {
      vendedor: string;
      total: number | string;
      ativos: number | string;
      inativos: number | string;
      pct_ativacao: number | string;
    }) => ({
      vendedor: normalizeVendedor(r.vendedor),
      total: Number(r.total) || 0,
      ativos: Number(r.ativos) || 0,
      inativos: Number(r.inativos) || 0,
      pctAtivacao: Number(r.pct_ativacao) || 0,
    })
  );
}
```

- [ ] **Step 6: Update getClientesInativos to pass B2B list + add cidade/uf**

Update the `ClienteInativo` interface to add cidade/uf:

```typescript
export interface ClienteInativo {
  nome: string;
  vendedor: string;
  ultimoPedido: string | null;
  valorUltimoPedido: number;
  diasSemCompra: number;
  cidade: string;
  uf: string;
}
```

Replace `_fetchClientesInativos`:

```typescript
async function _fetchClientesInativos(
  vendedorFilter?: string
): Promise<ClienteInativo[]> {
  const supabase = createSupabaseServer();

  const { data, error } = await supabase.rpc("rpc_clientes_inativos", {
    p_vendedor: vendedorFilter ? vendedorFilter.toUpperCase().trim() : null,
    p_b2b_vendedores: B2B_VENDEDORES_NORMALIZED,
    p_limit: 5000,
  });

  if (error)
    throw new Error(`rpc_clientes_inativos failed: ${error.message}`);

  const rows = Array.isArray(data) ? data : [];
  return rows.map(
    (r: {
      nome: string;
      vendedor: string;
      ultimo_pedido: string | null;
      valor_ultimo_pedido: number | string;
      dias_sem_compra: number | string;
      cidade: string | null;
      uf: string | null;
    }) => ({
      nome: String(r.nome),
      vendedor: normalizeVendedor(r.vendedor),
      ultimoPedido: r.ultimo_pedido ? String(r.ultimo_pedido) : null,
      valorUltimoPedido: Number(r.valor_ultimo_pedido) || 0,
      diasSemCompra: Number(r.dias_sem_compra) || 0,
      cidade: r.cidade ?? "",
      uf: r.uf ?? "",
    })
  );
}
```

- [ ] **Step 7: Update getProdutosEvolucao to filter B2B**

In `_fetchProdutosEvolucao`, add `.in("vendedor_pedido", B2B_RAW_VARIATIONS)` to the query (same pattern as step 4).

- [ ] **Step 8: Add getTop20Clientes query**

Add at the end of `src/lib/queries/comercial-analytics.ts`:

```typescript
// ---------------------------------------------------------------------------
// 7. getTop20Clientes
// ---------------------------------------------------------------------------

export interface TopCliente {
  posicao: number;
  nome: string;
  vendedor: string;
  valorTotal: number;
  qtdPedidos: number;
  ticketMedio: number;
  uf: string;
}

export async function getTop20Clientes(
  mesInicio: number,
  mesFim: number,
  ano: number,
  apenasVendasInternas: boolean = false
): Promise<TopCliente[]> {
  const key = apenasVendasInternas
    ? CACHE_KEYS.biTop20VI(mesInicio, mesFim, ano)
    : CACHE_KEYS.biTop20(mesInicio, mesFim, ano);
  return cacheGetOrFetchSWR(key, () =>
    _fetchTop20Clientes(mesInicio, mesFim, ano, apenasVendasInternas)
  );
}

async function _fetchTop20Clientes(
  mesInicio: number,
  mesFim: number,
  ano: number,
  apenasVendasInternas: boolean
): Promise<TopCliente[]> {
  const supabase = createSupabaseServer();
  const { start, end } = buildDateRange(mesInicio, mesFim, ano);

  const vendedorFilter = apenasVendasInternas
    ? B2B_RAW_VARIATIONS.filter((v) =>
        normalizeVendedor(v) === "Vendas Internas"
      )
    : B2B_RAW_VARIATIONS;

  const [pedidos, clientes] = await Promise.all([
    supabaseFetchAll<{
      id_cliente: string;
      vendedor_pedido: string;
      valor_total_nota: string;
    }>(
      (from, to) =>
        supabase
          .from("pedidos")
          .select("id_cliente, vendedor_pedido, valor_total_nota")
          .eq("status_pedido", "Atendido")
          .eq("lixeira", "Nao")
          .gte("data_pedido", start)
          .lte("data_pedido", end)
          .in("vendedor_pedido", vendedorFilter)
          .range(from, to)
    ),
    supabaseFetchAll<{
      id_cliente: string;
      fantasia_cliente: string;
      razao_cliente: string;
      vendedor_cliente: string;
      uf_cliente: string;
    }>(
      (from, to) =>
        supabase
          .from("clientes")
          .select(
            "id_cliente, fantasia_cliente, razao_cliente, vendedor_cliente, uf_cliente"
          )
          .eq("lixeira", "Nao")
          .range(from, to)
    ),
  ]);

  // Build client lookup
  const clienteMap = new Map<
    string,
    { nome: string; vendedor: string; uf: string }
  >();
  for (const c of clientes) {
    clienteMap.set(String(c.id_cliente), {
      nome: c.fantasia_cliente?.trim() || c.razao_cliente?.trim() || "N/D",
      vendedor: normalizeVendedor(c.vendedor_cliente),
      uf: c.uf_cliente || "N/D",
    });
  }

  // Aggregate by client
  const groups: Record<string, { total: number; count: number }> = {};
  for (const p of pedidos) {
    const cid = String(p.id_cliente);
    if (!groups[cid]) groups[cid] = { total: 0, count: 0 };
    groups[cid].total += Number(p.valor_total_nota) || 0;
    groups[cid].count += 1;
  }

  const sorted = Object.entries(groups)
    .map(([cid, agg]) => {
      const info = clienteMap.get(cid);
      return {
        cid,
        nome: info?.nome ?? "N/D",
        vendedor: info?.vendedor ?? "Sem vendedor",
        uf: info?.uf ?? "N/D",
        valorTotal: agg.total,
        qtdPedidos: agg.count,
        ticketMedio: agg.count > 0 ? agg.total / agg.count : 0,
      };
    })
    .sort((a, b) => b.valorTotal - a.valorTotal)
    .slice(0, 20);

  return sorted.map((s, i) => ({
    posicao: i + 1,
    nome: s.nome,
    vendedor: s.vendedor,
    valorTotal: s.valorTotal,
    qtdPedidos: s.qtdPedidos,
    ticketMedio: s.ticketMedio,
    uf: s.uf,
  }));
}
```

- [ ] **Step 9: Verify build**

```bash
npm run build
```

Expected: Build succeeds (type errors may surface from the ClienteInativo cidade/uf change — fix in dashboard component by adding `cidade: ""` and `uf: ""` defaults where the type is used).

- [ ] **Step 10: Commit**

```bash
git add src/lib/queries/comercial-analytics.ts
git commit -m "feat: B2B filtering in all comercial queries + top 20 clientes

- All queries filter to B2B vendors only (via inclusion list)
- Vendor names normalized post-fetch for display
- RPCs receive B2B_VENDEDORES_NORMALIZED parameter
- New getTop20Clientes query with general + vendas internas modes
- ClienteInativo now includes cidade/uf fields"
```

---

## Task 4: Dashboard Decomposition + KPI Fix

**Files:**
- Create: `src/app/(dashboard)/comercial/bi/components/bi-filters.tsx`
- Create: `src/app/(dashboard)/comercial/bi/components/kpi-cards-section.tsx`
- Modify: `src/app/(dashboard)/comercial/bi/comercial-dashboard.tsx`
- Modify: `src/app/(dashboard)/comercial/bi/page.tsx`

- [ ] **Step 1: Extract bi-filters.tsx**

Create `src/app/(dashboard)/comercial/bi/components/bi-filters.tsx`:

```typescript
"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MESES = [
  { value: 0, label: "Acumulado" },
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Marco" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

interface BiFiltersProps {
  mes: number; // 0 = acumulado, 1-12 = month
  ano: number;
  vendedorFilter: string;
  vendedores: string[];
  onMesChange: (mes: number) => void;
  onAnoChange: (ano: number) => void;
  onVendedorChange: (vendedor: string) => void;
}

export function BiFilters({
  mes,
  ano,
  vendedorFilter,
  vendedores,
  onMesChange,
  onAnoChange,
  onVendedorChange,
}: BiFiltersProps) {
  // Group vendedores
  const vendasInternas = vendedores.filter((v) => v === "Vendas Internas");
  const representantes = vendedores.filter((v) => v !== "Vendas Internas");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={String(mes)}
        onValueChange={(v) => onMesChange(Number(v))}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Mes" />
        </SelectTrigger>
        <SelectContent align="end">
          {MESES.map((m) => (
            <SelectItem key={m.value} value={String(m.value)}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={String(ano)}
        onValueChange={(v) => onAnoChange(Number(v))}
      >
        <SelectTrigger className="w-[100px]">
          <SelectValue placeholder="Ano" />
        </SelectTrigger>
        <SelectContent align="end">
          {[2025, 2026].map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={vendedorFilter}
        onValueChange={(v) => onVendedorChange(v ?? "todos")}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Vendedor" />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="todos">Todos os vendedores</SelectItem>
          {vendasInternas.length > 0 && (
            <>
              <SelectItem value="__group_vi" disabled className="text-xs font-semibold text-muted-foreground">
                Vendas Internas
              </SelectItem>
              {vendasInternas.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </>
          )}
          {representantes.length > 0 && (
            <>
              <SelectItem value="__group_rep" disabled className="text-xs font-semibold text-muted-foreground">
                Representantes
              </SelectItem>
              {representantes.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

export function getMesLabel(mes: number): string {
  return MESES.find((m) => m.value === mes)?.label ?? String(mes);
}
```

- [ ] **Step 2: Update page.tsx to handle "Acumulado" (mes=0)**

Replace `src/app/(dashboard)/comercial/bi/page.tsx`:

```typescript
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getComercialKPIs,
  getPedidosPorVendedor,
  getPedidosPorRegiao,
  getClientesAtivosVendedor,
  getClientesInativos,
  getProdutosEvolucao,
  getTop20Clientes,
} from "@/lib/queries/comercial-analytics";
import { ComercialDashboard } from "./comercial-dashboard";

interface PageProps {
  searchParams: Promise<{ mes?: string; ano?: string }>;
}

export default async function ComercialBIPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // mes=0 means "Acumulado" (Jan to current month)
  const mesParam = params.mes !== undefined ? Number(params.mes) : 0;
  const mes = mesParam >= 0 && mesParam <= 12 ? mesParam : 0;
  const ano = params.ano ? Number(params.ano) : currentYear;

  // For acumulado: mesInicio=1, mesFim=currentMonth
  // For specific month: mesInicio=mesFim=that month
  const isAcumulado = mes === 0;
  const mesInicio = isAcumulado ? 1 : mes;
  const mesFim = isAcumulado ? currentMonth : mes;

  // Previous month for delta calculation (only when specific month)
  const prevMesInicio = isAcumulado ? null : (mes === 1 ? 12 : mes - 1);
  const prevAno = isAcumulado ? null : (mes === 1 ? ano - 1 : ano);

  const fetchPromises = [
    getComercialKPIs(mesInicio, mesFim, ano),
    getPedidosPorVendedor(mesInicio, mesFim, ano),
    getPedidosPorRegiao(mesInicio, mesFim, ano),
    getClientesAtivosVendedor(),
    getClientesInativos(),
    getProdutosEvolucao(6),
    getTop20Clientes(mesInicio, mesFim, ano, false),
    getTop20Clientes(mesInicio, mesFim, ano, true),
    // Previous month data for delta (null if acumulado)
    prevMesInicio !== null && prevAno !== null
      ? getPedidosPorVendedor(prevMesInicio, prevMesInicio, prevAno)
      : Promise.resolve(null),
  ] as const;

  const [
    kpis,
    pedidosVendedor,
    pedidosRegiao,
    clientesStatus,
    clientesInativos,
    evolucao,
    top20Geral,
    top20VI,
    pedidosVendedorPrev,
  ] = await Promise.all(fetchPromises);

  return (
    <ComercialDashboard
      kpis={kpis}
      pedidosVendedor={pedidosVendedor}
      pedidosVendedorPrev={pedidosVendedorPrev}
      pedidosRegiao={pedidosRegiao}
      clientesStatus={clientesStatus}
      clientesInativos={clientesInativos}
      evolucao={evolucao}
      top20Geral={top20Geral}
      top20VI={top20VI}
      defaultMes={mes}
      defaultAno={ano}
      isAcumulado={isAcumulado}
    />
  );
}
```

- [ ] **Step 3: Update ComercialDashboard props and structure**

Update the `ComercialDashboardProps` interface in `comercial-dashboard.tsx` to add the new props (`pedidosVendedorPrev`, `top20Geral`, `top20VI`, `isAcumulado`). Integrate the `BiFilters` component. Keep the existing indicator sections for now — they will be extracted to sub-components in Tasks 5-10.

The key changes:
- Replace the inline month/year/vendedor selects with `<BiFilters />`
- Update the `navigateToMonth` callback to handle mes=0 (Acumulado)
- Add `top20Geral` and `top20VI` props (render placeholder sections for now)
- Add `pedidosVendedorPrev` prop (used in Task 6 for delta column)

- [ ] **Step 4: Verify build + manually test**

```bash
npm run build
```

Then start dev server and verify the BI page loads with corrected KPI values.

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/comercial/bi/
git commit -m "feat: dashboard decomposition + Acumulado filter + top 20 data flow

- Extract BiFilters component with Acumulado option and grouped vendedores
- Page.tsx handles mes=0 as Acumulado (Jan to current month)
- Parallel fetch of previous month data for delta calculation
- Top 20 geral + vendas internas data passed as props"
```

---

## Task 5: Indicator 1 — Pedidos por Vendedor (evolve)

**Files:**
- Create: `src/app/(dashboard)/comercial/bi/components/pedidos-vendedor-section.tsx`
- Modify: `src/app/(dashboard)/comercial/bi/comercial-dashboard.tsx` (extract section)

- [ ] **Step 1: Create pedidos-vendedor-section.tsx**

This component receives `pedidosVendedor`, `pedidosVendedorPrev`, `isAcumulado`, `vendedorFilter`, and renders:
- Vendas Internas section (if present)
- Top 10 Representantes with bar chart
- "Outros representantes" in a collapsible accordion (using shadcn Collapsible or details/summary)
- Table with columns: Vendedor | Pedidos | Valor (R$) | Ticket Medio | Meta Mes | % Ating. | Delta vs Anterior
- Delta column hidden when `isAcumulado` is true
- CSV export button

Delta calculation: for each vendedor, find matching entry in `pedidosVendedorPrev` by name and compute `((current - prev) / prev) * 100`.

- [ ] **Step 2: Extract section from comercial-dashboard.tsx**

Remove the "Pedidos por Vendedor" Card section from `comercial-dashboard.tsx` and replace with `<PedidosVendedorSection />` receiving the appropriate props.

- [ ] **Step 3: Verify visually**

Start dev server, navigate to BI Comercial, verify:
- Vendas Internas appears as separate section
- Top 10 representantes shown, others collapsed
- Delta column shows when a specific month is selected

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/comercial/bi/
git commit -m "feat: indicator 1 — vendedor sections with delta + accordion"
```

---

## Task 6: Indicator 4 — Lista de Inativos (Raquel priority)

**Files:**
- Create: `src/app/(dashboard)/comercial/bi/components/clientes-inativos-section.tsx`
- Modify: `src/app/(dashboard)/comercial/bi/comercial-dashboard.tsx`

- [ ] **Step 1: Create clientes-inativos-section.tsx**

This component receives `clientesInativos: ClienteInativo[]` and renders:
- Client-side search input (filters by nome)
- Inactivity range filter: buttons "Todos", "6-9 meses", "9-12 meses", "12+ meses"
- Table: Cliente | Vendedor | Ultimo Pedido | Valor | Dias sem Compra | Cidade/UF
- Default sort: dias sem compra DESC
- Client-side pagination (50 per page with prev/next)
- CSV export exports ALL matching records (not just current page)
- No 50-row limit

Filtering logic:
- Search: `nome.toLowerCase().includes(searchTerm.toLowerCase())`
- Inactivity range: filter by `diasSemCompra` (180-270, 270-365, 365+)
- Both filters compose (AND)

- [ ] **Step 2: Extract from comercial-dashboard.tsx**

Remove the inactive clients section and replace with `<ClientesInativosSection />`.

- [ ] **Step 3: Verify**

Start dev server, test:
- Search by name filters the table
- Inactivity range buttons work
- Pagination shows 50 per page
- CSV downloads all matching records

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/comercial/bi/
git commit -m "feat: indicator 4 — full inactive clients list with search, range filter, pagination"
```

---

## Task 7: Indicator 3 — Base Ativa por Vendedor

**Files:**
- Create: `src/app/(dashboard)/comercial/bi/components/base-ativa-section.tsx`
- Modify: `src/app/(dashboard)/comercial/bi/comercial-dashboard.tsx`

- [ ] **Step 1: Create base-ativa-section.tsx**

This component receives `clientesStatus: ClienteVendedorStatus[]` and renders:
- Grid of cards (one per vendedor), sorted by % ativacao ASC (worst first)
- Each card shows: vendedor name, total/ativos/inativos counts, % ativacao
- Progress bar: green portion = % ativos, red = % inativos
- Uses Tailwind for the progress bar (no external library)
- CSV export

Progress bar markup:
```tsx
<div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-red-200 dark:bg-red-900">
  <div
    className="h-full rounded-full bg-emerald-500"
    style={{ width: `${pctAtivacao}%` }}
  />
</div>
```

- [ ] **Step 2: Extract from comercial-dashboard.tsx**

Remove the status-per-vendedor table and summary cards, replace with `<BaseAtivaSection />`.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/comercial/bi/
git commit -m "feat: indicator 3 — base ativa cards with progress bars, worst-first sort"
```

---

## Task 8: Top 20 Clientes

**Files:**
- Create: `src/app/(dashboard)/comercial/bi/components/top-clientes-section.tsx`
- Modify: `src/app/(dashboard)/comercial/bi/comercial-dashboard.tsx`

- [ ] **Step 1: Create top-clientes-section.tsx**

This component receives `top20Geral: TopCliente[]` and `top20VI: TopCliente[]` and renders:
- Two tabs: "Geral" and "Vendas Internas"
- Table: Posicao | Cliente | Vendedor | Valor Total | N Pedidos | Ticket Medio | UF
- CSV export per tab

Use shadcn Tabs if available, or simple button toggle with state.

- [ ] **Step 2: Add to comercial-dashboard.tsx**

Add `<TopClientesSection />` after the KPI cards section.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/comercial/bi/
git commit -m "feat: top 20 clientes — geral + vendas internas tabs"
```

---

## Task 9: Indicator 2 — Regiao (mapa)

**Files:**
- Create: `src/app/(dashboard)/comercial/bi/components/brazil-map.tsx`
- Create: `src/app/(dashboard)/comercial/bi/components/pedidos-regiao-section.tsx`
- Modify: `src/app/(dashboard)/comercial/bi/comercial-dashboard.tsx`

- [ ] **Step 1: Create brazil-map.tsx**

Inline SVG of Brazil with 27 UF paths. Each UF receives a fill color based on its faturamento percentage (heat map). Use a linear scale from light to dark.

The SVG paths for each UF are standard and widely available. The component receives `data: Record<string, number>` mapping UF code to value, and renders with opacity proportional to value/maxValue.

- [ ] **Step 2: Create pedidos-regiao-section.tsx**

This component receives `pedidosRegiao: PedidoRegiao[]` and renders:
- Left: Brazil map (heat by valor)
- Right: Table with UF | N Pedidos | Valor Total | % do Total
- % do Total = `valorTotal / sum(all valorTotal) * 100`
- CSV export

- [ ] **Step 3: Extract from comercial-dashboard.tsx**

Replace the existing region table with `<PedidosRegiaoSection />`.

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/comercial/bi/
git commit -m "feat: indicator 2 — region map + table with % do total"
```

---

## Task 10: Layout Fixes

**Files:**
- Modify: `src/app/(dashboard)/comercial/bi/comercial-dashboard.tsx`

- [ ] **Step 1: Fix bar chart height**

In `pedidos-vendedor-section.tsx`, replace the fixed `height={Math.max(300, barChartData.length * 44)}` with a dynamic calculation:
```tsx
<ResponsiveContainer width="100%" height={Math.max(200, Math.min(barChartData.length * 44, 600))}>
```

This caps the chart height at 600px and starts at 200px minimum.

- [ ] **Step 2: Remove excessive spacing**

In `comercial-dashboard.tsx`, ensure the container uses `space-y-6` (not `space-y-8`) and remove any fixed heights that create blank space.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/comercial/bi/
git commit -m "fix: layout — cap chart heights, reduce section spacing"
```

---

## Task 11: E2E Smoke Test

**Files:**
- Create: `tests/e2e/bi-comercial.spec.ts`

- [ ] **Step 1: Create smoke test**

Create `tests/e2e/bi-comercial.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("BI Comercial", () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.fill('input[type="email"]', process.env.TEST_EMAIL || "admin@rigel.com");
    await page.fill('input[type="password"]', process.env.TEST_PASSWORD || "test1234");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/");
  });

  test("loads BI page with KPI cards", async ({ page }) => {
    await page.goto("/comercial/bi");
    await page.waitForSelector('[data-testid="kpi-card"]', { timeout: 15000 });

    const cards = page.locator('[data-testid="kpi-card"]');
    await expect(cards).toHaveCount(7);

    // Faturamento should not be R$ 0
    const faturamento = cards.nth(0);
    const value = await faturamento.locator(".tabular-nums").textContent();
    expect(value).not.toBe("R$ 0");
  });

  test("month filter changes data", async ({ page }) => {
    await page.goto("/comercial/bi?mes=1&ano=2026");
    await page.waitForSelector('[data-testid="kpi-card"]');

    // Switch to Acumulado
    await page.click('button:has-text("Janeiro")');
    await page.click('text=Acumulado');

    await page.waitForURL("**/mes=0**");
  });

  test("CSV export downloads file", async ({ page }) => {
    await page.goto("/comercial/bi");
    await page.waitForSelector('[data-testid="kpi-card"]');

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click('button:has-text("CSV")'),
    ]);

    expect(download.suggestedFilename()).toContain(".csv");
  });

  test("page renders at tablet viewport", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/comercial/bi");
    await page.waitForSelector('[data-testid="kpi-card"]');

    // No JS errors
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(2000);
    expect(errors).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Add data-testid to KpiCard**

In `src/components/dashboard/kpi-card.tsx`, add `data-testid="kpi-card"` to the root Card element.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/bi-comercial.spec.ts src/components/dashboard/kpi-card.tsx
git commit -m "test: E2E smoke tests for BI Comercial

- Login → load BI → verify KPI cards
- Month filter navigation
- CSV download
- Tablet viewport rendering"
```

---

## Deferred: Tasks for Blocos 9-10 (Indicators 5 & 6)

These require a `pedido_itens` table synced from VHSys. Implementation plan will be written separately after investigating the VHSys `/pedidos/{id}/itens` endpoint feasibility. The current evolution chart (monthly totals) remains functional.
