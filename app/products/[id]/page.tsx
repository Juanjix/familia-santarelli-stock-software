"use client"

import { use, useState, useEffect } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { useInventory } from "@/lib/inventory-context"
import { Header } from "@/components/dashboard/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ArrowLeft,
  Pencil,
  Tag,
  ArrowLeftRight,
  Package,
  Barcode,
  Scale,
  DollarSign,
  Warehouse,
  ArrowDownRight,
  ArrowUpRight,
  Wrench,
  Plus,
  Minus,
  CheckCircle2,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Client-side only relative time to avoid hydration mismatch
function RelativeTime({ date }: { date: string }) {
  const [relativeTime, setRelativeTime] = useState<string>("")
  
  useEffect(() => {
    const dateObj = new Date(date)
    const now = new Date()
    const diffMs = now.getTime() - dateObj.getTime()
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
      }).format(dateObj)
    }
    setRelativeTime(result)
  }, [date])
  
  return <>{relativeTime || "-"}</>
}

const stockStatusConfig = {
  in_stock: { label: "En Stock", className: "bg-green-500/10 text-green-500 border-green-500/20" },
  low_stock: { label: "Stock Bajo", className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
  out_of_stock: { label: "Sin Stock", className: "bg-red-500/10 text-red-500 border-red-500/20" },
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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value)
}

const categories = ["Anillos", "Collares", "Pulseras", "Aros", "Cadenas", "Relojes", "Accesorios"]
const materials = ["Oro", "Plata", "Acero", "Mixto"]
const pricingTypes = ["Fijo", "Base oro", "Base plata", "Base USD", "Por peso", "Personalizado"]

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { getProductById, getStockByWarehouse, movements, warehouses, updateProduct, adjustStock, transferStock } = useInventory()
  
  const product = getProductById(id)
  
  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [adjustType, setAdjustType] = useState<"in" | "out">("in")
  const [success, setSuccess] = useState<string | null>(null)
  
  // Form states
  const [formName, setFormName] = useState("")
  const [formCategory, setFormCategory] = useState("")
  const [formMaterial, setFormMaterial] = useState("")
  const [formPrice, setFormPrice] = useState("")
  const [formWeight, setFormWeight] = useState("")
  const [formPricingType, setFormPricingType] = useState("")
  
  const [quantity, setQuantity] = useState("")
  const [selectedWarehouse, setSelectedWarehouse] = useState("")
  const [fromWarehouse, setFromWarehouse] = useState("")
  const [toWarehouse, setToWarehouse] = useState("")
  const [notes, setNotes] = useState("")

  if (!product) {
    notFound()
  }

  const stockByWarehouse = getStockByWarehouse(id)
  const statusConfig = stockStatusConfig[product.stockStatus]
  const productMovements = movements.filter((m) => m.productId === id).slice(0, 5)

  const openEditDialog = () => {
    setFormName(product.name)
    setFormCategory(product.category)
    setFormMaterial(product.material)
    setFormPrice(String(product.price))
    setFormWeight(String(product.weight))
    setFormPricingType(product.pricingType)
    setEditDialogOpen(true)
  }

  const handleSaveEdit = () => {
    updateProduct(product.id, {
      name: formName,
      category: formCategory,
      material: formMaterial,
      price: parseFloat(formPrice),
      weight: parseFloat(formWeight),
      pricingType: formPricingType,
    })
    setEditDialogOpen(false)
    showSuccess("Producto actualizado correctamente")
  }

  const openAdjustDialog = (type: "in" | "out") => {
    setAdjustType(type)
    setQuantity("")
    setSelectedWarehouse("")
    setNotes("")
    setAdjustDialogOpen(true)
  }

  const handleAdjust = () => {
    if (!selectedWarehouse || !quantity) return
    adjustStock(product.id, selectedWarehouse, parseInt(quantity), adjustType, notes || undefined)
    setAdjustDialogOpen(false)
    showSuccess(`${adjustType === "in" ? "Entrada" : "Salida"} de ${quantity} unidades registrada`)
  }

  const openTransferDialog = () => {
    setQuantity("")
    setFromWarehouse("")
    setToWarehouse("")
    setNotes("")
    setTransferDialogOpen(true)
  }

  const handleTransfer = () => {
    if (!fromWarehouse || !toWarehouse || !quantity) return
    transferStock(product.id, fromWarehouse, toWarehouse, parseInt(quantity), notes || undefined)
    setTransferDialogOpen(false)
    showSuccess(`Transferencia de ${quantity} unidades realizada`)
  }

  const showSuccess = (message: string) => {
    setSuccess(message)
    setTimeout(() => setSuccess(null), 3000)
  }

  return (
    <>
      <Header title={product.name} description={product.sku} />

      <div className="flex-1 overflow-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/products">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a Productos
            </Button>
          </Link>
          
          {success && (
            <div className="flex items-center gap-2 rounded-lg bg-green-500/10 px-4 py-2 text-green-500">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">{success}</span>
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Información Principal */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-medium">Información del Producto</CardTitle>
                <div className="flex items-center gap-2">
                  {!product.isActive && (
                    <Badge variant="outline">Inactivo</Badge>
                  )}
                  <Badge variant="outline" className={cn("font-normal", statusConfig.className)}>
                    {statusConfig.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-secondary p-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Categoría</p>
                        <p className="font-medium">{product.category}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-secondary p-2">
                        <Scale className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Material</p>
                        <p className="font-medium">{product.material}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-secondary p-2">
                        <Scale className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Peso</p>
                        <p className="font-medium">{product.weight} g</p>
                      </div>
                    </div>
                    {product.supplierName && (
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-secondary p-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Proveedor</p>
                          <p className="font-medium">{product.supplierName}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-secondary p-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Tipo de Precio</p>
                        <p className="font-medium">{product.pricingType}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-secondary p-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Precio Base</p>
                        <p className="font-medium">{formatCurrency(product.price)}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-secondary p-2">
                        <Warehouse className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Stock Total</p>
                        <p className="font-medium">{product.totalStock} unidades</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Código de Barras */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Información de Código de Barras</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-secondary p-2">
                      <Barcode className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Código de Barras</p>
                      <p className="font-mono font-medium">{product.barcode}</p>
                    </div>
                  </div>
                  <Separator orientation="vertical" className="h-12" />
                  <div>
                    <p className="text-sm text-muted-foreground">SKU</p>
                    <p className="font-mono font-medium">{product.sku}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stock por Depósito */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Stock por Depósito</CardTitle>
              </CardHeader>
              <CardContent>
                {stockByWarehouse.length > 0 ? (
                  <div className="space-y-4">
                    {stockByWarehouse.map((stock) => (
                      <div key={stock.warehouseId} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg bg-secondary p-2">
                            <Warehouse className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <span className="font-medium">{stock.warehouseName}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="h-2 w-32 rounded-full bg-secondary">
                            <div
                              className="h-2 rounded-full bg-primary"
                              style={{ width: `${Math.min((stock.quantity / Math.max(product.totalStock, 1)) * 100, 100)}%` }}
                            />
                          </div>
                          <span className="w-16 text-right font-mono font-medium">{stock.quantity}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No hay stock disponible en ningún depósito</p>
                )}
              </CardContent>
            </Card>

            {/* Historial de Movimientos */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Historial de Movimientos Recientes</CardTitle>
              </CardHeader>
              <CardContent>
                {productMovements.length > 0 ? (
                  <div className="space-y-4">
                    {productMovements.map((movement) => {
                      const Icon = movementIcons[movement.type]
                      return (
                        <div key={movement.id} className="flex items-center gap-4">
                          <div className={`rounded-lg bg-secondary p-2 ${movementColors[movement.type]}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              {movement.type === "entry" && `+${movement.quantity} unidades ingresaron`}
                              {movement.type === "exit" && `${movement.quantity} unidades salieron`}
                              {movement.type === "transfer" && `${movement.quantity} unidades transferidas`}
                              {movement.type === "adjustment" && `Stock ajustado en ${movement.quantity}`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {movement.fromWarehouse && `Desde: ${movement.fromWarehouse}`}
                              {movement.fromWarehouse && movement.toWarehouse && " - "}
                              {movement.toWarehouse && `Hacia: ${movement.toWarehouse}`}
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
                ) : (
                  <p className="text-sm text-muted-foreground">No hay movimientos recientes para este producto</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Barra Lateral de Acciones Rápidas */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Acciones Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start" onClick={openEditDialog}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar Producto
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => openAdjustDialog("in")}>
                  <Plus className="mr-2 h-4 w-4" />
                  Entrada de Stock
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => openAdjustDialog("out")}>
                  <Minus className="mr-2 h-4 w-4" />
                  Salida de Stock
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={openTransferDialog}>
                  <ArrowLeftRight className="mr-2 h-4 w-4" />
                  Transferir Stock
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href="/labels">
                    <Tag className="mr-2 h-4 w-4" />
                    Imprimir Etiqueta
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Resumen de Precios</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tipo de Precio</span>
                  <Badge variant="secondary">{product.pricingType}</Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Precio Base</span>
                  <span className="font-medium">{formatCurrency(product.price)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Valor del Stock</span>
                  <span className="font-medium">{formatCurrency(product.price * product.totalStock)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Estado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Activo</span>
                  <Badge variant={product.isActive ? "default" : "secondary"}>
                    {product.isActive ? "Sí" : "No"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estado de Stock</span>
                  <Badge variant="outline" className={cn("font-normal", statusConfig.className)}>
                    {statusConfig.label}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Edit Product Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Producto</DialogTitle>
            <DialogDescription>Modifique los datos del producto</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Nombre</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Categoría</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Material</Label>
                <Select value={formMaterial} onValueChange={setFormMaterial}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {materials.map(mat => (
                      <SelectItem key={mat} value={mat}>{mat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Precio (ARS)</Label>
                <Input type="number" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Peso (gr)</Label>
                <Input type="number" value={formWeight} onChange={(e) => setFormWeight(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Tipo de Precio</Label>
              <Select value={formPricingType} onValueChange={setFormPricingType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {pricingTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit}>Guardar Cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Stock Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{adjustType === "in" ? "Entrada de Stock" : "Salida de Stock"}</DialogTitle>
            <DialogDescription>{product.name}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Depósito</Label>
              <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                <SelectTrigger><SelectValue placeholder="Seleccionar depósito" /></SelectTrigger>
                <SelectContent>
                  {warehouses.filter(w => w.isActive).map(warehouse => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Cantidad</Label>
              <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Notas (opcional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Agregar notas..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdjust} disabled={!selectedWarehouse || !quantity}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Stock Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir Stock</DialogTitle>
            <DialogDescription>{product.name}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Desde depósito</Label>
              <Select value={fromWarehouse} onValueChange={setFromWarehouse}>
                <SelectTrigger><SelectValue placeholder="Seleccionar origen" /></SelectTrigger>
                <SelectContent>
                  {warehouses.filter(w => w.isActive).map(warehouse => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Hacia depósito</Label>
              <Select value={toWarehouse} onValueChange={setToWarehouse}>
                <SelectTrigger><SelectValue placeholder="Seleccionar destino" /></SelectTrigger>
                <SelectContent>
                  {warehouses.filter(w => w.isActive && w.id !== fromWarehouse).map(warehouse => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Cantidad</Label>
              <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Notas (opcional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Agregar notas..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleTransfer} disabled={!fromWarehouse || !toWarehouse || !quantity}>Transferir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
