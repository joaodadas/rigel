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
