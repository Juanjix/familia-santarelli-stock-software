"use client"

import { useState } from "react"
import { useInventory } from "@/lib/inventory-context"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { 
  Building2, 
  Users, 
  Bell, 
  Database,
  Plus,
  Pencil,
  Warehouse
} from "lucide-react"

export default function SettingsPage() {
  const { warehouses, addWarehouse, updateWarehouse } = useInventory()
  
  const [businessName, setBusinessName] = useState("Familia Santarelli")
  const [lowStockThreshold, setLowStockThreshold] = useState("5")
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  
  const [warehouseDialogOpen, setWarehouseDialogOpen] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<typeof warehouses[0] | null>(null)
  const [warehouseName, setWarehouseName] = useState("")
  const [warehouseDescription, setWarehouseDescription] = useState("")
  const [warehouseActive, setWarehouseActive] = useState(true)

  const handleSaveWarehouse = () => {
    if (!warehouseName) return

    if (editingWarehouse) {
      updateWarehouse(editingWarehouse.id, {
        name: warehouseName,
        description: warehouseDescription,
        isActive: warehouseActive,
      })
    } else {
      addWarehouse({
        name: warehouseName,
        description: warehouseDescription,
        isActive: warehouseActive,
        stockCount: 0,
        totalValue: 0,
      })
    }

    resetWarehouseForm()
    setWarehouseDialogOpen(false)
  }

  const resetWarehouseForm = () => {
    setWarehouseName("")
    setWarehouseDescription("")
    setWarehouseActive(true)
    setEditingWarehouse(null)
  }

  const openEditWarehouse = (warehouse: typeof warehouses[0]) => {
    setEditingWarehouse(warehouse)
    setWarehouseName(warehouse.name)
    setWarehouseDescription(warehouse.description)
    setWarehouseActive(warehouse.isActive)
    setWarehouseDialogOpen(true)
  }

  return (
    <div className="flex flex-col">
      <Header title="Configuración" />
      
      <main className="flex-1 p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Business Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Datos del Negocio
              </CardTitle>
              <CardDescription>
                Información general del negocio
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="businessName">Nombre del Negocio</Label>
                <Input
                  id="businessName"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </div>
              <Button>Guardar Cambios</Button>
            </CardContent>
          </Card>

          {/* Inventory Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Configuración de Inventario
              </CardTitle>
              <CardDescription>
                Parámetros para la gestión del stock
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="lowStock">Umbral de Stock Bajo</Label>
                <Input
                  id="lowStock"
                  type="number"
                  min="1"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Productos con stock menor a este valor se marcarán como "Stock Bajo"
                </p>
              </div>
              <Button>Guardar Cambios</Button>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notificaciones
              </CardTitle>
              <CardDescription>
                Configurar alertas y notificaciones
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Alertas de Stock Bajo</Label>
                  <p className="text-sm text-muted-foreground">
                    Recibir notificaciones cuando un producto tenga stock bajo
                  </p>
                </div>
                <Switch
                  checked={notificationsEnabled}
                  onCheckedChange={setNotificationsEnabled}
                />
              </div>
            </CardContent>
          </Card>

          {/* Warehouses Management */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Warehouse className="h-5 w-5" />
                  Depósitos
                </CardTitle>
                <CardDescription>
                  Administrar ubicaciones de almacenamiento
                </CardDescription>
              </div>
              <Dialog open={warehouseDialogOpen} onOpenChange={(open) => {
                setWarehouseDialogOpen(open)
                if (!open) resetWarehouseForm()
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar Depósito
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingWarehouse ? "Editar Depósito" : "Nuevo Depósito"}
                    </DialogTitle>
                    <DialogDescription>
                      {editingWarehouse 
                        ? "Modifique los datos del depósito"
                        : "Agregue una nueva ubicación de almacenamiento"
                      }
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Nombre</Label>
                      <Input
                        value={warehouseName}
                        onChange={(e) => setWarehouseName(e.target.value)}
                        placeholder="Nombre del depósito"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Descripción</Label>
                      <Textarea
                        value={warehouseDescription}
                        onChange={(e) => setWarehouseDescription(e.target.value)}
                        placeholder="Descripción opcional"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Activo</Label>
                      <Switch
                        checked={warehouseActive}
                        onCheckedChange={setWarehouseActive}
                      />
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => {
                      setWarehouseDialogOpen(false)
                      resetWarehouseForm()
                    }}>
                      Cancelar
                    </Button>
                    <Button onClick={handleSaveWarehouse} disabled={!warehouseName}>
                      {editingWarehouse ? "Guardar Cambios" : "Crear Depósito"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {warehouses.map(warehouse => (
                  <div
                    key={warehouse.id}
                    className="flex items-center justify-between rounded-lg border border-border p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-3 w-3 rounded-full ${warehouse.isActive ? "bg-green-500" : "bg-muted"}`} />
                      <div>
                        <p className="font-medium">{warehouse.name}</p>
                        <p className="text-sm text-muted-foreground">{warehouse.description}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditWarehouse(warehouse)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Users placeholder */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Usuarios
              </CardTitle>
              <CardDescription>
                Gestión de usuarios del sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                La gestión de usuarios estará disponible próximamente.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
