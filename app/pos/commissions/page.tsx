"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  ChevronLeft,
  Loader2,
  Users,
  CircleDollarSign,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronRight,
  Ban,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { createBrowserClient } from "@supabase/ssr"
import type { Employee, CommissionStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

interface CommissionRow {
  id: string
  sale_id: string
  employee_id: string
  commission_pct: number
  commission_amount: number
  basis_amount: number
  status: CommissionStatus
  created_at: string
  updated_at: string
  sale: {
    sale_number: number
    confirmed_at: string | null
    total_amount: number
  }
  employee: {
    id: string
    name: string
  }
}

interface EmployeeGroup {
  employee: { id: string; name: string }
  pending: CommissionRow[]
  paid: CommissionRow[]
  voided: CommissionRow[]
  totalPending: number
  totalPaid: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function fmtARS(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "ARS", minimumFractionDigits: 0,
  }).format(n)
}

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  })
}

function fmtSaleNumber(n: number) {
  return "V-" + String(n).padStart(4, "0")
}

// Genera opciones de período: últimos 6 meses
function buildPeriodOptions() {
  const options: { value: string; label: string; from: string; to: string }[] = [
    { value: "all", label: "Todo el tiempo", from: "", to: "" },
  ]
  const now = new Date()
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
    const to   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString()
    const label = d.toLocaleDateString("es-AR", { month: "long", year: "numeric" })
    options.push({ value: from, label: label.charAt(0).toUpperCase() + label.slice(1), from, to })
  }
  return options
}

const PERIOD_OPTIONS = buildPeriodOptions()

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, highlight,
}: {
  label: string; value: string; sub?: string
  icon: React.ElementType; highlight?: boolean
}) {
  return (
    <div className={cn(
      "rounded-xl border p-4 flex gap-3 items-start",
      highlight && "border-primary/30 bg-primary/5"
    )}>
      <div className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
        highlight ? "bg-primary/10" : "bg-muted"
      )}>
        <Icon className={cn("h-4 w-4", highlight ? "text-primary" : "text-muted-foreground")} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-xl font-semibold leading-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Employee group row ────────────────────────────────────────────────────────

function EmployeeGroupRow({
  group,
  expanded,
  onToggle,
  onMarkPaid,
  marking,
}: {
  group: EmployeeGroup
  expanded: boolean
  onToggle: () => void
  onMarkPaid: (ids: string[]) => void
  marking: boolean
}) {
  const pendingIds = group.pending.map(c => c.id)

  return (
    <div className="border rounded-xl overflow-hidden mb-3">
      {/* Group header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
        onClick={onToggle}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
          {group.employee.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{group.employee.name}</p>
          <p className="text-xs text-muted-foreground">
            {group.pending.length + group.paid.length} comisión{group.pending.length + group.paid.length !== 1 ? "es" : ""}
          </p>
        </div>

        {/* Totals */}
        <div className="flex items-center gap-4 mr-2 shrink-0">
          {group.totalPending > 0 && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Pendiente</p>
              <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">{fmtARS(group.totalPending)}</p>
            </div>
          )}
          {group.totalPaid > 0 && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Pagado</p>
              <p className="text-sm font-semibold text-green-600 dark:text-green-400">{fmtARS(group.totalPaid)}</p>
            </div>
          )}
        </div>

        {/* Mark all paid button */}
        {pendingIds.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 shrink-0"
            disabled={marking}
            onClick={e => { e.stopPropagation(); onMarkPaid(pendingIds) }}
          >
            {marking ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
            Liquidar todo
          </Button>
        )}
        {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {/* Detail rows */}
      {expanded && (
        <div className="divide-y">
          {[...group.pending, ...group.paid, ...group.voided].map(c => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">{fmtSaleNumber(c.sale.sale_number)}</span>
                  <StatusBadge status={c.status} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {fmtDate(c.sale.confirmed_at)} · Base: {fmtARS(c.basis_amount)} · {c.commission_pct}%
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={cn(
                  "font-semibold text-sm",
                  c.status === "pending" && "text-amber-600 dark:text-amber-400",
                  c.status === "paid"    && "text-green-600 dark:text-green-400",
                  c.status === "voided"  && "text-muted-foreground line-through",
                )}>
                  {fmtARS(c.commission_amount)}
                </p>
              </div>
              {c.status === "pending" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7 shrink-0 text-muted-foreground hover:text-green-700"
                  disabled={marking}
                  onClick={() => onMarkPaid([c.id])}
                >
                  <CheckCircle2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: CommissionStatus }) {
  return (
    <Badge variant="outline" className={cn(
      "text-[10px] px-1.5 py-0",
      status === "pending" && "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
      status === "paid"    && "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400",
      status === "voided"  && "text-muted-foreground",
    )}>
      {status === "pending" ? "Pendiente" : status === "paid" ? "Pagada" : "Anulada"}
    </Badge>
  )
}

// ── Mark paid confirm dialog ───────────────────────────────────────────────────

function MarkPaidDialog({
  count,
  total,
  onConfirm,
  onClose,
}: {
  count: number
  total: number
  onConfirm: () => Promise<void>
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)

  async function handle() {
    setLoading(true)
    await onConfirm()
    setLoading(false)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirmar liquidación</DialogTitle>
          <DialogDescription>
            Marcás {count} comisión{count !== 1 ? "es" : ""} como pagada{count !== 1 ? "s" : ""} por un total de{" "}
            <strong>{fmtARS(total)}</strong>. Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handle} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CommissionsPage() {
  const [commissions, setCommissions] = useState<CommissionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(PERIOD_OPTIONS[1]?.value ?? "all")  // mes actual
  const [filterEmployee, setFilterEmployee] = useState("all")
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [pendingMark, setPendingMark] = useState<string[] | null>(null)
  const [marking, setMarking] = useState(false)

  const periodOption = PERIOD_OPTIONS.find(p => p.value === period) ?? PERIOD_OPTIONS[0]

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = getSupabase()

    let query = supabase
      .from("sale_commissions")
      .select(`
        *,
        sale:sales(sale_number, confirmed_at, total_amount),
        employee:employees(id, name)
      `)
      .order("created_at", { ascending: false })

    if (periodOption.from) query = query.gte("created_at", periodOption.from)
    if (periodOption.to)   query = query.lte("created_at", periodOption.to)

    const { data, error } = await query
    if (!error && data) setCommissions(data as CommissionRow[])
    setLoading(false)
  }, [periodOption])

  useEffect(() => { load() }, [load])

  // Agrupar por empleado
  const groups = useMemo((): EmployeeGroup[] => {
    const map = new Map<string, EmployeeGroup>()

    for (const c of commissions) {
      if (!c.employee) continue
      const key = c.employee_id

      if (!map.has(key)) {
        map.set(key, {
          employee: c.employee,
          pending: [], paid: [], voided: [],
          totalPending: 0, totalPaid: 0,
        })
      }
      const g = map.get(key)!
      if (c.status === "pending") { g.pending.push(c); g.totalPending += c.commission_amount }
      else if (c.status === "paid") { g.paid.push(c); g.totalPaid += c.commission_amount }
      else g.voided.push(c)
    }

    return Array.from(map.values()).sort((a, b) =>
      b.totalPending - a.totalPending || a.employee.name.localeCompare(b.employee.name)
    )
  }, [commissions])

  const visibleGroups = useMemo(() =>
    filterEmployee === "all" ? groups : groups.filter(g => g.employee.id === filterEmployee),
    [groups, filterEmployee]
  )

  // Totales globales
  const totalPending = useMemo(() =>
    commissions.filter(c => c.status === "pending").reduce((s, c) => s + c.commission_amount, 0),
    [commissions]
  )
  const totalPaid = useMemo(() =>
    commissions.filter(c => c.status === "paid").reduce((s, c) => s + c.commission_amount, 0),
    [commissions]
  )
  const countPending = commissions.filter(c => c.status === "pending").length

  const pendingTotal = useMemo(() => {
    if (!pendingMark) return 0
    return commissions
      .filter(c => pendingMark.includes(c.id))
      .reduce((s, c) => s + c.commission_amount, 0)
  }, [pendingMark, commissions])

  async function markAsPaid(ids: string[]) {
    const supabase = getSupabase()
    await supabase
      .from("sale_commissions")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .in("id", ids)
    setPendingMark(null)
    load()
  }

  function toggleExpanded(employeeId: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(employeeId) ? next.delete(employeeId) : next.add(employeeId)
      return next
    })
  }

  // Expand all on first load
  useEffect(() => {
    if (!loading && groups.length > 0) {
      setExpandedIds(new Set(groups.map(g => g.employee.id)))
    }
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  const allEmployees = useMemo(() =>
    groups.map(g => g.employee).sort((a, b) => a.name.localeCompare(b.name)),
    [groups]
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.location.assign("/pos")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h1 className="font-semibold text-sm">Comisiones</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs h-8" onClick={load}>
            Actualizar
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="h-8 text-xs w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterEmployee} onValueChange={setFilterEmployee}>
            <SelectTrigger className="h-8 text-xs w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todos los vendedores</SelectItem>
              {allEmployees.map(e => (
                <SelectItem key={e.id} value={e.id} className="text-xs">{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            label="Pendiente de pago"
            value={fmtARS(totalPending)}
            sub={`${countPending} comisión${countPending !== 1 ? "es" : ""}`}
            icon={Clock}
            highlight={totalPending > 0}
          />
          <StatCard
            label="Pagado en el período"
            value={fmtARS(totalPaid)}
            icon={CheckCircle2}
          />
          <StatCard
            label="Vendedores con comisión"
            value={String(groups.length)}
            icon={Users}
          />
        </div>

        {/* Liquidar todo (visible solo si hay pendientes en la vista filtrada) */}
        {visibleGroups.some(g => g.totalPending > 0) && (
          <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
            <div>
              <p className="text-sm font-medium">
                {filterEmployee === "all" ? "Liquidar todas las comisiones pendientes" : `Liquidar pendientes de ${visibleGroups[0]?.employee.name}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {fmtARS(visibleGroups.reduce((s, g) => s + g.totalPending, 0))} en total
              </p>
            </div>
            <Button
              size="sm"
              disabled={marking}
              onClick={() => {
                const ids = visibleGroups.flatMap(g => g.pending.map(c => c.id))
                setPendingMark(ids)
              }}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
              Liquidar
            </Button>
          </div>
        )}

        {/* Groups */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Cargando...</span>
          </div>
        ) : visibleGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
            <CircleDollarSign className="h-10 w-10 opacity-20" />
            <p className="text-sm">Sin comisiones para el período seleccionado.</p>
            <p className="text-xs opacity-70">Las comisiones se generan cuando se configura un porcentaje en el perfil del empleado.</p>
          </div>
        ) : (
          <div>
            {visibleGroups.map(group => (
              <EmployeeGroupRow
                key={group.employee.id}
                group={group}
                expanded={expandedIds.has(group.employee.id)}
                onToggle={() => toggleExpanded(group.employee.id)}
                onMarkPaid={ids => setPendingMark(ids)}
                marking={marking}
              />
            ))}
          </div>
        )}
      </div>

      {/* Confirm dialog */}
      {pendingMark && (
        <MarkPaidDialog
          count={pendingMark.length}
          total={pendingTotal}
          onClose={() => setPendingMark(null)}
          onConfirm={() => markAsPaid(pendingMark)}
        />
      )}
    </div>
  )
}
