"use client"

import { PermissionGuard } from "@/components/auth/permission-guard"
import { useState, useEffect, useCallback } from "react"
import {
  Search,
  ChevronLeft,
  Eye,
  AlertTriangle,
  Loader2,
  ShoppingCart,
  Ticket,
  Ban,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Label } from "@/components/ui/label"
import { usePOS } from "@/lib/pos-context"
import { useAuth } from "@/lib/auth-context"
import { useInventory } from "@/lib/inventory-context"
import { cn } from "@/lib/utils"
import type { Sale, Employee, SaleStatus } from "@/lib/types"

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtARS(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n)
}

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
}

function fmtSaleNumber(n: number) {
  return "V-" + String(n).padStart(4, "0")
}

const STATUS_LABELS: Record<SaleStatus, string> = {
  draft:     "Borrador",
  confirmed: "Confirmada",
  voided:    "Anulada",
}

function StatusBadge({ status }: { status: SaleStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs",
        status === "confirmed" && "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400",
        status === "voided"    && "border-destructive/40 bg-destructive/10 text-destructive",
        status === "draft"     && "text-muted-foreground",
      )}
    >
      {STATUS_LABELS[status]}
    </Badge>
  )
}

// ── Sale detail dialog ─────────────────────────────────────────────────────────

function SaleDetailDialog({
  sale,
  onClose,
  onVoid,
}: {
  sale: Sale
  onClose: () => void
  onVoid: (sale: Sale) => void
}) {
  const { canDelete } = useAuth()
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            {fmtSaleNumber(sale.sale_number)}
            <StatusBadge status={sale.status} />
          </DialogTitle>
          <DialogDescription>
            {fmtDate(sale.confirmed_at ?? sale.created_at)} · {(sale.seller as { name?: string })?.name ?? "—"}
          </DialogDescription>
        </DialogHeader>

        {/* Items */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Ítems</p>
          {sale.items?.map(item => (
            <div key={item.id} className="flex justify-between text-sm rounded-md border px-3 py-2">
              <div>
                <p className="font-medium">{(item.product_snapshot as { name?: string })?.name ?? "Producto"}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {(item.product_snapshot as { sku?: string })?.sku} · ×{item.quantity}
                  {item.discount_pct > 0 && ` · ${item.discount_pct}% desc.`}
                </p>
              </div>
              <p className="font-semibold">{fmtARS(item.line_total)}</p>
            </div>
          ))}
        </div>

        {/* Totales */}
        <div className="border-t pt-3 space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span><span>{fmtARS(sale.subtotal_amount)}</span>
          </div>
          {sale.discount_amount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Descuento</span><span>− {fmtARS(sale.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-base">
            <span>Total</span><span>{fmtARS(sale.total_amount)}</span>
          </div>
        </div>

        {/* Pagos */}
        {sale.payments && sale.payments.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Pagos</p>
            {sale.payments.map(p => (
              <div key={p.id} className="flex justify-between text-sm text-muted-foreground">
                <span className="capitalize">{p.method}</span>
                <span>{fmtARS(p.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Ticket de canje */}
        {sale.exchange_ticket && (
          <div className="rounded-lg border-2 border-dashed p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Ticket className="h-3.5 w-3.5" />
              <span className="font-semibold uppercase tracking-widest">Ticket de Canje</span>
            </div>
            <p className="text-xl font-mono font-semibold text-primary">{sale.exchange_ticket.ticket_number}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Estado: <span className="font-medium capitalize">{sale.exchange_ticket.status}</span>
              {" · "}Vence: {new Date(sale.exchange_ticket.valid_until).toLocaleDateString("es-AR")}
            </p>
          </div>
        )}

        {/* Cliente */}
        {sale.customer && (
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {(sale.customer as { first_name?: string })?.first_name} {(sale.customer as { last_name?: string })?.last_name}
            </span>
            {(sale.customer as { phone?: string })?.phone && (
              <> · {(sale.customer as { phone?: string }).phone}</>
            )}
          </div>
        )}

        {/* Motivo de anulación */}
        {sale.status === "voided" && sale.void_reason && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
            <span className="font-medium">Motivo de anulación:</span> {sale.void_reason}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
          {sale.status === "confirmed" && canDelete("pos_sales") && (
            <Button variant="destructive" onClick={() => { onClose(); onVoid(sale) }}>
              <Ban className="h-4 w-4 mr-2" />
              Anular venta
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Void confirm dialog ────────────────────────────────────────────────────────

function VoidDialog({
  sale,
  onClose,
  onConfirm,
}: {
  sale: Sale
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)

  const ticketUsed = sale.exchange_ticket?.status === "used"

  async function handle() {
    if (!reason.trim()) return
    setLoading(true)
    await onConfirm(reason.trim())
    setLoading(false)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Anular {fmtSaleNumber(sale.sale_number)}
          </DialogTitle>
          <DialogDescription>
            Esta acción es irreversible. El stock será devuelto al depósito de origen.
          </DialogDescription>
        </DialogHeader>

        {ticketUsed && (
          <div className="rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 inline mr-1.5" />
            El ticket de canje ya fue utilizado. Coordiná la resolución manualmente.
          </div>
        )}

        <div>
          <Label className="text-xs">Motivo de anulación *</Label>
          <Input
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Describí el motivo..."
            className="mt-1"
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" onClick={handle} disabled={!reason.trim() || loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar anulación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

// Draft huérfano: cualquier borrador con más de 30 minutos de antigüedad.
const STALE_DRAFT_MINUTES = 30

function isStaleDraft(sale: Sale): boolean {
  if (sale.status !== "draft") return false
  const ageMs = Date.now() - new Date(sale.created_at).getTime()
  return ageMs > STALE_DRAFT_MINUTES * 60 * 1000
}

function SalesHistoryPage() {
  const { fetchSales, voidSale, fetchEmployees } = usePOS()
  const { refreshAfterInventoryChange } = useInventory()
  const { user } = useAuth()

  const [sales, setSales] = useState<Sale[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterSeller, setFilterSeller] = useState<string>("all")
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [saleToVoid, setSaleToVoid] = useState<Sale | null>(null)
  const [cleaning, setCleaning] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<{ deleted: number } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [s, emps] = await Promise.all([
      fetchSales({ status: filterStatus === "all" ? undefined : filterStatus, pageSize: 100 }),
      fetchEmployees(),
    ])
    setSales(s)
    setEmployees(emps)
    setLoading(false)
  }, [fetchSales, fetchEmployees, filterStatus])

  useEffect(() => { load() }, [load])

  const filtered = sales.filter(s => {
    if (filterSeller !== "all" && s.seller_id !== filterSeller) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    const num = "v-" + String(s.sale_number).padStart(4, "0")
    const customer = s.customer
      ? `${(s.customer as { first_name?: string })?.first_name ?? ""} ${(s.customer as { last_name?: string })?.last_name ?? ""}`.toLowerCase()
      : ""
    return num.includes(q) || customer.includes(q)
  })

  const staleDraftCount = sales.filter(isStaleDraft).length

  async function handleVoid(reason: string) {
    if (!saleToVoid || !user) return

    // Optimistic update: mark as voided immediately so the UI responds instantly.
    // Reverted below if the RPC fails.
    setSales(prev => prev.map(s =>
      s.id === saleToVoid.id ? { ...s, status: "voided" as SaleStatus } : s
    ))
    setSaleToVoid(null)

    const result = await voidSale(saleToVoid.id, reason)

    if (result.ok) {
      // Refresh only the slices affected by void_sale: movements (new
      // sale_reversal entry) and stock (quantities restored to warehouse).
      // Runs in parallel in the background — UI already shows the change.
      refreshAfterInventoryChange()
    } else {
      // Revert optimistic update and re-open the dialog so the operator can retry.
      setSales(prev => prev.map(s =>
        s.id === saleToVoid.id ? { ...s, status: "confirmed" as SaleStatus } : s
      ))
      setSaleToVoid(saleToVoid)
    }
  }

  async function handleCleanupDrafts() {
    setCleaning(true)
    setCleanupResult(null)
    try {
      const res = await fetch("/api/pos/cleanup-drafts", { method: "POST" })
      const data = await res.json()
      if (data.ok) {
        setCleanupResult({ deleted: data.deleted })
        if (data.deleted > 0) load()
      }
    } finally {
      setCleaning(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => window.location.assign("/pos")} className="h-8 w-8">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h1 className="font-semibold text-sm">Historial de ventas</h1>
        <div className="ml-auto flex items-center gap-2">
          {staleDraftCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCleanupDrafts}
              disabled={cleaning}
              className="text-xs h-8 gap-1.5 text-amber-700 dark:text-amber-400 border-amber-500/40 hover:bg-amber-500/10"
            >
              {cleaning
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Trash2 className="h-3.5 w-3.5" />
              }
              {staleDraftCount} {staleDraftCount === 1 ? "borrador huérfano" : "borradores huérfanos"}
            </Button>
          )}
          {cleanupResult && (
            <span className="text-xs text-muted-foreground">
              {cleanupResult.deleted === 0
                ? "Sin borradores viejos"
                : `${cleanupResult.deleted} eliminado${cleanupResult.deleted > 1 ? "s" : ""}`
              }
            </span>
          )}
          <Button variant="outline" size="sm" onClick={load} className="text-xs h-8">
            Actualizar
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 px-4 py-3 border-b shrink-0 bg-muted/20">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Número o cliente..."
            className="h-8 text-xs pl-8"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 text-xs w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todos los estados</SelectItem>
            <SelectItem value="confirmed" className="text-xs">Confirmadas</SelectItem>
            <SelectItem value="voided" className="text-xs">Anuladas</SelectItem>
            <SelectItem value="draft" className="text-xs">Borradores</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterSeller} onValueChange={setFilterSeller}>
          <SelectTrigger className="h-8 text-xs w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todos los vendedores</SelectItem>
            {employees.map(e => (
              <SelectItem key={e.id} value={e.id} className="text-xs">{e.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Cargando...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
            <ShoppingCart className="h-8 w-8 opacity-20" />
            <p className="text-sm">Sin ventas para mostrar.</p>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map(sale => (
              <button
                key={sale.id}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                onClick={() => setSelectedSale(sale)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-sm font-semibold">{fmtSaleNumber(sale.sale_number)}</span>
                    <StatusBadge status={sale.status} />
                    {isStaleDraft(sale) && (
                      <Badge variant="outline" className="text-xs border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                        Huérfano
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{fmtDate(sale.confirmed_at ?? sale.created_at)}</span>
                    <span>·</span>
                    <span>{(sale.seller as { name?: string })?.name ?? "—"}</span>
                    {sale.customer && (
                      <>
                        <span>·</span>
                        <span>
                          {(sale.customer as { first_name?: string })?.first_name}{" "}
                          {(sale.customer as { last_name?: string })?.last_name}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-sm">{fmtARS(sale.total_amount)}</p>
                  {sale.exchange_ticket && (
                    <p className="text-xs text-muted-foreground font-mono">{sale.exchange_ticket.ticket_number}</p>
                  )}
                </div>
                <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      {selectedSale && (
        <SaleDetailDialog
          sale={selectedSale}
          onClose={() => setSelectedSale(null)}
          onVoid={s => { setSelectedSale(null); setSaleToVoid(s) }}
        />
      )}
      {saleToVoid && (
        <VoidDialog
          sale={saleToVoid}
          onClose={() => setSaleToVoid(null)}
          onConfirm={handleVoid}
        />
      )}
    </div>
  )
}

export default function SalesHistoryPageRoute() {
  return (
    <PermissionGuard module="pos_sales">
      <SalesHistoryPage />
    </PermissionGuard>
  )
}
