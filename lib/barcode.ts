/**
 * Generates a 16-character numeric barcode string compatible with CODE128.
 *
 * Format: "78" + 8 trailing digits of current timestamp + 6 cryptographic random digits
 *
 *   "78"         — prefix, avoids leading zeros
 *   xxxxxxxx     — last 8 digits of Date.now() (ms since epoch), ~3-year cycle
 *   yyyyyy       — 6 digits from crypto.getRandomValues(), 1-in-1,000,000 collision chance
 *                  per millisecond; effectively zero collision risk at any realistic scale
 *
 * This function does NOT check database uniqueness. Callers that persist the code
 * must verify it is unique and retry if necessary (see addProduct in inventory-context.tsx).
 */
export function generateBarcode(): string {
  const ts = Date.now().toString().slice(-8)
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  const rand = arr[0].toString().padStart(10, "0").slice(0, 6)
  return "78" + ts + rand
}
