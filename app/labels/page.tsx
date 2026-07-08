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

// ─── Dimensiones físicas ───────────────────────────────────────────────────────
const LABEL_W_MM = 80
const LABEL_H_MM = 10

// ─── TSPL — coordenadas en dots (203 DPI ≈ 8 dots/mm) ────────────────────────
// Todos los valores son ajustables. No tocar el layout HTML para cambiar
// la posición de impresión: solo modificar estas constantes.
const TSPL = {
  labelW:    80,   // mm — ancho físico de la etiqueta
  labelH:    10,   // mm — alto físico de la etiqueta
  gap:        3,   // mm — gap entre etiquetas en el rollo
  priceX:    10,   // dots — x del precio (~1.25mm desde borde izquierdo)
  priceY:     8,   // dots — y del precio (~1mm desde borde superior)
  groupY:    36,   // dots — y del grupo (~4.5mm desde borde superior)
  font:      "2",  // fuente TSC interna: "2" = 12×20 dots = 1.5×2.5mm
  barcodeX: 200,   // dots — x del barcode (~25mm desde borde izquierdo)
  barcodeY:   3,   // dots — y del barcode (~0.4mm desde borde superior)
  barcodeH:  45,   // dots — altura de las barras (~5.6mm)
  barcodeN:   2,   // dots — módulo mínimo (narrow bar width)
} as const

// ─── BARCODE_OPTIONS — solo para el preview en pantalla ───────────────────────
// La impresión real usa TSPL nativo. Estas opciones NO afectan lo que imprime.
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

// ─── Tipo global para QZ Tray ─────────────────────────────────────────────────
declare global {
  interface Window {
    qz?: {
      websocket: {
        connect: (options?: object) => Promise<void>
        disconnect: () => Promise<void>
        isActive: () => boolean
      }
      printers: {
        find: (query?: string) => Promise<string | string[]>
      }
      configs: {
        create: (printer: string, options?: object) => object
      }
      print: (config: object, data: object[]) => Promise<void>
      security: {
        setCertificatePromise: (fn: (resolve: (v: string) => void) => void) => void
        setSignaturePromise: (fn: (toSign: string) => (resolve: (v: string) => void) => void) => void
      }
    }
  }
}

// ─── Generador de TSPL ────────────────────────────────────────────────────────
// Produce el string de comandos nativos para un lote de etiquetas.
function buildTSPL(items: Array<{ product: Product; quantity: number }>): string {
  const cmds: string[] = [
    `SIZE ${TSPL.labelW} mm, ${TSPL.labelH} mm`,
    `GAP ${TSPL.gap} mm, 0 mm`,
    `DIRECTION 0`,
    `REFERENCE 0, 0`,
    `OFFSET 0 mm`,
    `SET TEAR ON`,
  ]

  for (const { product, quantity } of items) {
    const code  = product.barcode ?? ""
    const price = product.sell_price != null ? String(product.sell_price) : ""
    const group = product.supplier?.price_group ?? ""

    cmds.push("CLS")
    if (price) cmds.push(`TEXT ${TSPL.priceX}, ${TSPL.priceY}, "${TSPL.font}", 0, 1, 1, "${price}"`)
    if (group) cmds.push(`TEXT ${TSPL.priceX}, ${TSPL.groupY}, "${TSPL.font}", 0, 1, 1, "${group}"`)
    if (code)  cmds.push(`BARCODE ${TSPL.barcodeX}, ${TSPL.barcodeY}, "128", ${TSPL.barcodeH}, 1, 0, ${TSPL.barcodeN}, ${TSPL.barcodeN}, "${code}"`)
    cmds.push(`PRINT ${quantity}, 1`)
  }

  return cmds.join("\r\n") + "\r\n"
}

// ─── Helpers existentes (preview) ────────────────────────────────────────────
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

function LabelPreview({ product, scale = 6 }: { product: Product; scale?: number }) {
  const code  = product.barcode ?? ""
  const w     = LABEL_W_MM * scale
  const h     = LABEL_H_MM * scale
  const leftW = 30 * scale
  const price = product.sell_price != null ? product.sell_price : ""
  const group = product.supplier?.price_group ?? ""

  return (
    <div style={{
      width: `${w}px`, height: `${h}px`, display: "flex", alignItems: "stretch",
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
  )
}

// ─── Estado de QZ Tray ────────────────────────────────────────────────────────
type QZStatus = "loading" | "ready" | "connected" | "error"

export default function LabelsPage() {
  const { products, categories, categoryAttributes } = useInventory()
  const [search, setSearch]                     = useState("")
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [quantities, setQuantities]             = useState<Map<string, number>>(new Map())
  const [previewProduct, setPreviewProduct]     = useState<Product | null>(null)
  const [qzStatus, setQzStatus]                 = useState<QZStatus>("loading")
  const [qzError, setQzError]                   = useState<string | null>(null)
  const [printing, setPrinting]                 = useState(false)

  // Carga qz-tray.js una sola vez al montar el componente
  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.qz) { setQzStatus("ready"); return }
    if (document.querySelector('script[data-qz]')) return

    const script = document.createElement("script")
    script.setAttribute("data-qz", "1")
    script.src = "/qz-tray.js"
    script.onload = () => setQzStatus("ready")
    script.onerror = () => {
      setQzStatus("error")
      setQzError("No se pudo cargar el cliente QZ Tray (/qz-tray.js)")
    }
    document.head.appendChild(script)
  }, [])

  // Establece (o reutiliza) la conexión WebSocket con QZ Tray
  const connectQZ = async (): Promise<boolean> => {
    if (!window.qz) {
      setQzStatus("error")
      setQzError("QZ Tray no está disponible. Instalalo desde qz.io y ejecutalo.")
      return false
    }
    if (window.qz.websocket.isActive()) return true
    try {
      // Conexión sin firma (válida para HTTP / localhost)
      window.qz.security.setCertificatePromise((resolve) => resolve(""))
      window.qz.security.setSignaturePromise(() => (resolve) => resolve(""))
      await window.qz.websocket.connect()
      setQzStatus("connected")
      setQzError(null)
      return true
    } catch {
      setQzStatus("error")
      setQzError("No se pudo conectar con QZ Tray. ¿Está ejecutándose en esta PC?")
      return false
    }
  }

  // ─── Impresión via TSPL nativo ─────────────────────────────────────────────
  const handlePrint = async (productsOverride?: Product[]) => {
    const items = productsOverride
      ? productsOverride.map(p => ({ product: p, quantity: 1 }))
      : products
          .filter(p => selectedProducts.has(p.id) && p.barcode)
          .map(p => ({ product: p, quantity: quantities.get(p.id) || 1 }))

    if (items.length === 0) return

    setPrinting(true)
    try {
      const ok = await connectQZ()
      if (!ok) return

      // Busca la TSC por nombre parcial — coincide con "TTP-244", "TSC TTP-244 Pro", etc.
      const found = await window.qz!.printers.find("TTP-244")
      const printerName = Array.isArray(found) ? found[0] : found
      if (!printerName) throw new Error("No se encontró la impresora TSC TTP-244 Pro en Windows")

      const config = window.qz!.configs.create(printerName)
      const tspl   = buildTSPL(items)

      await window.qz!.print(config, [{ type: "raw", format: "plain", data: tspl }])
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setQzStatus("error")
      setQzError(`Error al imprimir: ${msg}`)
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
    if (qzStatus === "loading") return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Cargando QZ Tray…
      </span>
    )
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
            {previewProduct && <LabelPreview product={previewProduct} scale={6} />}
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
