# WhatsApp Daily Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cron diário às 07:00 BRT envia resumo de vendas D-1 por canal e contas a pagar (atrasadas / vence hoje / próximos 7 dias) via Evolution API para o WhatsApp do gestor.

**Architecture:** 4 módulos novos com responsabilidade única — `evolution/client.ts` (HTTP), `queries/daily-summary.ts` (Supabase), `notifications/daily-summary.ts` (formatter puro), `api/cron/daily-summary/route.ts` (orquestração). Cron registrado em `vercel.json` (`0 10 * * *` UTC).

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase JS client, `fetch` nativo, Vercel Cron, Evolution API v2.

**Spec:** `docs/superpowers/specs/2026-05-13-whatsapp-daily-summary-design.md`

**Verificação:** sem framework de testes; usa scripts `tsx` no padrão de `scripts/smoke-bi.ts` e `scripts/diag-*.ts`. Verificação visual + asserts no script.

---

## File Structure

**Criar:**
- `src/lib/evolution/client.ts` — cliente HTTP genérico (`sendWhatsAppText`)
- `src/lib/queries/daily-summary.ts` — `fetchDailySummary()` + tipos
- `src/lib/notifications/daily-summary.ts` — `formatDailySummary()` puro
- `src/app/api/cron/daily-summary/route.ts` — handler GET
- `scripts/smoke-evolution.ts` — smoke test do cliente Evolution
- `scripts/test-daily-summary-format.ts` — fixtures + verificação do formatter
- `scripts/test-daily-summary-data.ts` — chama queries reais e imprime JSON

**Modificar:**
- `src/lib/config/vendedores-map.ts` — adiciona `VENDEDOR_ID_TO_MARKETPLACE_NAME`
- `vercel.json` — adiciona terceiro cron
- `CLAUDE.md` — documenta novas envs

---

## Task 1: Adicionar mapa de IDs → nome de marketplace

**Files:**
- Modify: `src/lib/config/vendedores-map.ts`

- [ ] **Step 1: Adicionar `VENDEDOR_ID_TO_MARKETPLACE_NAME` logo após `MARKETPLACE_VENDEDOR_IDS`**

Em `src/lib/config/vendedores-map.ts`, encontrar o bloco que define `MARKETPLACE_VENDEDOR_IDS` (linhas ~36-45) e adicionar **logo após o `])`:**

```ts
// Mapeia o id do "vendedor" de marketplace para o nome de canal exibido no relatório.
// Mantém o nome exato cadastrado no VHSys (uppercase).
export const VENDEDOR_ID_TO_MARKETPLACE_NAME: Record<number, string> = {
  248324: "MERCADOFULL",
  207185: "MERCADOLIVRE",
  230194: "SHOPEE",
  262101: "SHOPEEFULL",
  262945: "SHEIN",
  212745: "SITE OPTA SAUDE",
  239225: "SITE RIGEL",
}
```

- [ ] **Step 2: Verificar tipo / lint**

Run: `npm run lint`
Expected: PASS (sem warnings novos).

- [ ] **Step 3: Commit**

```powershell
git add src/lib/config/vendedores-map.ts
git commit -m "feat(config): add VENDEDOR_ID_TO_MARKETPLACE_NAME map"
```

---

## Task 2: Cliente Evolution API

**Files:**
- Create: `src/lib/evolution/client.ts`
- Create: `scripts/smoke-evolution.ts`

- [ ] **Step 1: Criar `src/lib/evolution/client.ts`**

```ts
const DEFAULT_RETRIES = 3;
const BACKOFF_MS = [0, 1000, 3000];

/**
 * Envia uma mensagem de texto via Evolution API v2 para o destinatário configurado
 * em WHATSAPP_RECIPIENT_NUMBER. Tenta até 3 vezes com backoff 0/1s/3s em qualquer
 * falha (rede ou status != 2xx). Lança erro com mensagem agregada se todas falharem.
 */
export async function sendWhatsAppText(text: string): Promise<void> {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE_NAME;
  const recipient = process.env.WHATSAPP_RECIPIENT_NUMBER;

  if (!apiUrl || !apiKey || !instance) {
    throw new Error(
      "Evolution API not configured (missing EVOLUTION_API_URL/KEY/INSTANCE)",
    );
  }
  if (!recipient) {
    throw new Error("WHATSAPP_RECIPIENT_NUMBER not configured");
  }

  const url = `${apiUrl.replace(/\/$/, "")}/message/sendText/${encodeURIComponent(instance)}`;
  const body = JSON.stringify({ number: recipient, text });
  const headers = {
    "Content-Type": "application/json",
    apikey: apiKey,
  };

  let lastErr: unknown;

  for (let i = 0; i < DEFAULT_RETRIES; i++) {
    if (BACKOFF_MS[i] > 0) {
      await new Promise((r) => setTimeout(r, BACKOFF_MS[i]));
    }
    try {
      const res = await fetch(url, { method: "POST", headers, body });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Evolution ${res.status}: ${errText.slice(0, 200)}`);
      }
      return;
    } catch (err) {
      lastErr = err;
      console.warn(
        `[evolution] attempt ${i + 1}/${DEFAULT_RETRIES} failed:`,
        err,
      );
    }
  }

  throw new Error(
    `Evolution send failed after ${DEFAULT_RETRIES} attempts: ${lastErr}`,
  );
}
```

- [ ] **Step 2: Criar smoke test `scripts/smoke-evolution.ts`**

```ts
// Envia uma mensagem de teste pelo WhatsApp via Evolution.
// Confirma que envs estão certas e o endpoint funciona.
// USO: npx tsx --env-file=.env.local scripts/smoke-evolution.ts

import { sendWhatsAppText } from "../src/lib/evolution/client";

async function main() {
  const stamp = new Date().toISOString();
  const text =
    `🧪 *Smoke test Evolution*\n\n` +
    `Timestamp: ${stamp}\n` +
    `Se você está lendo isto, o cliente está OK.`;
  console.log("Enviando mensagem de teste...");
  await sendWhatsAppText(text);
  console.log("✓ Enviado com sucesso.");
}

main().catch((err) => {
  console.error("✗ Falhou:", err);
  process.exit(1);
});
```

- [ ] **Step 3: Rodar smoke test e confirmar mensagem no WhatsApp**

Run:
```powershell
npx tsx --env-file=.env.local scripts/smoke-evolution.ts
```
Expected:
- Console: `✓ Enviado com sucesso.`
- WhatsApp do número em `WHATSAPP_RECIPIENT_NUMBER` recebe a mensagem com timestamp e formatação (negrito, emoji).

**Se falhar com 404 ou body errado:** o endpoint Evolution v2 pode esperar shape diferente. Verificar contra https://doc.evolution-api.com/v2/api-reference; ajustar o body para o shape correto antes de prosseguir.

- [ ] **Step 4: Commit**

```powershell
git add src/lib/evolution/client.ts scripts/smoke-evolution.ts
git commit -m "feat(evolution): add Evolution API client with retry"
```

---

## Task 3: Queries de vendas D-1 por canal e contas a pagar

**Files:**
- Create: `src/lib/queries/daily-summary.ts`
- Create: `scripts/test-daily-summary-data.ts`

- [ ] **Step 1: Criar `src/lib/queries/daily-summary.ts`**

```ts
import { createSupabaseServer } from "@/lib/supabase/client";
import { supabaseFetchAll } from "@/lib/supabase/fetch-all";
import {
  MARKETPLACE_VENDEDOR_IDS,
  VENDEDOR_ID_TO_MARKETPLACE_NAME,
} from "@/lib/config/vendedores-map";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VendasCanal {
  canal: string;
  valorTotal: number;
  qtdPedidos: number;
}

export interface ContaPagarItem {
  fornecedor: string;
  valor: number;
  vencimento: string; // YYYY-MM-DD
  diasAtraso?: number; // só para atrasadas
}

export interface ContasPagarBloco {
  total: number;
  qtd: number;
  itens: ContaPagarItem[];
}

export interface DailySummaryData {
  dataReferencia: string; // D-1 em ISO YYYY-MM-DD
  vendas: {
    totalValor: number;
    totalPedidos: number;
    porCanal: VendasCanal[]; // sempre 8 linhas em ordem fixa
  };
  contasPagar: {
    venceHoje: ContasPagarBloco;
    proximos7Dias: ContasPagarBloco;
    atrasadas: ContasPagarBloco;
  };
}

// Ordem fixa dos canais (B2B primeiro, marketplaces em ordem alfabética).
const CANAIS_ORDEM = [
  "B2B",
  "MERCADOFULL",
  "MERCADOLIVRE",
  "SHEIN",
  "SHOPEE",
  "SHOPEEFULL",
  "SITE OPTA SAUDE",
  "SITE RIGEL",
];

// ---------------------------------------------------------------------------
// Date helpers (sempre em America/Sao_Paulo)
// ---------------------------------------------------------------------------

/** Retorna a data atual em BRT como YYYY-MM-DD. */
export function todayBRT(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}

/** Soma `days` (positivo ou negativo) a uma data ISO YYYY-MM-DD. Independente de TZ. */
export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Diferença em dias entre duas datas ISO (a - b). Independente de TZ. */
export function diffDaysISO(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const ms =
    Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd);
  return Math.floor(ms / 86_400_000);
}

// ---------------------------------------------------------------------------
// Vendas D-1
// ---------------------------------------------------------------------------

interface PedidoRow {
  vendedor_pedido_id: number | string | null;
  valor_total_nota: string | number | null;
}

async function fetchVendasPorCanal(d1: string): Promise<{
  totalValor: number;
  totalPedidos: number;
  porCanal: VendasCanal[];
}> {
  const supabase = createSupabaseServer();
  const rows = await supabaseFetchAll<PedidoRow>((from, to) =>
    supabase
      .from("pedidos")
      .select("vendedor_pedido_id, valor_total_nota")
      .eq("status_pedido", "Atendido")
      .eq("lixeira", "Nao")
      .gte("data_pedido", d1)
      .lte("data_pedido", d1)
      .range(from, to),
  );

  // Agrega: inicializa zerado para os 8 canais
  const acc = new Map<string, { valor: number; qtd: number }>();
  for (const c of CANAIS_ORDEM) acc.set(c, { valor: 0, qtd: 0 });

  let totalValor = 0;
  let totalPedidos = 0;

  for (const row of rows) {
    const id = row.vendedor_pedido_id != null ? Number(row.vendedor_pedido_id) : 0;
    const canal =
      MARKETPLACE_VENDEDOR_IDS.has(id)
        ? VENDEDOR_ID_TO_MARKETPLACE_NAME[id] ?? "B2B"
        : "B2B";
    const valor = Number(row.valor_total_nota) || 0;
    const bucket = acc.get(canal) ?? acc.get("B2B")!;
    bucket.valor += valor;
    bucket.qtd += 1;
    totalValor += valor;
    totalPedidos += 1;
  }

  const porCanal: VendasCanal[] = CANAIS_ORDEM.map((c) => {
    const b = acc.get(c)!;
    return { canal: c, valorTotal: b.valor, qtdPedidos: b.qtd };
  });

  return { totalValor, totalPedidos, porCanal };
}

// ---------------------------------------------------------------------------
// Contas a pagar
// ---------------------------------------------------------------------------

interface ContaPagarRow {
  nome_conta: string;
  nome_fornecedor: string | null;
  vencimento_pag: string | null;
  valor_pag: string | number | null;
}

async function fetchContasPagar(hoje: string): Promise<{
  venceHoje: ContasPagarBloco;
  proximos7Dias: ContasPagarBloco;
  atrasadas: ContasPagarBloco;
}> {
  const supabase = createSupabaseServer();
  const limiteSuperior = addDaysISO(hoje, 7);

  const rows = await supabaseFetchAll<ContaPagarRow>((from, to) =>
    supabase
      .from("contas_pagar")
      .select("nome_conta, nome_fornecedor, vencimento_pag, valor_pag")
      .eq("lixeira", "Nao")
      .eq("liquidado_pag", "Nao")
      .lte("vencimento_pag", limiteSuperior)
      .order("vencimento_pag", { ascending: true })
      .range(from, to),
  );

  const atrasadas: ContaPagarItem[] = [];
  const venceHoje: ContaPagarItem[] = [];
  const prox7: ContaPagarItem[] = [];

  for (const r of rows) {
    if (!r.vencimento_pag) continue;
    const venc = String(r.vencimento_pag).slice(0, 10);
    const valor = Number(r.valor_pag) || 0;
    const fornecedor = (r.nome_fornecedor ?? r.nome_conta ?? "").trim() || "(sem nome)";

    if (venc < hoje) {
      atrasadas.push({
        fornecedor,
        valor,
        vencimento: venc,
        diasAtraso: diffDaysISO(hoje, venc),
      });
    } else if (venc === hoje) {
      venceHoje.push({ fornecedor, valor, vencimento: venc });
    } else if (venc <= limiteSuperior) {
      prox7.push({ fornecedor, valor, vencimento: venc });
    }
  }

  // Ordenação
  atrasadas.sort((a, b) => (b.diasAtraso ?? 0) - (a.diasAtraso ?? 0));
  venceHoje.sort((a, b) => b.valor - a.valor);
  prox7.sort((a, b) => {
    if (a.vencimento !== b.vencimento) return a.vencimento < b.vencimento ? -1 : 1;
    return b.valor - a.valor;
  });

  function bloco(itens: ContaPagarItem[]): ContasPagarBloco {
    return {
      total: itens.reduce((s, i) => s + i.valor, 0),
      qtd: itens.length,
      itens,
    };
  }

  return {
    atrasadas: bloco(atrasadas),
    venceHoje: bloco(venceHoje),
    proximos7Dias: bloco(prox7),
  };
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export async function fetchDailySummary(
  now: Date = new Date(),
): Promise<DailySummaryData> {
  const hoje = todayBRT(now);
  const d1 = addDaysISO(hoje, -1);

  const [vendas, contasPagar] = await Promise.all([
    fetchVendasPorCanal(d1),
    fetchContasPagar(hoje),
  ]);

  return {
    dataReferencia: d1,
    vendas,
    contasPagar,
  };
}
```

- [ ] **Step 2: Criar script de verificação `scripts/test-daily-summary-data.ts`**

```ts
// Chama fetchDailySummary contra dados reais e imprime o resultado para inspeção.
// USO: npx tsx --env-file=.env.local scripts/test-daily-summary-data.ts

import { fetchDailySummary } from "../src/lib/queries/daily-summary";

async function main() {
  console.log("Chamando fetchDailySummary()...\n");
  const data = await fetchDailySummary();
  console.log(JSON.stringify(data, null, 2));

  console.log("\n=== CHECKS ===");
  console.log("dataReferencia:", data.dataReferencia);
  console.log("vendas.porCanal.length (esperado: 8):", data.vendas.porCanal.length);
  console.log("vendas.totalPedidos:", data.vendas.totalPedidos);
  console.log("contas.atrasadas.qtd:", data.contasPagar.atrasadas.qtd);
  console.log("contas.venceHoje.qtd:", data.contasPagar.venceHoje.qtd);
  console.log("contas.proximos7Dias.qtd:", data.contasPagar.proximos7Dias.qtd);

  if (data.vendas.porCanal.length !== 8) {
    console.error("✗ Esperava 8 canais.");
    process.exit(1);
  }
  const canais = data.vendas.porCanal.map((c) => c.canal).join(",");
  const esperado = "B2B,MERCADOFULL,MERCADOLIVRE,SHEIN,SHOPEE,SHOPEEFULL,SITE OPTA SAUDE,SITE RIGEL";
  if (canais !== esperado) {
    console.error("✗ Ordem dos canais inesperada:", canais);
    process.exit(1);
  }
  console.log("✓ Ordem e quantidade de canais OK.");
}

main().catch((err) => {
  console.error("✗ Falhou:", err);
  process.exit(1);
});
```

- [ ] **Step 3: Rodar e confirmar**

Run:
```powershell
npx tsx --env-file=.env.local scripts/test-daily-summary-data.ts
```
Expected:
- Imprime JSON completo com `dataReferencia` correspondendo a ontem em BRT (ex.: hoje 2026-05-13 → `dataReferencia` = `2026-05-12`).
- `vendas.porCanal` tem exatamente 8 linhas na ordem `B2B,MERCADOFULL,MERCADOLIVRE,SHEIN,SHOPEE,SHOPEEFULL,SITE OPTA SAUDE,SITE RIGEL`.
- Console: `✓ Ordem e quantidade de canais OK.`
- Os números de contas a pagar batem aproximadamente com o que aparece em `/financeiro/contas-pagar` do app.

- [ ] **Step 4: Commit**

```powershell
git add src/lib/queries/daily-summary.ts scripts/test-daily-summary-data.ts
git commit -m "feat(queries): add daily-summary queries for D-1 sales by channel and contas a pagar"
```

---

## Task 4: Formatter

**Files:**
- Create: `src/lib/notifications/daily-summary.ts`
- Create: `scripts/test-daily-summary-format.ts`

- [ ] **Step 1: Criar `src/lib/notifications/daily-summary.ts`**

```ts
import type {
  DailySummaryData,
  VendasCanal,
  ContaPagarItem,
  ContasPagarBloco,
} from "@/lib/queries/daily-summary";

const MAX_LEN = 4000; // margem de 96 chars sobre o limite de 4096 do WhatsApp
const CANAL_PAD = 18;
const VALOR_PAD = 12;
const QTD_PAD = 3;
const FORNECEDOR_MAX = 30;

// ---------------------------------------------------------------------------
// Helpers de formatação
// ---------------------------------------------------------------------------

function fmtBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function fmtDateLong(iso: string): string {
  const [y, m, d] = iso.split("-");
  // weekday: usa UTC para evitar shift; o dia ISO já é "absoluto"
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  const weekday = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    timeZone: "UTC",
  }).format(date);
  return `${d}/${m}/${y} (${weekday})`;
}

function fmtDateShort(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

function linhaCanal(c: VendasCanal): string {
  const nome = c.canal.padEnd(CANAL_PAD, ".");
  const valor = fmtBRL(c.valorTotal).padStart(VALOR_PAD);
  const qtd = String(c.qtdPedidos).padStart(QTD_PAD);
  return `• ${nome} ${valor} (${qtd})`;
}

function linhaContaAtrasada(c: ContaPagarItem): string {
  const nome = truncate(c.fornecedor, FORNECEDOR_MAX);
  return `• ${nome} — ${fmtBRL(c.valor)} (${c.diasAtraso}d atraso)`;
}

function linhaContaHoje(c: ContaPagarItem): string {
  const nome = truncate(c.fornecedor, FORNECEDOR_MAX);
  return `• ${nome} — ${fmtBRL(c.valor)}`;
}

function linhaContaProxima(c: ContaPagarItem): string {
  const nome = truncate(c.fornecedor, FORNECEDOR_MAX);
  return `• ${nome} — ${fmtBRL(c.valor)} (${fmtDateShort(c.vencimento)})`;
}

function blocoContas(
  emoji: string,
  titulo: string,
  bloco: ContasPagarBloco,
  linhaFn: (c: ContaPagarItem) => string,
): string[] {
  const header = `${emoji} *${titulo}* — ${fmtBRL(bloco.total)} (${bloco.qtd})`;
  if (bloco.qtd === 0) {
    return [header, "_(nenhuma)_"];
  }
  return [header, ...bloco.itens.map(linhaFn)];
}

function blocoContasCompacto(
  emoji: string,
  titulo: string,
  bloco: ContasPagarBloco,
): string {
  return `${emoji} *${titulo}* — ${fmtBRL(bloco.total)} (${bloco.qtd} contas) — lista omitida por tamanho`;
}

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

function build(
  data: DailySummaryData,
  modo: "completo" | "compactarProx7" | "compactarProx7EAtraso",
): string {
  const linhas: string[] = [];
  linhas.push("📊 *Resumo Diário Rigel*");
  linhas.push(`_Referência: ${fmtDateLong(data.dataReferencia)}_`);
  linhas.push("");
  linhas.push("━━━━━━━━━━━━━━━━━━━━━━");
  linhas.push("💰 *VENDAS D-1*");
  linhas.push("━━━━━━━━━━━━━━━━━━━━━━");
  linhas.push(
    `*Total:* ${fmtBRL(data.vendas.totalValor)} (${data.vendas.totalPedidos} pedidos)`,
  );
  linhas.push("");
  for (const c of data.vendas.porCanal) linhas.push(linhaCanal(c));
  linhas.push("");
  linhas.push("━━━━━━━━━━━━━━━━━━━━━━");
  linhas.push("💸 *CONTAS A PAGAR*");
  linhas.push("━━━━━━━━━━━━━━━━━━━━━━");
  linhas.push("");

  if (modo === "compactarProx7EAtraso") {
    linhas.push(blocoContasCompacto("🔴", "Em atraso", data.contasPagar.atrasadas));
  } else {
    linhas.push(
      ...blocoContas("🔴", "Em atraso", data.contasPagar.atrasadas, linhaContaAtrasada),
    );
  }
  linhas.push("");
  linhas.push(
    ...blocoContas("🟡", "Vence hoje", data.contasPagar.venceHoje, linhaContaHoje),
  );
  linhas.push("");
  if (modo === "compactarProx7" || modo === "compactarProx7EAtraso") {
    linhas.push(
      blocoContasCompacto("🔵", "Próximos 7 dias", data.contasPagar.proximos7Dias),
    );
  } else {
    linhas.push(
      ...blocoContas(
        "🔵",
        "Próximos 7 dias",
        data.contasPagar.proximos7Dias,
        linhaContaProxima,
      ),
    );
  }

  return linhas.join("\n");
}

export function formatDailySummary(data: DailySummaryData): string {
  const completa = build(data, "completo");
  if (completa.length <= MAX_LEN) return completa;

  const compacta1 = build(data, "compactarProx7");
  if (compacta1.length <= MAX_LEN) return compacta1;

  return build(data, "compactarProx7EAtraso");
}
```

- [ ] **Step 2: Criar `scripts/test-daily-summary-format.ts` com 3 fixtures**

```ts
// Verifica o formatDailySummary contra 3 cenários: normal, tudo zero, lista
// extremamente longa que força modo compacto. Imprime e valida tamanhos.
// USO: npx tsx scripts/test-daily-summary-format.ts

import { formatDailySummary } from "../src/lib/notifications/daily-summary";
import type { DailySummaryData } from "../src/lib/queries/daily-summary";

const CANAIS_ORDEM = [
  "B2B",
  "MERCADOFULL",
  "MERCADOLIVRE",
  "SHEIN",
  "SHOPEE",
  "SHOPEEFULL",
  "SITE OPTA SAUDE",
  "SITE RIGEL",
];

function vendasZeradas() {
  return {
    totalValor: 0,
    totalPedidos: 0,
    porCanal: CANAIS_ORDEM.map((canal) => ({ canal, valorTotal: 0, qtdPedidos: 0 })),
  };
}

const fixtureNormal: DailySummaryData = {
  dataReferencia: "2026-05-12",
  vendas: {
    totalValor: 47823.5,
    totalPedidos: 23,
    porCanal: [
      { canal: "B2B", valorTotal: 38420, qtdPedidos: 15 },
      { canal: "MERCADOFULL", valorTotal: 0, qtdPedidos: 0 },
      { canal: "MERCADOLIVRE", valorTotal: 4150.3, qtdPedidos: 3 },
      { canal: "SHEIN", valorTotal: 0, qtdPedidos: 0 },
      { canal: "SHOPEE", valorTotal: 3890.2, qtdPedidos: 4 },
      { canal: "SHOPEEFULL", valorTotal: 0, qtdPedidos: 0 },
      { canal: "SITE OPTA SAUDE", valorTotal: 0, qtdPedidos: 0 },
      { canal: "SITE RIGEL", valorTotal: 1363, qtdPedidos: 1 },
    ],
  },
  contasPagar: {
    atrasadas: {
      total: 12450,
      qtd: 3,
      itens: [
        { fornecedor: "Fornecedor X", valor: 8200, vencimento: "2026-05-01", diasAtraso: 12 },
        { fornecedor: "Fornecedor Y", valor: 3100, vencimento: "2026-05-08", diasAtraso: 5 },
        { fornecedor: "Fornecedor Z", valor: 1150, vencimento: "2026-05-11", diasAtraso: 2 },
      ],
    },
    venceHoje: {
      total: 5800,
      qtd: 2,
      itens: [
        { fornecedor: "Fornecedor A", valor: 3500, vencimento: "2026-05-13" },
        { fornecedor: "Fornecedor B", valor: 2300, vencimento: "2026-05-13" },
      ],
    },
    proximos7Dias: {
      total: 24300,
      qtd: 2,
      itens: [
        { fornecedor: "Fornecedor C", valor: 12000, vencimento: "2026-05-14" },
        { fornecedor: "Fornecedor D Com Nome Que Tem Mais De Trinta Caracteres Aqui", valor: 12300, vencimento: "2026-05-18" },
      ],
    },
  },
};

const fixtureTudoZero: DailySummaryData = {
  dataReferencia: "2026-05-10", // domingo
  vendas: vendasZeradas(),
  contasPagar: {
    atrasadas: { total: 0, qtd: 0, itens: [] },
    venceHoje: { total: 0, qtd: 0, itens: [] },
    proximos7Dias: { total: 0, qtd: 0, itens: [] },
  },
};

function gerarContas(n: number, baseDate: string, atraso: boolean) {
  const itens = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const valor = 1000 + i * 17;
    total += valor;
    itens.push({
      fornecedor: `Fornecedor Longo Que Pode Estourar ${i + 1}`,
      valor,
      vencimento: baseDate,
      ...(atraso ? { diasAtraso: i + 1 } : {}),
    });
  }
  return { total, qtd: n, itens };
}

const fixtureExtremo: DailySummaryData = {
  dataReferencia: "2026-05-12",
  vendas: fixtureNormal.vendas,
  contasPagar: {
    atrasadas: gerarContas(60, "2026-04-15", true),
    venceHoje: { total: 0, qtd: 0, itens: [] },
    proximos7Dias: gerarContas(120, "2026-05-18", false),
  },
};

function runFixture(name: string, data: DailySummaryData, maxLen = 4096) {
  console.log(`\n========== ${name} ==========`);
  const out = formatDailySummary(data);
  console.log(out);
  console.log(`\n--- length: ${out.length} chars (max ${maxLen}) ---`);
  if (out.length > maxLen) {
    console.error(`✗ Mensagem excede limite do WhatsApp.`);
    process.exit(1);
  }
}

runFixture("FIXTURE 1 — normal", fixtureNormal);
runFixture("FIXTURE 2 — tudo zero (domingo)", fixtureTudoZero);
runFixture("FIXTURE 3 — extremo (60 atrasadas + 120 prox 7d)", fixtureExtremo);

console.log("\n✓ Todas as fixtures couberam no limite.");
```

- [ ] **Step 3: Rodar e verificar visualmente**

Run:
```powershell
npx tsx scripts/test-daily-summary-format.ts
```
Expected:
- Imprime 3 mensagens (normal / tudo zero / extremo).
- Cada mensagem termina com `length: N chars (max 4096)`.
- Verificar visualmente:
  - **Fixture 1:** linhas de canal alinhadas; emojis e bullets OK; fornecedor longo da "proximos7Dias" foi truncado com `…`; blocos de contas com 3+2+2 itens.
  - **Fixture 2:** mostra `_(nenhuma)_` nos três blocos de contas; canais aparecem todos com `R$ 0,00 ( 0)`.
  - **Fixture 3:** o bloco "Próximos 7 dias" aparece com `"lista omitida por tamanho"` (ou "Em atraso" também, dependendo do tamanho). Mensagem total ≤ 4096.
- Console final: `✓ Todas as fixtures couberam no limite.`

- [ ] **Step 4: Commit**

```powershell
git add src/lib/notifications/daily-summary.ts scripts/test-daily-summary-format.ts
git commit -m "feat(notifications): add daily-summary formatter with compact fallback"
```

---

## Task 5: Route handler do cron

**Files:**
- Create: `src/app/api/cron/daily-summary/route.ts`

- [ ] **Step 1: Criar `src/app/api/cron/daily-summary/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/auth/cron";
import { fetchDailySummary } from "@/lib/queries/daily-summary";
import { formatDailySummary } from "@/lib/notifications/daily-summary";
import { sendWhatsAppText } from "@/lib/evolution/client";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await fetchDailySummary();
    const msg = formatDailySummary(data);
    await sendWhatsAppText(msg);
    console.log("[cron] daily-summary sent", {
      ref: data.dataReferencia,
      chars: msg.length,
      pedidos: data.vendas.totalPedidos,
    });
    return NextResponse.json({ success: true, ref: data.dataReferencia });
  } catch (error) {
    console.error("[cron] daily-summary failed:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Subir dev server e testar**

Em um terminal:
```powershell
npx portless rigel next dev --turbopack
```

Em outro terminal, capturar o `CRON_SECRET` do `.env.local` (se não existir, criar uma string aleatória, adicionar na env e reiniciar o server) e:

```powershell
$secret = (Get-Content .env.local | Select-String '^CRON_SECRET=').Line -replace '^CRON_SECRET=',''
curl -H "Authorization: Bearer $secret" https://rigel.localhost/api/cron/daily-summary
```

Expected:
- HTTP 200 JSON: `{"success":true,"ref":"<ontem em BRT>"}`.
- Mensagem chega no WhatsApp do número em `WHATSAPP_RECIPIENT_NUMBER`.
- Mensagem com formatação Markdown renderizada (negrito, emoji, monoespaçado), caracteres pt-BR (acentos) intactos.
- Logs no terminal do dev server: `[cron] daily-summary sent { ref: ..., chars: ..., pedidos: ... }`.

**Se `CRON_SECRET` não estiver no `.env.local`:** verificar; já é exigido pelos outros crons (`isAuthorizedCron`). Se de fato faltar, adicionar antes do envio (não é parte deste plano criar a env, mas o cron não funciona sem ela).

- [ ] **Step 3: Testar auth bloqueando request sem secret**

```powershell
curl https://rigel.localhost/api/cron/daily-summary
```
Expected: HTTP 401 `{"error":"Unauthorized"}`.

- [ ] **Step 4: Commit**

```powershell
git add src/app/api/cron/daily-summary/route.ts
git commit -m "feat(cron): add /api/cron/daily-summary endpoint"
```

---

## Task 6: Registrar cron no `vercel.json`

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Adicionar terceira entrada**

Substituir o conteúdo de `vercel.json` por:

```json
{
  "crons": [
    {
      "path": "/api/sync/incremental",
      "schedule": "*/30 * * * *"
    },
    {
      "path": "/api/cron/sync-pedido-itens",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/daily-summary",
      "schedule": "0 10 * * *"
    }
  ]
}
```

`0 10 * * *` UTC = **07:00 BRT** todo dia.

- [ ] **Step 2: Verificar JSON válido**

Run:
```powershell
Get-Content vercel.json | ConvertFrom-Json | Out-Null
```
Expected: sem erro (saída vazia).

- [ ] **Step 3: Commit**

```powershell
git add vercel.json
git commit -m "chore(cron): register /api/cron/daily-summary at 07:00 BRT"
```

---

## Task 7: Documentar envs no `CLAUDE.md`

**Files:**
- Modify: `../CLAUDE.md` (fora do git do `rigel/`; editar sem commitar)

**Contexto:** o `CLAUDE.md` em `Ashmont/Rigel/CLAUDE.md` está um nível acima do repo `rigel/`. O diretório pai **não** é um repositório git. Apenas editar o arquivo; não há commit.

- [ ] **Step 1: Localizar a seção "Environment Variables"**

Em `C:\Users\misae\Documents\Dev\Ashmont\Rigel\CLAUDE.md`, achar o bloco que começa com `## Environment Variables` e a lista que termina em:

```
- `VHSYS_ACCESS_TOKEN`, `VHSYS_SECRET_ACCESS_TOKEN` — VHSys ERP API
```

- [ ] **Step 2: Adicionar novas envs logo após VHSys**

```markdown
- `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME` — Evolution API (envio de WhatsApp)
- `WHATSAPP_RECIPIENT_NUMBER` — número do destinatário em formato internacional sem `+` (ex.: `5581998735441`)
- `OPENAI_API_KEY`, `OPENAI_MODEL` — OpenAI (reservadas; sem uso atual)
```

- [ ] **Step 3: Sem commit**

Arquivo está fora do repo. Apenas confirmar visualmente que a edição foi salva.

---

## Task 8: Verificação end-to-end final

**Files:** nenhum

- [ ] **Step 1: Confirmar testes individuais ainda passam**

Run os três scripts em sequência:
```powershell
npx tsx scripts/test-daily-summary-format.ts
npx tsx --env-file=.env.local scripts/test-daily-summary-data.ts
npx tsx --env-file=.env.local scripts/smoke-evolution.ts
```
Expected: cada um termina com `✓ ...` e exit code 0.

- [ ] **Step 2: Build de produção**

Run:
```powershell
npm run build
```
Expected: build conclui sem erros (warning de lint é aceitável).

- [ ] **Step 3: Hit final no endpoint via dev server**

Mesma sequência da Task 5 Step 2 — confirma:
- HTTP 200.
- Mensagem chega no WhatsApp com formatação Markdown correta.
- Conteúdo bate com o que os scripts `test-daily-summary-data.ts` e `test-daily-summary-format.ts` mostraram.

- [ ] **Step 4: Checklist pré-deploy (documentar, não executar)**

Imprimir essa checklist em formato de comentário no commit ou compartilhar com o usuário antes do merge:

```
[ ] Plano Vercel suporta 3 crons (Hobby permite 2 → precisa Pro)
[ ] Envs configuradas no painel Vercel (Production):
    - EVOLUTION_API_URL
    - EVOLUTION_API_KEY
    - EVOLUTION_INSTANCE_NAME
    - WHATSAPP_RECIPIENT_NUMBER (trocar para número do gestor antes do go-live)
    - CRON_SECRET (já existe, confirmar)
[ ] Após deploy, hit manual via curl com CRON_SECRET de prod para validar
[ ] No dia seguinte: monitorar logs Vercel às 10:00 UTC
```

- [ ] **Step 5: Sem commit nesta task** — apenas verificação. Se algo falhar, voltar à task correspondente.

---

## Notas finais

- **Status do número de teste:** o `WHATSAPP_RECIPIENT_NUMBER` em `.env.local` já é o número de teste do dev. **Trocar para o número do gestor apenas no painel Vercel de produção**, depois que a feature estiver mergeada e validada.
- **Endpoint Evolution v2:** o plano assume `/message/sendText/{instance}` com header `apikey` e body `{ number, text }`. Se a primeira chamada falhar com 404 ou erro de schema, validar contra a doc oficial e ajustar o body em `src/lib/evolution/client.ts` antes de prosseguir.
- **Sem cache Redis** para `fetchDailySummary` — cron roda 1×/dia, cache não ajuda.
- **DRY/YAGNI respeitado:** sem helpers especulativos, sem multi-destinatário, sem endpoint de teste.
