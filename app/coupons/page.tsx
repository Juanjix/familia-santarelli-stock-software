"use client"

import { useState, useMemo } from "react"
import { useInventory, type Coupon } from "@/lib/inventory-context"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Search, Plus, Ticket, CheckCircle2 } from "lucide-react"

function generateCouponCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let result = "CUP-"
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export default function CouponsPage() {
  const { products, coupons, addCoupon, useCoupon } = useInventory()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  
  // Form state
  const [selectedProductId, setSelectedProductId] = useState("")
  const [couponValue, setCouponValue] = useState("")
  const [expirationDays, setExpirationDays] = useState("30")

  const filteredCoupons = useMemo(() => {
    return coupons.filter(coupon => {
      const matchesSearch = coupon.code.toLowerCase().includes(search.toLowerCase()) ||
        coupon.productName.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = statusFilter === "all" || coupon.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [coupons, search, statusFilter])

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(dateString))
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(value)
  }

  const handleCreateCoupon = () => {
    const product = products.find(p => p.id === selectedProductId)
    if (!product || !couponValue) return

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + parseInt(expirationDays))

    addCoupon({
      code: generateCouponCode(),
      productId: product.id,
      productName: product.name,
      value: parseFloat(couponValue),
      status: "active",
      expiresAt: expiresAt.toISOString(),
    })

    setCreateDialogOpen(false)
    setSelectedProductId("")
    setCouponValue("")
    setExpirationDays("30")
  }

  const getStatusBadge = (status: Coupon["status"]) => {
    switch (status) {
      case "active":
        return <Badge variant="default">Activo</Badge>
      case "used":
        return <Badge variant="secondary">Usado</Badge>
      case "expired":
        return <Badge variant="destructive">Vencido</Badge>
    }
  }

  return (
    <div className="flex flex-col">
      <Header title="Cupones de Cambio" />
      
      <main className="flex-1 p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por código o producto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="used">Usados</SelectItem>
                <SelectItem value="expired">Vencidos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Crear Cupón
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Cupón de Cambio</DialogTitle>
                <DialogDescription>
                  Genere un cupón para un producto específico
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Producto</Label>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar producto" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.slice(0, 50).map(product => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} - {product.sku}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid gap-2">
                  <Label>Valor del Cupón (ARS)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="100"
                    value={couponValue}
                    onChange={(e) => setCouponValue(e.target.value)}
                    placeholder="Ingrese el valor"
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label>Días de validez</Label>
                  <Select value={expirationDays} onValueChange={setExpirationDays}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 días</SelectItem>
                      <SelectItem value="15">15 días</SelectItem>
                      <SelectItem value="30">30 días</SelectItem>
                      <SelectItem value="60">60 días</SelectItem>
                      <SelectItem value="90">90 días</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleCreateCoupon}
                  disabled={!selectedProductId || !couponValue}
                >
                  Crear Cupón
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Ticket className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cupones Activos</p>
                <p className="text-2xl font-bold">{coupons.filter(c => c.status === "active").length}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cupones Usados</p>
                <p className="text-2xl font-bold">{coupons.filter(c => c.status === "used").length}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Ticket className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor Total Activo</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(coupons.filter(c => c.status === "active").reduce((sum, c) => sum + c.value, 0))}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Código</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCoupons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No hay cupones para mostrar
                  </TableCell>
                </TableRow>
              ) : (
                filteredCoupons.map((coupon) => (
                  <TableRow key={coupon.id}>
                    <TableCell className="font-mono font-semibold">
                      {coupon.code}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{coupon.productName}</p>
                        <p className="text-xs text-muted-foreground">ID: {coupon.productId}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(coupon.value)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(coupon.status)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(coupon.createdAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(coupon.expiresAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {coupon.status === "active" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => useCoupon(coupon.id)}
                        >
                          Marcar Usado
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  )
}
