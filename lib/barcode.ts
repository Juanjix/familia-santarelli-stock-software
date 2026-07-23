/**
 * Generates an 8-digit numeric barcode compatible with CODE128.
 *
 * Format: "78" + 6 cryptographic random digits
 *
 *   "78"     — fixed prefix, avoids leading zeros
 *   yyyyyy   — 6 digits from crypto.getRandomValues(), 1-in-1,000,000 collision chance
 *
 * This function does NOT check database uniqueness. Callers that persist the code
 * must verify it is unique and retry if necessary (see addProduct in inventory-context.tsx).
 */
export function generateBarcode(): string {
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  const rand = arr[0].toString().padStart(10, "0").slice(0, 6)
  return "78" + rand
}
