# Sync incremental resiliente — pedidos não trava mais em surtos da VHSys

**Status:** design aprovado, aguardando plano de implementação
**Data:** 2026-06-15
**Escopo:** tornar o sync incremental resistente aos surtos de erro transitório da VHSys, de modo que `pedidos` (e as demais entidades) não trave de vez nem estoure os 60s da Vercel. Sem mudar o comportamento em operação normal.

---

## 1. Contexto e problema

O cron incremental (`/api/sync/incremental`, a cada 30min, `maxDuration = 60`) sincroniza cada entidade lendo da VHSys a partir de um watermark (`data_modificacao >= dia anterior ao último sucesso`) e fazendo upsert no Supabase. Hoje cada entidade é **tudo-ou-nada**: `vhsysFetchAll` acumula todas as páginas na memória e só então faz upsert; ao final, grava `success` no `sync_log` (avança o watermark).

Em 2026-06-12 a VHSys entrou num surto de erro transitório (`HTTP 200` com `{code:404,"data":"Erro ao comunicar com a API"}`) e `pedidos` travou por dias. O retry transitório (commit `0ca2253`, 3 tentativas) ajudou, mas observou-se em produção (15/06, 18:00 e 18:30 UTC) que `pedidos` **volta a falhar** em surtos:

- A taxa de erro da VHSys oscila; em surto, uma página esgota as 3 tentativas e **lança**, abortando a entidade.
- Ao abortar, o watermark **não avança**; a janela cresce a cada dia parado → fica cada vez mais difícil completar dentro de 60s → **círculo vicioso**.

### Restrições da API VHSys (verificadas em 2026-06-15)

Probes diretos contra `/pedidos` confirmaram limitações que **eliminam** os desenhos "elegantes" (processar do mais antigo, chunk por data):

- `data_modificacao` é filtro **">=" apenas** — não há data-final/intervalo. Todos os candidatos (`data_modificacao_fim`, `data_final`, `data_fim`, `data_modificacao_ate`, ...) são **ignorados** (total idêntico).
- Não há ordenação confiável por data de modificação: `order=data_mod_pedido&sort=Asc` retorna **página de erro HTML**. Só `order=id_ped` funciona, e a ordem por id **não corresponde** à `data_modificacao`.
- Paginação por `offset`; a ordem default é instável entre runs (novos registros modificados entram em qualquer offset).

**Consequência de design:** não dá para paginar do mais antigo nem fatiar a janela por data. Logo, não dá para "retomar do offset X" entre runs com segurança. A única forma segura de avançar o watermark é **completar a janela inteira num run**.

## 2. Objetivo e premissa

Que o incremental **se mantenha em dia** de forma resiliente aos surtos, e **nunca pule registros silenciosamente**. Backlog profundo (entidade dias atrás) é trabalho do **backfill** (`scripts/run-backfill.ts`, já existe), acionado pelo alerta do **monitor de saúde** (já existe). O cron mantém em dia; o backfill recupera backlog.

Premissa honesta: com a API sem data-final nem ordenação por data, o cron **não** consegue recuperar um backlog de muitos dias dentro de janelas de 60s. Isso é aceitável porque a rede de segurança (monitor + backfill) cobre esse caso.

## 3. Componentes

### 3.1 Mais tentativas no cliente VHSys

`withRetry` (em `src/lib/vhsys/client.ts`, usado por `vhsysGet`) passa de **3 → 6 tentativas**, com backoff exponencial **limitado a 4s**:

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

Backoff entre as 6 tentativas: 500ms, 1s, 2s, 4s, 4s (teto 4s). Pior caso de uma página: ~11,5s de espera + 6 requests. Para a janela diária normal (2-5 páginas) cabe folgado nos 60s e absorve os surtos — **conserta a falha observada**. Beneficia todas as leituras GET; POST/PUT/DELETE seguem sem retry (não idempotentes).

### 3.2 Streaming + soft deadline no incremental

Refatorar o laço por-entidade de `runIncrementalSync` (`src/lib/sync/incremental.ts`) para **streaming** — busca página → upsert da página → próxima — em vez de `vhsysFetchAll` (acumula tudo) + upsert no fim. Mesmo padrão do `syncEntity` do sync inicial.

Antes de cada página, checa um **soft deadline** (default 45s a partir do início do run):

- **Janela completa** (paginou até o fim antes do deadline) → grava `success` no `sync_log` → **watermark avança** (idêntico ao comportamento atual).
- **Bateu o deadline no meio** → para limpo: o que já foi buscado já está upsertado (idempotente); **NÃO grava `success`** (watermark fica parado); grava uma linha `status='error'` com `error_message` de contexto (ex.: `incompleto: soft deadline em 6/12 páginas`). O run segue para a próxima entidade (ou encerra) e a entidade incompleta é re-tentada no próximo cron.

Para a janela pequena do dia-a-dia, o deadline **nunca dispara** → comportamento idêntico ao atual. O deadline só atua no caso patológico (janela grande / API lenta), trocando o **kill seco aos 60s** (pode escrever pela metade) por uma **parada limpa e observável**.

O soft deadline é por-run (não por-entidade): uma vez excedido, o run para de processar páginas/entidades novas. Como pedidos é a 4ª entidade, um deadline durante pedidos pode pular `contas_pagar`/`contas_receber` naquele run — elas mantêm o watermark e são pegas no próximo run (isolamento por entidade preservado).

Folga de tempo: deadline 45s + pior caso de uma página em retry (~11,5s) ≈ 56,5s < 60s.

### 3.3 Rede de segurança (já construída — sem código novo)

Quando uma entidade fica tão atrás que o cron não completa a janela num run (surto sustentado por dias), o **monitor de staleness** (`/api/cron/sync-health`) alerta após o limiar, e o **`scripts/run-backfill.ts`** recupera o backlog (full re-sync idempotente, sem limite de 60s, local). Modelo operacional: cron = manter em dia; backfill = recuperar backlog.

## 4. Invariante de correção

**O watermark (linha `success` no `sync_log`) avança SOMENTE quando a janela da entidade é 100% sincronizada num run.** Runs parciais (deadline), com falha, ou abortados nunca gravam `success`. Combinado com upsert idempotente (re-buscar é inofensivo), isso garante que **nenhum registro é pulado silenciosamente** — exatamente o que a ausência de data-final/ordenação por data exige.

## 5. Estrutura de código

| Arquivo | Mudança |
|---------|---------|
| `src/lib/vhsys/client.ts` | `withRetry`: 3→6 tentativas, backoff com teto de 4s |
| `src/lib/sync/incremental.ts` | extrair `streamEntityPages(...)` (loop página→upsert→deadline, testável) e usar no laço por-entidade; gravar `success` só em janela completa |

`vhsysFetchAll` permanece (usado só pelo incremental hoje e por um teste); o incremental deixa de usá-lo, mas a função não é removida (evita mexer em quem possa passar a usá-la). Decisão: **não** remover nesta entrega (YAGNI reverso — manter estável).

### Esboço da função extraída

```ts
interface StreamResult { synced: number; complete: boolean; pagesFetched: number; pagesTotal: number | null; }

// Streaming página→upsert→próxima, com soft deadline. Retorna se completou a
// janela (complete=true) ou parou no deadline (complete=false). NÃO grava sync_log
// — quem chama decide (success só quando complete).
async function streamEntityPages(
  supabase, empresa, entity, params, deadlineAt: number,
): Promise<StreamResult>;
```

O `deadlineAt` é `runStart + SOFT_DEADLINE_MS`. A função é o ponto testável (fetcher mockável via injeção ou via stub de `vhsysGet`).

Por página, antes do upsert, o streaming preserva o que o incremental/`syncEntity` já fazem: para `pedidos`, chamar `canonicalizePedidoIds(pageItems)` (a VHSys devolve `id_pedido: 0`; o id canônico é `id_ped`) **antes** do dedup; dedup por PK **dentro da página** (a VHSys repete registros na mesma página); e `pickFields` + coluna `empresa` (tabelas multi-empresa) + `synced_at`. Dedup cross-página não é necessário (upsert idempotente por PK — última escrita vence).

## 6. Tratamento de erro

- Erro transitório dentro do orçamento de retry → o `vhsysGet` resolve (6 tentativas); transparente para o streaming.
- Erro transitório que esgota as 6 tentativas → `vhsysGet` lança; o laço por-entidade do incremental captura (try/catch já existente), grava `status='error'`, **não avança watermark**, segue para a próxima entidade. Isolamento por entidade preservado.
- Deadline → `complete=false`, grava `status='error'` com contexto de incompleto, sem `success`.
- Erro de upsert no Supabase → propaga como hoje (lança, vira `error` no `sync_log`).

## 7. Testes

Padrão do projeto (scripts `tsx`, sem framework de unit):

- **`streamEntityPages`** (com `vhsysGet`/fetcher mockado):
  - janela de N páginas sem erro → `complete=true`, `synced=N*250` (aprox.), todas upsertadas;
  - deadline atingido após k páginas → `complete=false`, `pagesFetched=k`, sem exceção;
  - página com erro transitório que recupera dentro do retry → completa normalmente;
  - página que esgota retry → lança (propaga), `complete` não retornado.
- **`withRetry`** — atualizar/garantir o teste de retry para 6 tentativas (transitório resolvido na 4ª/5ª; auth 401 não retentada).
- Verificação de não-regressão: rodar o smoke do incremental local (entidade pequena) e confirmar que janela completa grava `success` e avança watermark.

## 8. Fora de escopo (YAGNI)

- Paginação retomável entre runs (impossível com segurança dadas as restrições da API).
- Chunk por data (sem data-final na API).
- Mover `pedidos` para cron próprio (Approach C descartado).
- Remover `vhsysFetchAll`.
- Alterar `pedido_itens` (já tem soft deadline próprio).

## 9. Ajustes (calibráveis)

| Parâmetro | Default | Onde |
|-----------|---------|------|
| Tentativas de retry | 6 | `client.ts` |
| Teto de backoff | 4s | `client.ts` |
| Soft deadline do incremental | 45s | `incremental.ts` |
