/**
 * Fix UTF-8 double-encoding (mojibake).
 * e.g. "SÃ£o JosÃ©" → "São José"
 */
export function fixEncoding(text: string | null | undefined): string {
  if (!text) return "\u2014"
  try {
    // Try to decode double-encoded UTF-8
    const bytes = new Uint8Array([...text].map((c) => c.charCodeAt(0)))
    const decoded = new TextDecoder("utf-8").decode(bytes)
    // If decoded is different and doesn't contain replacement chars, use it
    if (decoded !== text && !decoded.includes("\uFFFD")) {
      return decoded
    }
  } catch {
    // ignore decoding errors
  }
  return text
}
