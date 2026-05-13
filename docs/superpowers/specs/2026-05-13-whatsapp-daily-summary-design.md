# WhatsApp Daily Summary — Design

**Data:** 2026-05-13
**Status:** Aprovado (brainstorming concluído)
**Branch:** `feat/bi-evolution`

## Objetivo

Cron diário que, às 07:00 BRT, envia um resumo único via WhatsApp (Evolution API) para o gestor, contendo:

1. **Vendas do dia anterior (D-1)** por canal — total + breakdown fixo de 8 linhas (B2B + 7 marketplaces).
2. **Contas a pagar** — três blocos: em atraso, vencendo hoje, próximos 7 dias.

Sem uso de OpenAI. Mensagem estruturada via formatter puro.

## Escopo

**Em escopo:**
- Endpoint `/api/cron/daily-summary` protegido por `CRON_SECRET`.
- Cliente Evolution genérico (`sendWhatsAppText`) reutilizável.
- Queries D-1 por canal e contas a pagar agregadas (não reaproveita `comercial-analytics.ts`).
- Formatter puro testável em isolamento.
- Cron registrado em `vercel.json` (`0 10 * * *` UTC = 07:00 BRT).

**Fora de escopo:**
- Endpoint de teste / dryRun.
- Notificação de erro via WhatsApp.
- Múltiplos destinatários, listas de transmissão, threads.
- Geração de narrativa por IA.
- Anexos (PDF/imagem).
- Frameworks de teste (sem Vitest/Jest configurado).

## Arquitetura

```
vercel.json cron → /api/cron/daily-summary (route.ts)
                     ├─ isAuthorizedCron(req)
                     ├─ fetchDailySummary()    → queries/daily-summary.ts
                     ├─ formatDailySummary()   → notifications/daily-summary.ts
                     └─ sendWhatsAppText()     → evolution/client.ts
```

**Fronteiras:**

- `evolution/client.ts` não conhece nada de Rigel — só HTTP com Evolution. Reutilizável.
- `queries/daily-summary.ts` é o único que toca Supabase; retorna `DailySummaryData` cru.
- `notifications/daily-summary.ts` é puro `(data) → string` — testável sem mocks.
- `route.ts` só orquestra: auth, chamadas, log, retorno HTTP.

Padrão alinhado com `src/lib/sync/`, `src/lib/queries/`, `src/lib/dre/` (cada um com seu domínio).

## Componentes

### 1. `src/lib/evolution/client.ts`

Cliente HTTP para Evolution API. Stateless, lê envs em runtime.

**Envs lidas:**
- `EVOLUTION_API_URL` — URL base
- `EVOLUTION_API_KEY` — chave de API (header `apikey`)
- `EVOLUTION_INSTANCE_NAME` — nome da instância
- `WHATSAPP_RECIPIENT_NUMBER` — destinatário em formato internacional (`5581998735441`)

**API pública:**
```ts
export async function sendWhatsAppText(text: string): Promise<void>
```

**Comportamento:**
- POST `${API_URL}/message/sendText/${INSTANCE}` com body `{ number: WHATSAPP_RECIPIENT_NUMBER, text }`.
- Headers: `Content-Type: application/json`, `apikey: ${API_KEY}`.
- Fail fast se envs faltarem.
- Retry 3 vezes com backoff `0 → 1s → 3s` em qualquer erro (rede ou status != 2xx).
- Loga cada tentativa que falha. Lança erro final com mensagem agregada.

**Nota de implementação:** verificar nome exato do endpoint na doc oficial da Evolution API v2; ajustar se divergir.

### 2. `src/lib/queries/daily-summary.ts`

Busca dados crus do Supabase. Sem cache Redis (cron 1×/dia).

**API pública:**
```ts
export interface VendasCanal {
  canal: string;            // "B2B" | "MERCADOLIVRE" | ...
  valorTotal: number;
  qtdPedidos: number;
}

export interface ContaPagarItem {
  fornecedor: string;       // nome_fornecedor ?? nome_conta
  valor: number;
  vencimento: string;       // YYYY-MM-DD
  diasAtraso?: number;      // só preenchido para atrasadas
}

export interface ContasPagarBloco {
  total: number;
  qtd: number;
  itens: ContaPagarItem[];
}

export interface DailySummaryData {
  dataReferencia: string;   // D-1 em ISO YYYY-MM-DD
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

export async function fetchDailySummary(): Promise<DailySummaryData>
```

**Cálculo de datas em BRT:** usar `Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" })` para extrair a data em BRT a partir de `new Date()`, depois subtrair 1 dia. Evita drift de UTC (cron dispara às 10:00 UTC = 07:00 BRT).

#### 2.1 Query de vendas D-1

```ts
supabase.from("pedidos")
  .select("vendedor_pedido_id, valor_total_nota")
  .eq("status_pedido", "Atendido")
  .eq("lixeira", "Nao")
  .gte("data_pedido", d1)
  .lte("data_pedido", d1)
```

Pagina com `supabaseFetchAll`. Agrega in-memory:

- Para cada pedido, mapeia canal:
  - Se `vendedor_pedido_id` ∈ `MARKETPLACE_VENDEDOR_IDS` → canal = nome do marketplace.
  - Caso contrário → canal = `"B2B"`.
- Soma `valor_total_nota` e conta pedidos por canal.

**Lista de canais é fixa, sempre 8 linhas, em ordem fixa:**
```ts
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
```

Canais sem venda no dia entram como `{ valorTotal: 0, qtdPedidos: 0 }` — o gestor precisa ver o zero para saber que aquele canal não vendeu.

**Mapa novo `VENDEDOR_ID_TO_MARKETPLACE_NAME`** em `vendedores-map.ts`:
```ts
export const VENDEDOR_ID_TO_MARKETPLACE_NAME: Record<number, string> = {
  248324: "MERCADOFULL",
  207185: "MERCADOLIVRE",
  230194: "SHOPEE",
  262101: "SHOPEEFULL",
  262945: "SHEIN",
  212745: "SITE OPTA SAUDE",
  239225: "SITE RIGEL",
};
```

#### 2.2 Query de contas a pagar

Query única, três filtros in-memory:

```ts
supabase.from("contas_pagar")
  .select("nome_conta, nome_fornecedor, vencimento_pag, valor_pag")
  .eq("lixeira", "Nao")
  .eq("liquidado_pag", "Nao")
  .gte("vencimento_pag", "2000-01-01")  // filtra sentinelas históricas do VHSys (1899-XX)
  .lte("vencimento_pag", hojePlus7)
  .order("vencimento_pag", { ascending: true })
```

Pagina com `supabaseFetchAll`. Separa em memória:
- `atrasadas`: `vencimento < hoje`
- `venceHoje`: `vencimento === hoje`
- `proximos7Dias`: `hoje < vencimento <= hoje+7`

**Mapeamento de item:**
- `fornecedor`: `nome_fornecedor ?? nome_conta` (fornecedor pode ser null no schema).
- `valor`: `Number(valor_pag) || 0`.
- `vencimento`: string `YYYY-MM-DD`.
- `diasAtraso`: só nas atrasadas, `floor((hoje - vencimento) / dia)` em BRT.

**Ordenação dentro de cada bloco:**
- `atrasadas`: por `diasAtraso` desc (mais antigas primeiro).
- `venceHoje`: por `valor` desc.
- `proximos7Dias`: por `vencimento` asc, depois `valor` desc.

### 3. `src/lib/notifications/daily-summary.ts`

Formatter puro. Sem I/O, sem `Date.now()`, sem `process.env`.

**API pública:**
```ts
export function formatDailySummary(data: DailySummaryData): string
```

**Template (cenário normal):**

```
📊 *Resumo Diário Rigel*
_Referência: 12/05/2026 (terça)_

━━━━━━━━━━━━━━━━━━━━━━
💰 *VENDAS D-1*
━━━━━━━━━━━━━━━━━━━━━━
*Total:* R$ 47.823,50 (23 pedidos)

• B2B................. R$ 38.420,00 (15)
• MERCADOFULL......... R$       0,00 ( 0)
• MERCADOLIVRE........ R$  4.150,30 ( 3)
• SHEIN............... R$       0,00 ( 0)
• SHOPEE.............. R$  3.890,20 ( 4)
• SHOPEEFULL.......... R$       0,00 ( 0)
• SITE OPTA SAUDE..... R$       0,00 ( 0)
• SITE RIGEL.......... R$  1.363,00 ( 1)

━━━━━━━━━━━━━━━━━━━━━━
💸 *CONTAS A PAGAR*
━━━━━━━━━━━━━━━━━━━━━━

🔴 *Em atraso* — R$ 3.001.161,48 (884 contas)

🟡 *Vence hoje* — R$ 5.800,00 (2)
• Fornecedor A — R$ 3.500,00
• Fornecedor B — R$ 2.300,00

🔵 *Próximos 7 dias* — R$ 24.300,00 (8)
• Fornecedor C — R$ 5.000,00 (13/05)
... (lista completa)
```

**Regras:**
- Moeda: `R$ 1.234,56` (locale pt-BR, 2 casas decimais).
- Quantidades: inteiro entre parênteses.
- Data de referência: `dd/MM/yyyy (dia-da-semana)`.
- Vencimento na lista: `dd/MM` (ano omitido).
- Linha de canal: `nome.padEnd(18, ".")` + valor `padStart(12)` + qtd `padStart(3)`.
- Fornecedor: trunca em 30 chars com `…`.
- Bloco vazio: `_(nenhuma)_` em vez de lista vazia.

**Bloco "Em atraso" mostra apenas total agregado (sem lista de itens).** Decisão tomada após inspeção da base real: ~884 contas em atraso (~R$ 3M) tornam qualquer listagem inviável; o agregado já cumpre o papel de alerta. Itens ainda são coletados pela query (preservados para diagnóstico via script), mas não renderizados no WhatsApp.

**Limite de 4096 chars do WhatsApp** (para "Vence hoje" e "Próximos 7 dias"):
1. Monta mensagem completa.
2. Se `length > 4000` (margem de 96), entra modo compacto:
   - Substitui lista de "Próximos 7 dias" por `🔵 Próximos 7 dias — R$ X (Y contas) — lista omitida por tamanho`.
3. Se ainda passar de 4000 (patológico): "Vence hoje" recebe o mesmo tratamento.

Retorna 1 string. Sem dividir em múltiplas mensagens.

### 4. `src/app/api/cron/daily-summary/route.ts`

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
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
```

**Política de envio:**
- Só envia quando a geração tem sucesso (fluxo feliz).
- Em caso de erro: log + 500. **Não** envia notificação de erro via WhatsApp.
- "Dia tudo zero" (sem vendas E sem contas): envia mensagem mesmo assim — manter cadência previsível para o gestor não confundir ausência com falha.

### 5. `vercel.json`

Adicionar terceira entrada:

```json
{
  "crons": [
    { "path": "/api/sync/incremental",       "schedule": "*/30 * * * *" },
    { "path": "/api/cron/sync-pedido-itens", "schedule": "*/5 * * * *"  },
    { "path": "/api/cron/daily-summary",     "schedule": "0 10 * * *"   }
  ]
}
```

`0 10 * * *` UTC = 07:00 BRT (sem horário de verão; Brasil não adota DST desde 2019).

**⚠️ Plano Vercel:** Hobby permite só 2 crons. Como já existem 2, o terceiro exige **Pro** ou consolidação. Verificar antes de mergear.

## Variáveis de ambiente

Já presentes em `.env.local` (não precisa gerar de novo). Documentar em `CLAUDE.md`:

```
EVOLUTION_API_URL=https://...
EVOLUTION_API_KEY=...
EVOLUTION_INSTANCE_NAME=Clynea
WHATSAPP_RECIPIENT_NUMBER=5581998735441   # formato internacional sem '+'
```

Configurar no painel Vercel (Production) antes do deploy. `OPENAI_*` ficam reservadas para uso futuro (sem consumo nesta feature).

## Verificação

Sem framework de testes. Verificação manual em 3 passos antes de habilitar o cron em produção:

**1. Formatter isolado** — `scripts/test-daily-summary-format.ts` monta fixtures (normal, tudo zero, 50 contas atrasadas), passa pelo `formatDailySummary`, imprime. Confirma alinhamento, truncamento, fallback compacto. Sem I/O.

**2. Queries reais** — `scripts/test-daily-summary-data.ts` chama `fetchDailySummary()`, imprime JSON. Confirma `dataReferencia` correto em BRT, 8 canais sempre presentes, contas coerentes.

**3. Envio real** — número atual em `WHATSAPP_RECIPIENT_NUMBER` já é de teste. Hit no endpoint com `CRON_SECRET`, verifica que mensagem chega, Markdown renderiza, caracteres especiais intactos. Antes do deploy: trocar para número do gestor.

**Após deploy:** acionar manualmente via curl com `CRON_SECRET` de produção. Dia seguinte, monitorar logs Vercel às 10:00 UTC.

## Riscos e premissas

- **Endpoint Evolution v2** — assumi `/message/sendText/{instance}` com header `apikey`. Validar contra doc oficial; pode haver variação por versão. Custo de ajuste: baixo (1 string).
- **Marketplaces com `id=0`** — raros, mas se aparecerem, caem em "B2B". Não há filtro por nome aqui. Aceitável.
- **`status_pedido='Atendido'`** — mesmo critério do BI atual. Pedidos cancelados/em separação não contam.
- **Plano Vercel** — confirmar Pro antes de mergear (ver acima).
- **Volume de contas** — fallback compacto cobre o caso extremo, mas se houver >100 contas atrasadas regularmente, vale repensar paginação. Não esperado.

## Próximos passos

1. Spec aprovada → `writing-plans` gera o plano de implementação.
2. Plano lista tarefas em ordem com checkpoints.
