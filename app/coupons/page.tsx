"use client"

import { useState, useMemo } from "react"
import { useInventory } from "@/lib/inventory-context"
import type { Coupon, Product } from "@/lib/types"
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
import { Search, Plus, Ticket, CheckCircle2, Printer } from "lucide-react"

const PHONE_REGEX = /^[0-9+\-\s()]{6,20}$/

function printTicket(coupon: Coupon, product: Product | undefined) {
  const issuedAt = coupon.created_at || new Date().toISOString()
  const formatDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"

  const code = product?.factory_code || product?.internal_code || product?.sku || "—"
  const description = product?.name || "—"
  const category = product?.category_obj?.name || product?.category || "—"
  const brand = product?.brand?.name || "—"

  const html = `<!DOCTYPE html><html><head>
    <meta charset="UTF-8"><title>Ticket ${coupon.code}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      @page { size: 148mm 210mm; margin: 0; }
      body { font-family: Arial, sans-serif; font-size: 9pt; color: #111; }
      .ticket {
        width: 145mm;
        padding: 3mm 4mm;
        display: flex;
        flex-direction: column;
        gap: 1mm;
      }
      .header { text-align: center; }
      .brand { font-size: 12pt; font-weight: bold; letter-spacing: 0.3px; }
      .subtitle { font-size: 11pt; font-weight: bold; margin-top: 0.5mm; letter-spacing: 0.3px; }
      .ticket-number {
        font-family: monospace;
        font-size: 14pt;
        font-weight: bold;
        text-align: center;
        letter-spacing: 1px;
        margin: 1mm 0 1.5mm;
        padding: 0.8mm 0;
        border: 1px solid #000;
        border-radius: 1mm;
      }
      .divider { border-top: 0.5px solid #bbb; margin: 0.5mm 0; }
      .section-title { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.3px; color: #777; font-weight: bold; margin-bottom: 0.6mm; }
      .row { display: flex; gap: 2mm; align-items: baseline; margin-bottom: 0.3mm; }
      .label { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.2px; color: #666; min-width: 24mm; flex-shrink: 0; }
      .value { font-size: 9pt; font-weight: 600; word-break: break-word; }
      .obs-box { border: 0.5px solid #bbb; border-radius: 1mm; padding: 1mm 2mm; min-height: 7mm; white-space: pre-wrap; font-size: 8.5pt; }
      .signature { margin-top: 2mm; padding-top: 2mm; text-align: center; }
      .signature-line { border-top: 0.7px solid #000; margin: 0 8mm; }
      .signature-label { font-size: 7pt; color: #555; margin-top: 0.8mm; }
    </style>
    </head><body>
    <div class="ticket">
      <div class="header">
        <div class="brand">FAMILIA SANTARELLI</div>
        <div class="subtitle">TICKET DE CAMBIO</div>
      </div>
      <div class="ticket-number">${coupon.code}</div>

      <div class="section">
        <div class="section-title">Cliente</div>
        <div class="row"><span class="label">Nombre y Apellido</span><span class="value">${coupon.customer_name || "—"}</span></div>
        <div class="row"><span class="label">Teléfono</span><span class="value">${coupon.customer_phone || "—"}</span></div>
      </div>
      <div class="divider"></div>
      <div class="section">
        <div class="section-title">Producto</div>
        <div class="row"><span class="label">Código</span><span class="value">${code}</span></div>
        <div class="row"><span class="label">Descripción</span><span class="value">${description}</span></div>
        <div class="row"><span class="label">Categoría</span><span class="value">${category}</span></div>
        <div class="row"><span class="label">Marca</span><span class="value">${brand}</span></div>
      </div>
      <div class="divider"></div>
      <div class="section">
        <div class="row"><span class="label">Fecha de emisión</span><span class="value">${formatDate(issuedAt)}</span></div>
        ${coupon.expires_at ? `<div class="row"><span class="label">Fecha de vencimiento</span><span class="value">${formatDate(coupon.expires_at)}</span></div>` : ""}
      </div>
      ${coupon.notes ? `<div class="divider"></div><div class="section"><div class="section-title">Observaciones</div><div class="obs-box">${coupon.notes}</div></div>` : ""}

      <div class="signature">
        <div class="signature-line"></div>
        <div class="signature-label">Firma del cliente</div>
      </div>
    </div>
    <script>window.print();</script>
    </body></html>`

  const win = window.open("", "_blank")
  if (!win) return
  win.document.write(html)
  win.document.close()
}

export default function CouponsPage() {
  const { products, coupons, warehouses, addCoupon, useCoupon, getStockByWarehouse } = useInventory()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [selectedProductId, setSelectedProductId] = useState("")
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("")
  const [couponValue, setCouponValue] = useState("")
  const [expirationDays, setExpirationDays] = useState("30")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")

  const filteredCoupons = useMemo(() => {
    return coupons.filter(coupon => {
      const matchesSearch =
        coupon.code.toLowerCase().includes(search.toLowerCase()) ||
        (coupon.productName || "").toLowerCase().includes(search.toLowerCase()) ||
        (coupon.customer_name || "").toLowerCase().includes(search.toLowerCase()) ||
        (coupon.customer_phone || "").includes(search)
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

  const phoneValid = PHONE_REGEX.test(customerPhone.trim())

  // Stock disponible del producto en el depósito seleccionado
  const stockAvailable = useMemo(() => {
    if (!selectedProductId || !selectedWarehouseId) return null
    const stock = getStockByWarehouse(selectedProductId).find(s => s.warehouseId === selectedWarehouseId)
    return stock?.quantity ?? 0
  }, [selectedProductId, selectedWarehouseId, getStockByWarehouse])

  const hasStock = stockAvailable === null || stockAvailable > 0

  const canSubmit =
    !!selectedProductId &&
    !!selectedWarehouseId &&
    !!couponValue &&
    customerName.trim().length > 1 &&
    phoneValid &&
    hasStock &&
    !submitting

  const resetForm = () => {
    setSelectedProductId("")
    setSelectedWarehouseId("")
    setCouponValue("")
    setExpirationDays("30")
    setCustomerName("")
    setCustomerPhone("")
    setSubmitError(null)
  }

  const handleCreateCoupon = async () => {
    if (!canSubmit) return
    setSubmitError(null)
    setSubmitting(true)
    try {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + parseInt(expirationDays))

      const result = await addCoupon({
        productId: selectedProductId,
        warehouseId: selectedWarehouseId,
        amount: parseFloat(couponValue),
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        expiresAt: expiresAt.toISOString(),
      })

      if (!result.success) {
        setSubmitError(
          result.error?.includes("Stock insuficiente") || result.error?.includes("No existe stock")
            ? "No hay stock disponible de este producto en el depósito seleccionado."
            : result.error || "No se pudo emitir el ticket."
        )
        return
      }

      const newest = coupons[0]
      setCreateDialogOpen(false)
      resetForm()
      // Imprimir automáticamente el ticket recién emitido
      const product = products.find(p => p.id === selectedProductId)
      if (newest) printTicket(newest, product)
    } finally {
      setSubmitting(false)
    }
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
    <div className="flex flex-col h-full">
      <Header title="Ticket de Cambio" />

      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por código, producto, cliente o teléfono..."
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

          <Dialog open={createDialogOpen} onOpenChange={(o) => { setCreateDialogOpen(o); if (!o) resetForm() }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Crear Ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Crear Ticket de Cambio</DialogTitle>
                <DialogDescription>
                  Emitir un ticket de cambio descuenta 1 unidad de stock del producto seleccionado.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Cliente</p>
                  <div className="grid gap-1.5">
                    <Label>Nombre y Apellido <span className="text-destructive">*</span></Label>
                    <Input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ej: Juan Pérez"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Teléfono <span className="text-destructive">*</span></Label>
                    <Input
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="Ej: 11-1234-5678"
                    />
                    {customerPhone.length > 0 && !phoneValid && (
                      <p className="text-xs text-destructive">Ingresá un teléfono válido (mínimo 6 dígitos).</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-2 pt-1 border-t border-border">
                  <p className="text-xs font-semibold uppercase text-muted-foreground mt-2">Producto</p>
                  <div className="grid gap-1.5">
                    <Label>Producto <span className="text-destructive">*</span></Label>
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

                  <div className="grid gap-1.5">
                    <Label>Depósito <span className="text-destructive">*</span></Label>
                    <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar depósito" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.filter(w => w.is_active).map(w => (
                          <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedProductId && selectedWarehouseId && (
                      hasStock ? (
                        <p className="text-xs text-muted-foreground">Stock disponible: {stockAvailable}</p>
                      ) : (
                        <p className="text-xs text-destructive">Sin stock disponible de este producto en el depósito seleccionado.</p>
                      )
                    )}
                  </div>

                  <div className="grid gap-1.5">
                    <Label>Valor del Ticket (ARS) <span className="text-destructive">*</span></Label>
                    <Input
                      type="number"
                      min="0"
                      step="100"
                      value={couponValue}
                      onChange={(e) => setCouponValue(e.target.value)}
                      placeholder="Ingrese el valor"
                    />
                  </div>

                  <div className="grid gap-1.5">
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

                {submitError && (
                  <p className="text-sm text-destructive bg-destructive/10 rounded-md p-2">{submitError}</p>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateCoupon} disabled={!canSubmit}>
                  {submitting ? "Emitiendo..." : "Emitir Ticket"}
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
                <p className="text-sm text-muted-foreground">Tickets Activos</p>
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
                <p className="text-sm text-muted-foreground">Tickets Usados</p>
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
                  {formatCurrency(coupons.filter(c => c.status === "active").reduce((sum, c) => sum + (c.value || 0), 0))}
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
                <TableHead>Cliente</TableHead>
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
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No hay tickets para mostrar
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
                        <p className="font-medium">{coupon.customer_name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{coupon.customer_phone || "—"}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{coupon.productName || "—"}</p>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(coupon.value || 0)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(coupon.status)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(coupon.createdAt || coupon.created_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {coupon.expiresAt ? formatDate(coupon.expiresAt) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => printTicket(coupon, products.find(p => p.id === coupon.original_product_id))}
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        {coupon.status === "active" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => useCoupon(coupon.id)}
                          >
                            Marcar Usado
                          </Button>
                        )}
                      </div>
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
