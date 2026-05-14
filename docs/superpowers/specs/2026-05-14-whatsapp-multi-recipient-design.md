# WhatsApp — múltiplos destinatários (envio em lote)

**Data:** 2026-05-14
**Escopo:** `src/lib/evolution/client.ts`
**Status:** Design aprovado, aguardando plano de implementação

## Contexto

Hoje o sistema envia notificações WhatsApp (resumo diário, smoke tests, send-now manual) para um único número configurado em `WHATSAPP_RECIPIENT_NUMBER`. A função `sendWhatsAppText(text)` em `src/lib/evolution/client.ts` lê a env, faz um POST para a Evolution API com até 3 retries (backoff 0/1s/3s) e lança erro se todas falharem.

**Objetivo:** permitir que a mesma mensagem seja enviada para vários destinatários, configurados como lista separada por vírgula na mesma env (`WHATSAPP_RECIPIENT_NUMBER=5581...,5582...`). Sem novas envs, sem mudança de assinatura pública, sem mudar call-sites.

## Decisões de design

| Decisão | Escolha | Justificativa |
|---|---|---|
| Formato da env | CSV (`a,b,c`) na mesma var | Reaproveita configuração existente; valor atual de 1 número permanece válido (lista de 1) |
| Escopo da mudança | Interno a `sendWhatsAppText` | Call-sites (`cron/daily-summary`, scripts) não mudam; mínima superfície |
| Concorrência | Sequencial | Evita rate-limit da Evolution; logs em ordem; tempo extra desprezível para 2-10 números |
| Falha parcial | Sucesso parcial + `console.error` | Garante que falha de 1 não bloqueia os demais; erro só se TODOS falharem |
| Mascaramento em log | Sim, últimos 4 dígitos (`****5441`) | Evita vazar números completos nos logs do Vercel |
| Lista vazia | `throw` | Mesma semântica do erro atual de env não configurada |
| Duplicatas | Dedupe silencioso | Evita envio duplicado se o usuário repetir um número por engano |

## Arquitetura

```
cron/daily-summary
scripts/send-daily-summary-now.ts        ─► sendWhatsAppText(text)
scripts/smoke-evolution.ts                       │
                                                 ▼
                                       parseRecipients(env)
                                                 │
                                                 ▼
                                       for each recipient:
                                         sendOneRecipient()  ←─ retry/backoff atual
                                                 │
                                       coleta failures[]
                                                 │
                                       ┌─────────┴─────────┐
                                       ▼                   ▼
                            todas falharam?         alguma sucesso?
                                  throw                  return
```

## Contratos

### `sendWhatsAppText(text: string): Promise<void>` (assinatura inalterada)

**Comportamento novo:**
1. Valida envs (`EVOLUTION_API_URL/KEY/INSTANCE` e `WHATSAPP_RECIPIENT_NUMBER`) — idêntico ao atual.
2. Faz parse de `WHATSAPP_RECIPIENT_NUMBER` em lista de destinatários.
3. Para cada destinatário, executa o envio (3 retries com backoff 0/1s/3s) sequencialmente.
4. Em sucesso por destinatário: `console.log("[evolution] sent to ****<last4>")`.
5. Em falha por destinatário (após 3 tentativas): `console.error("[evolution] failed for ****<last4>:", err)` e segue para o próximo.
6. No final:
   - Se **todos** falharam → `throw new Error("Evolution send failed for all N recipients: <agg>")`.
   - Caso contrário → retorna `undefined` (sucesso ou sucesso parcial).

### `parseRecipients(raw: string): string[]` (helper privado, novo)

```
parseRecipients(raw)
  = raw.split(",")
       .map(s => s.trim())
       .filter(s => s.length > 0)
       .filter((s, i, arr) => arr.indexOf(s) === i)   // dedupe preservando ordem
```

- Se a lista resultante for vazia → `throw new Error("WHATSAPP_RECIPIENT_NUMBER has no valid recipients")`.
- **Não** valida formato de número (Evolution API que rejeite se inválido). Mantém comportamento atual.

### `sendOneRecipient(url, headers, number, text): Promise<void>` (helper privado, novo)

Encapsula o loop de retry/backoff que hoje vive inline em `sendWhatsAppText`. Mesma lógica, mesma constante `DEFAULT_RETRIES = 3` e `BACKOFF_MS = [0, 1000, 3000]`. Lança erro agregado após 3 tentativas falhas.

### `maskNumber(num: string): string` (helper privado, novo)

```
maskNumber("5581998735441") = "****5441"
maskNumber("123") = "****123"   // < 4 dígitos: retorna como está, prefixado
```

Usado apenas em logs.

## Erros e logging

| Cenário | Comportamento |
|---|---|
| Env Evolution faltando | `throw` (igual ao atual) |
| `WHATSAPP_RECIPIENT_NUMBER` vazia/não configurada | `throw "WHATSAPP_RECIPIENT_NUMBER not configured"` (igual ao atual) |
| Env presente mas só com vírgulas/espaços | `throw "WHATSAPP_RECIPIENT_NUMBER has no valid recipients"` |
| 1 destinatário falha, outros OK | `console.error` para o que falhou; função retorna normal |
| Todos os destinatários falham | `throw` com mensagem agregada listando até 3 erros |

## Retrocompat

- Valor atual `WHATSAPP_RECIPIENT_NUMBER=5581998735441` continua funcionando: lista de 1.
- Nenhum call-site precisa mudar.
- Comportamento observável idêntico quando há 1 destinatário válido.

## Impacto em outros arquivos

| Arquivo | Mudança |
|---|---|
| `src/lib/evolution/client.ts` | Refatorado (helpers + loop) |
| `src/app/api/cron/daily-summary/route.ts` | Nenhuma |
| `scripts/send-daily-summary-now.ts` | Nenhuma |
| `scripts/smoke-evolution.ts` | Nenhuma |
| `CLAUDE.md` | Atualizar descrição da env para "um ou mais números separados por vírgula" |
| `.env.local` (do usuário) | O usuário adiciona os números — fora do repo |

## Testes manuais

1. **Lista de 1** (estado atual): rodar `npx tsx --env-file=.env.local scripts/smoke-evolution.ts` → único número recebe a mensagem.
2. **Lista de 2**: configurar `WHATSAPP_RECIPIENT_NUMBER=A,B` → ambos recebem; logs mostram 2 envios sequenciais com `****<last4>` mascarado.
3. **Espaços e vazios**: `WHATSAPP_RECIPIENT_NUMBER="A , ,B, A"` → envia para A e B uma vez cada (trim + dedupe).
4. **Lista vazia**: `WHATSAPP_RECIPIENT_NUMBER=", ,"` → `throw` claro.
5. **Falha simulada**: injetar um número inválido entre dois válidos → válidos recebem; inválido gera `console.error`; função retorna sem throw.

Não há suíte de testes automatizada para esse módulo hoje (Playwright instalado mas sem testes); o teste manual via `smoke-evolution.ts` continua sendo o ponto de validação.

## Fora de escopo

- Personalização por destinatário (cada um recebe a mesma mensagem).
- Persistência de quem recebeu o quê.
- Retry em background para destinatários que falharam.
- Validação de formato dos números antes do envio.
- Suporte a outras envs com listas (`EVOLUTION_INSTANCE_NAME` continua single).
