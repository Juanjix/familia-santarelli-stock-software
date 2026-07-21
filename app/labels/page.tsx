"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import JsBarcode from "jsbarcode"
import { useInventory } from "@/lib/inventory-context"
import type { Product, Category, CategoryAttribute } from "@/lib/types"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Search, Printer, Tags, Barcode, Wifi, WifiOff, Loader2 } from "lucide-react"
import { printLabels, isQZConnected, PrintError, type LabelItem } from "@/lib/printing"

// ─── Dimensiones físicas (solo para el preview en pantalla) ─────────────────
const LABEL_W_MM = 80
const LABEL_H_MM = 10

// ─── BARCODE_OPTIONS — solo para el preview en pantalla ──────────────────────
const BARCODE_OPTIONS = {
  format: "CODE128",
  width: 2,
  height: 45,
  displayValue: true,
  fontSize: 7,
  textMargin: 1,
  margin: 2,
  background: "#ffffff",
  lineColor: "#000000",
} as const

// ─── Helpers de preview ───────────────────────────────────────────────────────
function getPrimaryAttributeText(
  product: Product,
  categories: Category[],
  categoryAttributes: CategoryAttribute[]
): string | null {
  if (!product.attributes) return null
  const cat = product.category_id
    ? categories.find(c => c.id === product.category_id)
    : categories.find(c => c.name === product.category)
  if (!cat) return null
  const attrs = categoryAttributes
    .filter(a => a.category_id === cat.id && a.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
  if (attrs.length === 0) return null
  const primary = attrs[0]
  const value = product.attributes[primary.key]
  if (!value) return null
  return primary.input_type === "number" ? `${primary.label} ${value}` : value
}

function BarcodeCanvas({ code, className }: { code: string; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!canvasRef.current || !code) return
    try { JsBarcode(canvasRef.current, code, BARCODE_OPTIONS) } catch { /* código inválido */ }
  }, [code])
  if (!code) return <span className="text-xs text-muted-foreground">Sin código</span>
  return <canvas ref={canvasRef} className={className} />
}

function LabelPreview({ product }: { product: Product }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(4)

  // Compute scale so the label always fills the container width exactly.
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(([entry]) => {
      const px = entry.contentRect.width
      if (px > 0) setScale(px / LABEL_W_MM)
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const h     = LABEL_H_MM * scale
  const leftW = 30 * scale
  const price = product.sell_price != null ? product.sell_price : ""
  const group = product.supplier?.price_group ?? ""
  const code  = product.barcode ?? ""

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      <div style={{
        width: "100%", height: `${h}px`, display: "flex", alignItems: "stretch",
        border: "1px solid #e2e8f0", background: "#ffffff",
        boxSizing: "border-box", fontFamily: "Arial, sans-serif", overflow: "hidden",
      }}>
        <div style={{
          width: `${leftW}px`, flexShrink: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          borderRight: "0.5px solid #ccc", padding: `0 ${2 * scale / 6}px`,
        }}>
          <div style={{ fontSize: `${8 * scale / 6}px`, fontWeight: 700, color: "#000", lineHeight: 1 }}>{price}</div>
          {group && (
            <div style={{ fontSize: `${7 * scale / 6}px`, fontWeight: 700, color: "#000", lineHeight: 1, marginTop: `${0.8 * scale / 6}px` }}>
              {group}
            </div>
          )}
        </div>
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          padding: `${1.5 * scale / 6}px ${5 * scale / 6}px ${1.5 * scale / 6}px ${2 * scale / 6}px`,
          height: "100%", minWidth: 0, overflow: "hidden",
        }}>
          <BarcodeCanvas code={code} className="h-full w-auto" />
        </div>
      </div>
    </div>
  )
}

// ─── Helpers para construir LabelItem desde Product ──────────────────────────
function productToLabelItem(product: Product, quantity: number): LabelItem {
  return {
    barcode:  product.barcode ?? "",
    price:    product.sell_price != null ? String(product.sell_price) : undefined,
    group:    product.supplier?.price_group ?? undefined,
    quantity,
  }
}

// ─── Estado de QZ Tray ────────────────────────────────────────────────────────
type QZStatus = "idle" | "connected" | "error"

export default function LabelsPage() {
  const { products, categories, categoryAttributes } = useInventory()
  const [search, setSearch]                     = useState("")
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [quantities, setQuantities]             = useState<Map<string, number>>(new Map())
  const [previewProduct, setPreviewProduct]     = useState<Product | null>(null)
  const [qzStatus, setQzStatus]                 = useState<QZStatus>("idle")
  const [qzError, setQzError]                   = useState<string | null>(null)
  const [printing, setPrinting]                 = useState(false)

  // Refleja el estado de conexión real de QZ en el indicador
  useEffect(() => {
    if (isQZConnected()) setQzStatus("connected")
  }, [printing])

  // ─── Impresión ─────────────────────────────────────────────────────────────
  const handlePrint = async (productsOverride?: Product[]) => {
    const items = productsOverride
      ? productsOverride.map(p => productToLabelItem(p, 1))
      : products
          .filter(p => selectedProducts.has(p.id) && p.barcode)
          .map(p => productToLabelItem(p, quantities.get(p.id) || 1))

    if (items.length === 0) return

    setPrinting(true)
    setQzError(null)
    try {
      await printLabels(items)
      setQzStatus("connected")
    } catch (e) {
      const msg = e instanceof PrintError ? e.message : (e instanceof Error ? e.message : String(e))
      setQzStatus("error")
      setQzError(msg)
    } finally {
      setPrinting(false)
    }
  }

  // ─── Helpers de selección ──────────────────────────────────────────────────
  const filteredProducts = useMemo(() => products.filter(product => {
    const hasBarcode    = !!product.barcode
    const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.sku.toLowerCase().includes(search.toLowerCase()) ||
      (product.barcode || "").includes(search)
    return hasBarcode && matchesSearch
  }), [products, search])

  const toggleProduct = (productId: string) => {
    const next = new Set(selectedProducts)
    if (next.has(productId)) { next.delete(productId) }
    else {
      next.add(productId)
      if (!quantities.has(productId)) setQuantities(new Map(quantities).set(productId, 1))
    }
    setSelectedProducts(next)
  }

  const toggleAll = () => {
    setSelectedProducts(
      selectedProducts.size === filteredProducts.length
        ? new Set()
        : new Set(filteredProducts.map(p => p.id))
    )
  }

  const setQuantity = (productId: string, quantity: number) => {
    const next = new Map(quantities)
    if (quantity > 0) next.set(productId, quantity)
    else next.delete(productId)
    setQuantities(next)
  }

  const getTotalLabels = () => {
    let total = 0
    selectedProducts.forEach(id => { total += quantities.get(id) || 1 })
    return total
  }

  // ─── Indicador de estado QZ Tray ──────────────────────────────────────────
  const QZIndicator = () => {
    if (qzStatus === "connected") return (
      <span className="flex items-center gap-1 text-xs text-green-600">
        <Wifi className="h-3 w-3" /> QZ Tray conectado
      </span>
    )
    if (qzStatus === "error") return (
      <span className="flex items-center gap-1 text-xs text-destructive" title={qzError ?? ""}>
        <WifiOff className="h-3 w-3" /> {qzError ?? "Error QZ Tray"}
      </span>
    )
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Wifi className="h-3 w-3" /> QZ Tray listo
      </span>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      <Header title="Etiquetas" />

      <main className="flex-1 overflow-auto p-4 md:p-6">
        {/* Toolbar */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, SKU o código de barras…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-3">
            <QZIndicator />
            {selectedProducts.size > 0 && (
              <Badge variant="secondary">
                {selectedProducts.size} seleccionados · {getTotalLabels()} etiquetas
              </Badge>
            )}
            <Button
              onClick={() => handlePrint()}
              disabled={selectedProducts.size === 0 || printing}
            >
              {printing
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Printer className="mr-2 h-4 w-4" />}
              {printing ? "Imprimiendo…" : "Imprimir"}
            </Button>
          </div>
        </div>

        {/* Info */}
        <p className="mb-3 text-xs text-muted-foreground">
          Formato: {LABEL_W_MM}×{LABEL_H_MM} mm · Impresión via TSPL (QZ Tray + TSC TTP-244 Pro) · Solo productos con código de barras
        </p>

        {/* Tabla */}
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Identificador</TableHead>
                <TableHead>Atributo</TableHead>
                <TableHead>Código de Barras</TableHead>
                <TableHead className="w-32 text-center">Cantidad</TableHead>
                <TableHead className="text-right">Vista previa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.slice(0, 50).map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedProducts.has(product.id)}
                      onCheckedChange={() => toggleProduct(product.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0">
                        <Tags className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.category}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm font-semibold">
                    {(product.internal_code || product.sku || "").toUpperCase()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {getPrimaryAttributeText(product, categories, categoryAttributes) || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Barcode className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-mono text-sm">{product.barcode}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {selectedProducts.has(product.id) ? (
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0"
                          onClick={() => setQuantity(product.id, Math.max(1, (quantities.get(product.id) || 1) - 1))}>
                          −
                        </Button>
                        <Input type="number" min="1" max="99"
                          value={quantities.get(product.id) || 1}
                          onChange={(e) => setQuantity(product.id, Math.max(1, parseInt(e.target.value) || 1))}
                          className="h-8 w-12 text-center p-0"
                        />
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0"
                          onClick={() => setQuantity(product.id, Math.min(99, (quantities.get(product.id) || 1) + 1))}>
                          +
                        </Button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm text-center block">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setPreviewProduct(product)}>
                      Ver
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {search ? "Sin resultados para esa búsqueda." : "No hay productos con código de barras asignado."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {filteredProducts.length > 50 && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Mostrando 50 de {filteredProducts.length}. Usá el buscador para filtrar.
          </p>
        )}
      </main>

      {/* Preview dialog */}
      <Dialog open={!!previewProduct} onOpenChange={() => setPreviewProduct(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Vista previa — {LABEL_W_MM}×{LABEL_H_MM} mm</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {previewProduct && <LabelPreview product={previewProduct} />}
            <p className="text-xs text-muted-foreground text-center">
              Vista aproximada — la impresión real usa TSPL nativo (posición exacta en dots)
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPreviewProduct(null)}>Cerrar</Button>
            <Button
              disabled={printing}
              onClick={() => { if (previewProduct) handlePrint([previewProduct]) }}
            >
              {printing
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Printer className="mr-2 h-4 w-4" />}
              Imprimir 1
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
