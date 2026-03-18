"use client"

import { useState, useEffect, useRef } from "react"
import { useInventory } from "@/lib/inventory-context"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { ScanLine, Package, Plus, Minus, ArrowLeftRight, AlertCircle, CheckCircle2 } from "lucide-react"
import type { Product } from "@/lib/types"

export default function ScanPage() {
  const { products, warehouses, getStockByWarehouse, adjustStock, transferStock } = useInventory()
  const [scanInput, setScanInput] = useState("")
  const [foundProduct, setFoundProduct] = useState<Product | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [actionDialog, setActionDialog] = useState<{ 
    open: boolean; 
    type: "in" | "out" | "transfer" | null 
  }>({ open: false, type: null })
  const [quantity, setQuantity] = useState("1")
  const [selectedWarehouse, setSelectedWarehouse] = useState("")
  const [fromWarehouse, setFromWarehouse] = useState("")
  const [toWarehouse, setToWarehouse] = useState("")
  const [notes, setNotes] = useState("")

  // Auto-focus on input
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Clear messages after timeout
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [success])

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault()
    const code = scanInput.trim()
    if (!code) return

    // Search by barcode, SKU, or ID
    const product = products.find(
      p => p.barcode === code || p.sku.toLowerCase() === code.toLowerCase() || p.id === code
    )

    if (product) {
      setFoundProduct(product)
      setError(null)
    } else {
      setFoundProduct(null)
      setError(`No se encontró ningún producto con el código: ${code}`)
    }

    setScanInput("")
    inputRef.current?.focus()
  }

  const resetForm = () => {
    setQuantity("1")
    setSelectedWarehouse("")
    setFromWarehouse("")
    setToWarehouse("")
    setNotes("")
  }

  const handleAction = () => {
    if (!foundProduct) return

    if (actionDialog.type === "transfer") {
      if (!fromWarehouse || !toWarehouse || !quantity) return
      transferStock(foundProduct.id, fromWarehouse, toWarehouse, parseInt(quantity), notes || undefined)
      setSuccess(`Transferencia de ${quantity} unidades realizada correctamente`)
    } else if (actionDialog.type === "in" || actionDialog.type === "out") {
      if (!selectedWarehouse || !quantity) return
      adjustStock(foundProduct.id, selectedWarehouse, parseInt(quantity), actionDialog.type, notes || undefined)
      setSuccess(`${actionDialog.type === "in" ? "Entrada" : "Salida"} de ${quantity} unidades registrada`)
    }

    setActionDialog({ open: false, type: null })
    resetForm()
    
    // Refresh product data
    const updatedProduct = products.find(p => p.id === foundProduct.id)
    if (updatedProduct) setFoundProduct(updatedProduct)
    
    inputRef.current?.focus()
  }

  const stockByWarehouse = foundProduct ? getStockByWarehouse(foundProduct.id) : []

  return (
    <div className="flex flex-col h-full">
      <Header title="Escanear" />
      
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {/* Scan Input */}
        <Card className="mb-4 md:mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <ScanLine className="h-5 w-5" />
              Escanear Producto
            </CardTitle>
            <CardDescription className="text-xs md:text-sm">
              Escanee un código de barras o ingrese el SKU/código manualmente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleScan} className="flex flex-col sm:flex-row gap-3">
              <Input
                ref={inputRef}
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                placeholder="Código de barras o SKU..."
                className="flex-1 text-base md:text-lg h-11 md:h-12"
                autoFocus
              />
              <Button type="submit" size="lg" className="h-11 md:h-12 w-full sm:w-auto">
                Buscar
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Status Messages */}
        {error && (
          <div className="mb-4 md:mb-6 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 md:p-4 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 md:mb-6 flex items-center gap-2 rounded-lg border border-green-500/50 bg-green-500/10 p-3 md:p-4 text-green-500 text-sm">
            <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Product Info */}
        {foundProduct && (
          <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Producto Encontrado
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted">
                    <Package className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{foundProduct.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {foundProduct.category} - {foundProduct.material}
                    </p>
                  </div>
                  <Badge
                    variant={foundProduct.isActive ? "default" : "secondary"}
                  >
                    {foundProduct.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">SKU:</span>
                    <p className="font-mono font-medium">{foundProduct.sku}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Código de Barras:</span>
                    <p className="font-mono font-medium">{foundProduct.barcode}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Precio:</span>
                    <p className="font-medium">
                      {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(foundProduct.price)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Stock Total:</span>
                    <p className="font-medium">{foundProduct.totalStock} unidades</p>
                  </div>
                </div>

                <div>
                  <span className="text-sm text-muted-foreground">Stock por Depósito:</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {stockByWarehouse.length > 0 ? (
                      stockByWarehouse.map(stock => (
                        <Badge key={stock.warehouseId} variant="outline">
                          {stock.warehouseName}: {stock.quantity}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">Sin stock</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Acciones Rápidas</CardTitle>
                <CardDescription>
                  Realice operaciones de inventario sobre este producto
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <Button
                  size="lg"
                  className="h-14 md:h-16 justify-start gap-3 md:gap-4 text-base md:text-lg"
                  variant="outline"
                  onClick={() => setActionDialog({ open: true, type: "in" })}
                >
                  <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg bg-green-500/10 shrink-0">
                    <Plus className="h-4 w-4 md:h-5 md:w-5 text-green-500" />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="font-semibold text-sm md:text-base">Entrada de Stock</p>
                    <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">Registrar ingreso</p>
                  </div>
                </Button>

                <Button
                  size="lg"
                  className="h-14 md:h-16 justify-start gap-3 md:gap-4 text-base md:text-lg"
                  variant="outline"
                  onClick={() => setActionDialog({ open: true, type: "out" })}
                >
                  <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg bg-red-500/10 shrink-0">
                    <Minus className="h-4 w-4 md:h-5 md:w-5 text-red-500" />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="font-semibold text-sm md:text-base">Salida de Stock</p>
                    <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">Registrar venta o egreso</p>
                  </div>
                </Button>

                <Button
                  size="lg"
                  className="h-14 md:h-16 justify-start gap-3 md:gap-4 text-base md:text-lg"
                  variant="outline"
                  onClick={() => setActionDialog({ open: true, type: "transfer" })}
                >
                  <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg bg-blue-500/10 shrink-0">
                    <ArrowLeftRight className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="font-semibold text-sm md:text-base">Transferir</p>
                    <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">Mover entre depósitos</p>
                  </div>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Empty State */}
        {!foundProduct && !error && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
            <ScanLine className="h-16 w-16 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">Esperando escaneo</h3>
            <p className="text-sm text-muted-foreground">
              Escanee un código de barras o ingrese un SKU para comenzar
            </p>
          </div>
        )}
      </main>

      {/* Action Dialog */}
      <Dialog 
        open={actionDialog.open} 
        onOpenChange={(open) => { 
          setActionDialog({ ...actionDialog, open }); 
          if (!open) resetForm(); 
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.type === "in" 
                ? "Entrada de Stock" 
                : actionDialog.type === "out" 
                ? "Salida de Stock" 
                : "Transferir Stock"}
            </DialogTitle>
            <DialogDescription>
              {foundProduct?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {actionDialog.type === "transfer" ? (
              <>
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
              </>
            ) : (
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
            )}
            
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
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => { 
                setActionDialog({ open: false, type: null }); 
                resetForm(); 
              }}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleAction}
              disabled={
                actionDialog.type === "transfer" 
                  ? !fromWarehouse || !toWarehouse || !quantity 
                  : !selectedWarehouse || !quantity
              }
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
