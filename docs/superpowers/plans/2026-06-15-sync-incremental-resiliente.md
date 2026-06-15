# Sync incremental resiliente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o sync incremental resistente aos surtos da VHSys — mais tentativas de retry e processamento em streaming com soft deadline, para `pedidos` não travar nem estourar os 60s da Vercel.

**Architecture:** (1) `withRetry` no cliente VHSys sobe de 3→6 tentativas com backoff limitado. (2) O laço por-entidade do incremental passa de "acumula-tudo→upsert" para streaming (página→upsert→próxima) com soft deadline; o watermark só avança quando a janela completa 100% num run. (3) Backlog profundo continua sendo trabalho do backfill+monitor (já existem).

**Tech Stack:** Next.js 15, Supabase PostgREST, cliente REST VHSys, Vercel Cron. Testes são scripts `tsx` rodados via `npx tsx --env-file=.env.local <script>` (não há framework de unit).

**Spec:** `docs/superpowers/specs/2026-06-15-sync-incremental-resiliente-design.md`

---

## File Structure

| Arquivo | Responsabilidade / mudança |
|---------|------------|
| `src/lib/vhsys/client.ts` (modificar) | `withRetry`: 3→6 tentativas, backoff com teto 4s |
| `src/lib/sync/incremental.ts` (modificar) | extrair `streamEntityPages` (loop página→upsert→deadline, testável por DI) e usar no laço por-entidade; `success` só em janela completa; parar run no deadline; remover uso de `vhsysFetchAll` e `BATCH_SIZE` |
| `scripts/test-vhsys-retry.ts` (modificar) | adicionar caso que prova tolerância a >3 falhas |
| `scripts/test-stream-entity-pages.ts` (criar) | testa `streamEntityPages` (completo / deadline / vazio / dedup) com callbacks fake |

**Invariante crítica (não viole):** o `sync_log` com `status='success'` (que avança o watermark) só é gravado quando `streamEntityPages` retorna `complete: true`. Deadline ou exceção nunca gravam `success`.

---

## Task 1: Subir o retry de 3→6 tentativas com backoff limitado

**Files:**
- Modify: `src/lib/vhsys/client.ts` (função `withRetry`, ~linhas 63-75)
- Test: `scripts/test-vhsys-retry.ts`

- [ ] **Step 1: Adicionar caso de teste que falha (tolerância a >3 falhas)**

Abrir `scripts/test-vhsys-retry.ts`. Ele já tem `testRetriesTransient` (falha 2x, 3ª ok) e `testDoesNotRetryAuth`. ADICIONAR esta função nova e chamá-la no `main`:

```ts
async function testToleratesMoreThanThree() {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    // falha nas 3 primeiras, sucesso na 4ª — o código antigo (3 tentativas) falharia aqui
    if (calls < 4) {
      return jsonResponse({ code: 404, status: "error", data: "Erro ao comunicar com a API" });
    }
    return jsonResponse({ code: 200, status: "success", data: [{ id_pedido: 1 }], paging: {} });
  }) as typeof fetch;

  const res = await vhsysGet("rigel_fabricante", "/pedidos", { limit: "1" });
  if (calls !== 4) throw new Error(`esperado 4 chamadas (3 falhas + 1 ok), houve ${calls}`);
  if (!Array.isArray(res.data) || res.data.length !== 1) {
    throw new Error(`esperado data com 1 item, veio ${JSON.stringify(res.data)}`);
  }
  console.log(`PASS: tolera >3 falhas (resolveu em ${calls} tentativas)`);
}
```

E no `main()`, adicionar a chamada após as existentes (dentro do try):
```ts
    await testRetriesTransient();
    await testDoesNotRetryAuth();
    await testToleratesMoreThanThree();
```

- [ ] **Step 2: Rodar o teste e confirmar que FALHA**

Run: `npx tsx --env-file=.env.local scripts/test-vhsys-retry.ts`
Expected: as 2 primeiras passam; `testToleratesMoreThanThree` FALHA com algo como `esperado 4 chamadas (3 falhas + 1 ok), houve 3` (o código atual desiste em 3).

- [ ] **Step 3: Implementar — subir attempts e limitar backoff**

Em `src/lib/vhsys/client.ts`, substituir a função `withRetry` inteira por:
```ts
async function withRetry<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      if (!(error instanceof VHSysTransientError)) throw error;
      lastError = error;
      if (i < attempts - 1) await delay(Math.min(500 * 2 ** i, 4000));
    }
  }
  throw lastError;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que PASSA**

Run: `npx tsx --env-file=.env.local scripts/test-vhsys-retry.ts`
Expected: três linhas `PASS:` (incluindo `tolera >3 falhas (resolveu em 4 tentativas)`). O caso novo leva ~3,5s (backoff 500+1000+2000).

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 erros (o aviso pré-existente em `src/lib/supabase/fetch-all.ts` é aceitável).

- [ ] **Step 6: Commit**

```bash
git add src/lib/vhsys/client.ts scripts/test-vhsys-retry.ts
git commit -m "feat(vhsys): retry 3->6 tentativas com backoff limitado a 4s

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 2: Extrair `streamEntityPages` (streaming + deadline, testável)

**Files:**
- Modify: `src/lib/sync/incremental.ts` (adicionar a função + tipo; ainda sem usar no loop)
- Test: `scripts/test-stream-entity-pages.ts`

- [ ] **Step 1: Escrever o teste que FALHA**

Create `scripts/test-stream-entity-pages.ts`:
```ts
// Testa streamEntityPages: loop página→upsert→deadline (lógica pura via callbacks).
// USO: npx tsx --env-file=.env.local scripts/test-stream-entity-pages.ts
import { streamEntityPages } from "../src/lib/sync/incremental";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}
function page(n: number): Record<string, unknown>[] {
  return Array.from({ length: n }, (_, i) => ({ id_pedido: Math.random() * 1e9 | 0, _i: i }));
}

async function main() {
  // 1. Completo: 250 + 250 + 100 => para na página curta, complete=true
  {
    const pages = [page(250), page(250), page(100)];
    const upserts: number[] = [];
    const res = await streamEntityPages({
      entityName: "pedidos", pk: "id_pedido", deadlineAt: Date.now() + 60_000,
      fetchPage: async (off) => pages[off / 250] ?? [],
      upsertBatch: async (rows) => { upserts.push(rows.length); },
    });
    assert(res.complete === true, "deveria completar");
    assert(res.pagesFetched === 3, `esperado 3 páginas, veio ${res.pagesFetched}`);
    assert(res.synced === 600, `esperado synced=600, veio ${res.synced}`);
    assert(upserts.length === 3, `esperado 3 upserts, veio ${upserts.length}`);
  }

  // 2. Deadline: páginas cheias infinitas, relógio cruza o deadline na 3ª checagem
  {
    let calls = 0;
    const clock = [0, 0, 2000]; // now() é chamado no topo de cada iteração
    const upserts: number[] = [];
    const res = await streamEntityPages({
      entityName: "clientes", pk: "id_cliente", deadlineAt: 1000,
      now: () => clock[calls++],
      fetchPage: async () => page(250),
      upsertBatch: async (rows) => { upserts.push(rows.length); },
    });
    assert(res.complete === false, "deadline deveria deixar complete=false");
    assert(res.pagesFetched === 2, `esperado 2 páginas antes do deadline, veio ${res.pagesFetched}`);
    assert(upserts.length === 2, `esperado 2 upserts parciais, veio ${upserts.length}`);
  }

  // 3. Vazio: primeira página vazia => complete=true, sem upsert
  {
    const upserts: number[] = [];
    const res = await streamEntityPages({
      entityName: "vendedores", pk: "id_vendedor", deadlineAt: Date.now() + 60_000,
      fetchPage: async () => [],
      upsertBatch: async (rows) => { upserts.push(rows.length); },
    });
    assert(res.complete === true, "vazio deveria completar");
    assert(res.synced === 0 && upserts.length === 0, "vazio não deveria upsertar");
  }

  // 4. Dedup por PK dentro da página
  {
    let received = -1;
    const dup = [{ id_cliente: 1 }, { id_cliente: 1 }, { id_cliente: 2 }];
    await streamEntityPages({
      entityName: "clientes", pk: "id_cliente", deadlineAt: Date.now() + 60_000,
      fetchPage: async (off) => (off === 0 ? dup : []),
      upsertBatch: async (rows) => { received = rows.length; },
    });
    assert(received === 2, `dedup deveria deixar 2 linhas, veio ${received}`);
  }

  // 5. fetchPage que lança (retry esgotado) PROPAGA — nunca vira "complete"
  {
    let threw = false;
    try {
      await streamEntityPages({
        entityName: "pedidos", pk: "id_pedido", deadlineAt: Date.now() + 60_000,
        fetchPage: async () => { throw new Error("VHSys [..] GET /pedidos failed: code 404"); },
        upsertBatch: async () => {},
      });
    } catch (e) {
      threw = true;
      assert(/404/.test(String(e)), `erro deveria propagar, veio ${String(e)}`);
    }
    assert(threw, "fetchPage que lança deveria propagar (não completar silenciosamente)");
  }

  console.log("PASS: streamEntityPages");
}

main().catch((e) => { console.error("FAIL:", e instanceof Error ? e.message : e); process.exit(1); });
```

- [ ] **Step 2: Rodar e confirmar que FALHA**

Run: `npx tsx --env-file=.env.local scripts/test-stream-entity-pages.ts`
Expected: FAIL (`streamEntityPages is not a function` / módulo não exporta).

- [ ] **Step 3: Implementar `streamEntityPages` em `incremental.ts`**

Em `src/lib/sync/incremental.ts`, adicionar o import de `MAX_PAGE_SIZE` (a linha de import de endpoints já existe — trocar para incluir):
```ts
import { ENDPOINTS, MAX_PAGE_SIZE } from "@/lib/vhsys/endpoints";
```

E adicionar, logo após o `const BATCH_SIZE = 500;` (ou em qualquer ponto antes de `runIncrementalSync`), a função e o tipo:
```ts
const SOFT_DEADLINE_MS = 45_000;

export interface StreamResult {
  synced: number;
  complete: boolean;
  pagesFetched: number;
}

/** Pagina uma entidade em streaming: fetchPage(offset) -> dedup por PK na página
 *  -> upsertBatch -> próxima, até a página curta (complete) ou o soft deadline
 *  (complete=false). NÃO grava sync_log — quem chama decide (success só quando
 *  complete). fetchPage/upsertBatch são injetados para teste. */
export async function streamEntityPages(args: {
  entityName: string;
  pk: string;
  fetchPage: (offset: number) => Promise<Record<string, unknown>[]>;
  upsertBatch: (rows: Record<string, unknown>[]) => Promise<void>;
  deadlineAt: number;
  now?: () => number;
}): Promise<StreamResult> {
  const now = args.now ?? Date.now;
  let offset = 0;
  let synced = 0;
  let pagesFetched = 0;

  while (true) {
    if (now() >= args.deadlineAt) {
      return { synced, complete: false, pagesFetched };
    }

    const items = await args.fetchPage(offset);
    pagesFetched++;

    if (items.length > 0) {
      if (args.entityName === "pedidos") canonicalizePedidoIds(items);

      const seen = new Set<unknown>();
      const deduped = items.filter((item) => {
        const key = item[args.pk];
        if (key === undefined || seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (deduped.length > 0) await args.upsertBatch(deduped);
      synced += items.length;
    }

    if (items.length < MAX_PAGE_SIZE) {
      return { synced, complete: true, pagesFetched };
    }
    offset += MAX_PAGE_SIZE;
  }
}
```

`canonicalizePedidoIds` já está importado em `incremental.ts` (de `@/lib/sync/initial`). Não usar `vhsysGet` aqui — a chamada real à VHSys é injetada pelo chamador (Task 3).

- [ ] **Step 4: Rodar e confirmar que PASSA**

Run: `npx tsx --env-file=.env.local scripts/test-stream-entity-pages.ts`
Expected: `PASS: streamEntityPages`

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 erros. (Lint pode acusar `SOFT_DEADLINE_MS` como não usado até a Task 3 — NÃO rodar lint como gate aqui; o teste roda via tsx/esbuild que ignora unused. NÃO remover `SOFT_DEADLINE_MS`, é usado na Task 3.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/sync/incremental.ts scripts/test-stream-entity-pages.ts
git commit -m "feat(incremental): streamEntityPages (streaming + soft deadline) com teste

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 3: Usar `streamEntityPages` no laço do incremental

**Files:**
- Modify: `src/lib/sync/incremental.ts` (`runIncrementalSync` + imports)

- [ ] **Step 1: Trocar o import `vhsysFetchAll` por `vhsysGet`**

Em `src/lib/sync/incremental.ts`, linha 3, trocar:
```ts
import { vhsysFetchAll } from "@/lib/vhsys/client";
```
por:
```ts
import { vhsysGet } from "@/lib/vhsys/client";
```

- [ ] **Step 2: Reescrever o corpo de `runIncrementalSync`**

Substituir a função `runIncrementalSync` inteira (de `export async function runIncrementalSync` até o `return results;` final) por:
```ts
export async function runIncrementalSync(): Promise<Record<string, Record<string, number>>> {
  const supabase = createSupabaseServer();
  const results: Record<string, Record<string, number>> = {};
  const runStart = Date.now();
  let deadlineHit = false;

  for (const empresaConfig of EMPRESAS) {
    if (deadlineHit) break;
    const empresa = empresaConfig.slug;
    results[empresa] = {};

    for (const entity of entitiesForEmpresa(empresa)) {
      if (deadlineHit) break;
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
          data_modificacao: previousDayISO(lastSync.split("T")[0]),
        };
        const fields = TABLE_FIELDS[entity.name];
        const writesEmpresaColumn = TABLES_WITH_EMPRESA_PK.has(entity.name);

        const result = await streamEntityPages({
          entityName: entity.name,
          pk: entity.pk,
          deadlineAt: runStart + SOFT_DEADLINE_MS,
          fetchPage: async (offset) => {
            const res = await vhsysGet<Record<string, unknown>>(empresa, entity.endpoint, {
              ...params,
              limit: String(MAX_PAGE_SIZE),
              offset: String(offset),
            });
            return res.data ?? [];
          },
          upsertBatch: async (rows) => {
            const batch = rows.map((item) => ({
              ...(fields ? pickFields(item, fields) : item),
              ...(writesEmpresaColumn ? { empresa } : {}),
              synced_at: new Date().toISOString(),
            }));
            const { error } = await supabase
              .from(entity.name)
              .upsert(batch, { onConflict: onConflictFor(entity.name, entity.pk) });
            if (error) {
              console.error(`[incremental:${empresa}] Error upserting ${entity.name}:`, error);
              throw error;
            }
          },
        });

        const duration = Date.now() - start;
        results[empresa][entity.name] = result.synced;

        if (result.complete) {
          await supabase.from("sync_log").insert({
            entity: entity.name,
            empresa,
            records_synced: result.synced,
            status: "success",
            duration_ms: duration,
          });
          console.log(`[incremental:${empresa}] ${entity.name} done: ${result.synced} records in ${duration}ms`);
        } else {
          // Soft deadline no meio da janela: NÃO grava success (watermark não avança).
          await supabase.from("sync_log").insert({
            entity: entity.name,
            empresa,
            records_synced: result.synced,
            status: "error",
            error_message: `incompleto: soft deadline em ${result.pagesFetched} páginas (${result.synced} registros)`,
            duration_ms: duration,
          });
          console.warn(`[incremental:${empresa}] ${entity.name} incompleto (soft deadline): ${result.pagesFetched} páginas, ${result.synced} registros`);
          deadlineHit = true;
          break;
        }
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

- [ ] **Step 3: Remover `BATCH_SIZE` (agora sem uso)**

Em `src/lib/sync/incremental.ts`, remover a linha:
```ts
const BATCH_SIZE = 500;
```
(o streaming faz upsert por página de 250; `BATCH_SIZE` deixou de ser usado).

- [ ] **Step 4: Typecheck + lint (agora tudo em uso)**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 erros; nenhum aviso novo (sem `vhsysFetchAll`/`BATCH_SIZE`/`SOFT_DEADLINE_MS` não usados). Só o aviso pré-existente em `fetch-all.ts`.

- [ ] **Step 5: Re-rodar os testes de streaming e retry (não-regressão)**

Run:
```bash
npx tsx --env-file=.env.local scripts/test-stream-entity-pages.ts && \
npx tsx --env-file=.env.local scripts/test-vhsys-retry.ts
```
Expected: `PASS: streamEntityPages` e três `PASS:` do retry.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sync/incremental.ts
git commit -m "feat(incremental): streaming por pagina com soft deadline; watermark so em janela completa

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 4: Verificação ponta-a-ponta (real)

**Files:** nenhum (verificação)

- [ ] **Step 1: Build de produção**

Run: `npm run build`
Expected: compila sem erro; a rota `/api/sync/incremental` aparece no output.

- [ ] **Step 2: Smoke real — janela pequena completa e avança watermark**

Rodar o sync incremental LOCAL contra o banco de produção (idempotente). Como `clientes`/`pedidos` foram backfillados/destravados, a janela de cada entidade é pequena e deve completar:
```bash
npx tsx --env-file=.env.local -e "import('./src/lib/sync/incremental.ts').then(async m => { const r = await m.runIncrementalSync(); console.log(JSON.stringify(r)); })"
```
Expected: termina sem travar; o objeto de resultado mostra contagens >= 0 (não -1) para as entidades; nos logs, linhas `... done: N records`. Confirma que janela completa grava success.

- [ ] **Step 3: Confirmar no sync_log que pedidos voltou a ter success recente**

```bash
npx tsx --env-file=.env.local -e "import('./src/lib/supabase/client.ts').then(async ({createSupabaseServer})=>{const s=createSupabaseServer();const {data}=await s.from('sync_log').select('status,records_synced,last_sync_at').eq('entity','pedidos').eq('empresa','rigel_fabricante').order('last_sync_at',{ascending:false}).limit(3);console.log(JSON.stringify(data,null,1));})"
```
Expected: a linha mais recente é `status: 'success'` (o smoke do Step 2 a gravou), confirmando watermark avançado.

- [ ] **Step 4: Confirmar com o monitor que nada está travado**

Run: `npx tsx --env-file=.env.local scripts/smoke-sync-health.ts`
Expected: `Travadas: []` (ou só itens esperados); a mensagem final é `(saudável — nenhum alerta)` ou apenas divergências conhecidas.

- [ ] **Step 5: Rodar TODA a suíte de testes do projeto (não-regressão)**

Run:
```bash
npx tsx --env-file=.env.local scripts/test-vhsys-retry.ts && \
npx tsx --env-file=.env.local scripts/test-vhsys-empty-403.ts && \
npx tsx --env-file=.env.local scripts/test-vhsys-auth-200.ts && \
npx tsx --env-file=.env.local scripts/test-stream-entity-pages.ts && \
npx tsx --env-file=.env.local scripts/test-health-staleness.ts && \
npx tsx --env-file=.env.local scripts/test-health-divergence.ts && \
npx tsx --env-file=.env.local scripts/test-health-format.ts
```
Expected: todos `PASS`.

- [ ] **Step 6: Sem commit (só verificação).** Reportar os resultados. O deploy desta branch para produção é decisão do usuário (fluxo de finishing-a-development-branch).

---

## Notas de execução

- **TDD:** Tasks 1-2 seguem write-test→fail→implement→pass. Task 3 é integração (verificada por typecheck/lint + re-rodar os testes das partes). Task 4 é verificação real contra produção.
- **Ordem:** Task 2 antes da 3 (define `streamEntityPages` e `SOFT_DEADLINE_MS`). Task 1 é independente.
- **Invariante a vigiar na review:** `status:'success'` só quando `result.complete === true`. Em deadline ou exceção, nunca `success`.
- **Sem migration / sem mudança de schema.**
