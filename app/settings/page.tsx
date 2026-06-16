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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Building2,
  Users,
  Bell,
  Database,
  Plus,
  Pencil,
  Trash2,
  Warehouse,
  Tags
} from "lucide-react"
import type { Category } from "@/lib/types"

export default function SettingsPage() {
  const { warehouses, addWarehouse, updateWarehouse, categories, addCategory, updateCategory, deleteCategory, products } = useInventory()

  const [businessName, setBusinessName] = useState("Familia Santarelli")
  const [lowStockThreshold, setLowStockThreshold] = useState("5")
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  const [warehouseDialogOpen, setWarehouseDialogOpen] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<typeof warehouses[0] | null>(null)
  const [warehouseName, setWarehouseName] = useState("")
  const [warehouseDescription, setWarehouseDescription] = useState("")
  const [warehouseActive, setWarehouseActive] = useState(true)

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categoryName, setCategoryName] = useState("")
  const [categoryDescription, setCategoryDescription] = useState("")
  const [categoryActive, setCategoryActive] = useState(true)
  const [savingCategory, setSavingCategory] = useState(false)
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null)

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

  const handleSaveCategory = async () => {
    if (!categoryName.trim()) return

    setSavingCategory(true)
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name: categoryName.trim(),
          description: categoryDescription.trim() || null,
          is_active: categoryActive,
        })
      } else {
        await addCategory({
          name: categoryName.trim(),
          description: categoryDescription.trim() || null,
          is_active: categoryActive,
        })
      }

      resetCategoryForm()
      setCategoryDialogOpen(false)
    } finally {
      setSavingCategory(false)
    }
  }

  const resetCategoryForm = () => {
    setCategoryName("")
    setCategoryDescription("")
    setCategoryActive(true)
    setEditingCategory(null)
  }

  const handleDeleteCategory = async () => {
    if (!deletingCategory) return
    await deleteCategory(deletingCategory.id)
    setDeletingCategory(null)
  }

  const openEditCategory = (category: Category) => {
    setEditingCategory(category)
    setCategoryName(category.name)
    setCategoryDescription(category.description || "")
    setCategoryActive(category.is_active)
    setCategoryDialogOpen(true)
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Configuración" />
      
      <main className="flex-1 overflow-auto p-4 md:p-6">
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

          {/* Categories Management */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Tags className="h-5 w-5" />
                  Categorías
                </CardTitle>
                <CardDescription>
                  Administrar categorías de productos
                </CardDescription>
              </div>
              <Dialog open={categoryDialogOpen} onOpenChange={(open) => {
                setCategoryDialogOpen(open)
                if (!open) resetCategoryForm()
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar Categoría
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingCategory ? "Editar Categoría" : "Nueva Categoría"}
                    </DialogTitle>
                    <DialogDescription>
                      {editingCategory
                        ? "Modifique los datos de la categoría"
                        : "Agregue una nueva categoría de productos"
                      }
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Nombre</Label>
                      <Input
                        value={categoryName}
                        onChange={(e) => setCategoryName(e.target.value)}
                        placeholder="Nombre de la categoría"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Descripción</Label>
                      <Textarea
                        value={categoryDescription}
                        onChange={(e) => setCategoryDescription(e.target.value)}
                        placeholder="Descripción opcional"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Activa</Label>
                      <Switch
                        checked={categoryActive}
                        onCheckedChange={setCategoryActive}
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => {
                      setCategoryDialogOpen(false)
                      resetCategoryForm()
                    }}>
                      Cancelar
                    </Button>
                    <Button onClick={handleSaveCategory} disabled={!categoryName.trim() || savingCategory}>
                      {savingCategory ? "Guardando..." : editingCategory ? "Guardar Cambios" : "Crear Categoría"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {categories.map(category => {
                  const productCount = products.filter(
                    p => p.category_id === category.id || p.category === category.name
                  ).length
                  return (
                    <div
                      key={category.id}
                      className="flex items-center justify-between rounded-lg border border-border p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-3 w-3 rounded-full ${category.is_active ? "bg-green-500" : "bg-muted"}`} />
                        <div>
                          <p className="font-medium">{category.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {category.description
                              ? `${category.description} · `
                              : ""}
                            {productCount === 0
                              ? "Sin productos"
                              : `${productCount} producto${productCount !== 1 ? "s" : ""}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditCategory(category)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={productCount > 0}
                          title={productCount > 0 ? `No se puede eliminar: ${productCount} producto${productCount !== 1 ? "s" : ""} la usan. Desactivala en cambio.` : "Eliminar categoría"}
                          onClick={() => setDeletingCategory(category)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
                {categories.length === 0 && (
                  <p className="text-sm text-muted-foreground">No hay categorías cargadas.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Delete category confirmation */}
          <AlertDialog open={!!deletingCategory} onOpenChange={(open) => !open && setDeletingCategory(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
                <AlertDialogDescription>
                  Vas a eliminar la categoría <strong>{deletingCategory?.name}</strong>. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleDeleteCategory}
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

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
