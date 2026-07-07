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
import { Search, Printer, Tags, Barcode } from "lucide-react"

// Etiqueta física real utilizada por la joyería (ver plano técnico): banda
// horizontal angosta, NO el formato vertical 56×25mm usado anteriormente.
const LABEL_W_MM = 80
const LABEL_H_MM = 10

const BARCODE_OPTIONS = {
  format: "CODE128",
  width: 2,
  height: 60,
  displayValue: false,
  margin: 0,
  background: "#ffffff",
  lineColor: "#000000",
} as const

// Atributo principal de un producto según su categoría (Talle, Largo, etc).
// Regla: si el atributo es numérico (ej. Talle) se antepone su label
// ("Talle 16"); si es texto libre (ej. Largo, donde el operador ya tipea
// "45 cm") se imprime el valor solo, sin duplicar la unidad.
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

// Genera el barcode real (Code128) como dataURL PNG, reutilizable tanto en
// el preview (canvas en pantalla) como en la impresión (img embebida).
function barcodeToDataURL(code: string): string | null {
  if (!code) return null
  const canvas = document.createElement("canvas")
  try {
    JsBarcode(canvas, code, BARCODE_OPTIONS)
    return canvas.toDataURL("image/png")
  } catch {
    return null
  }
}

// Barcode renderizado en vivo para el preview — misma librería y mismas
// opciones que la impresión: una única fuente de verdad.
function BarcodeCanvas({ code, className }: { code: string; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || !code) return
    try {
      JsBarcode(canvasRef.current, code, BARCODE_OPTIONS)
    } catch {
      // código inválido para Code128 — se deja el canvas vacío
    }
  }, [code])

  if (!code) return <span className="text-xs text-muted-foreground">Sin código</span>
  return <canvas ref={canvasRef} className={className} />
}

// Vista previa a escala — dos zonas: izquierda (Precio + Grupo) | derecha (Barcode).
// Layout y proporciones idénticas a lo que se imprime.
function LabelPreview({ product, scale = 6 }: {
  product: Product
  scale?: number
}) {
  const code = product.barcode || ""
  const w = LABEL_W_MM * scale
  const h = LABEL_H_MM * scale
  const leftW = 30 * scale       // ~30mm zona izquierda
  const price = product.sell_price != null ? product.sell_price : ""
  const group = product.supplier?.price_group || ""

  return (
    <div
      style={{
        width: `${w}px`,
        height: `${h}px`,
        display: "flex",
        alignItems: "stretch",
        border: "1px solid #e2e8f0",
        background: "#ffffff",
        boxSizing: "border-box",
        fontFamily: "Arial, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Zona izquierda: Precio + Grupo centrados */}
      <div style={{
        width: `${leftW}px`,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        borderRight: "0.5px solid #ccc",
        padding: `0 ${2 * scale / 6}px`,
      }}>
        <div style={{ fontSize: `${8 * scale / 6}px`, fontWeight: 700, color: "#000", lineHeight: 1 }}>
          {price}
        </div>
        {group && (
          <div style={{ fontSize: `${7 * scale / 6}px`, fontWeight: 700, color: "#000", lineHeight: 1, marginTop: `${0.8 * scale / 6}px` }}>
            {group}
          </div>
        )}
      </div>

      {/* Zona derecha: Barcode con margen interno (5mm der, 1.5mm arr/abj) */}
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: `${1.5 * scale / 6}px ${5 * scale / 6}px ${1.5 * scale / 6}px ${2 * scale / 6}px`,
        height: "100%",
        minWidth: 0,
        overflow: "hidden",
      }}>
        <BarcodeCanvas code={code} className="h-full w-auto" />
      </div>
    </div>
  )
}

export default function LabelsPage() {
  const { products, categories, categoryAttributes } = useInventory()
  const [search, setSearch] = useState("")
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [quantities, setQuantities] = useState<Map<string, number>>(new Map())
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null)

  // Only show products that have a barcode (required to print)
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const hasBarcode = !!product.barcode
      const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase()) ||
        product.sku.toLowerCase().includes(search.toLowerCase()) ||
        (product.barcode || "").includes(search)
      return hasBarcode && matchesSearch
    })
  }, [products, search])

  const toggleProduct = (productId: string) => {
    const newSelected = new Set(selectedProducts)
    if (newSelected.has(productId)) {
      newSelected.delete(productId)
    } else {
      newSelected.add(productId)
      if (!quantities.has(productId)) {
        setQuantities(new Map(quantities).set(productId, 1))
      }
    }
    setSelectedProducts(newSelected)
  }

  const toggleAll = () => {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set())
    } else {
      setSelectedProducts(new Set(filteredProducts.map(p => p.id)))
    }
  }

  const setQuantity = (productId: string, quantity: number) => {
    const newQuantities = new Map(quantities)
    if (quantity > 0) {
      newQuantities.set(productId, quantity)
    } else {
      newQuantities.delete(productId)
    }
    setQuantities(newQuantities)
  }

  const getTotalLabels = () => {
    let total = 0
    selectedProducts.forEach(id => { total += quantities.get(id) || 1 })
    return total
  }

  const handlePrint = (productsOverride?: Product[]) => {
    const list = productsOverride || products.filter(p => selectedProducts.has(p.id) && p.barcode)
    if (list.length === 0) return

    // Una sola renderización de barcode por código único (evita trabajo repetido si quantity > 1)
    const barcodeCache = new Map<string, string | null>()
    const getBarcodeDataURL = (code: string) => {
      if (!barcodeCache.has(code)) barcodeCache.set(code, barcodeToDataURL(code))
      return barcodeCache.get(code) || null
    }

    let labelsHtml = ""
    list.forEach(product => {
      const quantity = productsOverride ? 1 : (quantities.get(product.id) || 1)
      const code = product.barcode || ""
      const price = product.sell_price != null ? product.sell_price : ""
      const group = product.supplier?.price_group || ""
      const barcodeSrc = getBarcodeDataURL(code)

      for (let i = 0; i < quantity; i++) {
        labelsHtml += `
          <div class="label">
            <div class="label-left">
              <div class="label-price">${price}</div>
              ${group ? `<div class="label-group">${group}</div>` : ""}
            </div>
            <div class="label-barcode">
              ${barcodeSrc ? `<img src="${barcodeSrc}" alt="${code}" />` : ""}
            </div>
          </div>
        `
      }
    })

    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Etiquetas — Santarelli</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }

            @page {
              size: ${LABEL_W_MM}mm ${LABEL_H_MM}mm;
              margin: 0;
            }

            body { font-family: Arial, sans-serif; background: #fff; }

            .label {
              width: ${LABEL_W_MM}mm;
              height: ${LABEL_H_MM}mm;
              display: flex;
              align-items: stretch;
              overflow: hidden;
              page-break-after: always;
            }
            .label:last-child { page-break-after: avoid; }

            .label-left {
              width: 30mm;
              flex-shrink: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              border-right: 0.4px solid #ccc;
              padding: 0 1.5mm;
            }

            .label-price {
              font-size: 8.5pt;
              font-weight: 700;
              color: #000;
              line-height: 1;
            }

            .label-group {
              font-size: 7.5pt;
              font-weight: 700;
              color: #000;
              line-height: 1;
              margin-top: 0.8mm;
            }

            .label-barcode {
              flex: 1;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100%;
              min-width: 0;
              overflow: hidden;
              padding: 1.5mm 5mm 1.5mm 2mm;
            }
            .label-barcode img {
              height: 100%;
              width: auto;
              object-fit: contain;
            }
          </style>
        </head>
        <body>
          ${labelsHtml}
          <script>window.print();</script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Etiquetas" />

      <main className="flex-1 overflow-auto p-4 md:p-6">
        {/* Toolbar */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, SKU o código de barras..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            {selectedProducts.size > 0 && (
              <Badge variant="secondary">
                {selectedProducts.size} seleccionados · {getTotalLabels()} etiquetas
              </Badge>
            )}
            <Button onClick={() => handlePrint()} disabled={selectedProducts.size === 0}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
          </div>
        </div>

        {/* Label size info */}
        <p className="mb-3 text-xs text-muted-foreground">
          Formato: {LABEL_W_MM}×{LABEL_H_MM} mm — solo se listan productos con código de barras asignado
        </p>

        {/* Products table */}
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
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => setQuantity(product.id, Math.max(1, (quantities.get(product.id) || 1) - 1))}
                        >
                          −
                        </Button>
                        <Input
                          type="number"
                          min="1"
                          max="99"
                          value={quantities.get(product.id) || 1}
                          onChange={(e) => setQuantity(product.id, Math.max(1, parseInt(e.target.value) || 1))}
                          className="h-8 w-12 text-center p-0"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => setQuantity(product.id, Math.min(99, (quantities.get(product.id) || 1) + 1))}
                        >
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

      {/* Label Preview Dialog */}
      <Dialog open={!!previewProduct} onOpenChange={() => setPreviewProduct(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Vista previa — {LABEL_W_MM}×{LABEL_H_MM} mm</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-4">
            {previewProduct && (
              <LabelPreview
                product={previewProduct}
                scale={6}
              />
            )}
            <p className="text-xs text-muted-foreground text-center">
              Vista a escala con barcode real (Code128) — el impreso usará exactamente este contenido
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPreviewProduct(null)}>
              Cerrar
            </Button>
            <Button onClick={() => {
              if (previewProduct) handlePrint([previewProduct])
            }}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir 1
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
