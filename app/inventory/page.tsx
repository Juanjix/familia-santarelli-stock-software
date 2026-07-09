"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useInventory } from "@/lib/inventory-context"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
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
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Search, Plus, Minus, ArrowLeftRight, Package, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react"

export default function InventoryPage() {
  const { products, warehouses, getStockByWarehouse, adjustStock, transferStock } = useInventory()
  const [search, setSearch] = useState("")
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all")
  const [adjustDialog, setAdjustDialog] = useState<{ open: boolean; productId: string | null; type: "in" | "out" | "adjustment" }>({ open: false, productId: null, type: "in" })
  const [transferDialog, setTransferDialog] = useState<{ open: boolean; productId: string | null }>({ open: false, productId: null })
  const [quantity, setQuantity] = useState("")
  const [selectedWarehouse, setSelectedWarehouse] = useState("")
  const [fromWarehouse, setFromWarehouse] = useState("")
  const [toWarehouse, setToWarehouse] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [transferResult, setTransferResult] = useState<"success" | "error" | null>(null)
  const [quantityError, setQuantityError] = useState<string | null>(null)

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase()) ||
        product.sku.toLowerCase().includes(search.toLowerCase()) ||
        (product.barcode || "").includes(search)

      if (warehouseFilter === "all") return matchesSearch

      const stockByWarehouse = getStockByWarehouse(product.id) || []
      return matchesSearch && Array.isArray(stockByWarehouse) && stockByWarehouse.some(s => s.warehouseId === warehouseFilter && s.quantity > 0)
    })
  }, [products, search, warehouseFilter, getStockByWarehouse])

  const handleAdjust = async () => {
    if (!adjustDialog.productId || !selectedWarehouse || !quantity) return
    await adjustStock(adjustDialog.productId, selectedWarehouse, parseInt(quantity), adjustDialog.type, notes || undefined)
    setAdjustDialog({ open: false, productId: null, type: "in" })
    resetForm()
  }

  const handleTransfer = async () => {
    if (!transferDialog.productId || !fromWarehouse || !toWarehouse) return
    const qty = parseInt(quantity)
    if (!qty || qty <= 0) return

    setSaving(true)
    setTransferResult(null)
    const success = await transferStock(transferDialog.productId, fromWarehouse, toWarehouse, qty, notes || undefined)
    setSaving(false)

    if (success) {
      setTransferResult("success")
      setTimeout(() => {
        setTransferDialog({ open: false, productId: null })
        resetForm()
      }, 1800)
    } else {
      setTransferResult("error")
    }
  }

  const resetForm = () => {
    setQuantity("")
    setSelectedWarehouse("")
    setFromWarehouse("")
    setToWarehouse("")
    setNotes("")
    setSaving(false)
    setTransferResult(null)
    setQuantityError(null)
  }

  const openAdjustDialog = (productId: string, type: "in" | "out" | "adjustment") => {
    setAdjustDialog({ open: true, productId, type })
  }

  const openTransferDialog = (productId: string) => {
    resetForm()
    setTransferDialog({ open: true, productId })
  }

  const selectedProduct = adjustDialog.productId
    ? products.find(p => p.id === adjustDialog.productId)
    : transferDialog.productId
    ? products.find(p => p.id === transferDialog.productId)
    : null

  // Transfer dialog derived state
  const transferProduct = transferDialog.productId ? products.find(p => p.id === transferDialog.productId) : null
  const transferProductStock = transferProduct ? getStockByWarehouse(transferProduct.id) || [] : []

  const fromStockEntry = fromWarehouse ? transferProductStock.find(s => s.warehouseId === fromWarehouse) : null
  const fromStockAvailable = fromStockEntry?.quantity ?? 0

  const toStockEntry = toWarehouse ? transferProductStock.find(s => s.warehouseId === toWarehouse) : null
  const toStockCurrent = toStockEntry?.quantity ?? 0

  const parsedQty = parseInt(quantity) || 0
  const isQtyValid = parsedQty > 0 && parsedQty <= fromStockAvailable && !quantity.includes(".")
  const canTransfer = !!fromWarehouse && !!toWarehouse && isQtyValid && !saving && transferResult !== "success"

  const handleQuantityChange = (val: string) => {
    setQuantity(val)
    setQuantityError(null)
    const n = parseInt(val)
    if (val && val.includes(".")) {
      setQuantityError("La cantidad debe ser un número entero.")
    } else if (n <= 0) {
      setQuantityError("La cantidad debe ser mayor a 0.")
    } else if (fromWarehouse && n > fromStockAvailable) {
      setQuantityError(`Stock insuficiente. Disponible en origen: ${fromStockAvailable} unidad${fromStockAvailable !== 1 ? "es" : ""}.`)
    }
  }

  const handleFromWarehouseChange = (val: string) => {
    setFromWarehouse(val)
    setQuantityError(null)
    // Re-validate quantity against new origin stock
    if (quantity) {
      const stock = transferProductStock.find(s => s.warehouseId === val)?.quantity ?? 0
      const n = parseInt(quantity)
      if (n > stock) {
        setQuantityError(`Stock insuficiente. Disponible en origen: ${stock} unidad${stock !== 1 ? "es" : ""}.`)
      }
    }
    // Clear destination if same as new origin
    if (toWarehouse === val) setToWarehouse("")
  }

  const showSummary = fromWarehouse && toWarehouse && isQtyValid

  return (
    <div className="flex flex-col h-full">
      <Header title="Inventario" />

      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-4 md:mb-6 flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, SKU o código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filtrar por depósito" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los depósitos</SelectItem>
              {warehouses.filter(w => w.isActive).map(warehouse => (
                <SelectItem key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Mobile Card View */}
        <div className="space-y-3 md:hidden">
          {filteredProducts.slice(0, 50).map((product) => {
            const stockByWarehouse = getStockByWarehouse(product.id) || []
            return (
              <Card key={product.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.sku}</p>
                    </div>
                    <Badge
                      variant={
                        product.stockStatus === "in_stock"
                          ? "default"
                          : product.stockStatus === "low_stock"
                          ? "secondary"
                          : "destructive"
                      }
                      className="shrink-0"
                    >
                      {product.total_stock ?? 0}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {Array.isArray(stockByWarehouse) && stockByWarehouse.map(stock => (
                      <Badge key={stock.warehouseId} variant="outline" className="text-xs">
                        {stock.warehouseName}: {stock.quantity}
                      </Badge>
                    ))}
                    {(!Array.isArray(stockByWarehouse) || stockByWarehouse.length === 0) && (
                      <span className="text-xs text-muted-foreground">Sin stock asignado</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-9"
                      onClick={() => openAdjustDialog(product.id, "in")}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Entrada
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-9"
                      onClick={() => openAdjustDialog(product.id, "out")}
                    >
                      <Minus className="h-4 w-4 mr-1" />
                      Salida
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 h-9" asChild>
                      <Link href="/transfers">
                        <ArrowLeftRight className="h-4 w-4 mr-1" />
                        Mover
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block rounded-lg border border-border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Producto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Stock Total</TableHead>
                <TableHead>Stock por Depósito</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.slice(0, 50).map((product) => {
                const stockByWarehouse = getStockByWarehouse(product.id) || []
                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.category} - {product.material}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {product.sku}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {product.total_stock ?? 0}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(stockByWarehouse) && stockByWarehouse.map(stock => (
                          <Badge key={stock.warehouseId} variant="outline" className="text-xs">
                            {stock.warehouseName}: {stock.quantity}
                          </Badge>
                        ))}
                        {(!Array.isArray(stockByWarehouse) || stockByWarehouse.length === 0) && (
                          <span className="text-xs text-muted-foreground">Sin stock</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          product.stockStatus === "in_stock"
                            ? "default"
                            : product.stockStatus === "low_stock"
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {product.stockStatus === "in_stock"
                          ? "En stock"
                          : product.stockStatus === "low_stock"
                          ? "Stock bajo"
                          : "Sin stock"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openAdjustDialog(product.id, "in")}
                          title="Entrada de stock"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openAdjustDialog(product.id, "out")}
                          title="Salida de stock"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" title="Transferir" asChild>
                          <Link href="/transfers">
                            <ArrowLeftRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        {filteredProducts.length > 50 && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Mostrando 50 de {filteredProducts.length} productos. Use el buscador para filtrar.
          </p>
        )}
      </main>

      {/* Adjust Stock Dialog */}
      <Dialog open={adjustDialog.open} onOpenChange={(open) => { setAdjustDialog({ ...adjustDialog, open }); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {adjustDialog.type === "in" ? "Entrada de Stock" : adjustDialog.type === "out" ? "Salida de Stock" : "Ajuste de Stock"}
            </DialogTitle>
            <DialogDescription>
              {selectedProduct?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Depósito</Label>
              <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar depósito" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.filter(w => w.isActive).map(warehouse => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Cantidad</Label>
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Ingrese cantidad"
              />
            </div>
            <div className="grid gap-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Agregar notas..."
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { setAdjustDialog({ open: false, productId: null, type: "in" }); resetForm(); }} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={handleAdjust} disabled={!selectedWarehouse || !quantity} className="w-full sm:w-auto">
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={transferDialog.open} onOpenChange={(open) => {
        if (!open) { setTransferDialog({ open: false, productId: null }); resetForm() }
        else setTransferDialog(d => ({ ...d, open }))
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4" />
              Transferir Stock
            </DialogTitle>
            <DialogDescription className="font-medium text-foreground">
              {transferProduct?.name}
            </DialogDescription>
          </DialogHeader>

          {/* Success state */}
          {transferResult === "success" && (
            <div className="flex items-center gap-3 rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Transferencia realizada</p>
                <p className="text-xs mt-0.5 opacity-80">
                  {fromStockAvailable} → {fromStockAvailable - parsedQty} en {warehouses.find(w => w.id === fromWarehouse)?.name} &nbsp;·&nbsp;
                  {toStockCurrent} → {toStockCurrent + parsedQty} en {warehouses.find(w => w.id === toWarehouse)?.name}
                </p>
              </div>
            </div>
          )}

          {/* Error state */}
          {transferResult === "error" && (
            <div className="flex items-center gap-3 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="text-sm">No se pudo realizar la transferencia. Verificá el stock disponible e intentá de nuevo.</p>
            </div>
          )}

          {transferResult !== "success" && (
            <div className="grid gap-4 py-2">
              {/* Origin */}
              <div className="grid gap-2">
                <Label>Desde</Label>
                <Select value={fromWarehouse} onValueChange={handleFromWarehouseChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar origen" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.filter(w => w.isActive).map(warehouse => {
                      const stock = transferProductStock.find(s => s.warehouseId === warehouse.id)?.quantity ?? 0
                      return (
                        <SelectItem key={warehouse.id} value={warehouse.id} disabled={stock === 0}>
                          {warehouse.name}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {stock === 0 ? "(sin stock)" : `(${stock} disponible${stock !== 1 ? "s" : ""})`}
                          </span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                {fromWarehouse && (
                  <p className="text-xs text-muted-foreground">
                    Disponible: <span className="font-semibold text-foreground">{fromStockAvailable} unidad{fromStockAvailable !== 1 ? "es" : ""}</span>
                  </p>
                )}
              </div>

              {/* Destination */}
              <div className="grid gap-2">
                <Label>Hacia</Label>
                <Select value={toWarehouse} onValueChange={setToWarehouse} disabled={!fromWarehouse}>
                  <SelectTrigger>
                    <SelectValue placeholder={fromWarehouse ? "Seleccionar destino" : "Primero elegí el origen"} />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.filter(w => w.isActive && w.id !== fromWarehouse).map(warehouse => {
                      const stock = transferProductStock.find(s => s.warehouseId === warehouse.id)?.quantity ?? 0
                      return (
                        <SelectItem key={warehouse.id} value={warehouse.id}>
                          {warehouse.name}
                          <span className="ml-2 text-xs text-muted-foreground">
                            (actual: {stock})
                          </span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                {toWarehouse && (
                  <p className="text-xs text-muted-foreground">
                    Stock actual: <span className="font-semibold text-foreground">{toStockCurrent} unidad{toStockCurrent !== 1 ? "es" : ""}</span>
                  </p>
                )}
              </div>

              {/* Quantity */}
              <div className="grid gap-2">
                <Label>Cantidad a transferir</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  placeholder={fromWarehouse ? `Máx. ${fromStockAvailable}` : "Ingrese cantidad"}
                  disabled={!fromWarehouse}
                  className={quantityError ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {quantityError && (
                  <p className="text-xs text-destructive">{quantityError}</p>
                )}
              </div>

              {/* Transfer summary */}
              {showSummary && (
                <>
                  <Separator />
                  <div className="rounded-lg bg-muted/50 border border-border px-4 py-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resumen</p>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="flex-1 text-center">
                        <p className="text-xs text-muted-foreground truncate">{warehouses.find(w => w.id === fromWarehouse)?.name}</p>
                        <p className="font-semibold">{fromStockAvailable} <span className="text-xs font-normal text-muted-foreground">→</span> <span className="text-destructive">{fromStockAvailable - parsedQty}</span></p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 text-center">
                        <p className="text-xs text-muted-foreground truncate">{warehouses.find(w => w.id === toWarehouse)?.name}</p>
                        <p className="font-semibold">{toStockCurrent} <span className="text-xs font-normal text-muted-foreground">→</span> <span className="text-green-600 dark:text-green-400">+{parsedQty} = {toStockCurrent + parsedQty}</span></p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Notes */}
              <div className="grid gap-2">
                <Label>Notas <span className="text-xs font-normal text-muted-foreground">(Opcional)</span></Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: Reposición para evento del viernes"
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => { setTransferDialog({ open: false, productId: null }); resetForm() }}
              className="w-full sm:w-auto"
            >
              {transferResult === "success" ? "Cerrar" : "Cancelar"}
            </Button>
            {transferResult !== "success" && (
              <Button
                onClick={handleTransfer}
                disabled={!canTransfer}
                className="w-full sm:w-auto"
              >
                {saving ? "Transfiriendo..." : "Transferir"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
