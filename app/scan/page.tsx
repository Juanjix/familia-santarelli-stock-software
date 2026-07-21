"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useInventory } from "@/lib/inventory-context"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ProductScannerInput, type ProductScannerInputHandle } from "@/components/products/product-scanner-input"
import {
  ScanLine,
  Package,
  Plus,
  Minus,
  ArrowLeftRight,
  CheckCircle2,
  Tag,
  Hash,
  Layers,
  Warehouse,
} from "lucide-react"
import type { Product, StockByWarehouse } from "@/lib/types"

// ── Types ─────────────────────────────────────────────────────────────────────

type ActionType = "in" | "out" | "transfer"

interface ActionState {
  open: boolean
  type: ActionType | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtARS = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n)

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ScanPage() {
  const { products, warehouses, getStockByWarehouse, adjustStock, transferStock, loading } =
    useInventory()

  const scannerRef = useRef<ProductScannerInputHandle>(null)
  // Ref-based lock: prevents concurrent handleAction calls even if state batching
  // delays the re-render that would disable the button. Same pattern as confirmingRef in POS.
  const processingRef = useRef(false)

  const [foundProduct, setFoundProduct] = useState<Product | null>(null)
  const [stockByWarehouse, setStockByWarehouse] = useState<StockByWarehouse[]>([])
  const [success, setSuccess] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const [actionDialog, setActionDialog] = useState<ActionState>({ open: false, type: null })
  const [quantity, setQuantity] = useState("1")
  const [selectedWarehouse, setSelectedWarehouse] = useState("")
  const [fromWarehouse, setFromWarehouse] = useState("")
  const [toWarehouse, setToWarehouse] = useState("")
  const [notes, setNotes] = useState("")

  const activeWarehouses = warehouses.filter(w => w.is_active !== false)

  // Auto-clear success banner after 3 s (consistent with the rest of the system).
  useEffect(() => {
    if (!success) return
    const t = setTimeout(() => setSuccess(null), 3000)
    return () => clearTimeout(t)
  }, [success])

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleResolve = useCallback(
    async (product: Product) => {
      setFoundProduct(product)
      setSuccess(null)
      const stock = await getStockByWarehouse(product.id)
      setStockByWarehouse(stock)
    },
    [getStockByWarehouse],
  )

  const resetDialog = () => {
    setQuantity("1")
    setSelectedWarehouse("")
    setFromWarehouse("")
    setToWarehouse("")
    setNotes("")
    setActionError(null)
  }

  const closeDialog = () => {
    setActionDialog({ open: false, type: null })
    resetDialog()
    // Restore focus to the scanner input so the next scan doesn't need a manual click.
    setTimeout(() => scannerRef.current?.focus(), 0)
  }

  const handleAction = async () => {
    if (!foundProduct) return
    // Ref-based guard: prevents double execution between click and re-render.
    if (processingRef.current) return
    processingRef.current = true
    setProcessing(true)
    setActionError(null)
    try {
      const qty = parseInt(quantity, 10)

      if (actionDialog.type === "transfer") {
        const ok = await transferStock(
          foundProduct.id,
          fromWarehouse,
          toWarehouse,
          qty,
          notes || undefined,
        )
        if (!ok) throw new Error("No se pudo registrar la transferencia. Revisá el stock disponible e intentá nuevamente.")
        setSuccess(`Transferencia de ${qty} ud. registrada`)
      } else if (actionDialog.type === "in" || actionDialog.type === "out") {
        await adjustStock(
          foundProduct.id,
          selectedWarehouse,
          qty,
          actionDialog.type,
          notes || undefined,
        )
        setSuccess(
          actionDialog.type === "in"
            ? `Entrada de ${qty} ud. registrada`
            : `Salida de ${qty} ud. registrada`,
        )
      }

      // Solo se llega aquí si no se lanzó ninguna excepción.
      closeDialog()
      const updated = await getStockByWarehouse(foundProduct.id)
      setStockByWarehouse(updated)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Ocurrió un error inesperado.")
    } finally {
      processingRef.current = false
      setProcessing(false)
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Escáner" />
        <main className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </main>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      <Header title="Escáner" />

      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-4 md:space-y-6">

        {/* Scanner input — always visible and focused */}
        <ProductScannerInput
          ref={scannerRef}
          products={products}
          onResolve={handleResolve}
          onNotFound={() => { /* mantener el producto activo — el banner de "sin resultado" lo muestra ProductScannerInput */ }}
          placeholder="Escanear código de barras o ingresar SKU..."
        />

        {/* Success feedback */}
        {success && (
          <div className="flex items-center gap-2 rounded-lg border border-green-500/40 bg-green-500/8 px-4 py-3 text-sm text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {success}
          </div>
        )}

        {/* Empty state */}
        {!foundProduct && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
            <ScanLine className="h-14 w-14 text-muted-foreground/30" />
            <p className="mt-4 text-base font-medium text-muted-foreground">Esperando escaneo</p>
            <p className="mt-1 text-sm text-muted-foreground/70">
              Escaneá un código de barras o ingresá un SKU para ver el producto
            </p>
          </div>
        )}

        {/* Product detail */}
        {foundProduct && (
          <div className="grid gap-4 lg:grid-cols-2">

            {/* ── Info card ── */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base leading-tight">{foundProduct.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {foundProduct.category}
                        {foundProduct.material && ` · ${foundProduct.material}`}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={foundProduct.is_active !== false ? "default" : "secondary"}>
                    {foundProduct.is_active !== false ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Identifiers */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Hash className="h-3 w-3" /> SKU
                    </div>
                    <p className="font-mono text-sm font-medium">{foundProduct.sku}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Tag className="h-3 w-3" /> Código de barras
                    </div>
                    <p className="font-mono text-sm font-medium">{foundProduct.barcode || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      Precio de venta
                    </div>
                    <p className="text-sm font-semibold">
                      {fmtARS(foundProduct.sell_price || foundProduct.price || 0)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      Stock total
                    </div>
                    <p className="text-sm font-semibold">{foundProduct.total_stock ?? 0} ud.</p>
                  </div>
                </div>

                {/* Stock by warehouse */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Warehouse className="h-3 w-3" /> Stock por depósito
                  </div>
                  {stockByWarehouse.length > 0 ? (
                    <div className="space-y-1.5">
                      {stockByWarehouse.map(s => (
                        <div
                          key={s.warehouseId}
                          className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm"
                        >
                          <span className="text-muted-foreground">{s.warehouseName}</span>
                          <span className={s.quantity === 0 ? "text-destructive font-medium" : "font-medium"}>
                            {s.quantity} ud.
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Sin stock registrado</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ── Quick actions card ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Acciones rápidas</CardTitle>
                <CardDescription className="text-xs">
                  Operaciones de inventario sobre este producto
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2.5">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-14 justify-start gap-3"
                  onClick={() => setActionDialog({ open: true, type: "in" })}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-green-500/10">
                    <Plus className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold">Entrada de stock</p>
                    <p className="text-xs text-muted-foreground">Registrar ingreso</p>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  className="h-14 justify-start gap-3"
                  onClick={() => setActionDialog({ open: true, type: "out" })}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-red-500/10">
                    <Minus className="h-4 w-4 text-red-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold">Salida de stock</p>
                    <p className="text-xs text-muted-foreground">Registrar egreso o ajuste</p>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  className="h-14 justify-start gap-3"
                  onClick={() => setActionDialog({ open: true, type: "transfer" })}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-500/10">
                    <ArrowLeftRight className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold">Transferir</p>
                    <p className="text-xs text-muted-foreground">Mover entre depósitos</p>
                  </div>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* ── Action dialog ── */}
      <Dialog open={actionDialog.open} onOpenChange={open => { if (!open) closeDialog() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.type === "in"
                ? "Entrada de stock"
                : actionDialog.type === "out"
                ? "Salida de stock"
                : "Transferir stock"}
            </DialogTitle>
            <DialogDescription>{foundProduct?.name}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {actionDialog.type === "transfer" ? (
              <>
                <div className="grid gap-2">
                  <Label>Desde depósito</Label>
                  <Select value={fromWarehouse} onValueChange={setFromWarehouse}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar origen" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeWarehouses.map(w => {
                        const s = stockByWarehouse.find(x => x.warehouseId === w.id)
                        return (
                          <SelectItem key={w.id} value={w.id}>
                            {w.name}{s ? ` — ${s.quantity} ud.` : " — sin stock"}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  {fromWarehouse && (() => {
                    const s = stockByWarehouse.find(x => x.warehouseId === fromWarehouse)
                    return s && s.quantity > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Disponible: <span className="font-medium text-foreground">{s.quantity} unidades</span>
                      </p>
                    ) : null
                  })()}
                </div>
                <div className="grid gap-2">
                  <Label>Hacia depósito</Label>
                  <Select value={toWarehouse} onValueChange={setToWarehouse}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeWarehouses.filter(w => w.id !== fromWarehouse).map(w => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <div className="grid gap-2">
                <Label>Depósito</Label>
                <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar depósito" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeWarehouses.map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-2">
              <Label>Cantidad</Label>
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Agregar notas..."
                rows={2}
              />
            </div>
          </div>

          {actionError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {actionError}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button
              onClick={handleAction}
              disabled={
                processing ||
                parseInt(quantity, 10) < 1 ||
                isNaN(parseInt(quantity, 10)) ||
                (actionDialog.type === "transfer"
                  ? !fromWarehouse || !toWarehouse || fromWarehouse === toWarehouse
                  : !selectedWarehouse)
              }
            >
              {processing ? "Procesando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
