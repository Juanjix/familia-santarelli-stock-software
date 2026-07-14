"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Banknote,
  Smartphone,
  CircleEllipsis,
  Check,
  Loader2,
  ChevronRight,
  UserPlus,
  X,
  History,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ProductSearchCombobox } from "@/components/products/product-search-combobox"
import { usePOS } from "@/lib/pos-context"
import { useInventory } from "@/lib/inventory-context"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
import type { Employee, Warehouse, PaymentMethod, POSCustomer, ConfirmSaleResult } from "@/lib/types"

// ── Helpers ───────────────────────────────────────────────────────────────────

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ElementType }[] = [
  { value: "cash",     label: "Efectivo",      icon: Banknote },
  { value: "transfer", label: "Transferencia", icon: Smartphone },
  { value: "card",     label: "Tarjeta",       icon: CreditCard },
  { value: "other",    label: "Otro",          icon: CircleEllipsis },
]

function fmtARS(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n)
}

// ── Success screen ─────────────────────────────────────────────────────────────

function SuccessScreen({
  result,
  onNewSale,
}: {
  result: ConfirmSaleResult & { ok: true; sale_number: number; ticket_number: string }
  onNewSale: () => void
}) {
  const router = useRouter()
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
        <Check className="h-10 w-10 text-green-600 dark:text-green-400" />
      </div>
      <div>
        <p className="text-2xl font-semibold">Venta confirmada</p>
        <p className="text-muted-foreground mt-1">
          Venta <span className="font-mono font-medium">V-{String(result.sale_number).padStart(4, "0")}</span>
        </p>
      </div>

      <div className="w-full max-w-sm border-2 border-dashed rounded-xl p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
          Ticket de Canje
        </p>
        <p className="text-3xl font-mono font-semibold text-primary">{result.ticket_number}</p>
        <p className="text-xs text-muted-foreground mt-2">Válido por 30 días</p>
      </div>

      <div className="flex gap-3 w-full max-w-sm">
        <Button variant="outline" className="flex-1" onClick={() => router.push("/pos/sales")}>
          <History className="h-4 w-4 mr-2" />
          Historial
        </Button>
        <Button className="flex-1" onClick={onNewSale}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva venta
        </Button>
      </div>
    </div>
  )
}

// ── Customer selector dialog ───────────────────────────────────────────────────

function CustomerDialog({
  open,
  onClose,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  onSelect: (customer: POSCustomer) => void
}) {
  const { searchCustomers, findOrCreateCustomer } = usePOS()
  const [mode, setMode] = useState<"search" | "create">("search")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<POSCustomer[]>([])
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      const r = await searchCustomers(query)
      setResults(r)
    }, 250)
    return () => clearTimeout(t)
  }, [query, searchCustomers])

  async function handleCreate() {
    if (!firstName.trim() || !lastName.trim()) return
    setLoading(true)
    const c = await findOrCreateCustomer(firstName, lastName, phone)
    setLoading(false)
    if (c) { onSelect(c); onClose() }
  }

  function reset() {
    setMode("search"); setQuery(""); setResults([])
    setFirstName(""); setLastName(""); setPhone("")
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cliente</DialogTitle>
          <DialogDescription>Buscá un cliente existente o creá uno nuevo.</DialogDescription>
        </DialogHeader>

        {mode === "search" ? (
          <div className="space-y-3">
            <Input
              placeholder="Nombre, apellido o teléfono..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
            {results.length > 0 && (
              <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                {results.map(c => (
                  <button
                    key={c.id}
                    className="w-full text-left px-3 py-2.5 hover:bg-muted text-sm transition-colors"
                    onClick={() => { onSelect(c); onClose(); reset() }}
                  >
                    <p className="font-medium">{c.first_name} {c.last_name}</p>
                    {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                  </button>
                ))}
              </div>
            )}
            {query.trim() && results.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">Sin resultados.</p>
            )}
            <Button variant="outline" className="w-full" onClick={() => setMode("create")}>
              <UserPlus className="h-4 w-4 mr-2" />
              Crear cliente nuevo
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Nombre *</Label>
                <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Juan" />
              </div>
              <div>
                <Label className="text-xs">Apellido *</Label>
                <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="García" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Teléfono</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="11 1234-5678" />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => setMode("search")}>Volver</Button>
              <Button onClick={handleCreate} disabled={!firstName.trim() || !lastName.trim() || loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Main POS page ──────────────────────────────────────────────────────────────

export default function POSPage() {
  const {
    items, payments, discountAmount, customerId,
    subtotal, total, paymentTotal, change,
    isCartEmpty, isPaymentComplete,
    addOrIncrementProduct, removeItem, updateItemQty, updateItemDiscount,
    setDiscountAmount, setCustomerId, setPayment, removePayment,
    confirmSale, clearCart,
    fetchEmployees, fetchWarehouses, searchCustomers,
  } = usePOS()

  const { products } = useInventory()
  const { user } = useAuth()

  const [employees, setEmployees] = useState<Employee[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [sellerId, setSellerId] = useState("")
  const [warehouseId, setWarehouseId] = useState("")
  const [customerObj, setCustomerObj] = useState<POSCustomer | null>(null)
  const [showCustomerDialog, setShowCustomerDialog] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [successResult, setSuccessResult] = useState<(ConfirmSaleResult & { ok: true; sale_number: number; ticket_number: string }) | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchEmployees(), fetchWarehouses()]).then(([emps, whs]) => {
      setEmployees(emps)
      setWarehouses(whs)
      // Pre-seleccionar el primer empleado/depósito como default
      if (emps.length > 0) setSellerId(emps[0].id)
      if (whs.length > 0) setWarehouseId(whs[0].id)
    })
  }, [fetchEmployees, fetchWarehouses])

  // Productos activos con stock (el combobox muestra el stock via getStock)
  const activeProducts = products.filter(p => p.is_active)

  function getStock(productId: string) {
    const p = products.find(p => p.id === productId)
    return p?.total_stock ?? 0
  }

  async function handleConfirm() {
    if (!sellerId || !warehouseId || isCartEmpty || !isPaymentComplete) return
    setConfirming(true)
    setConfirmError(null)
    const result = await confirmSale(sellerId, warehouseId)
    setConfirming(false)
    if (result.ok) {
      setSuccessResult(result as typeof successResult)
    } else {
      setConfirmError(result.error_detail ?? "Error al confirmar la venta.")
    }
  }

  function handleNewSale() {
    clearCart()
    setSuccessResult(null)
    setConfirmError(null)
    setCustomerObj(null)
    setCustomerId(null)
  }

  if (successResult) {
    return <SuccessScreen result={successResult} onNewSale={handleNewSale} />
  }

  const paymentMap = Object.fromEntries(payments.map(p => [p.method, p]))

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Panel izquierdo: búsqueda + carrito ─────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 border-r overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-muted-foreground" />
            <span className="font-semibold text-sm">Punto de Venta</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => window.location.assign("/pos/sales")} className="text-xs text-muted-foreground">
            <History className="h-3.5 w-3.5 mr-1.5" />
            Historial
          </Button>
        </div>

        {/* Vendedor / Depósito */}
        <div className="grid grid-cols-2 gap-3 px-4 py-3 border-b shrink-0 bg-muted/30">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Vendedor</Label>
            <Select value={sellerId} onValueChange={setSellerId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Seleccioná..." />
              </SelectTrigger>
              <SelectContent>
                {employees.map(e => (
                  <SelectItem key={e.id} value={e.id} className="text-xs">{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Depósito</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Seleccioná..." />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map(w => (
                  <SelectItem key={w.id} value={w.id} className="text-xs">{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Buscador de producto */}
        <div className="px-4 py-3 border-b shrink-0">
          <ProductSearchCombobox
            products={activeProducts}
            selectedProductId=""
            onSelect={productId => {
              const p = products.find(p => p.id === productId)
              if (p) addOrIncrementProduct(p)
            }}
            getStock={getStock}
            placeholder="Buscar o escanear producto..."
            emptyMessage="No hay productos activos."
            className="h-9 text-sm"
          />
        </div>

        {/* Carrito */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {isCartEmpty ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-2 text-muted-foreground">
              <ShoppingCart className="h-10 w-10 opacity-20" />
              <p className="text-sm">El carrito está vacío.</p>
              <p className="text-xs opacity-70">Buscá o escaneá un producto para agregarlo.</p>
            </div>
          ) : (
            <div className="space-y-2 py-2">
              {items.map(item => (
                <div
                  key={item.product_id}
                  className="flex gap-3 rounded-lg border bg-card p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight truncate">{item.product.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{item.product.sku}</p>
                    <div className="flex items-center gap-3 mt-2">
                      {/* Qty */}
                      <div className="flex items-center gap-1">
                        <button
                          className="h-6 w-6 rounded border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                          onClick={() => item.quantity > 1 ? updateItemQty(item.product_id, item.quantity - 1) : removeItem(item.product_id)}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-7 text-center text-sm font-medium">{item.quantity}</span>
                        <button
                          className="h-6 w-6 rounded border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                          onClick={() => updateItemQty(item.product_id, item.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      {/* Descuento */}
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Desc.</span>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={item.discount_pct || ""}
                          onChange={e => updateItemDiscount(item.product_id, Number(e.target.value))}
                          placeholder="0"
                          className="h-6 w-14 text-xs px-2"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end justify-between shrink-0">
                    <button
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      onClick={() => removeItem(item.product_id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {fmtARS(item.quantity * item.unit_price * (1 - item.discount_pct / 100))}
                      </p>
                      {item.discount_pct > 0 && (
                        <p className="text-xs text-muted-foreground line-through">
                          {fmtARS(item.quantity * item.unit_price)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Panel derecho: resumen + pagos ───────────────────────────────── */}
      <div className="w-80 shrink-0 flex flex-col overflow-hidden bg-muted/20">

        {/* Resumen */}
        <div className="px-4 py-4 border-b space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Resumen</p>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{fmtARS(subtotal)}</span>
          </div>

          {/* Descuento global */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Descuento global</span>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">$</span>
              <Input
                type="number"
                min={0}
                max={subtotal}
                value={discountAmount || ""}
                onChange={e => setDiscountAmount(Number(e.target.value))}
                placeholder="0"
                className="h-6 w-24 text-xs px-2 text-right"
              />
            </div>
          </div>

          <div className="border-t pt-2 flex justify-between font-semibold">
            <span>Total</span>
            <span className="text-lg">{fmtARS(total)}</span>
          </div>
        </div>

        {/* Pagos */}
        <div className="px-4 py-4 border-b space-y-2 overflow-y-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Método de pago</p>
          {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => {
            const p = paymentMap[value]
            return (
              <div key={value} className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs w-24 text-muted-foreground">{label}</span>
                <Input
                  type="number"
                  min={0}
                  value={p?.amount || ""}
                  onChange={e => {
                    const v = Number(e.target.value)
                    if (v > 0) setPayment(value, v)
                    else removePayment(value)
                  }}
                  placeholder="—"
                  className="h-7 text-xs flex-1"
                />
              </div>
            )
          })}

          {paymentTotal > 0 && (
            <div className="mt-2 pt-2 border-t space-y-1 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Total ingresado</span>
                <span>{fmtARS(paymentTotal)}</span>
              </div>
              {change > 0 && (
                <div className="flex justify-between font-medium text-green-700 dark:text-green-400">
                  <span>Vuelto</span>
                  <span>{fmtARS(change)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cliente */}
        <div className="px-4 py-3 border-b">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Cliente</p>
          {customerObj ? (
            <div className="flex items-center justify-between rounded-md border px-3 py-2 bg-background">
              <div>
                <p className="text-sm font-medium">{customerObj.first_name} {customerObj.last_name}</p>
                {customerObj.phone && <p className="text-xs text-muted-foreground">{customerObj.phone}</p>}
              </div>
              <button
                className="text-muted-foreground hover:text-destructive transition-colors"
                onClick={() => { setCustomerObj(null); setCustomerId(null) }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs justify-start text-muted-foreground"
              onClick={() => setShowCustomerDialog(true)}
            >
              <UserPlus className="h-3.5 w-3.5 mr-2" />
              Agregar cliente (opcional)
            </Button>
          )}
        </div>

        {/* Error */}
        {confirmError && (
          <div className="mx-4 mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {confirmError}
          </div>
        )}

        {/* Botón confirmar */}
        <div className="mt-auto p-4">
          <Button
            className="w-full h-11 text-sm font-semibold gap-2"
            disabled={isCartEmpty || !isPaymentComplete || !sellerId || !warehouseId || confirming}
            onClick={handleConfirm}
          >
            {confirming
              ? <><Loader2 className="h-4 w-4 animate-spin" />Procesando...</>
              : <><Check className="h-4 w-4" />Confirmar venta<ChevronRight className="h-4 w-4 ml-auto" /></>
            }
          </Button>
          {!isPaymentComplete && !isCartEmpty && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Falta ingresar {fmtARS(Math.max(0, total - paymentTotal))} en métodos de pago.
            </p>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <CustomerDialog
        open={showCustomerDialog}
        onClose={() => setShowCustomerDialog(false)}
        onSelect={c => { setCustomerObj(c); setCustomerId(c.id) }}
      />
    </div>
  )
}
