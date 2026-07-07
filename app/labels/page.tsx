"use client"

import React, { useState, useMemo, useEffect, useRef } from "react"
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

// Etiqueta física real: rollo 80×10mm
const LABEL_W_MM = 80
const LABEL_H_MM = 10
// Distribución de zonas en mm — suma exacta 80mm
const LEFT_ZONE_MM  = 23   // zona izquierda (dobla): precio + grupo
const RIGHT_ZONE_MM = 57   // zona derecha: solo barcode
// Padding interno del contenedor del barcode
const BARCODE_PAD_V_MM = 2   // arriba y abajo
const BARCODE_PAD_L_MM = 2   // izquierda (desplaza barcode a la izquierda)

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

// Barcode como <img> (mismo dataURL que la impresión) — se escala
// correctamente con height: 100%; width: auto a diferencia de <canvas>.
function BarcodeImg({ code, style }: { code: string; style?: React.CSSProperties }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    setSrc(barcodeToDataURL(code))
  }, [code])

  if (!code || !src) return <span className="text-xs text-muted-foreground italic">Sin código</span>
  return <img src={src} alt={code} style={{ display: "block", ...style }} />
}

// Vista previa a escala — layout idéntico al CSS de impresión, en px×scale.
// scale=6 → 1mm = 6px. Mismo split 23mm | 57mm, mismo padding del barcode.
function LabelPreview({ product, scale = 6 }: {
  product: Product
  scale?: number
}) {
  const code = product.barcode || ""
  const w    = LABEL_W_MM   * scale   // 480px
  const h    = LABEL_H_MM   * scale   // 60px
  const lW   = LEFT_ZONE_MM * scale   // 138px
  const rW   = RIGHT_ZONE_MM * scale  // 342px
  const pvPx = BARCODE_PAD_V_MM * scale   // padding vertical en px
  const plPx = BARCODE_PAD_L_MM * scale   // padding left en px
  const price = product.sell_price != null ? product.sell_price : ""
  const group = product.supplier?.price_group || ""

  return (
    <div style={{
      width: `${w}px`,
      height: `${h}px`,
      display: "flex",
      alignItems: "stretch",
      border: "1px solid #e2e8f0",
      background: "#ffffff",
      boxSizing: "border-box",
      fontFamily: "Arial, sans-serif",
      overflow: "hidden",
    }}>
      {/* Zona izquierda 23mm: Precio + Grupo centrados */}
      <div style={{
        width: `${lW}px`,
        height: `${h}px`,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        borderRight: "0.5px solid #ccc",
        boxSizing: "border-box",
      }}>
        <div style={{ fontSize: `${8 * scale / 6}px`, fontWeight: 700, color: "#000", lineHeight: 1 }}>
          {price}
        </div>
        {group && (
          <div style={{ fontSize: `${7 * scale / 6}px`, fontWeight: 700, color: "#000", lineHeight: 1, marginTop: `${0.5 * scale / 6}px` }}>
            {group}
          </div>
        )}
      </div>

      {/* Zona derecha 57mm: solo barcode, alineado a la izquierda */}
      <div style={{
        width: `${rW}px`,
        height: `${h}px`,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: `${pvPx}px 0 ${pvPx}px ${plPx}px`,
        boxSizing: "border-box",
        overflow: "hidden",
      }}>
        <BarcodeImg code={code} style={{ height: "100%", width: "auto" }} />
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
              width: ${LEFT_ZONE_MM}mm;
              height: ${LABEL_H_MM}mm;
              flex-shrink: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              border-right: 0.3px solid #ccc;
              box-sizing: border-box;
            }

            .label-price {
              font-size: 8pt;
              font-weight: 700;
              color: #000;
              line-height: 1;
            }

            .label-group {
              font-size: 7pt;
              font-weight: 700;
              color: #000;
              line-height: 1;
              margin-top: 0.5mm;
            }

            .label-barcode {
              width: ${RIGHT_ZONE_MM}mm;
              height: ${LABEL_H_MM}mm;
              flex-shrink: 0;
              display: flex;
              align-items: center;
              justify-content: flex-start;
              padding: ${BARCODE_PAD_V_MM}mm 0 ${BARCODE_PAD_V_MM}mm ${BARCODE_PAD_L_MM}mm;
              box-sizing: border-box;
              overflow: hidden;
            }
            .label-barcode img {
              height: 100%;
              width: auto;
              display: block;
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
