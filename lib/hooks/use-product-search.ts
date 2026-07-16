"use client"

import { useCallback } from "react"
import type { Product } from "@/lib/types"

// ── Ranking ───────────────────────────────────────────────────────────────────
// Score 0 = exact barcode  1 = exact SKU  2 = name starts with  3 = partial
// Score -1 = no match (excluded)

const MAX_VISIBLE = 30

export function rankProducts(products: Product[], query: string): Product[] {
  if (!query.trim()) return products.slice(0, MAX_VISIBLE)
  const q = query.toLowerCase().trim()
  return products
    .map(p => {
      const barcode = (p.barcode ?? "").toLowerCase()
      const sku = p.sku.toLowerCase()
      const name = p.name.toLowerCase()
      if (barcode && barcode === q) return { p, score: 0 }
      if (sku === q)                return { p, score: 1 }
      if (name.startsWith(q))       return { p, score: 2 }
      if (name.includes(q) || sku.includes(q) || barcode.includes(q)) return { p, score: 3 }
      return { p, score: -1 }
    })
    .filter(s => s.score >= 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, MAX_VISIBLE)
    .map(s => s.p)
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Pure product-identification logic with no UI or side effects.
 *
 * resolve(code) — finds a product by exact barcode, SKU, or ID.
 *   Priority: barcode → SKU (case-insensitive) → ID.
 *   Returns null when nothing matches.
 *
 * rank(query) — returns up to 30 products ranked by relevance.
 *   Used by combobox-style search UIs.
 */
export function useProductSearch(products: Product[]) {
  const resolve = useCallback(
    (code: string): Product | null => {
      const trimmed = code.trim()
      if (!trimmed) return null
      const lower = trimmed.toLowerCase()
      return (
        products.find(p => p.barcode && p.barcode === trimmed) ??
        products.find(p => p.sku.toLowerCase() === lower) ??
        products.find(p => p.id === trimmed) ??
        null
      )
    },
    [products],
  )

  const rank = useCallback(
    (query: string): Product[] => rankProducts(products, query),
    [products],
  )

  return { resolve, rank }
}
