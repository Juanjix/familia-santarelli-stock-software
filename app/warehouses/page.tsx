"use client"

import { useState } from "react"
import { useInventory } from "@/lib/inventory-context"
import { Header } from "@/components/dashboard/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  const { warehouses, addWarehouse, updateWarehouse } = useInventory()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null)
  const [formData, setFormData] = useState({ name: "", description: "" })

  const handleCreateWarehouse = () => {
    if (!formData.name.trim()) return
    
    addWarehouse({
      name: formData.name,
      description: formData.description,
      isActive: true,
      stockCount: 0,
      totalValue: 0,
    })
    
    setFormData({ name: "", description: "" })
    setIsCreateDialogOpen(false)
  }

  const handleEditWarehouse = () => {
    if (!editingWarehouse || !formData.name.trim()) return
    
    updateWarehouse(editingWarehouse.id, {
      name: formData.name,
      description: formData.description,
    })
    setEditingWarehouse(null)
    setFormData({ name: "", description: "" })
  }

  const handleToggleActive = (id: string) => {
    const warehouse = warehouses.find(w => w.id === id)
    if (warehouse) {
      updateWarehouse(id, { isActive: !warehouse.isActive })
    }
  }

  const openEditDialog = (warehouse: Warehouse) => {
    setEditingWarehouse(warehouse)
    setFormData({ name: warehouse.name, description: warehouse.description })
  }

  const totalStock = warehouses.reduce((acc, w) => acc + w.stockCount, 0)
  const totalValue = warehouses.reduce((acc, w) => acc + w.totalValue, 0)
  const activeWarehouses = warehouses.filter((w) => w.isActive).length

  return (
    <>
      <Header
        title="Depósitos"
        description={`${warehouses.length} ubicaciones`}
        action={{
          label: "Agregar Depósito",
          onClick: () => setIsCreateDialogOpen(true),
        }}
      />

      <div className="flex-1 overflow-auto p-6">
        {/* Tarjetas de Resumen */}
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-secondary p-3">
                <WarehouseIcon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ubicaciones Activas</p>
                <p className="text-2xl font-semibold">{activeWarehouses} / {warehouses.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-secondary p-3">
                <Package className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Unidades</p>
                <p className="text-2xl font-semibold">{formatNumber(totalStock)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-secondary p-3">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor Total</p>
                <p className="text-2xl font-semibold">{formatCurrency(totalValue)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Grilla de Depósitos */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {warehouses.map((warehouse) => (
            <Card key={warehouse.id} className={cn("group", !warehouse.isActive && "opacity-60")}>
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-lg font-medium">{warehouse.name}</CardTitle>
                  <p className="text-sm text-muted-foreground line-clamp-1">{warehouse.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={warehouse.isActive ? "default" : "secondary"}>
                    {warehouse.isActive ? "Activo" : "Inactivo"}
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
                        Editar Depósito
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleToggleActive(warehouse.id)}>
                        <Power className="mr-2 h-4 w-4" />
                        {warehouse.isActive ? "Desactivar" : "Activar"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Unidades en Stock</span>
                    <span className="font-mono font-medium">{formatNumber(warehouse.stockCount)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${Math.min((warehouse.stockCount / 6000) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-sm text-muted-foreground">Valor Estimado</span>
                    <span className="font-medium">{formatCurrency(warehouse.totalValue)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Diálogo de Crear */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Depósito</DialogTitle>
            <DialogDescription>
              Agregá una nueva ubicación de almacenamiento para tu inventario.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>Nombre</FieldLabel>
              <Input
                placeholder="ej., Shopping, Galería"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel>Descripción</FieldLabel>
              <Textarea
                placeholder="Breve descripción de esta ubicación"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateWarehouse}>Crear Depósito</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Editar */}
      <Dialog open={!!editingWarehouse} onOpenChange={() => setEditingWarehouse(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Depósito</DialogTitle>
            <DialogDescription>
              Actualizá la información del depósito.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>Nombre</FieldLabel>
              <Input
                placeholder="Nombre del depósito"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel>Descripción</FieldLabel>
              <Textarea
                placeholder="Breve descripción"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingWarehouse(null)}>
              Cancelar
            </Button>
            <Button onClick={handleEditWarehouse}>Guardar Cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
