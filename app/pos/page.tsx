"use client"

import { useState, useEffect, useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from "react"
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
  Printer,
  CircleDollarSign,
  ScanLine,
  AlertCircle,
  Undo2,
  CornerDownLeft,
  CheckCircle2,
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
import { useProductSearch } from "@/lib/hooks/use-product-search"
import { usePOS } from "@/lib/pos-context"
import { useInventory } from "@/lib/inventory-context"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
import type { Product, Employee, Warehouse, PaymentMethod, POSCustomer, ConfirmSaleResult } from "@/lib/types"

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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

// ── Impresión del ticket de canje desde el POS ────────────────────────────────

interface PrintTicketData {
  ticketNumber: string
  saleNumber: number
  total: number
  customerName: string | null
  customerPhone: string | null
  items: { name: string; sku: string; quantity: number; lineTotal: number }[]
  validUntil: string  // ISO date string (30 días desde hoy)
}

function printPOSTicket(data: PrintTicketData) {
  const itemsHtml = data.items.map(it =>
    `<div class="row"><span class="label">${escHtml(it.name)}</span><span class="value">×${it.quantity} ${fmtARS(it.lineTotal)}</span></div>`
  ).join("")

  const html = `<!DOCTYPE html><html><head>
    <meta charset="UTF-8"><title>Ticket ${escHtml(data.ticketNumber)}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      @page { size: 105mm 148mm; margin: 0; }
      body { font-family: Arial, sans-serif; font-size: 9pt; color: #111; }
      .ticket { width: 100mm; min-height: 136mm; padding: 3mm 4mm; display: flex; flex-direction: column; gap: 1.2mm; }
      .header { text-align: center; }
      .brand { font-size: 12pt; font-weight: bold; letter-spacing: 0.3px; }
      .subtitle { font-size: 11pt; font-weight: bold; margin-top: 0.5mm; letter-spacing: 0.3px; }
      .ticket-number { font-family: monospace; font-size: 14pt; font-weight: bold; text-align: center; letter-spacing: 1px; margin: 1mm 0 1.5mm; padding: 0.8mm 0; border: 1px solid #000; border-radius: 1mm; }
      .divider { border-top: 0.5px solid #bbb; margin: 0.5mm 0; }
      .section-title { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.3px; color: #777; font-weight: bold; margin-bottom: 0.6mm; }
      .row { display: flex; gap: 2mm; align-items: baseline; margin-bottom: 0.3mm; }
      .label { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.2px; color: #666; min-width: 28mm; flex-shrink: 0; }
      .value { font-size: 9pt; font-weight: 600; word-break: break-word; }
      .total-row { display: flex; justify-content: space-between; font-size: 11pt; font-weight: bold; margin-top: 1mm; border-top: 0.7px solid #000; padding-top: 1mm; }
      .signature { margin-top: auto; padding-top: 2mm; text-align: center; }
      .signature-line { border-top: 0.7px solid #000; margin: 0 8mm; }
      .signature-label { font-size: 7pt; color: #555; margin-top: 0.8mm; }
    </style>
    </head><body>
    <div class="ticket">
      <div class="header">
        <div class="brand">FAMILIA SANTARELLI</div>
        <div class="subtitle">TICKET DE CAMBIO</div>
      </div>
      <div class="ticket-number">${escHtml(data.ticketNumber)}</div>

      <div class="section">
        <div class="section-title">Cliente</div>
        <div class="row"><span class="label">Nombre</span><span class="value">${escHtml(data.customerName ?? "—")}</span></div>
        <div class="row"><span class="label">Teléfono</span><span class="value">${escHtml(data.customerPhone ?? "—")}</span></div>
      </div>
      <div class="divider"></div>

      <div class="section">
        <div class="section-title">Productos</div>
        ${itemsHtml}
        <div class="total-row"><span>TOTAL</span><span>${fmtARS(data.total)}</span></div>
      </div>
      <div class="divider"></div>

      <div class="section">
        <div class="row"><span class="label">Nro. de venta</span><span class="value">V-${String(data.saleNumber).padStart(4, "0")}</span></div>
        <div class="row"><span class="label">Fecha emisión</span><span class="value">${fmtDate(new Date().toISOString())}</span></div>
        <div class="row"><span class="label">Válido hasta</span><span class="value">${fmtDate(data.validUntil)}</span></div>
      </div>

      <div class="signature">
        <div class="signature-line"></div>
        <div class="signature-label">Firma del cliente</div>
      </div>
    </div>
    <script>window.print();</script>
    </body></html>`

  const win = window.open("", "_blank")
  if (!win) { alert("Habilitá los popups para imprimir el ticket."); return }
  win.document.write(html)
  win.document.close()
}

function escHtml(s: string) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")
}

// ── Web Audio API — beeps de feedback ─────────────────────────────────────────

function playBeep(type: "success" | "error") {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    if (type === "success") {
      osc.frequency.value = 880
      osc.type = "sine"
      gain.gain.setValueAtTime(0.08, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
      osc.start()
      osc.stop(ctx.currentTime + 0.1)
    } else {
      osc.frequency.value = 200
      osc.type = "sawtooth"
      gain.gain.setValueAtTime(0.12, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
      osc.start()
      osc.stop(ctx.currentTime + 0.25)
    }
    osc.onended = () => ctx.close()
  } catch {
    // AudioContext no disponible (SSR, tests) — falla silenciosamente
  }
}

// ── Success screen ─────────────────────────────────────────────────────────────

function SuccessScreen({
  result,
  printData,
  onNewSale,
}: {
  result: ConfirmSaleResult & { ok: true; sale_number: number; ticket_number: string }
  printData: PrintTicketData
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

      <Button
        variant="outline"
        className="w-full max-w-sm gap-2"
        onClick={() => printPOSTicket(printData)}
      >
        <Printer className="h-4 w-4" />
        Imprimir ticket
      </Button>

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

// ── POS search bar ────────────────────────────────────────────────────────────
// Always-visible input that works with barcode/QR scanners AND manual text
// search. A scanner sends keystrokes + Enter; the input captures them regardless
// of what had focus before because it is always in the DOM and auto-focuses on
// mount. Typing shows an inline dropdown; Enter on an exact code auto-adds.

const POSSearchBar = forwardRef<
  { focus: () => void },
  {
    products: Product[]
    getStock: (id: string) => number
    onSelect: (product: Product) => void
    onFocusChange: (active: boolean) => void
    onNotFound: () => void
  }
>(function POSSearchBar({ products, getStock, onSelect, onFocusChange, onNotFound }, ref) {
  const [query, setQuery] = useState("")
  const [showDropdown, setShowDropdown] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }))
  const { resolve, rank } = useProductSearch(products)

  const results = useMemo(
    () => (query.trim() ? rank(query) : []),
    [query, rank],
  )

  // Show dropdown only when there are results and not an exact code match
  useEffect(() => {
    const exact = query.trim() ? resolve(query) : null
    setShowDropdown(results.length > 0 && !exact)
  }, [results, query, resolve])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  function add(product: Product) {
    onSelect(product)
    setQuery("")
    setShowDropdown(false)
    setNotFound(false)
    inputRef.current?.focus()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const code = query.trim()
    if (!code) return

    const exact = resolve(code)
    if (exact) { add(exact); return }

    if (results.length === 1) { add(results[0]); return }

    setNotFound(true)
    onNotFound()
    if (results.length > 1) setShowDropdown(true)
  }

  return (
    <div ref={containerRef} className="relative">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setNotFound(false) }}
            onFocus={() => { if (results.length > 0) setShowDropdown(true); onFocusChange(true) }}
            onBlur={() => onFocusChange(false)}
            placeholder="Buscar por nombre, SKU o escanear código..."
            className="pl-9 pr-8 h-10 text-sm"
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(""); setNotFound(false); setShowDropdown(false); inputRef.current?.focus() }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </form>

      {notFound && results.length === 0 && (
        <div className="flex items-center gap-2 mt-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          Sin resultado para <span className="font-mono font-medium">"{query}"</span>
        </div>
      )}

      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-popover border rounded-md shadow-lg overflow-hidden max-h-64 overflow-y-auto">
          {results.map(p => {
            const stock = getStock(p.id)
            return (
              <button
                key={p.id}
                type="button"
                onMouseDown={e => { e.preventDefault(); add(p) }}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted transition-colors text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{p.sku}{p.barcode ? ` · ${p.barcode}` : ""}</p>
                </div>
                <span className={cn(
                  "ml-3 text-xs font-medium shrink-0",
                  stock === 0 ? "text-destructive" : "text-green-700 dark:text-green-400"
                )}>
                  {stock} u.
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
})

// ── Main POS page ──────────────────────────────────────────────────────────────

export default function POSPage() {
  const {
    items, payments, discountAmount, customerId,
    subtotal, total, paymentTotal, change,
    isCartEmpty, isPaymentComplete,
    addOrIncrementProduct, removeItem, updateItemQty, updateItemPrice, updateItemDiscount,
    setDiscountAmount, setCustomerId, setPayment, removePayment,
    confirmSale, clearCart,
    fetchEmployees, fetchWarehouses, searchCustomers,
  } = usePOS()

  const { products, getStockByWarehouse } = useInventory()
  const { user } = useAuth()

  const [employees, setEmployees] = useState<Employee[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [sellerId, setSellerId] = useState("")
  const [warehouseId, setWarehouseId] = useState("")
  const [dataLoaded, setDataLoaded] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [customerObj, setCustomerObj] = useState<POSCustomer | null>(null)
  const [showCustomerDialog, setShowCustomerDialog] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [successResult, setSuccessResult] = useState<(ConfirmSaleResult & { ok: true; sale_number: number; ticket_number: string }) | null>(null)
  const [successPrintData, setSuccessPrintData] = useState<PrintTicketData | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [lastAdded, setLastAdded] = useState<{ productId: string; wasNew: boolean } | null>(null)
  const [scannerActive, setScannerActive] = useState(true)
  const [lastScannedFeedback, setLastScannedFeedback] = useState<{ name: string; stock: number } | null>(null)
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null)
  const scannerRef = useRef<{ focus: () => void }>(null)
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasPriceZero = items.some(it => it.unit_price === 0)

  // Restore seller/warehouse from localStorage; auto-resolve from user account when possible.
  // Only auto-selects without asking when: value is persisted, user is linked to an employee,
  // or there is only one option — otherwise shows the setup screen.
  useEffect(() => {
    Promise.all([fetchEmployees(), fetchWarehouses()]).then(([emps, whs]) => {
      setEmployees(emps)
      setWarehouses(whs)

      const savedSeller    = localStorage.getItem("pos:sellerId")
      const savedWarehouse = localStorage.getItem("pos:warehouseId")
      let sellerResolved   = false
      let warehouseResolved = false

      // Seller: localStorage → user.employee_id → only if single employee
      if (savedSeller && emps.find(e => e.id === savedSeller)) {
        setSellerId(savedSeller)
        sellerResolved = true
      } else if (user?.employee_id && emps.find(e => e.id === user.employee_id)) {
        setSellerId(user.employee_id)
        localStorage.setItem("pos:sellerId", user.employee_id)
        sellerResolved = true
      } else if (emps.length === 1) {
        setSellerId(emps[0].id)
        localStorage.setItem("pos:sellerId", emps[0].id)
        sellerResolved = true
      }

      // Warehouse: localStorage → only if single warehouse
      if (savedWarehouse && whs.find(w => w.id === savedWarehouse)) {
        setWarehouseId(savedWarehouse)
        warehouseResolved = true
      } else if (whs.length === 1) {
        setWarehouseId(whs[0].id)
        localStorage.setItem("pos:warehouseId", whs[0].id)
        warehouseResolved = true
      }

      setDataLoaded(true)
      if (sellerResolved && warehouseResolved) setSessionReady(true)
    })
  }, [fetchEmployees, fetchWarehouses, user?.employee_id])

  // Auto-clear undo hint after 5 s
  useEffect(() => {
    if (!lastAdded) return
    const t = setTimeout(() => setLastAdded(null), 5000)
    return () => clearTimeout(t)
  }, [lastAdded])

  // Clear undo if the item was manually removed from cart
  useEffect(() => {
    if (lastAdded && !items.find(i => i.product_id === lastAdded.productId)) {
      setLastAdded(null)
    }
  }, [items, lastAdded])

  const activeProducts = useMemo(() => products.filter(p => p.is_active), [products])

  const getStock = useCallback(
    (productId: string) => products.find(p => p.id === productId)?.total_stock ?? 0,
    [products],
  )

  // Stock in the currently selected warehouse for a given product
  const getWarehouseStock = useCallback(
    (productId: string) =>
      warehouseId
        ? (getStockByWarehouse(productId).find(s => s.warehouseId === warehouseId)?.quantity ?? 0)
        : 0,
    [getStockByWarehouse, warehouseId],
  )

  // Wrap addOrIncrement to track the last scanned product for undo
  const addWithUndo = useCallback((product: Product) => {
    const existingItem = items.find(i => i.product_id === product.id)
    const wasNew = !existingItem
    const existingQty = existingItem?.quantity ?? 0
    addOrIncrementProduct(product)
    setLastAdded({ productId: product.id, wasNew })

    // Feedback temporal: nombre del producto + stock restante estimado
    const whStock = getWarehouseStock(product.id)
    const remainingStock = Math.max(0, whStock - (existingQty + 1))
    setLastScannedFeedback({ name: product.name, stock: remainingStock })
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    feedbackTimerRef.current = setTimeout(() => setLastScannedFeedback(null), 800)

    // Highlight de la fila recién agregada
    setHighlightedProductId(product.id)
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    highlightTimerRef.current = setTimeout(() => setHighlightedProductId(null), 500)

    // Auto-scroll a la fila
    setTimeout(() => {
      itemRefs.current[product.id]?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }, 50)

    playBeep("success")
  }, [items, addOrIncrementProduct, getWarehouseStock])

  const handleUndo = useCallback(() => {
    if (!lastAdded) return
    const { productId, wasNew } = lastAdded
    const item = items.find(i => i.product_id === productId)
    if (!item) return
    if (wasNew || item.quantity <= 1) removeItem(productId)
    else updateItemQty(productId, item.quantity - 1)
    setLastAdded(null)
  }, [lastAdded, items, removeItem, updateItemQty])

  // Stable refs so the keydown closure always calls the latest function instances
  const handleConfirmRef = useRef<(() => void) | null>(null)
  const handleUndoRef    = useRef<(() => void) | null>(null)

  // Keyboard shortcuts: Ctrl/⌘+Enter → confirm, Ctrl/⌘+Z → undo last scan
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && e.key === "Enter") {
        e.preventDefault()
        handleConfirmRef.current?.()
      }
      if (e.key === "F8") {
        e.preventDefault()
        scannerRef.current?.focus()
      }
      if (ctrl && e.key === "z") {
        // Only intercept when focus is NOT inside an editable field (let the browser handle text undo)
        const tag = (document.activeElement as HTMLElement)?.tagName
        if (tag !== "INPUT" && tag !== "TEXTAREA") {
          e.preventDefault()
          handleUndoRef.current?.()
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  async function handleConfirm() {
    if (!sellerId || !warehouseId || isCartEmpty || !isPaymentComplete || hasPriceZero) return
    setConfirming(true)
    setConfirmError(null)
    const result = await confirmSale(sellerId, warehouseId)
    setConfirming(false)
    if (result.ok) {
      const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      setSuccessPrintData({
        ticketNumber: (result as { ticket_number: string }).ticket_number,
        saleNumber: (result as { sale_number: number }).sale_number,
        total,
        customerName: customerObj ? `${customerObj.first_name} ${customerObj.last_name}` : null,
        customerPhone: customerObj?.phone ?? null,
        items: items.map(it => ({
          name: it.product.name,
          sku: it.product.sku,
          quantity: it.quantity,
          lineTotal: it.quantity * it.unit_price * (1 - it.discount_pct / 100),
        })),
        validUntil,
      })
      setSuccessResult(result as typeof successResult)
    } else {
      setConfirmError(result.error_detail ?? "Error al confirmar la venta.")
    }
  }

  function handleNewSale() {
    clearCart()
    setSuccessResult(null)
    setSuccessPrintData(null)
    setConfirmError(null)
    setCustomerObj(null)
    setCustomerId(null)
    setLastAdded(null)
  }

  // Keep refs in sync with latest function instances on every render
  handleConfirmRef.current = handleConfirm
  handleUndoRef.current    = handleUndo

  if (successResult && successPrintData) {
    return <SuccessScreen result={successResult} printData={successPrintData} onNewSale={handleNewSale} />
  }

  // Setup screen — shown when seller or warehouse couldn't be auto-resolved
  if (dataLoaded && !sessionReady) {
    const sellerName = employees.find(e => e.id === sellerId)?.name
    const warehouseName = warehouses.find(w => w.id === warehouseId)?.name
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Preparar punto de venta</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Confirmá quién atiende y desde qué local para comenzar.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">¿Quién está atendiendo?</Label>
              {sellerName && employees.length === 1 ? (
                <div className="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground">
                  {sellerName}
                </div>
              ) : (
                <Select value={sellerId} onValueChange={id => { setSellerId(id); localStorage.setItem("pos:sellerId", id) }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccioná un vendedor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <Label className="text-sm font-medium mb-1.5 block">¿Desde qué local?</Label>
              {warehouseName && warehouses.length === 1 ? (
                <div className="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground">
                  {warehouseName}
                </div>
              ) : (
                <Select value={warehouseId} onValueChange={id => { setWarehouseId(id); localStorage.setItem("pos:warehouseId", id) }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccioná un depósito..." />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <Button
            className="w-full"
            disabled={!sellerId || !warehouseId}
            onClick={() => setSessionReady(true)}
          >
            Comenzar a vender
          </Button>
        </div>
      </div>
    )
  }

  const paymentMap = Object.fromEntries(payments.map(p => [p.method, p]))

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Panel izquierdo: búsqueda + carrito ─────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 border-r overflow-hidden">

        {/* Header con contexto de sesión */}
        <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <ShoppingCart className="h-5 w-5 text-muted-foreground shrink-0" />
            <span className="font-semibold text-sm shrink-0">
              {isCartEmpty
                ? "Punto de Venta"
                : (() => {
                    const qty = items.reduce((s, i) => s + i.quantity, 0)
                    return `${qty} artículo${qty !== 1 ? "s" : ""} · ${fmtARS(total)}`
                  })()}
            </span>
            <span className="text-muted-foreground/50 shrink-0">·</span>
            <span className="text-xs text-muted-foreground truncate">
              {employees.find(e => e.id === sellerId)?.name}
              {" · "}
              {warehouses.find(w => w.id === warehouseId)?.name}
            </span>
            <button
              className="shrink-0 text-[11px] text-muted-foreground/60 hover:text-muted-foreground underline underline-offset-2 transition-colors"
              onClick={() => setSessionReady(false)}
            >
              cambiar
            </button>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => window.location.assign("/pos/commissions")} className="text-xs text-muted-foreground">
              <CircleDollarSign className="h-3.5 w-3.5 mr-1.5" />
              Comisiones
            </Button>
            <Button variant="ghost" size="sm" onClick={() => window.location.assign("/pos/sales")} className="text-xs text-muted-foreground">
              <History className="h-3.5 w-3.5 mr-1.5" />
              Historial
            </Button>
          </div>
        </div>

        {/* Buscador / escáner de producto */}
        <div className="px-4 py-3 border-b shrink-0 space-y-2">
          <POSSearchBar
            ref={scannerRef}
            products={activeProducts}
            getStock={getStock}
            onSelect={addWithUndo}
            onFocusChange={setScannerActive}
            onNotFound={() => playBeep("error")}
          />

          {/* Estado del escáner */}
          {scannerActive ? (
            <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse shrink-0" />
              <span className="font-medium">Escáner listo</span>
              <span className="text-muted-foreground">· Escaneá el siguiente producto</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => scannerRef.current?.focus()}
              className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
            >
              <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
              <span className="font-medium">Escáner inactivo</span>
              <span className="text-muted-foreground">· Hacé clic aquí o presioná F8 para activarlo</span>
            </button>
          )}

          {/* Feedback temporal del último producto escaneado */}
          {lastScannedFeedback && (
            <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium truncate">{lastScannedFeedback.name}</span>
              <span className="text-muted-foreground shrink-0">· Stock restante: {lastScannedFeedback.stock}</span>
            </div>
          )}

          {/* Deshacer último scan */}
          {lastAdded && (
            <button
              onClick={handleUndo}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Undo2 className="h-3 w-3" />
              Deshacer último scan
              <kbd className="ml-1 rounded border border-border px-1 py-0.5 text-[10px] font-mono text-muted-foreground">⌘Z</kbd>
            </button>
          )}
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
              {items.map(item => {
                const lineTotal = item.quantity * item.unit_price * (1 - item.discount_pct / 100)
                const hasNoPrice = item.unit_price === 0
                const availStock = getWarehouseStock(item.product_id)
                const isOverstock = warehouseId && item.quantity > availStock
                return (
                  <div
                    key={item.product_id}
                    ref={el => { itemRefs.current[item.product_id] = el }}
                    className={cn(
                      "rounded-lg border bg-card p-3 transition-colors duration-300",
                      hasNoPrice && "border-amber-500/50 bg-amber-500/5",
                      isOverstock && !hasNoPrice && "border-destructive/50 bg-destructive/5",
                      highlightedProductId === item.product_id && !hasNoPrice && !isOverstock && "border-green-500/50 bg-green-500/5"
                    )}
                  >
                    <div className="flex gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight truncate">{item.product.name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground font-mono">{item.product.sku}</p>
                          {warehouseId && (
                            <span className={cn(
                              "text-xs",
                              isOverstock ? "text-destructive font-medium" : "text-muted-foreground/70"
                            )}>
                              {isOverstock ? `⚠ stock: ${availStock}` : `disp: ${availStock}`}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-2">
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
                          {/* Precio unitario */}
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">$</span>
                            <Input
                              type="number"
                              min={0}
                              value={item.unit_price || ""}
                              onChange={e => updateItemPrice(item.product_id, Number(e.target.value))}
                              onFocus={e => e.target.select()}
                              placeholder="0"
                              className={cn(
                                "h-6 w-20 text-xs px-2",
                                hasNoPrice && "border-amber-500 focus-visible:ring-amber-500"
                              )}
                            />
                          </div>
                          {/* Descuento */}
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={item.discount_pct || ""}
                              onChange={e => updateItemDiscount(item.product_id, Number(e.target.value))}
                              onFocus={e => e.target.select()}
                              placeholder="0%"
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
                          <p className={cn("text-sm font-semibold", hasNoPrice && "text-amber-600 dark:text-amber-400")}>
                            {fmtARS(lineTotal)}
                          </p>
                          {item.discount_pct > 0 && (
                            <p className="text-xs text-muted-foreground line-through">
                              {fmtARS(item.quantity * item.unit_price)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    {hasNoPrice && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                        Este producto no tiene precio configurado. Ingresalo antes de confirmar.
                      </p>
                    )}
                  </div>
                )
              })}
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
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Método de pago</p>
            {total > 0 && (
              <button
                type="button"
                onClick={() => setPayment("cash", total)}
                className="text-xs text-primary hover:underline font-medium"
              >
                Cobrar total en efectivo
              </button>
            )}
          </div>
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
                  onFocus={e => e.target.select()}
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
            disabled={isCartEmpty || !isPaymentComplete || !sellerId || !warehouseId || confirming || hasPriceZero}
            onClick={handleConfirm}
          >
            {confirming
              ? <><Loader2 className="h-4 w-4 animate-spin" />Procesando...</>
              : <>
                  <Check className="h-4 w-4" />
                  Confirmar venta
                  <kbd className="ml-auto rounded border border-primary-foreground/30 px-1 py-0.5 text-[10px] font-mono opacity-70">⌘↩</kbd>
                </>
            }
          </Button>
          {/* Mensajes de bloqueo — en orden de prioridad */}
          {hasPriceZero && !isCartEmpty && (
            <p className="text-xs text-amber-600 dark:text-amber-400 text-center mt-2">
              Hay ítems con precio $0. Corregí los precios para confirmar.
            </p>
          )}
          {!isPaymentComplete && !isCartEmpty && sellerId && warehouseId && !hasPriceZero && (
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
