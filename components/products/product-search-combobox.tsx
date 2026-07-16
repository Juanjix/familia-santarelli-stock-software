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
import { useProductSearch } from "@/lib/hooks/use-product-search"
import type { Product } from "@/lib/types"

// ── Props ─────────────────────────────────────────────────────────────────────

const DEFAULT_PLACEHOLDER = "Buscar por nombre, SKU o código de barras..."

interface ProductSearchComboboxProps {
  /** Candidate products to search through. Pre-filter by the caller when needed
   *  (e.g. only products with stock in a specific warehouse). */
  products: Product[]
  selectedProductId: string
  onSelect: (productId: string) => void
  /** Optional: returns a stock count displayed next to each result row.
   *  Omit entirely when stock is not relevant to the context. */
  getStock?: (productId: string) => number
  disabled?: boolean
  /** Placeholder shown in the trigger button and the search input. */
  placeholder?: string
  /** Placeholder shown in the trigger button when the component is disabled.
   *  Use to explain *why* it is disabled ("Select a source warehouse first", etc.). */
  disabledPlaceholder?: string
  /** Message shown when the products list is empty before the user types anything.
   *  Customise per-module ("No products in this warehouse", "No products", etc.). */
  emptyMessage?: string
  className?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProductSearchCombobox({
  products,
  selectedProductId,
  onSelect,
  getStock,
  disabled,
  placeholder = DEFAULT_PLACEHOLDER,
  disabledPlaceholder = "No disponible",
  emptyMessage = "No hay productos disponibles.",
  className,
}: ProductSearchComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const { rank } = useProductSearch(products)

  // Debounce — 150 ms keeps the list snappy while avoiding excessive filtering.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 150)
    return () => clearTimeout(t)
  }, [query])

  // Scanner support: exact barcode match → auto-select without user interaction.
  // Intentionally barcode-only: SKU/ID lookups are manual selections from the list.
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
    () => rank(debouncedQuery),
    [rank, debouncedQuery],
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
              {disabled ? disabledPlaceholder : placeholder}
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
            placeholder={placeholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {products.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>{emptyMessage}</p>
              </div>
            ) : (
              <>
                <CommandEmpty>
                  <Package className="h-7 w-7 mx-auto mb-2 opacity-30" />
                  <p>Sin resultados para <strong>"{debouncedQuery}"</strong></p>
                </CommandEmpty>
                <CommandGroup>
                  {filtered.map(p => {
                    const stock = getStock?.(p.id)
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
