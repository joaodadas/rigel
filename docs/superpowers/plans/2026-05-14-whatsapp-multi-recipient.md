# WhatsApp Multi-Recipient — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow `WHATSAPP_RECIPIENT_NUMBER` to accept a comma-separated list of phone numbers, and have `sendWhatsAppText` deliver the same message to each one sequentially with partial-failure tolerance.

**Architecture:** All changes are internal to `src/lib/evolution/client.ts`. The public signature `sendWhatsAppText(text: string): Promise<void>` stays the same. We add three private helpers (`parseRecipients`, `maskNumber`, `sendOneRecipient`), extract the existing retry loop into `sendOneRecipient`, then refactor `sendWhatsAppText` to iterate over the parsed recipient list.

**Tech Stack:** TypeScript, Next.js 15, native `fetch`. No test framework in this repo — verification is via `npm run build` (TS + lint via Next) and the existing `scripts/smoke-evolution.ts` manual smoke script.

**Reference spec:** `docs/superpowers/specs/2026-05-14-whatsapp-multi-recipient-design.md`

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/evolution/client.ts` | Modify | Add helpers, refactor send loop |
| `CLAUDE.md` | Modify | Update env description |

No new files. No call-site changes.

---

### Task 1: Add helpers and extract `sendOneRecipient` (pure refactor)

This task changes the **shape** of `client.ts` without changing observable behavior. After this task, single-recipient sends still work exactly as before.

**Files:**
- Modify: `src/lib/evolution/client.ts` (full rewrite of the file body)

- [ ] **Step 1: Replace the entire contents of `src/lib/evolution/client.ts` with the refactored version**

```typescript
const DEFAULT_RETRIES = 3;
const BACKOFF_MS = [0, 1000, 3000];

/**
 * Mascara um número de WhatsApp para logs, mostrando apenas os 4 últimos dígitos.
 * Ex.: "5581998735441" → "****5441"
 */
function maskNumber(num: string): string {
  const trimmed = num.trim();
  if (trimmed.length <= 4) return `****${trimmed}`;
  return `****${trimmed.slice(-4)}`;
}

/**
 * Faz parse de uma string CSV (ex.: "5581...,5582...") em lista de destinatários.
 * - Faz trim em cada item, descarta vazios e duplicatas (preservando ordem da 1ª ocorrência).
 * - NÃO valida formato do número (Evolution rejeita se inválido).
 * - Se a lista resultante for vazia, lança erro.
 */
function parseRecipients(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  if (out.length === 0) {
    throw new Error("WHATSAPP_RECIPIENT_NUMBER has no valid recipients");
  }
  return out;
}

/**
 * Envia a mensagem para UM destinatário com 3 retries (backoff 0/1s/3s).
 * Lança erro agregado se todas as tentativas falharem.
 */
async function sendOneRecipient(
  url: string,
  headers: Record<string, string>,
  number: string,
  text: string,
): Promise<void> {
  const body = JSON.stringify({ number, text });
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
        `[evolution] attempt ${i + 1}/${DEFAULT_RETRIES} failed for ${maskNumber(number)}:`,
        err,
      );
    }
  }

  throw new Error(
    `Evolution send failed after ${DEFAULT_RETRIES} attempts: ${lastErr}`,
  );
}

/**
 * Envia uma mensagem de texto via Evolution API v2 para todos os destinatários
 * configurados em WHATSAPP_RECIPIENT_NUMBER (lista CSV). Envios são sequenciais,
 * cada um com 3 retries e backoff 0/1s/3s. Falha de um destinatário NÃO bloqueia
 * os demais. Só lança erro se TODOS falharem.
 */
export async function sendWhatsAppText(text: string): Promise<void> {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE_NAME;
  const recipientRaw = process.env.WHATSAPP_RECIPIENT_NUMBER;

  if (!apiUrl || !apiKey || !instance) {
    throw new Error(
      "Evolution API not configured (missing EVOLUTION_API_URL/KEY/INSTANCE)",
    );
  }
  if (!recipientRaw) {
    throw new Error("WHATSAPP_RECIPIENT_NUMBER not configured");
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
```

- [ ] **Step 2: Run typecheck + lint via Next build**

Run: `npm run build`
Expected: build succeeds with no TypeScript or ESLint errors. (Warnings about unrelated files are fine.)

If the build fails on unrelated existing files, run `npx tsc --noEmit` instead and confirm only this file is clean.

- [ ] **Step 3: Run the smoke test with the existing single-number env**

Run: `npx tsx --env-file=.env.local scripts/smoke-evolution.ts`
Expected: receive the test message on the configured number, logs show `[evolution] sent to ****<last4>`.

This proves retrocompat (1 number in env → 1 send, just like before).

- [ ] **Step 4: Commit**

```bash
git add src/lib/evolution/client.ts
git commit -m "refactor(evolution): support multiple recipients in WHATSAPP_RECIPIENT_NUMBER

Parses the env as a comma-separated list, sends sequentially with per-recipient
retry, masks numbers in logs, and tolerates partial failures (only throws if
all recipients fail). Single-number config remains valid (list of 1)."
```

---

### Task 2: Manual multi-recipient verification

This task validates the new behavior with a real 2-number list. **Coordinate with the user before changing `.env.local`**, since it affects their actual WhatsApp deliveries.

**Files:** none (verification only)

- [ ] **Step 1: Ask the user for a 2nd test number**

Prompt the user: "Para validar o multi-recipient, preciso de um segundo número de WhatsApp em formato internacional sem `+` (ex.: `5581991234567`). Pode ser o seu próprio outro número ou um de teste. Quer que eu rode com 2 destinatários?"

Do not proceed with `.env.local` changes without explicit user confirmation.

- [ ] **Step 2: Temporarily set `.env.local` to two numbers**

The user (or you, with permission) updates the line in `.env.local`:
```
WHATSAPP_RECIPIENT_NUMBER=<original-number>,<second-number>
```

- [ ] **Step 3: Run the smoke test**

Run: `npx tsx --env-file=.env.local scripts/smoke-evolution.ts`
Expected:
- Both numbers receive the test message.
- Console logs show two lines `[evolution] sent to ****<last4>` in order.
- The script exits 0.

- [ ] **Step 4: Run the smoke test with whitespace and duplicates**

Temporarily set:
```
WHATSAPP_RECIPIENT_NUMBER= <num1> , <num1>,,<num2>
```
Run: `npx tsx --env-file=.env.local scripts/smoke-evolution.ts`
Expected: each number receives exactly one message; logs show only two send lines.

- [ ] **Step 5: Run the smoke test with an empty list**

Temporarily set:
```
WHATSAPP_RECIPIENT_NUMBER=", ,"
```
Run: `npx tsx --env-file=.env.local scripts/smoke-evolution.ts`
Expected: script exits non-zero with `Error: WHATSAPP_RECIPIENT_NUMBER has no valid recipients`.

- [ ] **Step 6: Restore the user's preferred final value**

Ask the user what final value they want in `.env.local` (single number, both numbers, or another combination) and set it. **Do not commit `.env.local` — it is gitignored.**

No commit in this task (verification only).

---

### Task 3: Update `CLAUDE.md` env description

**Files:**
- Modify: `CLAUDE.md` — the line documenting `WHATSAPP_RECIPIENT_NUMBER`

- [ ] **Step 1: Update the env description**

Find this line in `CLAUDE.md`:
```
- `WHATSAPP_RECIPIENT_NUMBER` — número do destinatário em formato internacional sem `+` (ex.: `5581998735441`)
```

Replace with:
```
- `WHATSAPP_RECIPIENT_NUMBER` — um ou mais destinatários em formato internacional sem `+`, separados por vírgula (ex.: `5581998735441,5581991234567`). Lista é deduplicada e espaços são removidos.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude.md): document WHATSAPP_RECIPIENT_NUMBER as CSV list"
```

---

## Self-review

**Spec coverage check:**
- ✅ Parse CSV with trim + dedupe → Task 1 (`parseRecipients`)
- ✅ Sequential loop → Task 1 (for-of in `sendWhatsAppText`)
- ✅ Per-recipient retry/backoff → Task 1 (`sendOneRecipient`)
- ✅ Partial failure tolerance with `console.error` → Task 1 (failures array)
- ✅ Throw only if all fail, with aggregated message → Task 1
- ✅ Masked logs → Task 1 (`maskNumber` used in all log lines)
- ✅ Empty-list throws explicit error → Task 1 (`parseRecipients` throw)
- ✅ Retrocompat with 1 number → Task 1 Step 3 (smoke test)
- ✅ Manual verification with multiple numbers → Task 2
- ✅ CLAUDE.md env doc update → Task 3
- ✅ Call-sites unchanged → none touched

**Placeholder scan:** none. All code blocks are complete.

**Type consistency:**
- `maskNumber(num: string): string` used in all log call-sites with `number` (string) — consistent.
- `parseRecipients(raw: string): string[]` returns string[] consumed by `for (const number of recipients)` — consistent.
- `sendOneRecipient(url, headers, number, text)` signature matches the call site.
- `failures: { number: string; err: unknown }[]` matches the push shape.

No issues found.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-14-whatsapp-multi-recipient.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
