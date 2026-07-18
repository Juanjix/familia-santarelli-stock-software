"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useInventory } from "@/lib/inventory-context"
import { Header } from "@/components/dashboard/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { Product, StockTransfer, StockTransferEvent, StockTransferItem } from "@/lib/types"
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Package,
  Plus,
  Trash2,
  ChevronRight,
  ArrowLeft,
  TruckIcon,
} from "lucide-react"
import { ProductSearchCombobox } from "@/components/products/product-search-combobox"
import {
  ProductScannerInput,
  type ProductScannerInputHandle,
} from "@/components/products/product-scanner-input"

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso))
}

function formatDateShort(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso))
}

function elapsedLabel(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

const STATUS_LABEL: Record<StockTransfer['status'], string> = {
  in_transit: "En tránsito",
  completed: "Completada",
  with_differences: "Con diferencias",
  cancelled: "Cancelada",
}

const STATUS_CLASS: Record<StockTransfer['status'], string> = {
  in_transit: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  with_differences: "bg-red-100 text-red-800 border-red-200",
  cancelled: "bg-gray-100 text-gray-600 border-gray-200",
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  transfer_dispatched: <TruckIcon className="h-3.5 w-3.5" />,
  transfer_completed: <CheckCircle2 className="h-3.5 w-3.5" />,
  transfer_differences: <AlertTriangle className="h-3.5 w-3.5" />,
  transfer_cancelled: <XCircle className="h-3.5 w-3.5" />,
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TransferTimeline({ events }: { events: StockTransferEvent[] }) {
  if (!events.length) {
    return <p className="text-sm text-muted-foreground py-4 text-center">Sin eventos registrados</p>
  }
  return (
    <ol className="relative space-y-0 pl-5 before:absolute before:left-2 before:top-0 before:bottom-0 before:w-px before:bg-border">
      {events.map((ev) => (
        <li key={ev.id} className="relative pb-4 last:pb-0">
          <span className="absolute -left-[13px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background border border-border text-muted-foreground">
            {EVENT_ICONS[ev.event_type] ?? <Clock className="h-3 w-3" />}
          </span>
          <div className="pl-3">
            <p className="text-sm font-medium leading-tight">{ev.title}</p>
            {ev.detail && <p className="text-xs text-muted-foreground mt-0.5">{ev.detail}</p>}
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDateShort(ev.created_at)} · {ev.created_by}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}

// ── New Transfer Form ─────────────────────────────────────────────────────────

interface TransferLine {
  productId: string
  quantity: number
}

function NewTransferPanel({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const { products, warehouses, getStockByWarehouse, createAndDispatchTransfer } = useInventory()
  const [fromWarehouse, setFromWarehouse] = useState("")
  const [toWarehouse, setToWarehouse] = useState("")
  const [lines, setLines] = useState<TransferLine[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scannerRef = useRef<ProductScannerInputHandle>(null)

  const activeWarehouses = warehouses.filter(w => w.is_active !== false)

  const productsInOrigin = useMemo(() => {
    if (!fromWarehouse) return []
    return products.filter(p => {
      const stock = getStockByWarehouse(p.id)
      return stock.some(s => s.warehouseId === fromWarehouse && s.quantity > 0)
    })
  }, [products, fromWarehouse, getStockByWarehouse])

  function getAvailableQty(productId: string) {
    if (!fromWarehouse || !productId) return 0
    return getStockByWarehouse(productId).find(s => s.warehouseId === fromWarehouse)?.quantity ?? 0
  }

  // Scanner adds a new line or increments quantity if the product is already in the list.
  function handleScanProduct(product: Product) {
    const existing = lines.findIndex(l => l.productId === product.id)
    if (existing >= 0) {
      const avail = getAvailableQty(product.id)
      setLines(prev => prev.map((l, i) =>
        i === existing ? { ...l, quantity: Math.min(l.quantity + 1, avail) } : l
      ))
    } else {
      setLines(prev => [...prev, { productId: product.id, quantity: 1 }])
    }
    // Return focus to scanner after updating state.
    setTimeout(() => scannerRef.current?.focus(), 0)
  }

  function addEmptyLine() {
    setLines(prev => [...prev, { productId: "", quantity: 1 }])
  }

  function removeLine(idx: number) {
    setLines(prev => prev.filter((_, i) => i !== idx))
  }

  function updateLine(idx: number, field: keyof TransferLine, value: string | number) {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l))
  }

  const isValid = fromWarehouse && toWarehouse && fromWarehouse !== toWarehouse &&
    lines.length > 0 && lines.every(l => l.productId && l.quantity > 0)

  async function handleSubmit() {
    if (!isValid) return
    setSaving(true)
    setError(null)
    try {
      const result = await createAndDispatchTransfer(
        fromWarehouse,
        toWarehouse,
        lines.map(l => ({ productId: l.productId, quantity: l.quantity }))
      )
      if (!result.success) { setError(result.error || "No se pudo crear la transferencia. Revisá tu conexión e intentá nuevamente."); return }
      onCreated()
    } catch {
      setError("No se pudo crear la transferencia. Revisá tu conexión e intentá nuevamente.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-base font-semibold">Nueva Transferencia</h2>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {/* Origen / Destino */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <Field>
            <FieldLabel>Origen</FieldLabel>
            <Select value={fromWarehouse} onValueChange={v => { setFromWarehouse(v); setLines([]) }}>
              <SelectTrigger>
                <SelectValue placeholder="Depósito…" />
              </SelectTrigger>
              <SelectContent>
                {activeWarehouses.map(w => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <ArrowRight className="h-4 w-4 text-muted-foreground mb-2.5" />
          <Field>
            <FieldLabel>Destino</FieldLabel>
            <Select value={toWarehouse} onValueChange={setToWarehouse}>
              <SelectTrigger>
                <SelectValue placeholder="Depósito…" />
              </SelectTrigger>
              <SelectContent>
                {activeWarehouses.filter(w => w.id !== fromWarehouse).map(w => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {/* Productos */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <FieldLabel>
              Productos
              {lines.length > 0 && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  ({lines.length} línea{lines.length !== 1 ? 's' : ''})
                </span>
              )}
            </FieldLabel>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={addEmptyLine}
              disabled={!fromWarehouse}
            >
              <Plus className="h-3 w-3" /> Agregar
            </Button>
          </div>

          {/* Scanner — only active when origin is set */}
          <ProductScannerInput
            ref={scannerRef}
            products={productsInOrigin}
            onResolve={handleScanProduct}
            onNotFound={() => {}}
            autoFocus={false}
            placeholder={fromWarehouse ? "Escanear código de barras o SKU…" : "Seleccioná un origen primero"}
            className={cn("mb-3", !fromWarehouse && "pointer-events-none opacity-50")}
          />

          {lines.length === 0 && fromWarehouse && (
            <p className="text-xs text-muted-foreground text-center py-3 border border-dashed border-border rounded-md">
              Escaneá un producto o usá "Agregar" para carga manual
            </p>
          )}

          <div className="space-y-2">
            {lines.map((line, idx) => {
              const available = getAvailableQty(line.productId)
              return (
                <div key={idx} className="flex items-start gap-2">
                  <div className="flex-1">
                    <ProductSearchCombobox
                      products={productsInOrigin}
                      selectedProductId={line.productId}
                      onSelect={v => {
                        // If the selected product already exists on another line, merge.
                        const existing = lines.findIndex((l, i) => i !== idx && l.productId === v)
                        if (existing >= 0) {
                          setLines(prev => {
                            const merged = prev.map((l, i) =>
                              i === existing ? { ...l, quantity: l.quantity + prev[idx].quantity } : l
                            )
                            return merged.filter((_, i) => i !== idx)
                          })
                        } else {
                          updateLine(idx, "productId", v)
                        }
                      }}
                      getStock={getAvailableQty}
                      disabled={!fromWarehouse}
                      disabledPlaceholder="Seleccioná un origen primero"
                      emptyMessage="Sin stock en este depósito."
                    />
                  </div>
                  <Input
                    type="number"
                    min={1}
                    max={available || undefined}
                    value={line.quantity}
                    onChange={e => updateLine(idx, "quantity", Math.max(1, parseInt(e.target.value) || 1))}
                    className="h-8 w-16 text-xs text-center"
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeLine(idx)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              )
            })}
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
            {error}
          </p>
        )}
      </div>

      <div className="pt-4 border-t border-border mt-4">
        <Button className="w-full" disabled={!isValid || saving} onClick={handleSubmit}>
          {saving ? "Despachando…" : `Despachar Transferencia${lines.length > 0 ? ` (${lines.reduce((s, l) => s + l.quantity, 0)} unidades)` : ""}`}
        </Button>
      </div>
    </div>
  )
}

// ── Assisted Receipt Dialog ───────────────────────────────────────────────────

function ConfirmReceiptDialog({
  transfer,
  onClose,
  onConfirmed,
}: {
  transfer: StockTransfer
  onClose: () => void
  onConfirmed: () => void
}) {
  const { confirmStockTransfer } = useInventory()
  const scannerRef = useRef<ProductScannerInputHandle>(null)

  // received[item.id] = units scanned so far
  const [received, setReceived] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    for (const item of transfer.items ?? []) {
      init[item.id] = 0
    }
    return init
  })
  const [incidentNotes, setIncidentNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)

  // product_id → item mapping for scanner lookup
  const productToItem = useMemo(() => {
    const map: Record<string, StockTransferItem> = {}
    for (const item of transfer.items ?? []) {
      if (item.product_id) map[item.product_id] = item
    }
    return map
  }, [transfer.items])

  // Only products that belong to this transfer — scanner rejects anything else
  const productsInTransfer = useMemo(
    () => (transfer.items ?? []).map(i => i.product).filter(Boolean) as Product[],
    [transfer.items]
  )

  const totalSent = (transfer.items ?? []).reduce((s, i) => s + i.quantity_sent, 0)
  const totalReceived = Object.values(received).reduce((s, v) => s + v, 0)
  const progressPct = totalSent > 0 ? Math.round((totalReceived / totalSent) * 100) : 0

  function handleScan(product: Product) {
    setScanError(null)
    const item = productToItem[product.id]
    if (!item) {
      // Should not happen since scanner is restricted to productsInTransfer,
      // but guard defensively.
      setScanError("Este producto no pertenece a esta transferencia")
      return
    }
    const current = received[item.id] ?? 0
    if (current >= item.quantity_sent) {
      setScanError(`Ya recibiste todas las unidades de "${product.name}"`)
      return
    }
    setReceived(prev => ({ ...prev, [item.id]: current + 1 }))
    setTimeout(() => scannerRef.current?.focus(), 0)
  }

  function adjustReceived(itemId: string, delta: number, max: number) {
    setScanError(null)
    setReceived(prev => ({
      ...prev,
      [itemId]: Math.max(0, Math.min(max, (prev[itemId] ?? 0) + delta)),
    }))
  }

  const hasDifferences = (transfer.items ?? []).some(item => (received[item.id] ?? 0) < item.quantity_sent)
  const isComplete = totalReceived === totalSent
  const isValid = totalReceived > 0 && (!hasDifferences || incidentNotes.trim())

  async function handleConfirm() {
    if (!isValid) return
    setSaving(true)
    setError(null)
    try {
      const result = await confirmStockTransfer(
        transfer.id,
        (transfer.items ?? []).map(item => ({ itemId: item.id, quantityReceived: received[item.id] ?? 0 })),
        hasDifferences ? incidentNotes : undefined
      )
      if (!result.success) { setError(result.error || "No se pudo confirmar la recepción. Revisá tu conexión e intentá nuevamente."); return }
      onConfirmed()
    } catch {
      setError("No se pudo confirmar la recepción. Revisá tu conexión e intentá nuevamente.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Recepción asistida — {transfer.number}</DialogTitle>
          <DialogDescription>
            Escaneá cada producto recibido. El sistema los marcará automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Scanner */}
          <ProductScannerInput
            ref={scannerRef}
            products={productsInTransfer}
            onResolve={handleScan}
            onNotFound={() => setScanError("Este producto no pertenece a esta transferencia")}
            placeholder="Escanear código de barras o SKU…"
          />

          {scanError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {scanError}
            </div>
          )}

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Progreso de recepción</span>
              <span className={cn("font-semibold tabular-nums", isComplete ? "text-green-700 dark:text-green-400" : "text-foreground")}>
                {totalReceived} / {totalSent} recibidos
              </span>
            </div>
            <Progress value={progressPct} className="h-2" />
          </div>

          {/* Items table */}
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-center w-14">Env.</TableHead>
                  <TableHead className="text-center w-28">Recibido</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(transfer.items ?? []).map(item => {
                  const rec = received[item.id] ?? 0
                  const complete = rec >= item.quantity_sent
                  const partial = rec > 0 && !complete
                  const pending = rec === 0
                  return (
                    <TableRow
                      key={item.id}
                      className={cn(
                        complete && "bg-green-50/60 dark:bg-green-950/20",
                        partial && "bg-amber-50/60 dark:bg-amber-950/20",
                      )}
                    >
                      <TableCell className="text-sm font-medium">
                        {item.product?.name ?? "—"}
                        <div className="text-xs text-muted-foreground font-normal font-mono">
                          {item.product?.sku}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {item.quantity_sent}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => adjustReceived(item.id, -1, item.quantity_sent)}
                            className="h-6 w-6 flex items-center justify-center rounded border border-border text-muted-foreground hover:bg-muted transition-colors text-sm leading-none"
                            aria-label="Reducir"
                          >
                            −
                          </button>
                          <span className={cn(
                            "text-sm font-semibold w-7 text-center tabular-nums",
                            complete && "text-green-700 dark:text-green-400",
                            pending && "text-muted-foreground",
                          )}>
                            {rec}
                          </span>
                          <button
                            type="button"
                            onClick={() => adjustReceived(item.id, +1, item.quantity_sent)}
                            className="h-6 w-6 flex items-center justify-center rounded border border-border text-muted-foreground hover:bg-muted transition-colors text-sm leading-none"
                            aria-label="Aumentar"
                          >
                            +
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {complete ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                        ) : partial ? (
                          <AlertTriangle className="h-4 w-4 text-amber-500 mx-auto" />
                        ) : (
                          <Clock className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Differences alert */}
          {hasDifferences && totalReceived > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive font-medium">Se detectaron diferencias en la recepción</p>
              </div>
              <Field>
                <FieldLabel>Motivo de la diferencia *</FieldLabel>
                <Textarea
                  placeholder="Ej: Faltó una cadena, el paquete llegó abierto…"
                  value={incidentNotes}
                  onChange={e => setIncidentNotes(e.target.value)}
                  rows={2}
                />
              </Field>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!isValid || saving}>
            {saving ? "Confirmando…" : hasDifferences ? "Confirmar con diferencias" : "Confirmar recepción"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Transfer Detail Panel ─────────────────────────────────────────────────────

function TransferDetailPanel({
  transfer,
  onClose,
  onRefresh,
}: {
  transfer: StockTransfer
  onClose: () => void
  onRefresh: () => void
}) {
  const { cancelStockTransfer, fetchStockTransferEvents } = useInventory()
  const [events, setEvents] = useState<StockTransferEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [showConfirm, setShowConfirm] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    setLoadingEvents(true)
    fetchStockTransferEvents(transfer.id).then(evs => {
      setEvents(evs)
      setLoadingEvents(false)
    })
  }, [transfer.id, fetchStockTransferEvents])

  async function handleCancel() {
    setCancelling(true)
    await cancelStockTransfer(transfer.id)
    setCancelling(false)
    onRefresh()
  }

  const totalSent = (transfer.items ?? []).reduce((s, i) => s + i.quantity_sent, 0)
  const totalReceived = (transfer.items ?? []).reduce((s, i) => s + (i.quantity_received ?? 0), 0)

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold">{transfer.number}</h2>
          <p className="text-xs text-muted-foreground truncate">
            {transfer.from_warehouse?.name} → {transfer.to_warehouse?.name}
          </p>
        </div>
        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", STATUS_CLASS[transfer.status])}>
          {STATUS_LABEL[transfer.status]}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {/* Meta */}
        <Card>
          <CardContent className="p-3 grid grid-cols-2 gap-y-1.5 text-sm">
            <span className="text-muted-foreground">Creado por</span>
            <span className="font-medium">{transfer.created_by}</span>
            <span className="text-muted-foreground">Despachado</span>
            <span>{formatDate(transfer.dispatched_at)}</span>
            {transfer.received_by && <>
              <span className="text-muted-foreground">Recibido por</span>
              <span className="font-medium">{transfer.received_by}</span>
              <span className="text-muted-foreground">Recibido</span>
              <span>{formatDate(transfer.received_at!)}</span>
            </>}
            {transfer.incident_notes && <>
              <span className="text-muted-foreground">Incidencia</span>
              <span className="text-destructive text-xs">{transfer.incident_notes}</span>
            </>}
          </CardContent>
        </Card>

        {/* Items */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Productos</p>
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-center w-16">Env.</TableHead>
                  {transfer.status !== 'in_transit' && <TableHead className="text-center w-16">Rec.</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(transfer.items ?? []).map(item => {
                  const diff = item.quantity_received !== null ? item.quantity_received - item.quantity_sent : null
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm">{item.product?.name ?? "—"}</TableCell>
                      <TableCell className="text-center text-sm">{item.quantity_sent}</TableCell>
                      {transfer.status !== 'in_transit' && (
                        <TableCell className={cn("text-center text-sm", diff !== null && diff < 0 && "text-destructive font-medium")}>
                          {item.quantity_received ?? "—"}
                          {diff !== null && diff < 0 && <span className="ml-1 text-xs">({diff})</span>}
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
                <TableRow className="bg-muted/30 font-medium">
                  <TableCell className="text-sm">Total</TableCell>
                  <TableCell className="text-center text-sm">{totalSent}</TableCell>
                  {transfer.status !== 'in_transit' && (
                    <TableCell className={cn("text-center text-sm", totalReceived < totalSent && "text-destructive")}>
                      {totalReceived}
                    </TableCell>
                  )}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Timeline */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Historial</p>
          {loadingEvents
            ? <Skeleton className="h-16 w-full" />
            : <TransferTimeline events={events} />
          }
        </div>
      </div>

      {/* Actions */}
      {transfer.status === 'in_transit' && (
        <div className="pt-4 border-t border-border mt-4 flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 text-destructive hover:text-destructive" onClick={handleCancel} disabled={cancelling}>
            {cancelling ? "Cancelando…" : "Cancelar"}
          </Button>
          <Button size="sm" className="flex-1" onClick={() => setShowConfirm(true)}>
            Confirmar recepción
          </Button>
        </div>
      )}

      {showConfirm && (
        <ConfirmReceiptDialog
          transfer={transfer}
          onClose={() => setShowConfirm(false)}
          onConfirmed={() => { setShowConfirm(false); onRefresh() }}
        />
      )}
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Panel = 'new' | { type: 'detail'; transfer: StockTransfer } | null

export default function TransfersPage() {
  const { warehouses } = useInventory()
  const [transfers, setTransfers] = useState<StockTransfer[]>([])
  const [loadingTransfers, setLoadingTransfers] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StockTransfer['status'] | "all">("all")
  const [panel, setPanel] = useState<Panel>(null)
  const { fetchStockTransfers } = useInventory()

  const load = useCallback(async () => {
    setLoadingTransfers(true)
    const data = await fetchStockTransfers()
    setTransfers(data)
    setLoadingTransfers(false)
  }, [fetchStockTransfers])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (statusFilter === "all") return transfers
    return transfers.filter(t => t.status === statusFilter)
  }, [transfers, statusFilter])

  const countInTransit = transfers.filter(t => t.status === 'in_transit').length
  const countCompleted = transfers.filter(t => {
    if (t.status !== 'completed') return false
    const today = new Date().toDateString()
    return new Date(t.received_at ?? t.updated_at).toDateString() === today
  }).length
  const countDiff = transfers.filter(t => t.status === 'with_differences').length

  function handleRefresh() {
    setPanel(null)
    load()
  }

  function openDetail(t: StockTransfer) {
    setPanel({ type: 'detail', transfer: t })
  }

  const showPanel = panel !== null

  return (
    <>
      <Header
        title="Transferencias"
        description={`${transfers.length} transferencia${transfers.length !== 1 ? 's' : ''}`}
        action={!showPanel ? { label: "Nueva Transferencia", onClick: () => setPanel('new') } : undefined}
      />

      <div className={cn("flex flex-1 overflow-hidden")}>
        {/* Main list */}
        <div className={cn("flex flex-col flex-1 overflow-hidden transition-all", showPanel && "hidden md:flex md:w-[55%] md:border-r md:border-border")}>
          <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">

            {/* Dashboard cards */}
            <div className="grid grid-cols-3 gap-3">
              <Card
                className={cn("cursor-pointer transition-colors hover:bg-muted/30", statusFilter === 'in_transit' && "ring-2 ring-primary")}
                onClick={() => setStatusFilter(prev => prev === 'in_transit' ? 'all' : 'in_transit')}
              >
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700">{countInTransit}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">En tránsito</p>
                </CardContent>
              </Card>
              <Card
                className={cn("cursor-pointer transition-colors hover:bg-muted/30", statusFilter === 'completed' && "ring-2 ring-primary")}
                onClick={() => setStatusFilter(prev => prev === 'completed' ? 'all' : 'completed')}
              >
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{countCompleted}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Completadas hoy</p>
                </CardContent>
              </Card>
              <Card
                className={cn("cursor-pointer transition-colors hover:bg-muted/30", statusFilter === 'with_differences' && "ring-2 ring-primary")}
                onClick={() => setStatusFilter(prev => prev === 'with_differences' ? 'all' : 'with_differences')}
              >
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-red-700">{countDiff}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Con diferencias</p>
                </CardContent>
              </Card>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1.5 flex-wrap">
              {(["all", "in_transit", "completed", "with_differences", "cancelled"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                    statusFilter === s
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:bg-muted/50"
                  )}
                >
                  {s === "all" ? "Todas" : STATUS_LABEL[s]}
                </button>
              ))}
            </div>

            {/* Mobile new button */}
            {!showPanel && (
              <Button className="w-full md:hidden" onClick={() => setPanel('new')}>
                Nueva Transferencia
              </Button>
            )}

            {/* List */}
            {loadingTransfers ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No hay transferencias</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(t => {
                  const isSelected = typeof panel === 'object' && panel?.type === 'detail' && panel.transfer.id === t.id
                  const totalItems = (t.items ?? []).reduce((s, i) => s + i.quantity_sent, 0)
                  const productCount = (t.items ?? []).length
                  return (
                    <button
                      key={t.id}
                      onClick={() => openDetail(t)}
                      className={cn(
                        "w-full text-left rounded-lg border border-border p-3 transition-colors hover:bg-muted/30",
                        isSelected && "bg-muted/40 ring-2 ring-primary"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-medium">{t.number}</span>
                            <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded-full border", STATUS_CLASS[t.status])}>
                              {STATUS_LABEL[t.status]}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                            <span>{t.from_warehouse?.name}</span>
                            <ArrowRight className="h-3 w-3 shrink-0" />
                            <span>{t.to_warehouse?.name}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>{productCount} producto{productCount !== 1 ? 's' : ''} · {totalItems} unidad{totalItems !== 1 ? 'es' : ''}</span>
                            <span>·</span>
                            <span>{t.created_by}</span>
                            <span>·</span>
                            <span>{elapsedLabel(t.dispatched_at)}</span>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Side panel */}
        {showPanel && (
          <div className="flex flex-col w-full md:w-[45%] p-4 md:p-6 overflow-hidden">
            {panel === 'new' ? (
              <NewTransferPanel
                onClose={() => setPanel(null)}
                onCreated={() => { setPanel(null); load() }}
              />
            ) : typeof panel === 'object' && panel.type === 'detail' ? (
              <TransferDetailPanel
                transfer={panel.transfer}
                onClose={() => setPanel(null)}
                onRefresh={handleRefresh}
              />
            ) : null}
          </div>
        )}
      </div>
    </>
  )
}
