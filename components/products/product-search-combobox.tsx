"use client"

import { useState, useEffect, useMemo } from "react"
import { Check, Package } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import type { Product } from "@/lib/types"

// ── Ranking ───────────────────────────────────────────────────────────────────
// Score 0 = exact barcode  1 = exact SKU  2 = name starts with  3 = partial
// Score -1 = no match (excluded)

const MAX_VISIBLE = 30

function rankProducts(products: Product[], query: string): Product[] {
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

// ── Props ─────────────────────────────────────────────────────────────────────

interface ProductSearchComboboxProps {
  /** Candidate products to search through (pre-filtered by caller if needed). */
  products: Product[]
  selectedProductId: string
  onSelect: (productId: string) => void
  /** Returns the available stock for a given product — shown in each result row. */
  getStockInWarehouse?: (productId: string) => number
  disabled?: boolean
  className?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProductSearchCombobox({
  products,
  selectedProductId,
  onSelect,
  getStockInWarehouse,
  disabled,
  className,
}: ProductSearchComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")

  // Debounce — 150 ms keeps the list snappy while avoiding excessive filtering
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 150)
    return () => clearTimeout(t)
  }, [query])

  // Scanner support: exact barcode match → auto-select without user interaction.
  // A barcode reader types quickly and ends with Enter; the debounce settles
  // before Enter fires, so this effect reliably catches the full code.
  useEffect(() => {
    if (!debouncedQuery || !open) return
    const match = products.find(p => p.barcode && p.barcode === debouncedQuery)
    if (match) {
      onSelect(match.id)
      setOpen(false)
      setQuery("")
    }
  }, [debouncedQuery, open, products, onSelect])

  const filtered = useMemo(
    () => rankProducts(products, debouncedQuery),
    [products, debouncedQuery],
  )

  const selectedProduct = selectedProductId
    ? products.find(p => p.id === selectedProductId)
    : undefined

  function handleSelect(productId: string) {
    onSelect(productId)
    setOpen(false)
    setQuery("")
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setQuery("")
  }

  const noProductsAtAll = products.length === 0

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-8 w-full justify-start gap-1.5 text-xs font-normal overflow-hidden",
            !selectedProduct && "text-muted-foreground",
            className,
          )}
        >
          {selectedProduct ? (
            <span className="truncate">
              {selectedProduct.name}
              <span className="text-muted-foreground ml-1">— {selectedProduct.sku}</span>
            </span>
          ) : (
            <span className="truncate">
              {disabled
                ? "Seleccioná un origen primero"
                : "Buscar por nombre, SKU o código de barras..."}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[360px] p-0"
        align="start"
        onOpenAutoFocus={e => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar por nombre, SKU o código de barras..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {noProductsAtAll ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>Sin stock en este depósito.</p>
              </div>
            ) : (
              <>
                <CommandEmpty>
                  <Package className="h-7 w-7 mx-auto mb-2 opacity-30" />
                  <p>Sin resultados para <strong>"{debouncedQuery}"</strong></p>
                </CommandEmpty>
                <CommandGroup>
                  {filtered.map(p => {
                    const stock = getStockInWarehouse?.(p.id)
                    const isSelected = p.id === selectedProductId
                    return (
                      <CommandItem
                        key={p.id}
                        value={p.id}
                        onSelect={handleSelect}
                        className="cursor-pointer items-start py-2"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-sm leading-tight truncate">
                              {p.name}
                            </span>
                            {isSelected && (
                              <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                            <span className="font-mono">{p.sku}</span>
                            {p.barcode && (
                              <span className="font-mono opacity-70">· {p.barcode}</span>
                            )}
                            {stock !== undefined && (
                              <span
                                className={cn(
                                  "ml-auto shrink-0 font-medium",
                                  stock === 0 && "text-destructive",
                                  stock > 0 && "text-green-700 dark:text-green-400",
                                )}
                              >
                                {stock} u.
                              </span>
                            )}
                          </div>
                        </div>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
