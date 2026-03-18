"use client"

import { useState, useMemo } from "react"
import { useInventory } from "@/lib/inventory-context"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
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
import { Search, Plus, Minus, ArrowLeftRight, Package } from "lucide-react"

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

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase()) ||
        product.sku.toLowerCase().includes(search.toLowerCase()) ||
        product.barcode.includes(search)
      
      if (warehouseFilter === "all") return matchesSearch
      
      const stockByWarehouse = getStockByWarehouse(product.id)
      return matchesSearch && stockByWarehouse.some(s => s.warehouseId === warehouseFilter && s.quantity > 0)
    })
  }, [products, search, warehouseFilter, getStockByWarehouse])

  const handleAdjust = () => {
    if (!adjustDialog.productId || !selectedWarehouse || !quantity) return
    adjustStock(adjustDialog.productId, selectedWarehouse, parseInt(quantity), adjustDialog.type, notes || undefined)
    setAdjustDialog({ open: false, productId: null, type: "in" })
    resetForm()
  }

  const handleTransfer = () => {
    if (!transferDialog.productId || !fromWarehouse || !toWarehouse || !quantity) return
    transferStock(transferDialog.productId, fromWarehouse, toWarehouse, parseInt(quantity), notes || undefined)
    setTransferDialog({ open: false, productId: null })
    resetForm()
  }

  const resetForm = () => {
    setQuantity("")
    setSelectedWarehouse("")
    setFromWarehouse("")
    setToWarehouse("")
    setNotes("")
  }

  const openAdjustDialog = (productId: string, type: "in" | "out" | "adjustment") => {
    setAdjustDialog({ open: true, productId, type })
  }

  const openTransferDialog = (productId: string) => {
    setTransferDialog({ open: true, productId })
  }

  const selectedProduct = adjustDialog.productId 
    ? products.find(p => p.id === adjustDialog.productId) 
    : transferDialog.productId 
    ? products.find(p => p.id === transferDialog.productId)
    : null

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
            const stockByWarehouse = getStockByWarehouse(product.id)
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
                      {product.totalStock}
                    </Badge>
                  </div>
                  
                  <div className="flex flex-wrap gap-1 mb-3">
                    {stockByWarehouse.map(stock => (
                      <Badge key={stock.warehouseId} variant="outline" className="text-xs">
                        {stock.warehouseName}: {stock.quantity}
                      </Badge>
                    ))}
                    {stockByWarehouse.length === 0 && (
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
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-9"
                      onClick={() => openTransferDialog(product.id)}
                    >
                      <ArrowLeftRight className="h-4 w-4 mr-1" />
                      Mover
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
                const stockByWarehouse = getStockByWarehouse(product.id)
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
                      {product.totalStock}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {stockByWarehouse.map(stock => (
                          <Badge key={stock.warehouseId} variant="outline" className="text-xs">
                            {stock.warehouseName}: {stock.quantity}
                          </Badge>
                        ))}
                        {stockByWarehouse.length === 0 && (
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openTransferDialog(product.id)}
                          title="Transferir"
                        >
                          <ArrowLeftRight className="h-4 w-4" />
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
      <Dialog open={transferDialog.open} onOpenChange={(open) => { setTransferDialog({ ...transferDialog, open }); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transferir Stock</DialogTitle>
            <DialogDescription>
              {selectedProduct?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Desde depósito</Label>
              <Select value={fromWarehouse} onValueChange={setFromWarehouse}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar origen" />
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
              <Label>Hacia depósito</Label>
              <Select value={toWarehouse} onValueChange={setToWarehouse}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar destino" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.filter(w => w.isActive && w.id !== fromWarehouse).map(warehouse => (
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
            <Button variant="outline" onClick={() => { setTransferDialog({ open: false, productId: null }); resetForm(); }} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={handleTransfer} disabled={!fromWarehouse || !toWarehouse || !quantity} className="w-full sm:w-auto">
              Transferir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
