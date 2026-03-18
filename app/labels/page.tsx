"use client"

import { useState, useMemo, useRef } from "react"
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

// Simple barcode component using CSS
function BarcodeDisplay({ code }: { code: string }) {
  const bars = useMemo(() => {
    // Simple visual representation of barcode
    const result = []
    for (let i = 0; i < code.length; i++) {
      const digit = parseInt(code[i])
      for (let j = 0; j < 4; j++) {
        const isBlack = (digit + j) % 2 === 0
        result.push(
          <div
            key={`${i}-${j}`}
            className={`h-12 ${isBlack ? 'bg-foreground' : 'bg-background'}`}
            style={{ width: isBlack ? '2px' : '1px' }}
          />
        )
      }
    }
    return result
  }, [code])

  return (
    <div className="flex items-end justify-center gap-px">
      {bars}
    </div>
  )
}

interface LabelPreviewProps {
  product: {
    name: string
    sku: string
    barcode: string
    price: number
    material: string
  }
}

function LabelPreview({ product }: LabelPreviewProps) {
  return (
    <div className="w-[200px] border border-border bg-background p-3 text-center">
      <div className="mb-1 text-xs font-semibold text-muted-foreground">SANTARELLI</div>
      <div className="mb-2 text-sm font-bold text-foreground line-clamp-2">{product.name}</div>
      <div className="mb-2 text-xs text-muted-foreground">{product.material}</div>
      <BarcodeDisplay code={product.barcode} />
      <div className="mt-1 font-mono text-xs text-muted-foreground">{product.barcode}</div>
      <div className="mt-2 text-xs text-muted-foreground">SKU: {product.sku}</div>
      <div className="mt-1 text-lg font-bold text-foreground">
        {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(product.price)}
      </div>
    </div>
  )
}

export default function LabelsPage() {
  const { products } = useInventory()
  const [search, setSearch] = useState("")
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [previewProduct, setPreviewProduct] = useState<typeof products[0] | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      return product.name.toLowerCase().includes(search.toLowerCase()) ||
        product.sku.toLowerCase().includes(search.toLowerCase()) ||
        product.barcode.includes(search)
    })
  }, [products, search])

  const toggleProduct = (productId: string) => {
    const newSelected = new Set(selectedProducts)
    if (newSelected.has(productId)) {
      newSelected.delete(productId)
    } else {
      newSelected.add(productId)
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

  const handlePrint = () => {
    const selectedProductsList = products.filter(p => selectedProducts.has(p.id))
    if (selectedProductsList.length === 0) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const labelsHtml = selectedProductsList.map(product => `
      <div style="width: 200px; border: 1px solid #ccc; padding: 12px; text-align: center; page-break-inside: avoid; margin: 8px;">
        <div style="font-size: 10px; font-weight: 600; color: #666; margin-bottom: 4px;">SANTARELLI</div>
        <div style="font-size: 12px; font-weight: bold; margin-bottom: 8px;">${product.name}</div>
        <div style="font-size: 10px; color: #666; margin-bottom: 8px;">${product.material}</div>
        <div style="font-family: 'Libre Barcode 128', monospace; font-size: 48px; letter-spacing: -2px;">*${product.barcode}*</div>
        <div style="font-family: monospace; font-size: 10px; color: #666;">${product.barcode}</div>
        <div style="font-size: 10px; color: #666; margin-top: 8px;">SKU: ${product.sku}</div>
        <div style="font-size: 16px; font-weight: bold; margin-top: 4px;">$${product.price.toLocaleString('es-AR')}</div>
      </div>
    `).join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Etiquetas - Santarelli</title>
          <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+128&display=swap" rel="stylesheet">
          <style>
            body { font-family: Arial, sans-serif; }
            .labels-container { display: flex; flex-wrap: wrap; }
          </style>
        </head>
        <body>
          <div class="labels-container">
            ${labelsHtml}
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  return (
    <div className="flex flex-col">
      <Header title="Etiquetas" />
      
      <main className="flex-1 p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, SKU o código de barras..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedProducts.size > 0 && (
              <Badge variant="secondary" className="mr-2">
                {selectedProducts.size} seleccionados
              </Badge>
            )}
            <Button
              onClick={handlePrint}
              disabled={selectedProducts.size === 0}
            >
              <Printer className="mr-2 h-4 w-4" />
              Imprimir Etiquetas
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Código de Barras</TableHead>
                <TableHead>Material</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
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
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <Tags className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.category}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {product.sku}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Barcode className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-sm">{product.barcode}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {product.material}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(product.price)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewProduct(product)}
                    >
                      Vista previa
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredProducts.length > 50 && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Mostrando 50 de {filteredProducts.length} productos. Use el buscador para filtrar.
          </p>
        )}
      </main>

      {/* Label Preview Dialog */}
      <Dialog open={!!previewProduct} onOpenChange={() => setPreviewProduct(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Vista Previa de Etiqueta</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center py-4">
            {previewProduct && <LabelPreview product={previewProduct} />}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPreviewProduct(null)}>
              Cerrar
            </Button>
            <Button onClick={() => {
              if (previewProduct) {
                setSelectedProducts(new Set([previewProduct.id]))
                handlePrint()
              }
            }}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
