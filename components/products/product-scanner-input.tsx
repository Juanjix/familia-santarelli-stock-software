"use client"

import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react"
import { ScanLine, AlertCircle, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useProductSearch } from "@/lib/hooks/use-product-search"
import type { Product } from "@/lib/types"

interface ProductScannerInputProps {
  products: Product[]
  /** Called when a product is successfully identified. The input clears automatically. */
  onResolve: (product: Product) => void
  /** Called when no product matches the submitted code. Receives the raw code. */
  onNotFound?: (code: string) => void
  autoFocus?: boolean
  placeholder?: string
  className?: string
}

export interface ProductScannerInputHandle {
  focus(): void
}

/**
 * Standalone barcode/SKU input that resolves a product on submit (Enter or
 * hardware scanner trigger). Knows nothing about what happens next — the
 * parent module decides the action via onResolve.
 *
 * Exposes focus() via ref so parents can restore focus after modal actions.
 */
export const ProductScannerInput = forwardRef<
  ProductScannerInputHandle,
  ProductScannerInputProps
>(function ProductScannerInput(
  {
    products,
    onResolve,
    onNotFound,
    autoFocus = true,
    placeholder = "Código de barras o SKU...",
    className,
  },
  ref,
) {
  const [value, setValue] = useState("")
  const [notFoundCode, setNotFoundCode] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { resolve } = useProductSearch(products)

  useImperativeHandle(ref, () => ({
    focus() { inputRef.current?.focus() },
  }), [])

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  // Clear "not found" banner when the user starts typing again.
  // trim() prevents a stray space from dismissing the error prematurely.
  useEffect(() => {
    if (value.trim()) setNotFoundCode(null)
  }, [value])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const code = value.trim()
    if (!code) return

    const product = resolve(code)
    setValue("")
    inputRef.current?.focus()

    if (product) {
      setNotFoundCode(null)
      onResolve(product)
    } else {
      setNotFoundCode(code)
      onNotFound?.(code)
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={placeholder}
            className="pl-9 h-11 text-base"
            autoComplete="off"
            spellCheck={false}
          />
          {value && (
            <button
              type="button"
              onClick={() => { setValue(""); inputRef.current?.focus() }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </form>

      {notFoundCode && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            Sin resultado para <span className="font-mono font-medium">"{notFoundCode}"</span>
          </span>
        </div>
      )}
    </div>
  )
})
