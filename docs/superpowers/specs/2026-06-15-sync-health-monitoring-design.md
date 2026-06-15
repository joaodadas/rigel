# Saúde do sync VHSys — auto-recuperação, alerta técnico e detecção de divergência

**Status:** design aprovado, aguardando plano de implementação
**Data:** 2026-06-15
**Escopo:** tornar o sync VHSys→Supabase auto-recuperável para falhas transitórias e observável para falhas persistentes, com alerta consolidado por WhatsApp para um número técnico dedicado, sem alterar o comportamento atual da sincronização em si.

---

## 1. Contexto e objetivo

O sync VHSys→Supabase roda em três crons (`vercel.json`):

| Cron | Path | Schedule |
|------|------|----------|
| Incremental | `/api/sync/incremental` | `*/30 * * * *` |
| Pedido-itens | `/api/cron/sync-pedido-itens` | `*/5 * * * *` |
| Resumo diário (WhatsApp cliente) | `/api/cron/daily-summary` | `0 10 * * *` |

O incremental já é resiliente **por entidade** (uma falhar não derruba as outras: a entidade mantém o watermark antigo e re-tenta a janela no próximo run). O que falta é **observabilidade**: hoje uma falha persistente só aparece se alguém abrir os logs da Vercel. Em 2026-06, um glitch transitório da VHSys (`code 404 — "Erro ao comunicar com a API"`) travou o sync de pedidos por 3 dias sem ninguém perceber até as vendas zerarem no resumo de WhatsApp.

Objetivo: que tudo permaneça sincronizado e que, quando algo realmente travar, a equipe técnica seja avisada — em três camadas:

1. **Auto-recuperação** de falhas transitórias (quase pronta).
2. **Alerta** consolidado quando uma entidade fica travada além do esperado.
3. **Detecção de divergência** silenciosa (contagem VHSys vs Supabase).

**Premissa honesta:** com uma API upstream intermitente, "livre de falhas" no sentido literal não é alcançável. A meta é um sync **auto-recuperável e observável**: se conserta sozinho quando a API volta e avisa quando precisa de atenção humana.

### Decisões de produto que sustentam o design

- **Alerta vai para um número técnico dedicado** (nova env `WHATSAPP_TECH_ALERT_NUMBER`), **separado** do `WHATSAPP_RECIPIENT_NUMBER` do cliente.
- **Resumo periódico** (escolha do usuário): um único alerta consolidado a cada ciclo (de hora em hora) listando tudo que está travado/divergente no momento. Quando está tudo saudável, o monitor fica **silencioso** (sem spam, sem "tudo ok" horário).
- **Sem máquina de estado por incidente** e sem tabela nova — o resumo periódico dispensa rastrear início/fim de incidente.
- O monitor **só detecta** divergência; correção (backfill) continua manual/script.

---

## 2. Camada 1 — Auto-recuperação

### 2.1 Retry de transitórios (já entregue, commit `0ca2253`)

`vhsysGet` retenta erros transitórios da VHSys (mensagem "Erro ao comunicar com a API" e HTTP 5xx/429): 3 tentativas, backoff 500/1000ms. Erros permanentes (auth 401) e demais continuam fatais. POST/PUT/DELETE não são retentados (não idempotentes). Coberto por `scripts/test-vhsys-retry.ts`.

### 2.2 Watermark auto-curável (já é inerente)

Entidade que falha não grava linha de sucesso no `sync_log`, então mantém o watermark antigo e re-tenta a mesma janela (`data_modificacao = dia anterior ao último sucesso`) no próximo run. Com o retry da 2.1, runs que antes abortavam por um blip agora completam e o watermark avança. Nada novo a implementar aqui.

### 2.3 `pedido_itens` passa a gravar `sync_log` (acréscimo)

Hoje `runPedidoItensSync` retorna stats mas **não grava** em `sync_log`, ficando invisível ao monitor. Acréscimo: ao final de cada run, inserir uma linha:

- `entity = 'pedido_itens'`, `empresa = 'rigel_fabricante'`
- `records_synced = itensUpserted`
- `status = 'error'` **somente** quando `aborted === true` (30+ falhas upstream consecutivas); caso contrário `status = 'success'`.
- `duration_ms = durationMs`; em erro, `error_message` com um resumo dos stats (`upstreamFailures`, `remaining`).

Importante: um run normal com `remaining > 0` (fila ainda drenando dentro do soft-deadline) **não** é erro — é o comportamento projetado. Só `aborted` indica problema real de API.

---

## 3. Camada 2 — Monitor de saúde e alerta

### 3.1 Módulo `src/lib/sync/health.ts` (lógica pura, testável)

Responsabilidade única: a partir de leituras do `sync_log` (e, no caso da divergência, contagens), decidir o que está saudável e formatar o relatório. Não conhece HTTP nem cron — recebe o cliente Supabase e retorna estruturas de dados.

#### Alvos monitorados

Derivados do mesmo `entitiesForEmpresa()` usado pelo incremental (exportado de `incremental.ts`), para o monitor **nunca divergir** do que de fato roda, mais o par `(rigel_fabricante, pedido_itens)`. Em pseudocódigo:

```ts
const SYNC_TARGETS = [
  ...EMPRESAS.flatMap((e) => entitiesForEmpresa(e.slug).map((ent) => ({
    empresa: e.slug, entity: ent.name, source: "incremental" as const,
  }))),
  { empresa: "rigel_fabricante", entity: "pedido_itens", source: "pedido_itens" as const },
];
```

#### `checkStaleness(supabase): Promise<StaleEntity[]>`

Para cada alvo, busca a linha `sync_log` mais recente com `status='success'` para aquele `(empresa, entity)`. Calcula a idade dessa linha. Se for maior que o **limiar de staleness** do source, marca como travada e anexa a mensagem de erro da última linha (independente de status) para contexto.

```ts
interface StaleEntity {
  empresa: string;
  entity: string;
  lastSuccessAt: string | null;   // null = nunca teve sucesso
  staleForMs: number;             // agora - lastSuccessAt
  lastError: string | null;       // error_message da última linha, se for erro
}
```

Limiares de staleness = **3× o intervalo esperado** do source (absorve um run pulado/blip sem alarme falso):

| Source | Intervalo esperado | Limiar (3×) |
|--------|--------------------|-------------|
| incremental | 30 min | **90 min** |
| pedido_itens | 5 min | **15 min** |

`lastSuccessAt === null` (nunca houve sucesso) conta como travada se já existe alvo esperado para aquela empresa.

#### `checkDivergence(supabase): Promise<DivergedEntity[]>` (diário)

Para cada entidade de listagem com contagem barata, pega o `paging.total` da VHSys (1 request via `vhsysGet` com `limit=1`, sem filtro de data) e compara com a contagem no Supabase (filtrada por empresa nas tabelas multi-empresa).

```ts
interface DivergedEntity {
  empresa: string;
  entity: string;
  vhsysTotal: number;
  supabaseCount: number;
  deltaPct: number;               // (supabase - vhsys) / vhsys
}
```

Regras anti-falso-positivo:
- **Só alerta na direção perigosa**: Supabase com *menos* registros que a VHSys (`supabaseCount < vhsysTotal * (1 - TOLERANCE)`). Excedente (ex.: soft-deletes que ficam no Supabase) **não** é alertado.
- **Tolerância** `TOLERANCE = 0.02` (2%).
- **Ignora conjuntos minúsculos**: `vhsysTotal < 50` é pulado (ruído).
- Se a chamada VHSys falhar (API fora), a entidade entra como "não verificável" e **não** conta como divergência.

#### `formatHealthReport(stale, diverged, monitorErrors): string | null`

Monta a mensagem PT consolidada. Retorna `null` quando não há nada a reportar (tudo saudável) — sinal para o endpoint não enviar nada.

```
🔴 Rigel — Saúde do sync

Travadas:
• [rigel_fabricante] pedidos — sem sucesso há 4h20
  último erro: code 404 — Erro ao comunicar com a API
• [rigel_fabricante] pedido_itens — abortado por falha upstream

Suspeita de divergência (diário):
• clientes — Supabase 188.420 vs VHSys 190.115 (−0,9%)

Verificado às 09:00 UTC
```

O bloco "Travadas" pode aparecer em qualquer run horário; o bloco "Suspeita de divergência" só aparece no run diário das 09:00 UTC. O exemplo acima mostra os dois juntos (caso de um run das 09:00).

### 3.2 Endpoint `src/app/api/cron/sync-health/route.ts`

- Auth via `isAuthorizedCron(req)` (mesmo padrão dos outros crons); 401 se não autorizado.
- `export const maxDuration = 60; export const dynamic = "force-dynamic";`
- Fluxo:
  1. `checkStaleness` — sempre.
  2. `checkDivergence` — **somente quando `new Date().getUTCHours() === 9`** (1×/dia, antes do daily-summary das 10h UTC).
  3. `formatHealthReport(...)`. Se `!== null`, envia via `sendWhatsAppTextTo(process.env.WHATSAPP_TECH_ALERT_NUMBER, report)`.
  4. Retorna JSON `{ healthy: boolean, stale, diverged, monitorErrors }` para inspeção manual/debug.
- **Rede de segurança:** cada checagem é isolada em try/catch. Se uma falhar, vira item em `monitorErrors` ("monitor parcialmente falhou: …") e entra no relatório — o monitor nunca derruba o próprio run por erro interno.

### 3.3 Entrada no `vercel.json`

```json
{ "path": "/api/cron/sync-health", "schedule": "0 * * * *" }
```

De hora em hora — é o "X" do resumo periódico.

---

## 4. Envs e canal de alerta

### 4.1 Nova env `WHATSAPP_TECH_ALERT_NUMBER`

- Um ou mais números, CSV, formato internacional sem `+` (ex.: `5581999999999`), dedup + trim — mesma convenção do `WHATSAPP_RECIPIENT_NUMBER`.
- **Ausente** → o monitor loga aviso (`[sync-health] WHATSAPP_TECH_ALERT_NUMBER não configurado, pulando envio`) e segue retornando o JSON. Degradação graciosa, no estilo do resto do app.
- Documentar em `CLAUDE.md` (seção Environment Variables) e no `.env`/`.env.local` locais.

### 4.2 Refactor do `src/lib/evolution/client.ts`

O `sendWhatsAppText(text)` atual lê `WHATSAPP_RECIPIENT_NUMBER` direto. Extrair o núcleo para aceitar o destinatário como parâmetro, sem duplicar a lógica de envio/retry:

```ts
// novo: envia para uma lista CSV arbitrária
export async function sendWhatsAppTextTo(recipientRaw: string | undefined, text: string): Promise<void>;
// mantém compat: delega no novo com o número do cliente
export async function sendWhatsAppText(text: string): Promise<void>;
```

`sendWhatsAppTextTo` reaproveita `parseRecipients`, `sendOneRecipient` e a checagem de `EVOLUTION_*`. Quando `recipientRaw` é vazio/undefined, lança erro claro (o monitor trata esse caso antes de chamar, pulando o envio). O comportamento de `sendWhatsAppText` não muda.

---

## 5. Tratamento de erro

- Monitor **nunca lança sem tratar** — é rede de segurança, não pode virar mais uma fonte de falha. Checagens isoladas; erro interno vira `monitorErrors`.
- VHSys indisponível durante a divergência = "não verificável", não conta como divergência (evita alarme falso quando a própria API está com o glitch transitório).
- Falha ao enviar WhatsApp: o `sendWhatsAppTextTo` já tem retry próprio (3×, backoff 0/1s/3s); se todos os destinatários falharem, loga erro mas o endpoint ainda retorna o JSON de saúde (não derruba o cron).

---

## 6. Testes

Padrão atual do projeto: scripts executáveis `scripts/test-*.ts` rodados via `npx tsx --env-file=.env.local` (não há framework de unit). As funções puras de `health.ts` recebem dados fabricados, sem tocar rede/banco real:

- **`checkStaleness`** (com linhas de `sync_log` fabricadas):
  - sucesso recente → saudável;
  - sucesso mais velho que o limiar → travada, com `lastError` anexado;
  - erro recente **mas** sucesso recente → saudável (prova a auto-cura);
  - nunca houve sucesso → travada.
- **`checkDivergence`** (com pares de contagem fabricados):
  - faltando > tolerância → flag;
  - excedente → não flag;
  - dentro da tolerância → não flag;
  - `vhsysTotal < 50` → ignorado.
- **`formatHealthReport`**: tudo saudável → `null`; misto (travada + divergência) → string formatada esperada.
- **Smoke do endpoint**: script local que chama `/api/cron/sync-health` com o header de cron e confere o JSON.

---

## 7. Pontos calibráveis

Defaults aprovados, ajustáveis numa constante cada:

| Parâmetro | Default | Onde |
|-----------|---------|------|
| Limiar de staleness | 3× intervalo (90min / 15min) | `health.ts` |
| Cadência do monitor | horária (`0 * * * *`) | `vercel.json` |
| Hora da divergência | 09:00 UTC | `route.ts` |
| Tolerância de divergência | 2% | `health.ts` |
| Piso de divergência | total VHSys ≥ 50 | `health.ts` |

---

## 8. Fora de escopo (YAGNI)

- Máquina de estado por incidente / tabela de incidentes (resumo periódico dispensa).
- Monitoramento externo de terceiro (Better Stack, healthchecks.io, log drains).
- Auto-backfill de gaps históricos — continua on-demand via script.
- `pedido_itens` segue single-empresa (Rigel Fabricante), como hoje.
- Sem mudança no comportamento da sincronização em si além do retry já entregue e do `sync_log` do pedido_itens.

---

## 9. Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/lib/sync/health.ts` | **novo** — `checkStaleness`, `checkDivergence`, `formatHealthReport`, `SYNC_TARGETS` |
| `src/app/api/cron/sync-health/route.ts` | **novo** — endpoint do cron de saúde |
| `src/lib/sync/incremental.ts` | exportar `entitiesForEmpresa` para reuso no `health.ts` |
| `src/lib/sync/pedido-itens.ts` | gravar linha em `sync_log` ao final do run |
| `src/lib/evolution/client.ts` | extrair `sendWhatsAppTextTo(recipientRaw, text)` |
| `vercel.json` | nova entrada de cron `sync-health` |
| `CLAUDE.md` | documentar `WHATSAPP_TECH_ALERT_NUMBER` |
| `scripts/test-sync-health.ts` | **novo** — testes das funções puras + smoke |
