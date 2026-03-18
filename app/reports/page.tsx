"use client"

import { useMemo } from "react"
import { useInventory } from "@/lib/inventory-context"
import { Header } from "@/components/dashboard/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
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
  Boxes
} from "lucide-react"

export default function ReportsPage() {
  const { products, warehouses, movements, getStockByWarehouse } = useInventory()

  const stats = useMemo(() => {
    const totalProducts = products.length
    const activeProducts = products.filter(p => p.isActive).length
    const totalStock = products.reduce((sum, p) => sum + p.totalStock, 0)
    const totalValue = products.reduce((sum, p) => sum + (p.totalStock * p.price), 0)
    const lowStockProducts = products.filter(p => p.stockStatus === "low_stock")
    const outOfStockProducts = products.filter(p => p.stockStatus === "out_of_stock")
    
    // Category breakdown
    const byCategory = products.reduce((acc, p) => {
      acc[p.category] = (acc[p.category] || 0) + p.totalStock
      return acc
    }, {} as Record<string, number>)

    // Material breakdown
    const byMaterial = products.reduce((acc, p) => {
      acc[p.material] = (acc[p.material] || 0) + p.totalStock
      return acc
    }, {} as Record<string, number>)

    // Recent movements summary
    const todayMovements = movements.filter(m => {
      const movementDate = new Date(m.date)
      const today = new Date()
      return movementDate.toDateString() === today.toDateString()
    })
    const entries = todayMovements.filter(m => m.type === "entry").reduce((sum, m) => sum + m.quantity, 0)
    const exits = todayMovements.filter(m => m.type === "exit").reduce((sum, m) => sum + Math.abs(m.quantity), 0)

    return {
      totalProducts,
      activeProducts,
      totalStock,
      totalValue,
      lowStockProducts,
      outOfStockProducts,
      byCategory,
      byMaterial,
      todayEntries: entries,
      todayExits: exits,
    }
  }, [products, movements])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(value)
  }

  const warehouseStats = useMemo(() => {
    return warehouses.map(warehouse => {
      let stockCount = 0
      let valueSum = 0
      products.forEach(product => {
        const stockByWh = getStockByWarehouse(product.id)
        const whStock = stockByWh.find(s => s.warehouseId === warehouse.id)
        if (whStock) {
          stockCount += whStock.quantity
          valueSum += whStock.quantity * product.price
        }
      })
      return {
        ...warehouse,
        calculatedStock: stockCount,
        calculatedValue: valueSum,
      }
    })
  }, [warehouses, products, getStockByWarehouse])

  const totalWarehouseStock = warehouseStats.reduce((sum, w) => sum + w.calculatedStock, 0)

  return (
    <div className="flex flex-col">
      <Header title="Reportes" />
      
      <main className="flex-1 p-6">
        {/* Overview Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Productos
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalProducts.toLocaleString("es-AR")}</div>
              <p className="text-xs text-muted-foreground">
                {stats.activeProducts} activos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Stock Total
              </CardTitle>
              <Boxes className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalStock.toLocaleString("es-AR")}</div>
              <p className="text-xs text-muted-foreground">
                unidades en inventario
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Valor Estimado
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</div>
              <p className="text-xs text-muted-foreground">
                valor total del inventario
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Alertas de Stock
              </CardTitle>
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

        {/* Today's Activity */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                Entradas de Hoy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-500">+{stats.todayEntries}</div>
              <p className="text-sm text-muted-foreground">unidades ingresadas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-500" />
                Salidas de Hoy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-500">-{stats.todayExits}</div>
              <p className="text-sm text-muted-foreground">unidades egresadas</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Stock by Warehouse */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Warehouse className="h-5 w-5" />
                Stock por Depósito
              </CardTitle>
              <CardDescription>Distribución del inventario</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {warehouseStats.map(warehouse => {
                const percentage = totalWarehouseStock > 0 
                  ? (warehouse.calculatedStock / totalWarehouseStock) * 100 
                  : 0
                return (
                  <div key={warehouse.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{warehouse.name}</span>
                      <span className="text-muted-foreground">
                        {warehouse.calculatedStock.toLocaleString("es-AR")} unidades
                      </span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(warehouse.calculatedValue)} - {percentage.toFixed(1)}%
                    </p>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Stock by Category */}
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
                  .map(([category, count]) => {
                    const percentage = stats.totalStock > 0 
                      ? (count / stats.totalStock) * 100 
                      : 0
                    return (
                      <div key={category} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{category}</Badge>
                        </div>
                        <div className="text-right">
                          <span className="font-medium">{count.toLocaleString("es-AR")}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({percentage.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </CardContent>
          </Card>

          {/* Low Stock Alert Table */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Productos con Stock Bajo
              </CardTitle>
              <CardDescription>
                Productos que requieren reposición
              </CardDescription>
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
                  {stats.lowStockProducts.slice(0, 10).map(product => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {product.sku}
                      </TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {product.totalStock}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">Stock Bajo</Badge>
                      </TableCell>
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
        </div>
      </main>
    </div>
  )
}
