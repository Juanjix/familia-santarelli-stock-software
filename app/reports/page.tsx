"use client"

import { PermissionGuard } from "@/components/auth/permission-guard"
import { useMemo, useState, useRef } from "react"
import { useInventory } from "@/lib/inventory-context"
import { Header } from "@/components/dashboard/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  BarChart3,
  Package,
  Warehouse,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Boxes,
  Printer,
  CalendarDays,
} from "lucide-react"
import { MovementBadge } from "@/components/movement-badge"

// ── Date helpers ──────────────────────────────────────────────────────────────

type PeriodMode = "day" | "week" | "month" | "custom-day" | "custom-month"

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function thisMonthISO() {
  return new Date().toISOString().slice(0, 7)
}

function startOfWeekISO() {
  const d = new Date()
  d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1)) // Monday
  return d.toISOString().slice(0, 10)
}

function formatPeriodLabel(mode: PeriodMode, customDay: string, customMonth: string): string {
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(iso + "T12:00:00"))
  const fmtMonth = (iso: string) =>
    new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(new Date(iso + "-01T12:00:00"))

  if (mode === "day")          return fmt(todayISO())
  if (mode === "week")         return `semana del ${fmt(startOfWeekISO())}`
  if (mode === "month")        return fmtMonth(thisMonthISO())
  if (mode === "custom-day")   return customDay   ? fmt(customDay)        : "día seleccionado"
  if (mode === "custom-month") return customMonth ? fmtMonth(customMonth) : "mes seleccionado"
  return ""
}

function inPeriod(dateStr: string, mode: PeriodMode, customDay: string, customMonth: string): boolean {
  const d = new Date(dateStr)
  if (mode === "day") {
    return new Date(d).toDateString() === new Date().toDateString()
  }
  if (mode === "week") {
    const start = new Date(startOfWeekISO() + "T00:00:00")
    const end   = new Date(start); end.setDate(end.getDate() + 7)
    return d >= start && d < end
  }
  if (mode === "month") {
    const now = new Date()
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }
  if (mode === "custom-day" && customDay) {
    return dateStr.slice(0, 10) === customDay
  }
  if (mode === "custom-month" && customMonth) {
    return dateStr.slice(0, 7) === customMonth
  }
  return false
}

// ── Main page ─────────────────────────────────────────────────────────────────

function ReportsPage() {
  const { products, warehouses, movements, getStockByWarehouse } = useInventory()

  const [mode, setMode]             = useState<PeriodMode>("day")
  const [customDay, setCustomDay]   = useState(todayISO())
  const [customMonth, setCustomMonth] = useState(thisMonthISO())
  const printRef = useRef<HTMLDivElement>(null)

  // ── Period movements ────────────────────────────────────────────────────────

  const periodMovements = useMemo(
    () => movements.filter(m => inPeriod(m.date ?? m.created_at, mode, customDay, customMonth)),
    [movements, mode, customDay, customMonth]
  )

  const periodEntries = periodMovements.filter(m => m.type === "entry").reduce((s, m) => s + m.quantity, 0)
  const periodExits   = periodMovements.filter(m => m.type === "exit").reduce((s, m) => s + Math.abs(m.quantity), 0)

  const periodLabel = formatPeriodLabel(mode, customDay, customMonth)

  // ── Static stats (current snapshot) ────────────────────────────────────────

  const stats = useMemo(() => {
    const totalProducts    = products.length
    const activeProducts   = products.filter(p => p.is_active).length
    const totalStock       = products.reduce((s, p) => s + (p.total_stock || 0), 0)
    const totalValue       = products.reduce((s, p) => s + ((p.total_stock || 0) * (p.sell_price || 0)), 0)
    const lowStockProducts = products.filter(p => p.stockStatus === "low_stock")
    const outOfStockProducts = products.filter(p => p.stockStatus === "out_of_stock")
    const byCategory       = products.reduce((acc, p) => {
      acc[p.category] = (acc[p.category] || 0) + (p.total_stock || 0)
      return acc
    }, {} as Record<string, number>)
    return { totalProducts, activeProducts, totalStock, totalValue, lowStockProducts, outOfStockProducts, byCategory }
  }, [products])

  const warehouseStats = useMemo(() => {
    return warehouses.map(wh => {
      let stockCount = 0, valueSum = 0
      products.forEach(p => {
        const s = getStockByWarehouse(p.id).find(s => s.warehouseId === wh.id)
        if (s) { stockCount += s.quantity; valueSum += s.quantity * (p.sell_price || p.price || 0) }
      })
      return { ...wh, calculatedStock: stockCount, calculatedValue: valueSum }
    })
  }, [warehouses, products, getStockByWarehouse])

  const totalWarehouseStock = warehouseStats.reduce((s, w) => s + w.calculatedStock, 0)

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(v)

  const formatDate = (ds: string) =>
    new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(ds))

  // ── Print ───────────────────────────────────────────────────────────────────

  const handlePrint = () => window.print()

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Print-only styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; inset: 0; padding: 24px; }
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
          @page { size: A4; margin: 20mm; }
        }
      `}</style>

      <div className="flex flex-col h-full">
        <Header title="Reportes" />

        <main className="flex-1 overflow-auto p-4 md:p-6">

          {/* ── Toolbar ── */}
          <div className="no-print mb-6 flex flex-wrap items-end gap-3">
            {/* Period presets */}
            <div className="flex gap-2">
              {(["day", "week", "month"] as const).map(m => (
                <Button
                  key={m}
                  variant={mode === m ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode(m)}
                >
                  {m === "day" ? "Hoy" : m === "week" ? "Esta semana" : "Este mes"}
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-1 text-muted-foreground text-sm">|</div>

            {/* Custom day */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Día:</span>
              <Input
                type="date"
                className="w-40 h-8 text-sm"
                value={customDay}
                onChange={e => { setCustomDay(e.target.value); setMode("custom-day") }}
              />
            </div>

            {/* Custom month */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Mes:</span>
              <Input
                type="month"
                className="w-36 h-8 text-sm"
                value={customMonth}
                onChange={e => { setCustomMonth(e.target.value); setMode("custom-month") }}
              />
            </div>

            {/* Print button */}
            <Button variant="outline" size="sm" onClick={handlePrint} className="ml-auto gap-2">
              <Printer className="h-4 w-4" />
              Imprimir reporte
            </Button>
          </div>

          {/* ── Printable area ── */}
          <div id="print-area" ref={printRef}>

            {/* Print header (only visible when printing) */}
            <div className="hidden print:block mb-6 border-b pb-4">
              <h1 className="text-xl font-bold">Familia Santarelli — Sistema de Stock</h1>
              <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                <CalendarDays className="h-4 w-4 inline" />
                Reporte de {periodLabel}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Generado el {new Intl.DateTimeFormat("es-AR", { dateStyle: "full", timeStyle: "short" }).format(new Date())}
              </p>
            </div>

            {/* Period label (visible on screen too) */}
            <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              <span>Período: <span className="font-medium text-foreground capitalize">{periodLabel}</span></span>
            </div>

            {/* ── KPIs generales (snapshot actual) ── */}
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Productos</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalProducts.toLocaleString("es-AR")}</div>
                  <p className="text-xs text-muted-foreground">{stats.activeProducts} activos</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Stock Total</CardTitle>
                  <Boxes className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalStock.toLocaleString("es-AR")}</div>
                  <p className="text-xs text-muted-foreground">unidades en inventario</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Valor Estimado</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</div>
                  <p className="text-xs text-muted-foreground">valor total del inventario</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Alertas de Stock</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">
                    {stats.lowStockProducts.length + stats.outOfStockProducts.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stats.lowStockProducts.length} bajo stock, {stats.outOfStockProducts.length} sin stock
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* ── Movimientos del período ── */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    Entradas del período
                  </CardTitle>
                  <CardDescription className="capitalize">{periodLabel}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-500">+{periodEntries}</div>
                  <p className="text-sm text-muted-foreground">unidades ingresadas</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-red-500" />
                    Salidas del período
                  </CardTitle>
                  <CardDescription className="capitalize">{periodLabel}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-500">{periodExits > 0 ? `-${periodExits}` : "0"}</div>
                  <p className="text-sm text-muted-foreground">unidades egresadas</p>
                </CardContent>
              </Card>
            </div>

            {/* ── Detalle de movimientos del período ── */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Movimientos del período
                </CardTitle>
                <CardDescription className="capitalize">{periodLabel} · {periodMovements.length} evento{periodMovements.length !== 1 ? "s" : ""}</CardDescription>
              </CardHeader>
              <CardContent>
                {periodMovements.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Sin movimientos en este período.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Fecha</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead>Origen</TableHead>
                        <TableHead>Destino</TableHead>
                        <TableHead>Usuario</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {periodMovements.map(m => (
                        <TableRow key={m.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(m.date ?? m.created_at)}
                          </TableCell>
                          <TableCell className="font-medium">{m.productName ?? m.product?.name}</TableCell>
                          <TableCell><MovementBadge type={m.type} /></TableCell>
                          <TableCell className="text-right">
                            <span className={`font-semibold ${m.quantity > 0 ? "text-green-500" : "text-red-500"}`}>
                              {m.quantity > 0 ? "+" : ""}{m.quantity}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{m.fromWarehouse || "-"}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{m.toWarehouse || "-"}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{m.user}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* ── Stock por depósito / categoría ── */}
            <div className="grid gap-6 lg:grid-cols-2 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Warehouse className="h-5 w-5" />
                    Stock por Depósito
                  </CardTitle>
                  <CardDescription>Estado actual del inventario</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {warehouseStats.map(wh => {
                    const pct = totalWarehouseStock > 0 ? (wh.calculatedStock / totalWarehouseStock) * 100 : 0
                    return (
                      <div key={wh.id} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{wh.name}</span>
                          <span className="text-muted-foreground">{wh.calculatedStock.toLocaleString("es-AR")} unidades</span>
                        </div>
                        <Progress value={pct} className="h-2" />
                        <p className="text-xs text-muted-foreground">{formatCurrency(wh.calculatedValue)} — {pct.toFixed(1)}%</p>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Stock por Categoría
                  </CardTitle>
                  <CardDescription>Unidades por tipo de producto</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(stats.byCategory)
                      .sort((a, b) => b[1] - a[1])
                      .map(([cat, count]) => {
                        const pct = stats.totalStock > 0 ? (count / stats.totalStock) * 100 : 0
                        return (
                          <div key={cat} className="flex items-center justify-between">
                            <Badge variant="outline">{cat}</Badge>
                            <div className="text-right">
                              <span className="font-medium">{count.toLocaleString("es-AR")}</span>
                              <span className="ml-2 text-xs text-muted-foreground">({pct.toFixed(1)}%)</span>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ── Productos con stock bajo ── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Productos con Stock Bajo
                </CardTitle>
                <CardDescription>Productos que requieren reposición</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.lowStockProducts.slice(0, 10).map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">{p.sku}</TableCell>
                        <TableCell>{p.category}</TableCell>
                        <TableCell className="text-right font-semibold">{p.total_stock ?? 0}</TableCell>
                        <TableCell><Badge variant="secondary">Stock Bajo</Badge></TableCell>
                      </TableRow>
                    ))}
                    {stats.lowStockProducts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No hay productos con stock bajo
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

          </div>{/* end #print-area */}
        </main>
      </div>
    </>
  )
}

export default function ReportsPageRoute() {
  return (
    <PermissionGuard module="reports">
      <ReportsPage />
    </PermissionGuard>
  )
}
