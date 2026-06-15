# Saúde do sync VHSys — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma camada de saúde ao sync VHSys→Supabase: detectar entidades travadas e divergência de contagem, e disparar um alerta consolidado por WhatsApp para um número técnico dedicado.

**Architecture:** Um módulo de lógica pura (`src/lib/sync/health.ts`) decide o que está travado/divergente a partir de leituras do `sync_log` e de contagens; um cron horário (`/api/cron/sync-health`) orquestra as checagens e envia o resumo via Evolution. O envio é generalizado para aceitar um destinatário arbitrário. `pedido_itens` passa a registrar no `sync_log` para entrar no mesmo monitor.

**Tech Stack:** Next.js 15 (App Router, route handlers), Supabase PostgREST, VHSys REST client, Evolution API (WhatsApp), Vercel Cron. Testes são scripts `tsx` (não há framework de unit).

**Spec:** `docs/superpowers/specs/2026-06-15-sync-health-monitoring-design.md`

---

## File Structure

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/lib/evolution/client.ts` (modificar) | Extrair `sendWhatsAppTextTo(recipientRaw, text)`; `sendWhatsAppText` delega nele |
| `src/lib/sync/incremental.ts` (modificar) | Exportar `entitiesForEmpresa` para reuso |
| `src/lib/sync/health.ts` (criar) | `syncTargets`, funções puras `evaluateStaleness`/`evaluateDivergence`/`formatHealthReport`, e wrappers de DB `checkStaleness`/`checkDivergence` |
| `src/lib/sync/pedido-itens.ts` (modificar) | Gravar linha no `sync_log` ao final do run |
| `src/app/api/cron/sync-health/route.ts` (criar) | Endpoint do cron: orquestra checagens + envio |
| `vercel.json` (modificar) | Nova entrada de cron horária |
| `CLAUDE.md` (modificar) | Documentar `WHATSAPP_TECH_ALERT_NUMBER` |
| `scripts/test-health-staleness.ts` (criar) | Testa `evaluateStaleness` |
| `scripts/test-health-divergence.ts` (criar) | Testa `evaluateDivergence` |
| `scripts/test-health-format.ts` (criar) | Testa `formatHealthReport` |
| `scripts/smoke-sync-health.ts` (criar) | Smoke read-only contra DB/VHSys reais (manual) |

**Reference (referenced across tasks) — tipos e constantes definidos na Task 2, usados nas Tasks 3–7:**

```ts
// definidos em src/lib/sync/health.ts
type SyncSource = "incremental" | "pedido_itens";
interface SyncTarget { empresa: EmpresaSlug; entity: string; source: SyncSource; endpoint?: string; }
interface SyncLogRow { entity: string; empresa: string; status: string; error_message: string | null; last_sync_at: string; }
export interface StaleEntity { empresa: string; entity: string; source: SyncSource; lastSuccessAt: string | null; staleForMs: number; lastError: string | null; }
export interface DivergedEntity { empresa: string; entity: string; vhsysTotal: number; supabaseCount: number; deltaPct: number; }
```

---

## Task 1: Generalizar envio do Evolution para destinatário arbitrário

**Files:**
- Modify: `src/lib/evolution/client.ts`
- Test: `scripts/smoke-evolution.ts` (já existe; não alterar — validação manual)

- [ ] **Step 1: Refatorar `sendWhatsAppText` extraindo `sendWhatsAppTextTo`**

Substituir a função `sendWhatsAppText` atual (linhas 80–123) por estas duas funções. Também generalizar a mensagem de erro de `parseRecipients` (linha 31) para não citar uma env específica.

Em `parseRecipients`, trocar a linha:
```ts
    throw new Error("WHATSAPP_RECIPIENT_NUMBER has no valid recipients");
```
por:
```ts
    throw new Error("Nenhum destinatário de WhatsApp válido na lista");
```

Substituir a função `sendWhatsAppText` por:
```ts
/**
 * Envia uma mensagem de texto via Evolution API v2 para uma lista CSV arbitrária
 * de destinatários. Envios sequenciais, cada um com 3 retries (backoff 0/1s/3s).
 * Falha de um destinatário NÃO bloqueia os demais; só lança se TODOS falharem.
 */
export async function sendWhatsAppTextTo(
  recipientRaw: string | undefined,
  text: string,
): Promise<void> {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE_NAME;

  if (!apiUrl || !apiKey || !instance) {
    throw new Error(
      "Evolution API not configured (missing EVOLUTION_API_URL/KEY/INSTANCE)",
    );
  }
  if (!recipientRaw) {
    throw new Error("sendWhatsAppTextTo: recipientRaw vazio");
  }

  const recipients = parseRecipients(recipientRaw);
  const url = `${apiUrl.replace(/\/$/, "")}/message/sendText/${encodeURIComponent(instance)}`;
  const headers = {
    "Content-Type": "application/json",
    apikey: apiKey,
  };

  const failures: { number: string; err: unknown }[] = [];

  for (const number of recipients) {
    try {
      await sendOneRecipient(url, headers, number, text);
      console.log(`[evolution] sent to ${maskNumber(number)}`);
    } catch (err) {
      console.error(`[evolution] failed for ${maskNumber(number)}:`, err);
      failures.push({ number, err });
    }
  }

  if (failures.length === recipients.length) {
    const summary = failures
      .slice(0, 3)
      .map((f) => `${maskNumber(f.number)}: ${f.err}`)
      .join(" | ");
    throw new Error(
      `Evolution send failed for all ${recipients.length} recipients: ${summary}`,
    );
  }
}

/**
 * Envia para os destinatários do cliente (WHATSAPP_RECIPIENT_NUMBER).
 * Mantém a assinatura usada pelo daily-summary.
 */
export async function sendWhatsAppText(text: string): Promise<void> {
  const recipientRaw = process.env.WHATSAPP_RECIPIENT_NUMBER;
  if (!recipientRaw) {
    throw new Error("WHATSAPP_RECIPIENT_NUMBER not configured");
  }
  return sendWhatsAppTextTo(recipientRaw, text);
}
```

- [ ] **Step 2: Verificar typecheck e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors (o aviso pré-existente em `src/lib/supabase/fetch-all.ts` é aceitável).

- [ ] **Step 3: Verificar que o consumidor existente não quebrou**

Run: `npx tsx --env-file=.env.local -e "import('./src/lib/evolution/client.ts').then(m => console.log(typeof m.sendWhatsAppText, typeof m.sendWhatsAppTextTo))"`
Expected: `function function`

- [ ] **Step 4: Commit**

```bash
git add src/lib/evolution/client.ts
git commit -m "refactor(evolution): extrair sendWhatsAppTextTo para destinatario arbitrario

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 2: `health.ts` — alvos + `evaluateStaleness` (lógica pura)

**Files:**
- Create: `src/lib/sync/health.ts`
- Modify: `src/lib/sync/incremental.ts` (exportar `entitiesForEmpresa`)
- Test: `scripts/test-health-staleness.ts`

- [ ] **Step 1: Exportar `entitiesForEmpresa` do incremental**

Em `src/lib/sync/incremental.ts`, trocar a linha 21:
```ts
function entitiesForEmpresa(empresa: EmpresaSlug): typeof ENTITIES[number][] {
```
por:
```ts
export function entitiesForEmpresa(empresa: EmpresaSlug): typeof ENTITIES[number][] {
```

- [ ] **Step 2: Escrever o teste falho de `evaluateStaleness`**

Create `scripts/test-health-staleness.ts`:
```ts
// Testa evaluateStaleness (lógica pura, sem DB).
// USO: npx tsx --env-file=.env.local scripts/test-health-staleness.ts
import { evaluateStaleness, syncTargets, type StaleEntity } from "../src/lib/sync/health";

const now = new Date("2026-06-15T14:00:00.000Z");
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();

function findStale(stale: StaleEntity[], entity: string): StaleEntity | undefined {
  return stale.find((s) => s.entity === entity && s.empresa === "rigel_fabricante");
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function main() {
  const targets = syncTargets();

  // 1. sucesso recente em todas as entidades incrementais → nada travado
  const allRecent = targets.map((t) => ({
    entity: t.entity, empresa: t.empresa, status: "success",
    error_message: null, last_sync_at: minutesAgo(10),
  }));
  assert(evaluateStaleness(targets, allRecent, now).length === 0, "sucesso recente não deveria travar");

  // 2. pedidos sem sucesso há 120min (> limiar 90min do incremental) → travado, com último erro
  const pedidosStale = [
    ...allRecent.filter((r) => r.entity !== "pedidos"),
    { entity: "pedidos", empresa: "rigel_fabricante", status: "error",
      error_message: "code 404 — Erro ao comunicar com a API", last_sync_at: minutesAgo(5) },
    { entity: "pedidos", empresa: "rigel_fabricante", status: "success",
      error_message: null, last_sync_at: minutesAgo(120) },
  ];
  const r2 = evaluateStaleness(targets, pedidosStale, now);
  const p = findStale(r2, "pedidos");
  assert(!!p, "pedidos deveria estar travado");
  assert(p!.lastError === "code 404 — Erro ao comunicar com a API", "deveria anexar último erro");

  // 3. erro recente MAS sucesso recente → saudável (prova auto-cura)
  const recentErrorButSuccess = [
    ...allRecent.filter((r) => r.entity !== "clientes"),
    { entity: "clientes", empresa: "rigel_fabricante", status: "error",
      error_message: "blip", last_sync_at: minutesAgo(2) },
    { entity: "clientes", empresa: "rigel_fabricante", status: "success",
      error_message: null, last_sync_at: minutesAgo(20) },
  ];
  assert(!findStale(evaluateStaleness(targets, recentErrorButSuccess, now), "clientes"),
    "sucesso recente apesar de erro recente não deveria travar");

  // 4. nunca houve sucesso → travado
  const noSuccess = allRecent.filter((r) => r.entity !== "produtos");
  const r4 = evaluateStaleness(targets, noSuccess, now);
  const prod = findStale(r4, "produtos");
  assert(!!prod, "entidade sem sucesso deveria travar");
  assert(prod!.lastSuccessAt === null, "lastSuccessAt deveria ser null");

  console.log("PASS: evaluateStaleness");
}

main();
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npx tsx --env-file=.env.local scripts/test-health-staleness.ts`
Expected: FAIL (`Cannot find module` ou `evaluateStaleness is not a function` — `health.ts` ainda não existe).

- [ ] **Step 4: Criar `src/lib/sync/health.ts` com alvos + `evaluateStaleness`**

```ts
// src/lib/sync/health.ts
// Monitor de saúde do sync VHSys: detecta entidades travadas e divergência de
// contagem. A lógica de decisão é pura (testável sem DB); os wrappers checkX
// fazem as leituras. Ver docs/superpowers/specs/2026-06-15-sync-health-monitoring-design.md
import type { SupabaseClient } from "@supabase/supabase-js";
import { vhsysGet } from "@/lib/vhsys/client";
import { EMPRESAS, type EmpresaSlug } from "@/lib/empresas";
import { entitiesForEmpresa } from "@/lib/sync/incremental";
import { TABLES_WITH_EMPRESA_PK } from "@/lib/sync/multi-empresa";

// Intervalos esperados por source, em minutos (espelham o vercel.json).
const EXPECTED_INTERVAL_MIN: Record<SyncSource, number> = { incremental: 30, pedido_itens: 5 };
const STALE_FACTOR = 3;
const DIVERGENCE_TOLERANCE = 0.02;
const DIVERGENCE_MIN_TOTAL = 50;

export type SyncSource = "incremental" | "pedido_itens";

export interface SyncTarget {
  empresa: EmpresaSlug;
  entity: string;
  source: SyncSource;
  endpoint?: string; // endpoint de listagem VHSys; presente nas entidades incrementais
}

interface SyncLogRow {
  entity: string;
  empresa: string;
  status: string;
  error_message: string | null;
  last_sync_at: string;
}

export interface StaleEntity {
  empresa: string;
  entity: string;
  source: SyncSource;
  lastSuccessAt: string | null;
  staleForMs: number;
  lastError: string | null;
}

export interface DivergedEntity {
  empresa: string;
  entity: string;
  vhsysTotal: number;
  supabaseCount: number;
  deltaPct: number;
}

/** Lista (empresa, entidade) que de fato sincronizamos — derivada do mesmo
 *  entitiesForEmpresa do incremental para nunca divergir do que roda — mais
 *  o pedido_itens da Rigel Fabricante. */
export function syncTargets(): SyncTarget[] {
  const targets: SyncTarget[] = [];
  for (const e of EMPRESAS) {
    for (const ent of entitiesForEmpresa(e.slug)) {
      targets.push({ empresa: e.slug, entity: ent.name, source: "incremental", endpoint: ent.endpoint });
    }
  }
  targets.push({ empresa: "rigel_fabricante", entity: "pedido_itens", source: "pedido_itens" });
  return targets;
}

/** Decide quais alvos estão travados (sem sucesso há mais que 3× o intervalo
 *  esperado). Puro: recebe as linhas do sync_log já carregadas. */
export function evaluateStaleness(targets: SyncTarget[], rows: SyncLogRow[], now: Date): StaleEntity[] {
  const stale: StaleEntity[] = [];
  for (const t of targets) {
    const forTarget = rows
      .filter((r) => r.entity === t.entity && r.empresa === t.empresa)
      .sort((a, b) => b.last_sync_at.localeCompare(a.last_sync_at)); // desc; ISO ordena cronologicamente
    const lastSuccess = forTarget.find((r) => r.status === "success") ?? null;
    const latest = forTarget[0] ?? null;
    const thresholdMs = EXPECTED_INTERVAL_MIN[t.source] * STALE_FACTOR * 60_000;
    const staleForMs = lastSuccess
      ? now.getTime() - new Date(lastSuccess.last_sync_at).getTime()
      : Infinity;
    if (staleForMs > thresholdMs) {
      stale.push({
        empresa: t.empresa,
        entity: t.entity,
        source: t.source,
        lastSuccessAt: lastSuccess?.last_sync_at ?? null,
        staleForMs,
        lastError: latest && latest.status === "error" ? latest.error_message : null,
      });
    }
  }
  return stale;
}

/** Lê o sync_log (últimos 7 dias) e avalia staleness. */
export async function checkStaleness(supabase: SupabaseClient, now: Date = new Date()): Promise<StaleEntity[]> {
  const sinceISO = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("sync_log")
    .select("entity, empresa, status, error_message, last_sync_at")
    .gte("last_sync_at", sinceISO)
    .order("last_sync_at", { ascending: false });
  if (error) throw error;
  return evaluateStaleness(syncTargets(), (data ?? []) as SyncLogRow[], now);
}
```

> Nota: `vhsysGet`, `TABLES_WITH_EMPRESA_PK` e `DIVERGENCE_*` já estão importados/declarados aqui porque serão usados na Task 3. Se o lint reclamar de "unused" antes da Task 3, prossiga — a Task 3 os consome no mesmo PR. (Se preferir, adicione-os na Task 3; mas mantê-los aqui evita reabrir os imports.)

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npx tsx --env-file=.env.local scripts/test-health-staleness.ts`
Expected: `PASS: evaluateStaleness`

- [ ] **Step 6: Commit**

```bash
git add src/lib/sync/health.ts src/lib/sync/incremental.ts scripts/test-health-staleness.ts
git commit -m "feat(health): syncTargets + evaluateStaleness com teste

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 3: `health.ts` — `evaluateDivergence` + `checkDivergence`

**Files:**
- Modify: `src/lib/sync/health.ts`
- Test: `scripts/test-health-divergence.ts`

- [ ] **Step 1: Escrever o teste falho de `evaluateDivergence`**

Create `scripts/test-health-divergence.ts`:
```ts
// Testa evaluateDivergence (lógica pura).
// USO: npx tsx --env-file=.env.local scripts/test-health-divergence.ts
import { evaluateDivergence } from "../src/lib/sync/health";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function main() {
  // faltando > tolerância (2%) → flag
  const missing = evaluateDivergence(190115, 180000);
  assert(missing !== null, "deveria flagar falta acima da tolerância");
  assert(missing!.deltaPct < 0, "deltaPct deveria ser negativo");

  // dentro da tolerância (gap < 2%) → não flag
  assert(evaluateDivergence(190115, 188420) === null, "gap dentro da tolerância não deveria flagar");

  // excedente (temos mais que a VHSys) → não flag
  assert(evaluateDivergence(190115, 195000) === null, "excedente não deveria flagar");

  // conjunto minúsculo (< 50) → ignorado
  assert(evaluateDivergence(40, 0) === null, "conjunto < 50 deveria ser ignorado");

  console.log("PASS: evaluateDivergence");
}

main();
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx tsx --env-file=.env.local scripts/test-health-divergence.ts`
Expected: FAIL (`evaluateDivergence is not a function`).

- [ ] **Step 3: Adicionar `evaluateDivergence` e `checkDivergence` ao `health.ts`**

Anexar ao final de `src/lib/sync/health.ts`:
```ts
/** Decide se a contagem do Supabase divergiu da VHSys na direção perigosa
 *  (temos MENOS que a origem, acima da tolerância). Puro. Retorna null quando
 *  não há divergência relevante. */
export function evaluateDivergence(
  vhsysTotal: number,
  supabaseCount: number,
): { vhsysTotal: number; supabaseCount: number; deltaPct: number } | null {
  if (vhsysTotal < DIVERGENCE_MIN_TOTAL) return null;
  if (supabaseCount >= vhsysTotal * (1 - DIVERGENCE_TOLERANCE)) return null;
  return { vhsysTotal, supabaseCount, deltaPct: (supabaseCount - vhsysTotal) / vhsysTotal };
}

/** Para cada entidade de listagem, compara paging.total da VHSys (1 request)
 *  com a contagem no Supabase. Falha de VHSys numa entidade = não verificável
 *  (pulada, não conta como divergência). */
export async function checkDivergence(supabase: SupabaseClient): Promise<DivergedEntity[]> {
  const out: DivergedEntity[] = [];
  for (const t of syncTargets()) {
    if (!t.endpoint) continue;
    try {
      const resp = await vhsysGet(t.empresa, t.endpoint, { limit: "1" });
      const vhsysTotal = resp.paging?.total ?? 0;

      let q = supabase.from(t.entity).select("*", { count: "exact", head: true });
      if (TABLES_WITH_EMPRESA_PK.has(t.entity)) q = q.eq("empresa", t.empresa);
      const { count } = await q;
      const supabaseCount = count ?? 0;

      const verdict = evaluateDivergence(vhsysTotal, supabaseCount);
      if (verdict) out.push({ empresa: t.empresa, entity: t.entity, ...verdict });
    } catch (e) {
      console.warn(`[sync-health] divergência não verificável para ${t.empresa}/${t.entity}:`, e);
    }
  }
  return out;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx tsx --env-file=.env.local scripts/test-health-divergence.ts`
Expected: `PASS: evaluateDivergence`

- [ ] **Step 5: Verificar typecheck/lint (agora todos os imports do health.ts estão em uso)**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sync/health.ts scripts/test-health-divergence.ts
git commit -m "feat(health): evaluateDivergence + checkDivergence com teste

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 4: `health.ts` — `formatHealthReport`

**Files:**
- Modify: `src/lib/sync/health.ts`
- Test: `scripts/test-health-format.ts`

- [ ] **Step 1: Escrever o teste falho de `formatHealthReport`**

Create `scripts/test-health-format.ts`:
```ts
// Testa formatHealthReport (lógica pura).
// USO: npx tsx --env-file=.env.local scripts/test-health-format.ts
import { formatHealthReport, type StaleEntity, type DivergedEntity } from "../src/lib/sync/health";

const now = new Date("2026-06-15T09:00:00.000Z");

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const stale: StaleEntity[] = [
  { empresa: "rigel_fabricante", entity: "pedidos", source: "incremental",
    lastSuccessAt: "2026-06-15T04:40:00.000Z", staleForMs: 260 * 60_000,
    lastError: "code 404 — Erro ao comunicar com a API" },
  { empresa: "rigel_fabricante", entity: "pedido_itens", source: "pedido_itens",
    lastSuccessAt: null, staleForMs: Infinity, lastError: null },
];
const diverged: DivergedEntity[] = [
  { empresa: "rigel_fabricante", entity: "clientes", vhsysTotal: 190115, supabaseCount: 180000, deltaPct: -0.0532 },
];

function main() {
  // tudo saudável → null
  assert(formatHealthReport([], [], [], now) === null, "saudável deveria retornar null");

  // só travadas
  const onlyStale = formatHealthReport(stale, [], [], now)!;
  assert(onlyStale.includes("Travadas:"), "deveria ter seção Travadas");
  assert(onlyStale.includes("[rigel_fabricante] pedidos"), "deveria listar pedidos");
  assert(onlyStale.includes("code 404"), "deveria mostrar último erro");
  assert(onlyStale.includes("sem sucesso registrado"), "pedido_itens nunca sincronizou");
  assert(!onlyStale.includes("divergência"), "não deveria ter divergência");
  assert(onlyStale.includes("09:00 UTC"), "deveria ter o rodapé com hora");

  // só divergência
  const onlyDiv = formatHealthReport([], diverged, [], now)!;
  assert(onlyDiv.includes("Suspeita de divergência"), "deveria ter seção de divergência");
  assert(onlyDiv.includes("clientes"), "deveria listar clientes");

  // com erro do próprio monitor
  const withErr = formatHealthReport([], [], ["staleness: boom"], now)!;
  assert(withErr.includes("Falhas no monitor:"), "deveria ter seção de falhas do monitor");

  console.log("PASS: formatHealthReport");
}

main();
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx tsx --env-file=.env.local scripts/test-health-format.ts`
Expected: FAIL (`formatHealthReport is not a function`).

- [ ] **Step 3: Adicionar `formatHealthReport` + helper ao `health.ts`**

Anexar ao final de `src/lib/sync/health.ts`:
```ts
function formatStaleFor(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `há ${h}h${String(m).padStart(2, "0")}` : `há ${m}min`;
}

/** Monta o resumo consolidado (PT) ou null quando não há nada a reportar. */
export function formatHealthReport(
  stale: StaleEntity[],
  diverged: DivergedEntity[],
  monitorErrors: string[],
  now: Date,
): string | null {
  if (stale.length === 0 && diverged.length === 0 && monitorErrors.length === 0) return null;

  const lines: string[] = ["🔴 Rigel — Saúde do sync", ""];

  if (stale.length) {
    lines.push("Travadas:");
    for (const e of stale) {
      const when = Number.isFinite(e.staleForMs)
        ? `sem sucesso ${formatStaleFor(e.staleForMs)}`
        : "sem sucesso registrado";
      lines.push(`• [${e.empresa}] ${e.entity} — ${when}`);
      if (e.lastError) lines.push(`  último erro: ${e.lastError}`);
    }
    lines.push("");
  }

  if (diverged.length) {
    lines.push("Suspeita de divergência (diário):");
    for (const d of diverged) {
      const pct = (d.deltaPct * 100).toLocaleString("pt-BR", {
        maximumFractionDigits: 1,
        signDisplay: "always",
      });
      lines.push(
        `• ${d.entity} — Supabase ${d.supabaseCount.toLocaleString("pt-BR")} vs VHSys ${d.vhsysTotal.toLocaleString("pt-BR")} (${pct}%)`,
      );
    }
    lines.push("");
  }

  if (monitorErrors.length) {
    lines.push("Falhas no monitor:");
    for (const m of monitorErrors) lines.push(`• ${m}`);
    lines.push("");
  }

  const hh = String(now.getUTCHours()).padStart(2, "0");
  lines.push(`Verificado às ${hh}:00 UTC`);
  return lines.join("\n");
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx tsx --env-file=.env.local scripts/test-health-format.ts`
Expected: `PASS: formatHealthReport`

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync/health.ts scripts/test-health-format.ts
git commit -m "feat(health): formatHealthReport com teste

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 5: `pedido_itens` grava no `sync_log`

**Files:**
- Modify: `src/lib/sync/pedido-itens.ts:233-245`

- [ ] **Step 1: Inserir a gravação no sync_log antes do return**

Em `src/lib/sync/pedido-itens.ts`, localizar (perto da linha 244):
```ts
  console.log(`[sync-itens] done:`, stats);
  return stats;
```
Substituir por:
```ts
  // Registra no sync_log para o monitor de saúde enxergar o pedido_itens igual
  // às demais entidades. status='error' só quando abortado por falha upstream;
  // run normal com fila ainda drenando (remaining>0) é sucesso, por design.
  try {
    await supabase.from("sync_log").insert({
      entity: "pedido_itens",
      empresa: "rigel_fabricante",
      records_synced: stats.itensUpserted,
      status: aborted ? "error" : "success",
      error_message: aborted
        ? `aborted: ${upstreamFailures} falhas upstream, ${stats.remaining} restantes`
        : null,
      duration_ms: stats.durationMs,
    });
  } catch (logError) {
    console.error("[sync-itens] falha ao gravar sync_log:", logError);
  }

  console.log(`[sync-itens] done:`, stats);
  return stats;
```

- [ ] **Step 2: Verificar typecheck/lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors.

- [ ] **Step 3: Smoke read-only do sync de itens (opcional, requer envs reais)**

Run: `npx tsx --env-file=.env.local scripts/run-pedido-itens-backfill.ts` (script já existente que chama `runPedidoItensSync`)
Expected: termina sem erro e os logs mostram `[sync-itens] done`. Depois, confirmar a linha gravada:
`npx tsx --env-file=.env.local -e "import('./src/lib/supabase/client.ts').then(async ({createSupabaseServer})=>{const s=createSupabaseServer();const {data}=await s.from('sync_log').select('entity,status,records_synced,last_sync_at').eq('entity','pedido_itens').order('last_sync_at',{ascending:false}).limit(1);console.log(data);})"`
Expected: uma linha com `entity: 'pedido_itens'`.

> Se as envs locais não permitirem rodar o sync completo, pule o Step 3 — a verificação real acontece no deploy. Não bloquear o commit por isso.

- [ ] **Step 4: Commit**

```bash
git add src/lib/sync/pedido-itens.ts
git commit -m "feat(sync-itens): gravar resultado no sync_log para o monitor de saude

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 6: Endpoint do cron `/api/cron/sync-health` + vercel.json

**Files:**
- Create: `src/app/api/cron/sync-health/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Criar o route handler**

Create `src/app/api/cron/sync-health/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/auth/cron";
import { createSupabaseServer } from "@/lib/supabase/client";
import {
  checkStaleness,
  checkDivergence,
  formatHealthReport,
  type StaleEntity,
  type DivergedEntity,
} from "@/lib/sync/health";
import { sendWhatsAppTextTo } from "@/lib/evolution/client";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Hora UTC em que a checagem de divergência (mais cara) roda, 1×/dia, antes do
// daily-summary das 10h UTC.
const DIVERGENCE_HOUR_UTC = 9;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServer();
  const now = new Date();
  const monitorErrors: string[] = [];

  let stale: StaleEntity[] = [];
  try {
    stale = await checkStaleness(supabase, now);
  } catch (e) {
    monitorErrors.push(`staleness: ${String(e)}`);
  }

  let diverged: DivergedEntity[] = [];
  if (now.getUTCHours() === DIVERGENCE_HOUR_UTC) {
    try {
      diverged = await checkDivergence(supabase);
    } catch (e) {
      monitorErrors.push(`divergence: ${String(e)}`);
    }
  }

  const report = formatHealthReport(stale, diverged, monitorErrors, now);
  if (report) {
    const recipient = process.env.WHATSAPP_TECH_ALERT_NUMBER;
    if (recipient) {
      try {
        await sendWhatsAppTextTo(recipient, report);
      } catch (e) {
        console.error("[sync-health] envio do alerta falhou:", e);
      }
    } else {
      console.warn("[sync-health] WHATSAPP_TECH_ALERT_NUMBER não configurado, pulando envio");
    }
  }

  return NextResponse.json({ healthy: report === null, stale, diverged, monitorErrors });
}
```

- [ ] **Step 2: Adicionar a entrada de cron no `vercel.json`**

Em `vercel.json`, dentro do array `crons`, adicionar (após a entrada do `sync-pedido-itens`):
```json
    {
      "path": "/api/cron/sync-health",
      "schedule": "0 * * * *"
    },
```
O array final deve ficar com 4 entradas (incremental, sync-pedido-itens, sync-health, daily-summary). Garantir vírgulas corretas e JSON válido.

- [ ] **Step 3: Verificar typecheck, lint e build**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors.
Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('vercel.json OK')"`
Expected: `vercel.json OK`

- [ ] **Step 4: Smoke local do endpoint (opcional, requer dev server + CRON_SECRET)**

Em um terminal: `npx portless rigel next dev --turbopack`
Em outro:
```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" "http://localhost:$PORT/api/cron/sync-health" | head -c 400
```
(substitua `$PORT` pela porta do portless). Expected: JSON `{"healthy":...,"stale":[...],...}`. Sem `CRON_SECRET` correto → `{"error":"Unauthorized"}` (401), que também valida a auth.

> Se não der pra subir o dev server agora, pule — a Task 7 inclui um smoke read-only que não depende do servidor HTTP.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/sync-health/route.ts vercel.json
git commit -m "feat(cron): endpoint sync-health horario + entrada no vercel.json

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 7: Smoke read-only + documentação da env

**Files:**
- Create: `scripts/smoke-sync-health.ts`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Criar o smoke read-only contra dados reais**

Create `scripts/smoke-sync-health.ts`:
```ts
// Smoke read-only do monitor de saúde contra DB/VHSys reais. Não envia WhatsApp,
// não escreve nada. Use pra inspecionar o que o cron veria agora.
// USO: npx tsx --env-file=.env.local scripts/smoke-sync-health.ts
import { createSupabaseServer } from "../src/lib/supabase/client";
import { checkStaleness, checkDivergence, formatHealthReport } from "../src/lib/sync/health";

async function main() {
  const supabase = createSupabaseServer();
  const now = new Date();

  const stale = await checkStaleness(supabase, now);
  console.log("Travadas:", JSON.stringify(stale, null, 2));

  // Roda divergência sempre no smoke (ignora o gate de hora) pra dar visibilidade.
  const diverged = await checkDivergence(supabase);
  console.log("Divergências:", JSON.stringify(diverged, null, 2));

  const report = formatHealthReport(stale, diverged, [], now);
  console.log("\n--- Mensagem que seria enviada ---");
  console.log(report ?? "(saudável — nenhum alerta)");
}

main().catch((e) => {
  console.error("smoke falhou:", e);
  process.exit(1);
});
```

- [ ] **Step 2: Rodar o smoke (requer envs reais)**

Run: `npx tsx --env-file=.env.local scripts/smoke-sync-health.ts`
Expected: imprime as listas (provavelmente vazias se tudo estiver saudável) e a mensagem `(saudável — nenhum alerta)` ou um resumo. Sem erro de execução.

> Se as envs locais não tiverem acesso ao DB/VHSys, registre isso e siga — a validação real é no deploy.

- [ ] **Step 3: Documentar a nova env no `CLAUDE.md`**

Em `CLAUDE.md`, na seção `## Environment Variables`, logo após a linha do `WHATSAPP_RECIPIENT_NUMBER`, adicionar:
```markdown
- `WHATSAPP_TECH_ALERT_NUMBER` — destinatário(s) dos alertas técnicos de saúde do sync (cron `/api/cron/sync-health`). Mesmo formato do `WHATSAPP_RECIPIENT_NUMBER` (CSV, internacional sem `+`). Separado do número do cliente. Se ausente, o monitor não envia (degrada graciosamente).
```

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke-sync-health.ts CLAUDE.md
git commit -m "chore(health): smoke read-only + documentar WHATSAPP_TECH_ALERT_NUMBER

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 8: Verificação final e configuração de produção

**Files:** nenhum (verificação + ops)

- [ ] **Step 1: Rodar todos os testes puros**

Run:
```bash
npx tsx --env-file=.env.local scripts/test-health-staleness.ts && \
npx tsx --env-file=.env.local scripts/test-health-divergence.ts && \
npx tsx --env-file=.env.local scripts/test-health-format.ts
```
Expected: três linhas `PASS:`.

- [ ] **Step 2: Typecheck + lint + build final**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: typecheck 0 errors; lint só o aviso pré-existente; build conclui. O build deve listar a nova rota `/api/cron/sync-health`.

- [ ] **Step 3: Configurar `WHATSAPP_TECH_ALERT_NUMBER` na Vercel**

Ação manual do usuário (não automatizável daqui): adicionar a env `WHATSAPP_TECH_ALERT_NUMBER` no projeto da Vercel (Production) com o número técnico (formato internacional sem `+`). Sem isso, o cron roda mas não envia alerta (loga aviso).

- [ ] **Step 4: Confirmar integração após deploy**

Após o deploy, disparar o endpoint manualmente para validar ponta a ponta:
```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" "https://<deploy-url>/api/cron/sync-health"
```
Expected: JSON `{"healthy":...}`. Se houver algo travado no momento, confirmar o recebimento da mensagem no número técnico. Se estiver tudo saudável, confirmar que **nenhuma** mensagem foi enviada (silêncio quando ok).

---

## Notas de execução

- **TDD:** Tasks 2–4 seguem write-test → fail → implement → pass. Tasks 1, 5, 6, 7 são de integração/config (sem unit puro) e usam typecheck/lint/smoke como verificação.
- **Ordem importa:** Task 2 deve vir antes da 3 e 4 (define `health.ts` e os tipos). Task 1 (Evolution) é independente e pode ir primeiro. Task 6 depende de 1–4. 
- **Sem mudança de schema:** `sync_log` já tem todas as colunas usadas (`entity`, `empresa`, `records_synced`, `status`, `error_message`, `duration_ms`, `last_sync_at` com DEFAULT NOW()). Nenhuma migration nova.
