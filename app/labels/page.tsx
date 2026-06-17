"use client"

import { useState, useMemo, useEffect } from "react"
import { useInventory } from "@/lib/inventory-context"
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

// Label physical dimensions (thermoprint roll: 56mm × 25mm)
const LABEL_W_MM = 56
const LABEL_H_MM = 25

// Real label using Libre Barcode 128 font — matches the print output exactly
function LabelPreview({ product, scale = 3.5 }: {
  product: { sku: string; barcode: string | null; internal_code?: string | null }
  scale?: number
}) {
  const code = product.barcode || ""
  const identifier = (product.internal_code || product.sku || "").toUpperCase()

  const w = LABEL_W_MM * scale
  const h = LABEL_H_MM * scale

  return (
    <div
      style={{
        width: `${w}px`,
        height: `${h}px`,
        padding: `${1.5 * scale}px ${2 * scale}px`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "center",
        border: "1px solid #e2e8f0",
        background: "#ffffff",
        boxSizing: "border-box",
        fontFamily: "Arial, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Top: identifier */}
      <div style={{
        fontSize: `${7 * scale / 3.5}px`,
        fontWeight: 700,
        letterSpacing: "0.5px",
        textTransform: "uppercase",
        color: "#000",
        width: "100%",
        textAlign: "center",
        lineHeight: 1,
        flexShrink: 0,
      }}>
        {identifier}
      </div>

      {/* Center: barcode */}
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        overflow: "hidden",
        minHeight: 0,
      }}>
        <div style={{
          fontFamily: "'Libre Barcode 128', monospace",
          fontSize: `${28 * scale / 3.5}px`,
          lineHeight: 1,
          color: "#000",
          whiteSpace: "nowrap",
          maxWidth: "100%",
        }}>
          {code ? `*${code}*` : "*000000000000*"}
        </div>
      </div>

      {/* Bottom: barcode number */}
      <div style={{
        fontSize: `${6.5 * scale / 3.5}px`,
        fontFamily: "monospace",
        letterSpacing: "1px",
        color: "#000",
        width: "100%",
        textAlign: "center",
        lineHeight: 1,
        flexShrink: 0,
      }}>
        {code || "—"}
      </div>
    </div>
  )
}

export default function LabelsPage() {
  const { products } = useInventory()
  const [search, setSearch] = useState("")
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [quantities, setQuantities] = useState<Map<string, number>>(new Map())
  const [previewProduct, setPreviewProduct] = useState<typeof products[0] | null>(null)
  const [fontLoaded, setFontLoaded] = useState(false)

  // Load Libre Barcode 128 font so preview matches print output
  useEffect(() => {
    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = "https://fonts.googleapis.com/css2?family=Libre+Barcode+128&display=swap"
    link.onload = () => setFontLoaded(true)
    document.head.appendChild(link)
    return () => { document.head.removeChild(link) }
  }, [])

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

  const handlePrint = () => {
    const selectedProductsList = products.filter(p => selectedProducts.has(p.id) && p.barcode)
    if (selectedProductsList.length === 0) return

    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    let labelsHtml = ""
    selectedProductsList.forEach(product => {
      const quantity = quantities.get(product.id) || 1
      const identifier = ((product.internal_code || product.sku) || "").toUpperCase()
      const code = product.barcode || ""

      for (let i = 0; i < quantity; i++) {
        labelsHtml += `
          <div class="label">
            <div class="label-id">${identifier}</div>
            <div class="label-barcode">*${code}*</div>
            <div class="label-num">${code}</div>
          </div>
        `
      }
    })

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Etiquetas — Santarelli</title>
          <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+128&display=swap" rel="stylesheet">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }

            @page {
              size: auto;
              margin: 4mm;
            }

            body {
              font-family: Arial, sans-serif;
              background: #fff;
            }

            .labels-container {
              display: flex;
              flex-wrap: wrap;
              gap: 2mm;
            }

            .label {
              width: ${LABEL_W_MM}mm;
              height: ${LABEL_H_MM}mm;
              padding: 1.5mm 2mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              align-items: center;
              overflow: hidden;
              page-break-inside: avoid;
            }

            .label-id {
              font-size: 7pt;
              font-weight: 700;
              letter-spacing: 0.5px;
              text-transform: uppercase;
              color: #000;
              text-align: center;
              line-height: 1;
              width: 100%;
            }

            .label-barcode {
              flex: 1;
              display: flex;
              align-items: center;
              justify-content: center;
              width: 100%;
              overflow: hidden;
              font-family: 'Libre Barcode 128', monospace;
              font-size: 28pt;
              line-height: 1;
              color: #000;
              text-align: center;
            }

            .label-num {
              font-size: 6.5pt;
              font-family: monospace;
              letter-spacing: 1px;
              color: #000;
              text-align: center;
              line-height: 1;
              width: 100%;
            }
          </style>
        </head>
        <body>
          <div class="labels-container">
            ${labelsHtml}
          </div>
          <script>
            // Wait for font before printing
            document.fonts.ready.then(() => { window.print(); });
          </script>
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
            <Button onClick={handlePrint} disabled={selectedProducts.size === 0}>
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
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Vista previa — {LABEL_W_MM}×{LABEL_H_MM} mm</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-4">
            {!fontLoaded && (
              <p className="text-xs text-muted-foreground">Cargando fuente de barras...</p>
            )}
            {previewProduct && (
              <LabelPreview product={previewProduct} scale={3.5} />
            )}
            <p className="text-xs text-muted-foreground text-center">
              Vista a escala — el impreso usará exactamente este layout
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPreviewProduct(null)}>
              Cerrar
            </Button>
            <Button onClick={() => {
              if (previewProduct) {
                setSelectedProducts(new Set([previewProduct.id]))
                if (!quantities.has(previewProduct.id)) {
                  setQuantities(new Map(quantities).set(previewProduct.id, 1))
                }
                handlePrint()
              }
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
