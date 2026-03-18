"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/dashboard/header"
import { StatCard } from "@/components/dashboard/stat-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { dashboardStats, recentMovements, warehouses } from "@/lib/mock-data"
import { Package, Boxes, DollarSign, AlertTriangle, ArrowDownRight, ArrowUpRight, ArrowLeftRight, Wrench } from "lucide-react"

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value)
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-AR").format(value)
}

const movementIcons = {
  entry: ArrowDownRight,
  exit: ArrowUpRight,
  transfer: ArrowLeftRight,
  adjustment: Wrench,
}

const movementColors = {
  entry: "text-green-500",
  exit: "text-red-500",
  transfer: "text-primary",
  adjustment: "text-yellow-500",
}

const movementLabels = {
  entry: "Entrada",
  exit: "Salida",
  transfer: "Transferencia",
  adjustment: "Ajuste",
}

// Client-side only relative time to avoid hydration mismatch
function useRelativeTime(dateString: string): string {
  const [relativeTime, setRelativeTime] = useState<string>("")
  
  useEffect(() => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    let result: string
    if (diffMins < 1) {
      result = "hace un momento"
    } else if (diffMins < 60) {
      result = `hace ${diffMins} min`
    } else if (diffHours < 24) {
      result = `hace ${diffHours} ${diffHours === 1 ? "hora" : "horas"}`
    } else if (diffDays < 7) {
      result = `hace ${diffDays} ${diffDays === 1 ? "día" : "días"}`
    } else {
      result = new Intl.DateTimeFormat("es-AR", {
        day: "2-digit",
        month: "2-digit",
      }).format(date)
    }
    setRelativeTime(result)
  }, [dateString])
  
  return relativeTime
}

function RelativeTime({ date }: { date: string }) {
  const relativeTime = useRelativeTime(date)
  return <>{relativeTime || "-"}</>
}

export default function DashboardPage() {
  return (
    <>
      <Header title="Panel" description="Resumen de tu inventario" />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total de Productos"
            value={formatNumber(dashboardStats.totalProducts)}
            subtitle="SKUs activos en el sistema"
            icon={Package}
            trend={{ value: 2.5, isPositive: true }}
          />
          <StatCard
            title="Total de Unidades"
            value={formatNumber(dashboardStats.totalUnits)}
            subtitle="Artículos en todos los depósitos"
            icon={Boxes}
            trend={{ value: 1.2, isPositive: true }}
          />
          <StatCard
            title="Valor Estimado"
            value={formatCurrency(dashboardStats.estimatedValue)}
            subtitle="Valor total del inventario"
            icon={DollarSign}
            trend={{ value: 4.1, isPositive: true }}
          />
          <StatCard
            title="Alertas de Stock Bajo"
            value={dashboardStats.lowStockAlerts}
            subtitle="Productos que requieren atención"
            icon={AlertTriangle}
            className="border-yellow-500/20"
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Movimientos Recientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentMovements.slice(0, 6).map((movement) => {
                  const Icon = movementIcons[movement.type]
                  return (
                    <div key={movement.id} className="flex items-center gap-4">
                      <div className={`rounded-lg bg-secondary p-2 ${movementColors[movement.type]}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{movement.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          {movement.type === "entry" && `+${movement.quantity} a ${movement.toWarehouse}`}
                          {movement.type === "exit" && `-${movement.quantity} de ${movement.fromWarehouse}`}
                          {movement.type === "transfer" && `${movement.quantity} de ${movement.fromWarehouse} a ${movement.toWarehouse}`}
                          {movement.type === "adjustment" && `${movement.quantity > 0 ? "+" : ""}${movement.quantity} en ${movement.fromWarehouse}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          <RelativeTime date={movement.date} />
                        </p>
                        <p className="text-xs text-muted-foreground">{movement.user}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Stock por Depósito</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {warehouses.map((warehouse) => (
                  <div key={warehouse.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{warehouse.name}</span>
                      <span className="text-sm text-muted-foreground">{formatNumber(warehouse.stockCount)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${(warehouse.stockCount / 6000) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Stock por Categoría</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {dashboardStats.stockByCategory.map((item) => (
                  <div key={item.category} className="flex items-center justify-between rounded-lg bg-secondary/50 p-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.category}</p>
                      <p className="text-xs text-muted-foreground">{formatNumber(item.count)} unidades</p>
                    </div>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {item.percentage}%
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
