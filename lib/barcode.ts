/**
 * Generates a CODE128-compatible barcode string.
 *
 * Format: "78" + 8 trailing digits of current timestamp + 6 cryptographically random digits = 16 chars.
 * - Timestamp component ensures temporal uniqueness across separate sessions.
 * - Crypto random component prevents collisions within the same millisecond.
 * - Does NOT perform a DB uniqueness check — callers that write to the DB must
 *   verify uniqueness themselves (see addProduct in inventory-context.tsx).
 */
export function generateBarcode(): string {
  const ts = Date.now().toString().slice(-8)
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  const rand = arr[0].toString().padStart(10, "0").slice(0, 6)
  return "78" + ts + rand
}
