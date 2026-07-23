"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useInventory } from "@/lib/inventory-context"
import { createClient } from "@/lib/supabase/client"
import { Header } from "@/components/dashboard/header"
import { StatCard } from "@/components/dashboard/stat-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Package, Boxes, DollarSign, AlertTriangle,
  Tags, Repeat2, Wrench as WrenchIcon, ChevronRight, ShoppingCart,
} from "lucide-react"
import { getMovementIcon } from "@/components/movement-badge"

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value)
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-AR").format(value)
}

function useRelativeTime(dateString: string): string {
  const [relativeTime, setRelativeTime] = useState("")
  useEffect(() => {
    const date = new Date(dateString)
    const diffMs = Date.now() - date.getTime()
    const diffMins  = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays  = Math.floor(diffMs / 86400000)
    if (diffMins  < 1)  { setRelativeTime("hace un momento"); return }
    if (diffMins  < 60) { setRelativeTime(`hace ${diffMins} min`); return }
    if (diffHours < 24) { setRelativeTime(`hace ${diffHours} ${diffHours === 1 ? "hora" : "horas"}`); return }
    if (diffDays  < 7)  { setRelativeTime(`hace ${diffDays} ${diffDays === 1 ? "día" : "días"}`); return }
    setRelativeTime(new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit" }).format(date))
  }, [dateString])
  return relativeTime
}

function RelativeTime({ date }: { date: string }) {
  return <>{useRelativeTime(date) || "—"}</>
}

interface TodayStats {
  salesCount: number
  salesTotal: number
  readyRepairs: number
  pendingTransfers: number
}

export function AdminDashboard() {
  const { products, warehouses, movements, loading } = useInventory()
  const [todayStats, setTodayStats] = useState<TodayStats | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const today = new Date().toISOString().split("T")[0]
    Promise.all([
      supabase.from("sales").select("total_amount")
        .eq("status", "confirmed")
        .gte("confirmed_at", `${today}T00:00:00`)
        .lte("confirmed_at", `${today}T23:59:59`),
      supabase.from("envelopes").select("id", { count: "exact", head: true }).eq("status", "ready"),
      supabase.from("stock_transfers").select("id", { count: "exact", head: true }).eq("status", "in_transit"),
    ]).then(([salesRes, repairsRes, transfersRes]) => {
      const sales = salesRes.data ?? []
      setTodayStats({
        salesCount:       sales.length,
        salesTotal:       sales.reduce((s, x) => s + (x.total_amount ?? 0), 0),
        readyRepairs:     repairsRes.count ?? 0,
        pendingTransfers: transfersRes.count ?? 0,
      })
    })
  }, [])

  const stats = useMemo(() => {
    const totalProducts  = products.filter(p => p.is_active).length
    const totalUnits     = products.reduce((s, p) => s + (p.total_stock || 0), 0)
    const estimatedValue = products.reduce((s, p) => s + ((p.total_stock || 0) * (p.sell_price || 0)), 0)
    const lowStockAlerts = products.filter(p => p.is_active && (p.total_stock || 0) < (p.min_stock || 5)).length
    const categoryMap = new Map<string, number>()
    products.forEach(p => categoryMap.set(p.category, (categoryMap.get(p.category) || 0) + (p.total_stock || 0)))
    const stockByCategory = Array.from(categoryMap.entries())
      .map(([category, count]) => ({ category, count, percentage: totalUnits > 0 ? Math.round((count / totalUnits) * 100) : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
    return { totalProducts, totalUnits, estimatedValue, lowStockAlerts, stockByCategory }
  }, [products])

  if (loading) {
    return (
      <>
        <Header title="Panel" description="Resumen de tu inventario" />
        <div className="flex-1 overflow-auto p-4 md:p-6">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-4">
            {[1,2,3,4].map(i => (
              <Card key={i}><CardContent className="p-5"><Skeleton className="h-4 w-24 mb-2" /><Skeleton className="h-8 w-16" /></CardContent></Card>
            ))}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Header title="Panel" description="Resumen operativo del día" />
      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4 md:space-y-6">

        {/* Accesos rápidos */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          {[
            { label: "Nueva Venta",         href: "/pos",       icon: ShoppingCart },
            { label: "Nueva Reparación",    href: "/sobres",    icon: WrenchIcon },
            { label: "Nueva Transferencia", href: "/transfers", icon: Repeat2 },
            { label: "Imprimir Etiquetas",  href: "/labels",    icon: Tags },
          ].map(({ label, href, icon: Icon }) => (
            <Link key={href} href={href}>
              <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                <Icon className="h-4 w-4" />
                {label}
              </Button>
            </Link>
          ))}
        </div>

        {/* Estado del día */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="col-span-2 lg:col-span-2">
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-1">Ventas de hoy</p>
              {todayStats ? (
                <>
                  <p className="text-2xl font-bold">{formatCurrency(todayStats.salesTotal)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {todayStats.salesCount === 0
                      ? "Sin ventas por el momento"
                      : `${todayStats.salesCount} ${todayStats.salesCount === 1 ? "venta" : "ventas"} confirmada${todayStats.salesCount === 1 ? "" : "s"}`}
                  </p>
                </>
              ) : (
                <><Skeleton className="h-8 w-32 mb-1" /><Skeleton className="h-3 w-24" /></>
              )}
            </CardContent>
          </Card>

          {todayStats && (todayStats.readyRepairs > 0 || todayStats.pendingTransfers > 0) ? (
            <Card className="col-span-2 lg:col-span-2 border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-5">
                <p className="text-xs text-amber-700 dark:text-amber-400 uppercase tracking-widest font-semibold mb-2">Requieren atención</p>
                <div className="space-y-2">
                  {todayStats.readyRepairs > 0 && (
                    <Link href="/sobres" className="flex items-center justify-between group">
                      <div className="flex items-center gap-2 text-sm">
                        <WrenchIcon className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span className="font-medium">
                          {todayStats.readyRepairs} {todayStats.readyRepairs === 1 ? "reparación lista" : "reparaciones listas"} para entregar
                        </span>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </Link>
                  )}
                  {todayStats.pendingTransfers > 0 && (
                    <Link href="/transfers" className="flex items-center justify-between group">
                      <div className="flex items-center gap-2 text-sm">
                        <Repeat2 className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span className="font-medium">
                          {todayStats.pendingTransfers} {todayStats.pendingTransfers === 1 ? "transferencia pendiente" : "transferencias pendientes"} de recibir
                        </span>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : todayStats ? (
            <Card className="col-span-2 lg:col-span-2 border-green-500/30 bg-green-500/5">
              <CardContent className="p-5 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 shrink-0">
                  <AlertTriangle className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">Todo al día</p>
                  <p className="text-xs text-muted-foreground">Sin alertas pendientes</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="col-span-2 lg:col-span-2">
              <CardContent className="p-5">
                <Skeleton className="h-4 w-32 mb-2" /><Skeleton className="h-3 w-48" />
              </CardContent>
            </Card>
          )}
        </div>

        {/* KPIs de inventario — solo admin */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total de Productos"    value={formatNumber(stats.totalProducts)}  subtitle="SKUs activos en el sistema"           icon={Package} />
          <StatCard title="Total de Unidades"     value={formatNumber(stats.totalUnits)}     subtitle="Artículos en todos los depósitos"     icon={Boxes} />
          <StatCard title="Valor Estimado"        value={formatCurrency(stats.estimatedValue)} subtitle="Valor total del inventario"          icon={DollarSign} />
          <StatCard title="Alertas de Stock Bajo" value={stats.lowStockAlerts}               subtitle="Productos que requieren atención"     icon={AlertTriangle} className="border-yellow-500/20" />
        </div>

        <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3"><CardTitle className="text-base font-medium">Movimientos Recientes</CardTitle></CardHeader>
            <CardContent>
              {movements.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No hay movimientos recientes</p>
              ) : (
                <div className="space-y-4">
                  {movements.slice(0, 6).map(movement => {
                    const { Icon, colorClass } = getMovementIcon(movement.type)
                    return (
                      <div key={movement.id} className="flex items-center gap-4">
                        <div className={`rounded-lg bg-secondary p-2 ${colorClass}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{movement.productName}</p>
                          <p className="text-xs text-muted-foreground">
                            {movement.type === "entry"        && `+${movement.quantity} a ${movement.toWarehouse}`}
                            {movement.type === "exit"         && `-${movement.quantity} de ${movement.fromWarehouse}`}
                            {movement.type === "transfer"     && `${movement.quantity} de ${movement.fromWarehouse} a ${movement.toWarehouse}`}
                            {movement.type === "adjustment"   && `${movement.quantity > 0 ? "+" : ""}${movement.quantity} en ${movement.fromWarehouse}`}
                            {movement.type === "sale"         && `-${movement.quantity} · venta desde ${movement.fromWarehouse ?? ""}`}
                            {movement.type === "sale_reversal"&& `+${movement.quantity} · anulación en ${movement.fromWarehouse ?? ""}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground"><RelativeTime date={movement.date || movement.created_at} /></p>
                          <p className="text-xs text-muted-foreground">{movement.user || movement.user_name}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base font-medium">Stock por Depósito</CardTitle></CardHeader>
            <CardContent>
              {warehouses.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No hay depósitos configurados</p>
              ) : (
                <div className="space-y-4">
                  {warehouses.filter(w => w.is_active).map(warehouse => {
                    const stockCount = warehouse.stock_count || warehouse.stockCount || 0
                    const maxStock   = Math.max(...warehouses.map(w => w.stock_count || w.stockCount || 1), 1)
                    return (
                      <div key={warehouse.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">{warehouse.name}</span>
                          <span className="text-sm text-muted-foreground">{formatNumber(stockCount)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-secondary">
                          <div className="h-2 rounded-full bg-primary" style={{ width: `${(stockCount / maxStock) * 100}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {stats.stockByCategory.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base font-medium">Stock por Categoría</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                {stats.stockByCategory.map(item => (
                  <div key={item.category} className="flex items-center justify-between rounded-lg bg-secondary/50 p-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.category}</p>
                      <p className="text-xs text-muted-foreground">{formatNumber(item.count)} unidades</p>
                    </div>
                    <Badge variant="secondary" className="font-mono text-xs">{item.percentage}%</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </>
  )
}
