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
    throw new Error("Nenhum destinatário de WhatsApp válido na lista");
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
