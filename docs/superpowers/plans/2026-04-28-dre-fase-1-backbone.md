# DRE Executivo — Fase 1 (Backbone) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a fundação do DRE Executivo: schema no Supabase, parser da planilha `.xlsx`, endpoint de upload `POST /api/dre/upload`, queries de leitura, item no sidebar e página placeholder. Ao final desta fase, o usuário deve conseguir subir a planilha real e ver os ~225 registros/mês persistidos no Supabase com totais conferidos.

**Architecture:** Página `/admin/dre` (Server Component, role=admin). Upload via multipart → Supabase Storage (bucket privado `dre-uploads`) + parser síncrono no backend (xlsx/SheetJS) → DELETE+INSERT por mês detectado em `dre_lancamentos`, registrando metadados em `dre_uploads`. Leitura via `src/lib/queries/dre.ts` direta do Supabase (sem Redis, sem REST de leitura).

**Tech Stack:** Next.js 15 (App Router, Server Components), Supabase (PostgREST + Storage), Better-Auth (sessão + RBAC), `xlsx` (SheetJS) para parsing, `tsx` para script de teste do parser.

**Spec:** `docs/superpowers/specs/2026-04-28-dre-controladoria-design.md`

**Pré-requisito manual (fora do plano):** Planilha de referência em `C:\Users\misae\Documents\Dev\Ashmont\Rigel\files\DRE 2026 Rigel.xlsx`.

---

## File Structure

| Caminho | Responsabilidade |
|---|---|
| `supabase/migrations/0001_dre_init.sql` | DDL para `dre_lancamentos`, `dre_uploads`, índices |
| `src/lib/dre/empresas.ts` | Constantes: codes, regimes, mapa de colunas (B/C, D/E…) |
| `src/lib/dre/linhas.ts` | Mapa de linhas L10–L85 → categoria/sub/descricao |
| `src/lib/dre/parser.ts` | `parseDRE(buffer)` → meses, lançamentos, warnings |
| `src/lib/queries/dre.ts` | Server fetchers (sem Redis): `getMesesDisponiveis`, `getLancamentos` |
| `src/app/api/dre/upload/route.ts` | `POST` multipart: auth → storage → parser → persist |
| `src/app/(dashboard)/admin/dre/page.tsx` | Placeholder Server Component (Fase 1) |
| `src/components/app-sidebar.tsx` | Adicionar item "DRE Executivo" em `navByRole.admin` |
| `scripts/test-dre-parser.ts` | Roda parser na planilha real, imprime JSON |
| `package.json` | Adicionar `xlsx` (dep) + `tsx` (devDep) |

**Fora desta fase:** UI editorial (tema gold/Fraunces), KPIs, gráficos, tabela DRE, alertas, dialog de upload — entram na Fase 2/3.

---

## Tasks

### Task 1: Instalar dependências

**Files:**
- Modify: `package.json` (via `npm install`)

- [ ] **Step 1: Instalar `xlsx` (runtime) e `tsx` (dev)**

```bash
npm install xlsx
npm install -D tsx
```

- [ ] **Step 2: Verificar `package.json`**

Esperado em `dependencies`:
```json
"xlsx": "^0.18.5"
```

Esperado em `devDependencies`:
```json
"tsx": "^4.x"
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(dre): add xlsx parser and tsx runner"
```

---

### Task 2: Migration SQL — schema de DRE

**Files:**
- Create: `supabase/migrations/0001_dre_init.sql`

**Importante:** Não há CLI Supabase configurado. O usuário roda manualmente no Supabase SQL Editor.

- [ ] **Step 1: Criar diretório de migrations**

```bash
mkdir -p supabase/migrations
```

- [ ] **Step 2: Criar arquivo `supabase/migrations/0001_dre_init.sql`**

```sql
-- DRE Controladoria — schema inicial
-- Roda manualmente no Supabase SQL Editor (sem CLI configurada).

CREATE TABLE IF NOT EXISTS dre_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_arquivo TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  tamanho_bytes BIGINT NOT NULL,
  ano_referencia INT NOT NULL,
  meses_processados INT[] NOT NULL DEFAULT '{}',
  usuario_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processando', 'sucesso', 'erro')),
  erros JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dre_uploads_ano ON dre_uploads(ano_referencia);
CREATE INDEX IF NOT EXISTS idx_dre_uploads_created ON dre_uploads(created_at DESC);

CREATE TABLE IF NOT EXISTS dre_lancamentos (
  id BIGSERIAL PRIMARY KEY,
  periodo DATE NOT NULL,
  empresa TEXT NOT NULL CHECK (empresa IN ('matriz', 'filial', 'hdslim', 'medical', 'consolidado')),
  regime_tributario TEXT NOT NULL CHECK (regime_tributario IN ('lucro_presumido', 'simples_nacional', 'na')),
  categoria TEXT NOT NULL CHECK (categoria IN ('faturamento', 'imposto', 'variavel', 'cpv', 'despesa_fixa', 'nao_operacional', 'resultado')),
  sub_categoria TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(14,2) NOT NULL,
  pct_sobre_faturamento NUMERIC(7,4),
  upload_id UUID NOT NULL REFERENCES dre_uploads(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- (categoria, sub_categoria) é a chave porque sub_categoria "total" se repete
  -- entre categorias (imposto.total, variavel.total, cpv.total, despesa_fixa.total).
  UNIQUE (periodo, empresa, categoria, sub_categoria)
);

CREATE INDEX IF NOT EXISTS idx_dre_periodo_empresa ON dre_lancamentos(periodo, empresa);
CREATE INDEX IF NOT EXISTS idx_dre_categoria ON dre_lancamentos(categoria);
```

- [ ] **Step 3: Pedir ao usuário para rodar a migration**

Mostre ao usuário a instrução:

> 1. Abra o Supabase Dashboard → SQL Editor
> 2. Cole o conteúdo de `supabase/migrations/0001_dre_init.sql`
> 3. Execute. Confirme que duas tabelas (`dre_uploads`, `dre_lancamentos`) aparecem em **Database → Tables**.
>
> Quando confirmar, prosseguimos.

**Não avance sem confirmação.**

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_dre_init.sql
git commit -m "feat(dre): initial schema (dre_lancamentos, dre_uploads)"
```

---

### Task 3: Criar bucket de Storage `dre-uploads`

**Files:** nenhuma alteração de código nesta task.

Esta é uma ação manual no Supabase UI. Não pode ser automatizada sem CLI.

- [ ] **Step 1: Pedir ao usuário para criar o bucket**

Mostre as instruções:

> 1. Supabase Dashboard → **Storage**
> 2. **New bucket**: nome `dre-uploads`, **Privado** (não marque "Public bucket")
> 3. Confirme que o bucket aparece na lista lateral.

- [ ] **Step 2: Aguardar confirmação do usuário**

Não avance sem confirmação. Se o usuário relatar problema, pause e troubleshoot.

---

### Task 4: Constantes de empresas

**Files:**
- Create: `src/lib/dre/empresas.ts`

- [ ] **Step 1: Criar `src/lib/dre/empresas.ts`**

```typescript
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
```

- [ ] **Step 2: Confirmar que TypeScript não reclama**

```bash
npx tsc --noEmit src/lib/dre/empresas.ts
```

Esperado: sem saída (sucesso). Se reclamar de paths, ignore — o tsc projeto vai rodar no build final.

- [ ] **Step 3: Commit**

```bash
git add src/lib/dre/empresas.ts
git commit -m "feat(dre): empresas config (codes, regimes, columns)"
```

---

### Task 5: Mapa de linhas da planilha

**Files:**
- Create: `src/lib/dre/linhas.ts`

- [ ] **Step 1: Criar `src/lib/dre/linhas.ts`**

Conteúdo derivado da spec seção 5 e do prompt original (linhas 154–202):

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/dre/linhas.ts
git commit -m "feat(dre): line map for monthly DRE sheets"
```

---

### Task 6: Parser principal

**Files:**
- Create: `src/lib/dre/parser.ts`

- [ ] **Step 1: Criar `src/lib/dre/parser.ts`**

```typescript
import * as XLSX from "xlsx";
import { EMPRESAS, EMPRESAS_OPERACIONAIS, EmpresaCode } from "./empresas";
import { LINHAS, LINHAS_FATURAMENTO_BRUTO, Categoria } from "./linhas";

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export interface DreLancamentoParsed {
  periodo: string;          // ISO date "YYYY-MM-01"
  empresa: EmpresaCode;
  regime_tributario: "lucro_presumido" | "simples_nacional" | "na";
  categoria: Categoria;
  sub_categoria: string;
  descricao: string;
  valor: number;
  pct_sobre_faturamento: number | null;
}

export interface DreParseResult {
  anoReferencia: number;
  mesesProcessados: number[];     // [1..12]
  lancamentos: DreLancamentoParsed[];
  warnings: string[];
}

interface AbaDetectada {
  nomeAba: string;
  mes: number;        // 1..12
  ano: number;        // 4 dígitos (ex: 2026)
}

const REGEX_ABA = /^DRE\s+(Janeiro|Fevereiro|Março|Marco|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)\s+(\d{2,4})$/i;

function nomeMesParaIndice(nome: string): number {
  const norm = nome.toLowerCase().replace(/ç/g, "c");
  const idx = MESES_PT.findIndex((m) => m.toLowerCase().replace(/ç/g, "c") === norm);
  return idx + 1; // 1..12
}

function normalizaAno(raw: string): number {
  const n = parseInt(raw, 10);
  if (n < 100) return 2000 + n;
  return n;
}

function detectarAbas(workbook: XLSX.WorkBook): AbaDetectada[] {
  const found: AbaDetectada[] = [];
  for (const nomeAba of workbook.SheetNames) {
    const m = nomeAba.match(REGEX_ABA);
    if (!m) continue;
    found.push({
      nomeAba,
      mes: nomeMesParaIndice(m[1]),
      ano: normalizaAno(m[2]),
    });
  }
  return found;
}

function parseNumero(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const trim = raw.trim();
  if (trim === "") return null;
  // Formato BR: 1.234,56 → 1234.56
  const norm = trim.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(norm);
  return Number.isFinite(n) ? n : null;
}

function periodoISO(ano: number, mes: number): string {
  const mm = String(mes).padStart(2, "0");
  return `${ano}-${mm}-01`;
}

function calcularFaturamentoBruto(
  sheet: XLSX.WorkSheet,
  colValor: string,
): number {
  let total = 0;
  for (const linha of LINHAS_FATURAMENTO_BRUTO) {
    const cell = sheet[`${colValor}${linha}`];
    const v = parseNumero(cell?.v);
    if (v !== null) total += v;
  }
  return total;
}

function parseAba(
  sheet: XLSX.WorkSheet,
  ano: number,
  mes: number,
  warnings: string[],
): { lancamentos: DreLancamentoParsed[]; teveDado: boolean } {
  const lancamentos: DreLancamentoParsed[] = [];
  const periodo = periodoISO(ano, mes);

  // Calcula faturamento bruto por empresa para % sobre faturamento
  const fatBrutoPorEmpresa: Record<string, number> = {};
  for (const emp of EMPRESAS) {
    fatBrutoPorEmpresa[emp.code] = calcularFaturamentoBruto(sheet, emp.colValor);
  }

  let teveAlgumValor = false;

  for (const [linhaStr, meta] of Object.entries(LINHAS)) {
    const linha = parseInt(linhaStr, 10);
    for (const empresa of EMPRESAS) {
      // L85 (investimentos) só vem na coluna consolidada
      if (linha === 85 && empresa.code !== "consolidado") continue;

      const cellRef = `${empresa.colValor}${linha}`;
      const raw = sheet[cellRef]?.v;
      const valor = parseNumero(raw);
      if (valor === null) continue;

      teveAlgumValor = true;

      const fatBruto = fatBrutoPorEmpresa[empresa.code];
      const pct = fatBruto > 0 ? Number((valor / fatBruto).toFixed(4)) : null;

      lancamentos.push({
        periodo,
        empresa: empresa.code,
        regime_tributario: empresa.regime,
        categoria: meta.categoria,
        sub_categoria: meta.subCategoria,
        descricao: meta.descricao,
        valor: Number(valor.toFixed(2)),
        pct_sobre_faturamento: pct,
      });
    }
  }

  if (teveAlgumValor) {
    validarMatematica(lancamentos, mes, warnings);
  }

  return { lancamentos, teveDado: teveAlgumValor };
}

function validarMatematica(
  lancamentos: DreLancamentoParsed[],
  mes: number,
  warnings: string[],
): void {
  const TOL = 0.01;
  // Chave inclui categoria porque sub_categoria "total" colide entre
  // imposto/variavel/cpv/despesa_fixa.
  const keyOf = (empresa: string, categoria: string, sub: string) =>
    `${empresa}:${categoria}:${sub}`;

  const byKey = new Map<string, DreLancamentoParsed>();
  for (const l of lancamentos) {
    byKey.set(keyOf(l.empresa, l.categoria, l.sub_categoria), l);
  }

  // 1. Faturamento − Devoluções − Impostos ≈ Receita Líquida
  for (const empresa of EMPRESAS) {
    const fatInt = byKey.get(keyOf(empresa.code, "faturamento", "mercado_interno"))?.valor ?? 0;
    const fatExt = byKey.get(keyOf(empresa.code, "faturamento", "mercado_externo"))?.valor ?? 0;
    const dev = byKey.get(keyOf(empresa.code, "faturamento", "devolucoes"))?.valor ?? 0;
    const imp = byKey.get(keyOf(empresa.code, "imposto", "total"))?.valor ?? 0;
    const rl = byKey.get(keyOf(empresa.code, "resultado", "receita_liquida"))?.valor;
    if (rl === undefined) continue;
    const calc = fatInt + fatExt - dev - imp;
    if (Math.abs(calc - rl) > TOL) {
      warnings.push(
        `[mes=${mes} empresa=${empresa.code}] Receita Líquida divergente: calc=${calc.toFixed(2)} planilha=${rl.toFixed(2)}`,
      );
    }
  }

  // 2. Consolidado ≈ soma das 4 empresas operacionais (linha por linha)
  for (const [linhaStr, meta] of Object.entries(LINHAS)) {
    const linha = parseInt(linhaStr, 10);
    if (linha === 85) continue; // só consolidado
    const cons = byKey.get(keyOf("consolidado", meta.categoria, meta.subCategoria));
    if (!cons) continue;
    const soma = EMPRESAS_OPERACIONAIS.reduce((acc, code) => {
      return acc + (byKey.get(keyOf(code, meta.categoria, meta.subCategoria))?.valor ?? 0);
    }, 0);
    if (Math.abs(soma - cons.valor) > TOL) {
      warnings.push(
        `[mes=${mes} linha=${linha} ${meta.categoria}.${meta.subCategoria}] Consolidado divergente: soma=${soma.toFixed(2)} planilha=${cons.valor.toFixed(2)}`,
      );
    }
  }
}

export function parseDRE(buffer: Buffer | ArrayBuffer): DreParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const abas = detectarAbas(workbook);

  if (abas.length === 0) {
    throw new Error("Nenhuma aba DRE detectada (esperado: 'DRE Janeiro 26', 'DRE Fevereiro 26', etc.)");
  }

  const anos = new Set(abas.map((a) => a.ano));
  if (anos.size > 1) {
    throw new Error(`Planilha contém múltiplos anos (${[...anos].join(", ")}). Esperado: um ano só.`);
  }
  const ano = [...anos][0];

  const todosLancamentos: DreLancamentoParsed[] = [];
  const mesesProcessados: number[] = [];
  const warnings: string[] = [];

  for (const aba of abas) {
    const sheet = workbook.Sheets[aba.nomeAba];
    const { lancamentos, teveDado } = parseAba(sheet, aba.ano, aba.mes, warnings);
    if (teveDado) {
      todosLancamentos.push(...lancamentos);
      mesesProcessados.push(aba.mes);
    }
  }

  mesesProcessados.sort((a, b) => a - b);

  return {
    anoReferencia: ano,
    mesesProcessados,
    lancamentos: todosLancamentos,
    warnings,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/dre/parser.ts
git commit -m "feat(dre): xlsx parser with sheet detection and math validation"
```

---

### Task 7: Script de teste do parser

**Files:**
- Create: `scripts/test-dre-parser.ts`

- [ ] **Step 1: Criar `scripts/test-dre-parser.ts`**

```typescript
// Roda o parser na planilha real e imprime sumário + amostra de lançamentos.
// Uso: npx tsx scripts/test-dre-parser.ts "C:\\Users\\misae\\Documents\\Dev\\Ashmont\\Rigel\\files\\DRE 2026 Rigel.xlsx"

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseDRE } from "../src/lib/dre/parser";

const arg = process.argv[2];
if (!arg) {
  console.error("Uso: npx tsx scripts/test-dre-parser.ts <caminho-da-planilha.xlsx>");
  process.exit(1);
}

const fullPath = resolve(arg);
console.log(`Lendo: ${fullPath}`);

const buffer = readFileSync(fullPath);
const result = parseDRE(buffer);

console.log("\n=== SUMÁRIO ===");
console.log("Ano de referência:", result.anoReferencia);
console.log("Meses processados:", result.mesesProcessados);
console.log("Total de lançamentos:", result.lancamentos.length);
console.log("Warnings:", result.warnings.length);

if (result.warnings.length > 0) {
  console.log("\n=== WARNINGS ===");
  for (const w of result.warnings) console.log("  -", w);
}

console.log("\n=== AMOSTRA: primeiro mês, empresa CONSOLIDADO ===");
const primeiroMes = result.mesesProcessados[0];
const periodoStr = `${result.anoReferencia}-${String(primeiroMes).padStart(2, "0")}-01`;
const amostra = result.lancamentos.filter(
  (l) => l.periodo === periodoStr && l.empresa === "consolidado",
);
console.table(amostra.map((l) => ({
  cat: l.categoria,
  sub: l.sub_categoria,
  valor: l.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
  pct: l.pct_sobre_faturamento !== null ? (l.pct_sobre_faturamento * 100).toFixed(2) + "%" : "—",
})));

console.log("\n✓ Parser executou sem erros.");
```

- [ ] **Step 2: Rodar contra a planilha real**

```bash
npx tsx scripts/test-dre-parser.ts "C:/Users/misae/Documents/Dev/Ashmont/Rigel/files/DRE 2026 Rigel.xlsx"
```

Esperado:
- "Ano de referência: 2026"
- "Meses processados: [1, 2, ...]" (lista crescente conforme planilha)
- "Total de lançamentos: ~225 × N meses"
- Tabela do consolidado com `mercado_interno`, `devolucoes`, `total` (impostos), `receita_liquida`, etc.
- "✓ Parser executou sem erros."

- [ ] **Step 3: Validar com o usuário**

Mostre o output ao usuário e peça para validar:
1. Os meses processados batem com os dados que a controladoria preencheu?
2. Os valores do consolidado batem com a planilha aberta no Excel?
3. Os warnings (se houver) fazem sentido (somas que realmente divergem) ou são falso positivo?

Se algo divergir, pause e debug. Não avance.

- [ ] **Step 4: Commit**

```bash
git add scripts/test-dre-parser.ts
git commit -m "chore(dre): add parser smoke-test script"
```

---

### Task 8: Read queries (skeleton)

**Files:**
- Create: `src/lib/queries/dre.ts`

- [ ] **Step 1: Criar `src/lib/queries/dre.ts`**

Para Fase 1 só precisamos do mínimo: detectar quais meses têm dados (para a UI saber o que mostrar). O resto entra na Fase 2.

```typescript
import { createSupabaseServer } from "@/lib/supabase/client";
import type { Categoria } from "@/lib/dre/linhas";
import type { EmpresaCode } from "@/lib/dre/empresas";

export interface DreLancamento {
  periodo: string;
  empresa: EmpresaCode;
  regime_tributario: "lucro_presumido" | "simples_nacional" | "na";
  categoria: Categoria;
  sub_categoria: string;
  descricao: string;
  valor: number;
  pct_sobre_faturamento: number | null;
}

export interface MesesDisponiveisResult {
  ano: number;
  meses: number[]; // 1..12, ordenados crescentes
}

/**
 * Retorna o ano mais recente em dre_uploads (status=sucesso) e a união de
 * meses processados — usado pela UI para habilitar/desabilitar pills de mês.
 */
export async function getMesesDisponiveis(): Promise<MesesDisponiveisResult | null> {
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("dre_uploads")
    .select("ano_referencia, meses_processados")
    .eq("status", "sucesso")
    .order("ano_referencia", { ascending: false });

  if (error) {
    console.error("[dre/getMesesDisponiveis]", error);
    return null;
  }
  if (!data || data.length === 0) return null;

  const ano = data[0].ano_referencia;
  const meses = new Set<number>();
  for (const row of data) {
    if (row.ano_referencia !== ano) continue;
    for (const m of row.meses_processados ?? []) meses.add(m);
  }
  return { ano, meses: [...meses].sort((a, b) => a - b) };
}

/**
 * Lê todos os lançamentos de um conjunto de meses + empresa.
 * `meses`: array de 1..12 dentro de `ano`. Vazio = sem retorno.
 */
export async function getLancamentos(opts: {
  ano: number;
  meses: number[];
  empresa?: EmpresaCode;
}): Promise<DreLancamento[]> {
  if (opts.meses.length === 0) return [];

  const supabase = createSupabaseServer();
  const periodos = opts.meses.map((m) => `${opts.ano}-${String(m).padStart(2, "0")}-01`);

  let query = supabase
    .from("dre_lancamentos")
    .select("periodo, empresa, regime_tributario, categoria, sub_categoria, descricao, valor, pct_sobre_faturamento")
    .in("periodo", periodos);

  if (opts.empresa) query = query.eq("empresa", opts.empresa);

  const { data, error } = await query;
  if (error) {
    console.error("[dre/getLancamentos]", error);
    return [];
  }
  return (data ?? []) as DreLancamento[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/queries/dre.ts
git commit -m "feat(dre): read queries (meses disponiveis, lancamentos)"
```

---

### Task 9: Endpoint de upload `POST /api/dre/upload`

**Files:**
- Create: `src/app/api/dre/upload/route.ts`

- [ ] **Step 1: Criar `src/app/api/dre/upload/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSession } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/client";
import { parseDRE } from "@/lib/dre/parser";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 50 * 1024 * 1024; // 50MB
const BUCKET = "dre-uploads";

export async function POST(req: NextRequest) {
  // 1. Auth + role check
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Apenas admin pode fazer upload" }, { status: 403 });
  }

  // 2. Validação de arquivo
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Body inválido (esperado multipart/form-data)" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Campo 'file' ausente" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json({ error: "Apenas arquivos .xlsx são aceitos" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `Arquivo excede ${MAX_BYTES / 1024 / 1024}MB` }, { status: 400 });
  }

  const supabase = createSupabaseServer();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 3. Pré-parse mínimo para descobrir o ano (precisamos antes do INSERT em dre_uploads)
  let parsed: ReturnType<typeof parseDRE>;
  try {
    parsed = parseDRE(buffer);
  } catch (e) {
    return NextResponse.json({ error: `Falha ao parsear: ${(e as Error).message}` }, { status: 400 });
  }

  if (parsed.mesesProcessados.length === 0) {
    return NextResponse.json(
      { error: "Planilha não contém nenhum mês com dados preenchidos" },
      { status: 400 },
    );
  }

  // 4. Cria upload com status=processando
  const uploadId = randomUUID();
  const storagePath = `${parsed.anoReferencia}/${uploadId}.xlsx`;

  const { error: insertErr } = await supabase.from("dre_uploads").insert({
    id: uploadId,
    nome_arquivo: file.name,
    storage_path: storagePath,
    tamanho_bytes: file.size,
    ano_referencia: parsed.anoReferencia,
    meses_processados: [],
    usuario_id: session.user.id,
    status: "processando",
  });

  if (insertErr) {
    console.error("[dre/upload] insert dre_uploads", insertErr);
    return NextResponse.json({ error: "Falha ao registrar upload" }, { status: 500 });
  }

  // 5. Sobe arquivo no Storage
  const { error: storageErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: false,
    });

  if (storageErr) {
    await supabase
      .from("dre_uploads")
      .update({ status: "erro", erros: { fatal: `storage: ${storageErr.message}` } })
      .eq("id", uploadId);
    return NextResponse.json({ error: `Falha no upload: ${storageErr.message}` }, { status: 500 });
  }

  // 6. Persistência transacional: DELETE + INSERT por mês
  const periodos = parsed.mesesProcessados.map(
    (m) => `${parsed.anoReferencia}-${String(m).padStart(2, "0")}-01`,
  );

  const { error: delErr } = await supabase
    .from("dre_lancamentos")
    .delete()
    .in("periodo", periodos);

  if (delErr) {
    await supabase
      .from("dre_uploads")
      .update({ status: "erro", erros: { fatal: `delete: ${delErr.message}` } })
      .eq("id", uploadId);
    return NextResponse.json({ error: `Falha ao limpar dados antigos: ${delErr.message}` }, { status: 500 });
  }

  const rows = parsed.lancamentos.map((l) => ({
    periodo: l.periodo,
    empresa: l.empresa,
    regime_tributario: l.regime_tributario,
    categoria: l.categoria,
    sub_categoria: l.sub_categoria,
    descricao: l.descricao,
    valor: l.valor,
    pct_sobre_faturamento: l.pct_sobre_faturamento,
    upload_id: uploadId,
  }));

  const { error: insLancErr } = await supabase.from("dre_lancamentos").insert(rows);

  if (insLancErr) {
    await supabase
      .from("dre_uploads")
      .update({ status: "erro", erros: { fatal: `insert lancamentos: ${insLancErr.message}` } })
      .eq("id", uploadId);
    return NextResponse.json({ error: `Falha ao gravar lançamentos: ${insLancErr.message}` }, { status: 500 });
  }

  // 7. Marca upload como sucesso
  await supabase
    .from("dre_uploads")
    .update({
      status: "sucesso",
      meses_processados: parsed.mesesProcessados,
      erros: parsed.warnings.length > 0 ? { warnings: parsed.warnings } : null,
    })
    .eq("id", uploadId);

  return NextResponse.json({
    upload_id: uploadId,
    ano: parsed.anoReferencia,
    meses_processados: parsed.mesesProcessados,
    total_lancamentos: rows.length,
    warnings: parsed.warnings,
  });
}
```

- [ ] **Step 2: Verificar import paths**

Confirme que `@/lib/auth` e `@/lib/supabase/client` resolvem (já existem). Não rode build ainda — vamos testar end-to-end na Task 11.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/dre/upload/route.ts
git commit -m "feat(dre): upload endpoint with auth, storage, parse, persist"
```

---

### Task 10: Página placeholder + sidebar

**Files:**
- Create: `src/app/(dashboard)/admin/dre/page.tsx`
- Modify: `src/components/app-sidebar.tsx`

- [ ] **Step 1: Criar página placeholder**

```typescript
// src/app/(dashboard)/admin/dre/page.tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getMesesDisponiveis } from "@/lib/queries/dre";

export default async function DREPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const role = (session.user as { role?: string }).role;
  if (role !== "admin") redirect("/");

  const disponiveis = await getMesesDisponiveis();

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">DRE Executivo</h1>
      <p className="text-muted-foreground">Aba Controladoria — em construção (Fase 1: backbone).</p>

      <section className="rounded-lg border p-4">
        <h2 className="font-medium mb-2">Status dos dados</h2>
        {disponiveis ? (
          <p>
            Ano <strong>{disponiveis.ano}</strong> — meses com dados:{" "}
            <strong>{disponiveis.meses.join(", ") || "nenhum"}</strong>
          </p>
        ) : (
          <p className="text-muted-foreground">
            Nenhum upload ainda. Use{" "}
            <code className="px-1 py-0.5 rounded bg-muted">POST /api/dre/upload</code> com{" "}
            <code className="px-1 py-0.5 rounded bg-muted">file</code> (multipart) para popular.
          </p>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Adicionar item no sidebar**

Em `src/components/app-sidebar.tsx`:

(a) Adicionar `LineChart` aos imports do `lucide-react` (linhas 6–22). Se já estiver, pular.

```typescript
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  FileText,
  Receipt,
  Package,
  ArrowDownCircle,
  ArrowUpCircle,
  List,
  UserCheck,
  Shield,
  LogOut,
  ChevronRight,
  ChevronsUpDown,
  BarChart3,
  LineChart, // ← novo
} from "lucide-react"
```

(b) Em `navByRole.admin` (linha ~81), inserir o item entre "BI Comercial" e "Clientes":

```typescript
admin: [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "BI Comercial", url: "/admin/bi", icon: BarChart3 },
  { title: "DRE Executivo", url: "/admin/dre", icon: LineChart }, // ← novo
  { title: "Clientes", url: "/admin/clientes", icon: Users },
  // ...resto sem alteração
],
```

- [ ] **Step 3: Subir dev server e validar visualmente**

```bash
npx portless rigel next dev --turbopack
```

No browser (URL portless):
1. Login como admin.
2. Sidebar deve mostrar "DRE Executivo" entre "BI Comercial" e "Clientes".
3. Clicar abre `/admin/dre` com texto "DRE em construção" e a seção "Status dos dados" mostrando "Nenhum upload ainda."
4. Logout, login como `comercial`/`financeiro`/`rh` → item NÃO deve aparecer.
5. Tentar acessar `/admin/dre` direto como não-admin → redireciona para `/`.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/admin/dre/page.tsx src/components/app-sidebar.tsx
git commit -m "feat(dre): placeholder page + sidebar entry (admin only)"
```

---

### Task 11: Validação end-to-end

**Files:** nenhuma alteração de código (a menos que algo quebre).

- [ ] **Step 1: Subir planilha real via curl**

Com o dev server rodando, pegue o cookie de sessão (DevTools → Application → Cookies → `better-auth.session_token`) e rode:

```bash
curl -X POST "http://localhost:PORT/api/dre/upload" \
  -H "Cookie: better-auth.session_token=COLE_AQUI" \
  -F "file=@C:/Users/misae/Documents/Dev/Ashmont/Rigel/files/DRE 2026 Rigel.xlsx"
```

Esperado (HTTP 200):
```json
{
  "upload_id": "...",
  "ano": 2026,
  "meses_processados": [1, 2, ...],
  "total_lancamentos": <225 × N meses>,
  "warnings": []
}
```

Se vier erro, leia a mensagem e debug. Cenários comuns:
- 401: cookie expirado/errado
- 403: usuário não é admin
- 500 com `storage:`: bucket não existe ou nome errado
- 500 com `insert lancamentos:`: provável violação de UNIQUE — reabrir migration e conferir

- [ ] **Step 2: Conferir dados no Supabase**

No Supabase Dashboard → **Database → Table editor**:

1. `dre_uploads`: 1 linha, `status = sucesso`, `meses_processados` populado, `erros = null`.
2. `dre_lancamentos`: contagem ≈ `225 × N meses` (rode SQL Editor: `SELECT COUNT(*) FROM dre_lancamentos`).
3. Sanity check totais — pegue a Receita Líquida do consolidado de janeiro:

```sql
SELECT valor FROM dre_lancamentos
WHERE periodo = '2026-01-01'
  AND empresa = 'consolidado'
  AND sub_categoria = 'receita_liquida';
```

Compare com a célula `J20` da aba "DRE Janeiro 26" no Excel. Devem ser iguais.

4. `dre-uploads` (Storage): arquivo `2026/<uuid>.xlsx` presente.

- [ ] **Step 3: Confirmar com o usuário**

Apresente os resultados ao usuário e peça validação:
- Total de lançamentos faz sentido?
- Receita Líquida do consolidado bate?
- Algum warning (se houver) precisa ser investigado?

Se tudo OK, Fase 1 está concluída.

- [ ] **Step 4: Commit final (se houve fix) e marcar fase concluída**

Se nenhum fix foi necessário, não há commit nesta task. Caso contrário:

```bash
git add -A
git commit -m "fix(dre): <descrição>"
```

---

## Self-Review

**1. Spec coverage (Fase 1):**

| Spec section | Coberto por |
|---|---|
| §3 (Arquitetura) — endpoint `/api/dre/upload` | Task 9 |
| §4 (Schema) — `dre_lancamentos`, `dre_uploads`, índices | Task 2 |
| §5 (Parser) — regex de aba, mapa empresas/linhas, parse números, validação matemática, persistência DELETE+INSERT | Tasks 4–6, 9 |
| §6 (Estrutura) — `src/lib/dre/`, `src/lib/queries/dre.ts`, `/api/dre/upload`, `(dashboard)/admin/dre/page.tsx` (placeholder) | Tasks 4–10 |
| §11 (Erros) — 400 não-xlsx/>50MB, 403 não-admin, 500 storage/parse | Task 9 |
| §12 (Testes) — `scripts/test-dre-parser.ts` | Task 7 |
| §13 (Fase 1 entregáveis) — migration, bucket, sidebar, placeholder, lib/dre, queries, /api/dre/upload, test script, validação | Tasks 1–11 |

Não coberto (intencional, escopo Fase 2/3):
- Tema editorial (gold/Fraunces) — Fase 2
- Filtros/KPIs/gráficos/tabela DRE — Fase 2
- Sinais financeiros, dialog de upload, grid mensal — Fase 3

**2. Placeholders:** Nenhuma menção a "TBD", "implement later", "add validation". Cada step tem código completo ou comando explícito.

**3. Type consistency:** Tipos `DreLancamentoParsed` (parser) ↔ `DreLancamento` (queries) — diferem só em `pct_sobre_faturamento` ser `number | null` em ambos. `EmpresaCode` e `Categoria` exportados de `empresas.ts`/`linhas.ts` e reusados em `parser.ts` e `queries/dre.ts`. Migration usa CHECK constraints que casam com os tipos TS.

**4. Tasks manuais que dependem do usuário:**
- Task 2 Step 3: rodar SQL no Supabase
- Task 3 Step 1: criar bucket
- Task 7 Step 3: validar parser output
- Task 11: validar end-to-end

Em todas, o plano explicita que o executor não deve avançar sem confirmação.

---

## Próximos passos (fora deste plano)

Após validação da Fase 1, escrever:
- `docs/superpowers/plans/2026-04-XX-dre-fase-2-dashboard.md` — tema editorial, filtros, KPIs, tabela DRE colapsável, gráficos (waterfall/tendência/donut/ranking), resumo executivo dinâmico
- `docs/superpowers/plans/2026-04-XX-dre-fase-3-polish.md` — alertas (7 regras), dialog de upload com drag-drop, grid mensal de status, empty states, responsividade
