"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { useInventory } from "@/lib/inventory-context"
import { Header } from "@/components/dashboard/header"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, ArrowLeftRight, ChevronDown, ChevronRight, ArrowRight, ChevronLeft } from "lucide-react"
import { MovementBadge } from "@/components/movement-badge"
import { MOVEMENT_TYPE_OPTIONS } from "@/lib/movement-types"
import type { Movement, StockTransfer } from "@/lib/types"

// ── Types ────────────────────────────────────────────────────────────────────

type UnifiedRow =
  | { kind: "movement"; item: Movement; date: string }
  | { kind: "transfer"; item: StockTransfer; date: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(dateString))
}

function getRelativeTime(dateString: string) {
  const diffMs = Date.now() - new Date(dateString).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 60) return `hace ${diffMins} min`
  if (diffHours < 24) return `hace ${diffHours} hs`
  if (diffDays < 7) return `hace ${diffDays} días`
  return formatDate(dateString)
}

function transferMatchesSearch(st: StockTransfer, q: string): boolean {
  if (!q) return true
  const lower = q.toLowerCase()
  if (st.number.toLowerCase().includes(lower)) return true
  if (st.from_warehouse?.name.toLowerCase().includes(lower)) return true
  if (st.to_warehouse?.name.toLowerCase().includes(lower)) return true
  return st.items?.some(i => i.product?.name?.toLowerCase().includes(lower)) ?? false
}

// ── Transfer status badge ─────────────────────────────────────────────────────

function TransferStatusBadge({ status }: { status: StockTransfer["status"] }) {
  const map = {
    in_transit:       { label: "En tránsito",    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
    completed:        { label: "Completada",      className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
    with_differences: { label: "Con diferencias", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
    cancelled:        { label: "Cancelada",       className: "bg-muted text-muted-foreground" },
  }
  const cfg = map[status]
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.className}`}>{cfg.label}</span>
}

// ── Expanded transfer technical movements ─────────────────────────────────────

function TransferExpanded({ transferId, fetchMovementsForTransfer }: {
  transferId: string
  fetchMovementsForTransfer: (id: string) => Promise<Movement[]>
}) {
  const [loaded, setLoaded] = useState(false)
  const [techMovements, setTechMovements] = useState<Movement[]>([])

  // Fetch on first render of this component
  useState(() => {
    fetchMovementsForTransfer(transferId).then(ms => {
      setTechMovements(ms)
      setLoaded(true)
    })
  })

  if (!loaded) return (
    <div className="text-xs text-muted-foreground py-2 pl-4">Cargando movimientos técnicos…</div>
  )

  if (techMovements.length === 0) return (
    <div className="text-xs text-muted-foreground py-2 pl-4">Sin movimientos técnicos registrados.</div>
  )

  return (
    <div className="pl-4 pt-1 pb-2 space-y-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Movimientos técnicos</p>
      {techMovements.map(m => (
        <div key={m.id} className="flex items-center gap-3 text-xs text-muted-foreground">
          <MovementBadge type={m.type} className="shrink-0" />
          <span className="font-medium text-foreground">{m.productName}</span>
          <span className={m.quantity > 0 ? "text-green-500" : "text-red-500"}>
            {m.quantity > 0 ? "+" : ""}{m.quantity}
          </span>
          {m.fromWarehouse && <><span>{m.fromWarehouse}</span><ArrowRight className="h-3 w-3" /></>}
          {m.toWarehouse && <span>{m.toWarehouse}</span>}
        </div>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25

export default function MovementsPage() {
  const { movements, stockTransfers, fetchMovementsForTransfer } = useInventory()
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  // Build unified sorted list
  const unifiedRows = useMemo((): UnifiedRow[] => {
    const rows: UnifiedRow[] = []

    // Regular movements (already excludes transfer-linked ones via context query)
    for (const m of movements) {
      rows.push({ kind: "movement", item: m, date: m.date ?? m.created_at })
    }

    // Transfer events — one row per transfer
    for (const st of stockTransfers) {
      rows.push({ kind: "transfer", item: st, date: st.dispatched_at })
    }

    return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [movements, stockTransfers])

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1) }, [search, typeFilter])

  const filteredRows = useMemo((): UnifiedRow[] => {
    return unifiedRows.filter(row => {
      if (row.kind === "movement") {
        const m = row.item
        const productName = m.productName ?? m.product?.name ?? ""
        const matchesSearch = !search ||
          productName.toLowerCase().includes(search.toLowerCase()) ||
          (m.productId ?? m.product_id ?? "").includes(search)
        const matchesType = typeFilter === "all" || m.type === typeFilter
        return matchesSearch && matchesType
      } else {
        const matchesSearch = transferMatchesSearch(row.item, search)
        const matchesType = typeFilter === "all" || typeFilter === "transfer"
        return matchesSearch && matchesType
      }
    })
  }, [unifiedRows, search, typeFilter])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const pagedRows = useMemo(
    () => filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredRows, page]
  )

  return (
    <div className="flex flex-col h-full">
      <Header title="Movimientos" />

      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-4 md:mb-6 flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por producto, depósito o número de transferencia..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Tipo de movimiento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {MOVEMENT_TYPE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Mobile Card View */}
        <div className="space-y-3 md:hidden">
          {filteredRows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ArrowLeftRight className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="font-medium">{search || typeFilter !== "all" ? "Sin resultados para ese filtro" : "Todavía no hay movimientos registrados"}</p>
              {(search || typeFilter !== "all") && <p className="text-sm mt-1">Probá cambiando el filtro o la búsqueda.</p>}
            </div>
          ) : pagedRows.map(row => {
            if (row.kind === "movement") {
              const m = row.item
              return (
                <Card key={`m-${m.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <MovementBadge type={m.type} />
                      <span className={`font-semibold text-lg ${m.quantity > 0 ? "text-green-500" : "text-red-500"}`}>
                        {m.quantity > 0 ? "+" : ""}{m.quantity}
                      </span>
                    </div>
                    <p className="font-medium text-foreground mb-1">{m.productName}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-2">
                      {m.fromWarehouse && <span>De: {m.fromWarehouse}</span>}
                      {m.toWarehouse && <span>A: {m.toWarehouse}</span>}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                      <span>{getRelativeTime(row.date)}</span>
                      <span>{m.user ?? m.user_name}</span>
                    </div>
                    {m.notes && <p className="text-xs text-muted-foreground mt-2 italic truncate">{m.notes}</p>}
                  </CardContent>
                </Card>
              )
            } else {
              const st = row.item
              const isExpanded = expandedIds.has(st.id)
              const totalUnits = st.items?.reduce((s, i) => s + (i.quantity_received ?? i.quantity_sent), 0) ?? 0
              return (
                <Card key={`t-${st.id}`} className="border-blue-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <MovementBadge type="transfer" />
                      <TransferStatusBadge status={st.status} />
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-2">
                      <span className="font-medium text-foreground">{st.number}</span>
                      {st.from_warehouse && <span>De: {st.from_warehouse.name}</span>}
                      {st.to_warehouse && <span>A: {st.to_warehouse.name}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {st.items?.length ?? 0} producto{(st.items?.length ?? 0) !== 1 ? "s" : ""} · {totalUnits} unidad{totalUnits !== 1 ? "es" : ""}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border mt-2">
                      <span>{getRelativeTime(row.date)}</span>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" onClick={() => toggleExpand(st.id)}>
                        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        {isExpanded ? "Ocultar" : "Ver detalle"}
                      </Button>
                    </div>
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border">
                        {st.items?.map(item => (
                          <div key={item.id} className="flex items-center justify-between py-1 text-xs">
                            <span className="text-foreground font-medium">{item.product?.name}</span>
                            <span className="text-muted-foreground">
                              {item.quantity_received != null && item.quantity_received !== item.quantity_sent
                                ? `${item.quantity_received}/${item.quantity_sent} u.`
                                : `${item.quantity_sent} u.`}
                            </span>
                          </div>
                        ))}
                        <TransferExpanded transferId={st.id} fetchMovementsForTransfer={fetchMovementsForTransfer} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            }
          })}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block rounded-lg border border-border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-6"></TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Producto / Transferencia</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Notas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-16 text-center text-muted-foreground">
                    <ArrowLeftRight className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">{search || typeFilter !== "all" ? "Sin resultados para ese filtro" : "Todavía no hay movimientos registrados"}</p>
                    {(search || typeFilter !== "all") && <p className="text-sm mt-1">Probá cambiando el filtro o la búsqueda.</p>}
                  </TableCell>
                </TableRow>
              ) : pagedRows.map(row => {
                if (row.kind === "movement") {
                  const m = row.item
                  return (
                    <TableRow key={`m-${m.id}`}>
                      <TableCell />
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{getRelativeTime(row.date)}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(row.date)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-foreground">{m.productName ?? m.product?.name}</p>
                        <p className="text-xs text-muted-foreground">ID: {m.productId ?? m.product_id}</p>
                      </TableCell>
                      <TableCell><MovementBadge type={m.type} /></TableCell>
                      <TableCell className="text-right">
                        <span className={`font-semibold ${m.quantity > 0 ? "text-green-500" : "text-red-500"}`}>
                          {m.quantity > 0 ? "+" : ""}{m.quantity}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{m.fromWarehouse || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{m.toWarehouse || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{m.user}</TableCell>
                      <TableCell className="max-w-[180px] truncate text-muted-foreground">{m.notes || "-"}</TableCell>
                    </TableRow>
                  )
                } else {
                  const st = row.item
                  const isExpanded = expandedIds.has(st.id)
                  const productSummary = st.items && st.items.length === 1
                    ? st.items[0].product?.name
                    : `${st.items?.length ?? 0} productos`
                  const totalUnits = st.items?.reduce((s, i) => s + (i.quantity_received ?? i.quantity_sent), 0) ?? 0

                  return [
                    <TableRow
                      key={`t-${st.id}`}
                      className="cursor-pointer hover:bg-muted/40 bg-blue-500/5"
                      onClick={() => toggleExpand(st.id)}
                    >
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{getRelativeTime(row.date)}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(row.date)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-foreground">{productSummary}</p>
                        <p className="text-xs text-muted-foreground">{st.number}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MovementBadge type="transfer" />
                          <TransferStatusBadge status={st.status} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold text-blue-500">±{totalUnits}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{st.from_warehouse?.name || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{st.to_warehouse?.name || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{st.created_by}</TableCell>
                      <TableCell className="text-muted-foreground">-</TableCell>
                    </TableRow>,
                    isExpanded && (
                      <TableRow key={`t-${st.id}-expanded`} className="bg-muted/20 hover:bg-muted/20">
                        <TableCell />
                        <TableCell colSpan={8} className="py-3">
                          <div className="space-y-3">
                            {/* Items */}
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Productos transferidos</p>
                              <div className="space-y-1">
                                {st.items?.map(item => (
                                  <div key={item.id} className="flex items-center gap-3 text-sm">
                                    <span className="font-medium">{item.product?.name}</span>
                                    <span className="text-muted-foreground">
                                      {item.quantity_received != null && item.quantity_received !== item.quantity_sent
                                        ? <><span className="text-orange-500">{item.quantity_received}</span><span>/{item.quantity_sent} u.</span></>
                                        : `${item.quantity_sent} u.`}
                                    </span>
                                    {st.from_warehouse && st.to_warehouse && (
                                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        {st.from_warehouse.name} <ArrowRight className="h-3 w-3" /> {st.to_warehouse.name}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                            {/* Technical movements */}
                            <TransferExpanded transferId={st.id} fetchMovementsForTransfer={fetchMovementsForTransfer} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ),
                  ]
                }
              })}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {filteredRows.length === 0
              ? "Sin eventos"
              : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filteredRows.length)} de ${filteredRows.length} evento${filteredRows.length !== 1 ? "s" : ""}`}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground min-w-[80px] text-center">
                Página {page} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
