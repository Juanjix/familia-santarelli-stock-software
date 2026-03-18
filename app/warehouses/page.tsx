"use client"

import { useState } from "react"
import { useInventory } from "@/lib/inventory-context"
import { Header } from "@/components/dashboard/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import type { Warehouse } from "@/lib/types"
import { MoreHorizontal, Pencil, Power, Warehouse as WarehouseIcon, Package, DollarSign } from "lucide-react"
import { cn } from "@/lib/utils"

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value)
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-AR").format(value)
}

export default function WarehousesPage() {
  const { warehouses, addWarehouse, updateWarehouse, loading } = useInventory()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null)
  const [formData, setFormData] = useState({ name: "", description: "" })
  const [saving, setSaving] = useState(false)

  const handleCreateWarehouse = async () => {
    if (!formData.name.trim()) return
    
    setSaving(true)
    try {
      await addWarehouse({
        name: formData.name,
        description: formData.description,
        is_active: true,
        stock_count: 0,
        total_value: 0,
      })
      
      setFormData({ name: "", description: "" })
      setIsCreateDialogOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const handleEditWarehouse = async () => {
    if (!editingWarehouse || !formData.name.trim()) return
    
    setSaving(true)
    try {
      await updateWarehouse(editingWarehouse.id, {
        name: formData.name,
        description: formData.description,
      })
      setEditingWarehouse(null)
      setFormData({ name: "", description: "" })
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (id: string) => {
    const warehouse = warehouses.find(w => w.id === id)
    if (warehouse) {
      const isActive = warehouse.is_active !== false
      await updateWarehouse(id, { is_active: !isActive })
    }
  }

  const openEditDialog = (warehouse: Warehouse) => {
    setEditingWarehouse(warehouse)
    setFormData({ name: warehouse.name, description: warehouse.description || "" })
  }

  const totalStock = warehouses.reduce((acc, w) => acc + (w.stock_count || w.stockCount || 0), 0)
  const totalValue = warehouses.reduce((acc, w) => acc + (w.total_value || w.totalValue || 0), 0)
  const activeWarehouses = warehouses.filter((w) => w.is_active !== false).length

  if (loading) {
    return (
      <>
        <Header title="Depositos" description="Cargando..." />
        <div className="flex-1 overflow-auto p-4 md:p-6">
          <div className="mb-4 md:mb-6 grid gap-3 grid-cols-1 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-6 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Header
        title="Depositos"
        description={`${warehouses.length} ubicaciones`}
        action={{
          label: "Agregar Deposito",
          onClick: () => setIsCreateDialogOpen(true),
        }}
      />

      <div className="flex-1 overflow-auto p-4 md:p-6">
        {/* Tarjetas de Resumen */}
        <div className="mb-4 md:mb-6 grid gap-3 grid-cols-1 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-3 md:p-4">
              <div className="rounded-lg bg-secondary p-2 md:p-3 shrink-0">
                <WarehouseIcon className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-xs md:text-sm text-muted-foreground truncate">Ubicaciones</p>
                <p className="text-lg md:text-2xl font-semibold">{activeWarehouses} / {warehouses.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-3 md:p-4">
              <div className="rounded-lg bg-secondary p-2 md:p-3 shrink-0">
                <Package className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-xs md:text-sm text-muted-foreground truncate">Total Unidades</p>
                <p className="text-lg md:text-2xl font-semibold">{formatNumber(totalStock)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-3 md:p-4">
              <div className="rounded-lg bg-secondary p-2 md:p-3 shrink-0">
                <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-xs md:text-sm text-muted-foreground truncate">Valor Total</p>
                <p className="text-lg md:text-2xl font-semibold">{formatCurrency(totalValue)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Grilla de Depositos */}
        <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {warehouses.map((warehouse) => {
            const isActive = warehouse.is_active !== false
            const stockCount = warehouse.stock_count || warehouse.stockCount || 0
            const totalValue = warehouse.total_value || warehouse.totalValue || 0
            const maxStock = Math.max(...warehouses.map(w => w.stock_count || w.stockCount || 1), 1)
            
            return (
              <Card key={warehouse.id} className={cn("group", !isActive && "opacity-60")}>
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-medium">{warehouse.name}</CardTitle>
                    <p className="text-sm text-muted-foreground line-clamp-1">{warehouse.description || "Sin descripcion"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={isActive ? "default" : "secondary"}>
                      {isActive ? "Activo" : "Inactivo"}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => openEditDialog(warehouse)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar Deposito
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleToggleActive(warehouse.id)}>
                          <Power className="mr-2 h-4 w-4" />
                          {isActive ? "Desactivar" : "Activar"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Unidades en Stock</span>
                      <span className="font-mono font-medium">{formatNumber(stockCount)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${Math.min((stockCount / maxStock) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-sm text-muted-foreground">Valor Estimado</span>
                      <span className="font-medium">{formatCurrency(totalValue)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
          
          {warehouses.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              No hay depositos configurados
            </div>
          )}
        </div>
      </div>

      {/* Dialogo de Crear */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Deposito</DialogTitle>
            <DialogDescription>
              Agrega una nueva ubicacion de almacenamiento para tu inventario.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>Nombre</FieldLabel>
              <Input
                placeholder="ej., Shopping, Galeria"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel>Descripcion</FieldLabel>
              <Textarea
                placeholder="Breve descripcion de esta ubicacion"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateWarehouse} disabled={saving || !formData.name.trim()}>
              {saving ? "Creando..." : "Crear Deposito"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogo de Editar */}
      <Dialog open={!!editingWarehouse} onOpenChange={() => setEditingWarehouse(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Deposito</DialogTitle>
            <DialogDescription>
              Actualiza la informacion del deposito.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>Nombre</FieldLabel>
              <Input
                placeholder="Nombre del deposito"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel>Descripcion</FieldLabel>
              <Textarea
                placeholder="Breve descripcion"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingWarehouse(null)}>
              Cancelar
            </Button>
            <Button onClick={handleEditWarehouse} disabled={saving || !formData.name.trim()}>
              {saving ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
