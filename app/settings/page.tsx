"use client"

import { useState, useMemo } from "react"
import { useInventory } from "@/lib/inventory-context"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Building2,
  Users,
  Bell,
  Database,
  Plus,
  Pencil,
  Trash2,
  Warehouse,
  Tags,
  Tag,
  Truck,
  ChevronUp,
  ChevronDown,
  Hash,
  Type,
} from "lucide-react"
import type { Brand, Category, CategoryAttribute, Supplier, Jeweler, WorkerType, Employee } from "@/lib/types"

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
}

export default function SettingsPage() {
  const {
    warehouses, addWarehouse, updateWarehouse,
    categories, addCategory, updateCategory, deleteCategory,
    categoryAttributes, addCategoryAttribute, updateCategoryAttribute, deleteCategoryAttribute,
    brands, addBrand, updateBrand, deleteBrand,
    suppliers, addSupplier, updateSupplier, deleteSupplier,
    jewelers, addJeweler, updateJeweler, deleteJeweler,
    employees, addEmployee, updateEmployee, deleteEmployee,
    products,
  } = useInventory()

  const [businessName, setBusinessName] = useState("Familia Santarelli")
  const [lowStockThreshold, setLowStockThreshold] = useState("5")
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  // ── Depósitos ──────────────────────────────────────────────────────────────
  const [warehouseDialogOpen, setWarehouseDialogOpen] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<typeof warehouses[0] | null>(null)
  const [warehouseName, setWarehouseName] = useState("")
  const [warehouseDescription, setWarehouseDescription] = useState("")
  const [warehouseActive, setWarehouseActive] = useState(true)

  const handleSaveWarehouse = () => {
    if (!warehouseName) return
    if (editingWarehouse) {
      updateWarehouse(editingWarehouse.id, { name: warehouseName, description: warehouseDescription, isActive: warehouseActive })
    } else {
      addWarehouse({ name: warehouseName, description: warehouseDescription, isActive: warehouseActive, stockCount: 0, totalValue: 0 })
    }
    resetWarehouseForm()
    setWarehouseDialogOpen(false)
  }

  const resetWarehouseForm = () => {
    setWarehouseName(""); setWarehouseDescription(""); setWarehouseActive(true); setEditingWarehouse(null)
  }

  const openEditWarehouse = (warehouse: typeof warehouses[0]) => {
    setEditingWarehouse(warehouse)
    setWarehouseName(warehouse.name)
    setWarehouseDescription(warehouse.description)
    setWarehouseActive(warehouse.isActive)
    setWarehouseDialogOpen(true)
  }

  // ── Categorías ─────────────────────────────────────────────────────────────
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categoryName, setCategoryName] = useState("")
  const [categoryDescription, setCategoryDescription] = useState("")
  const [categoryActive, setCategoryActive] = useState(true)
  const [savingCategory, setSavingCategory] = useState(false)
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null)

  // Atributos del diálogo de edición de categoría
  const [attrFormOpen, setAttrFormOpen] = useState(false)
  const [editingAttr, setEditingAttr] = useState<CategoryAttribute | null>(null)
  const [attrLabel, setAttrLabel] = useState("")
  const [attrKey, setAttrKey] = useState("")
  const [attrKeyManuallyEdited, setAttrKeyManuallyEdited] = useState(false)
  const [attrType, setAttrType] = useState<"text" | "number">("text")
  const [attrPlaceholder, setAttrPlaceholder] = useState("")
  const [savingAttr, setSavingAttr] = useState(false)
  const [deletingAttr, setDeletingAttr] = useState<CategoryAttribute | null>(null)
  const [attrError, setAttrError] = useState<string | null>(null)

  const currentCategoryAttrs = useMemo(() => {
    if (!editingCategory) return []
    return categoryAttributes
      .filter(a => a.category_id === editingCategory.id)
      .sort((a, b) => a.sort_order - b.sort_order)
  }, [categoryAttributes, editingCategory])

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
    setCategoryName(""); setCategoryDescription(""); setCategoryActive(true)
    setEditingCategory(null); resetAttrForm()
  }

  const openEditCategory = (category: Category) => {
    setEditingCategory(category)
    setCategoryName(category.name)
    setCategoryDescription(category.description || "")
    setCategoryActive(category.is_active)
    setAttrFormOpen(false)
    setCategoryDialogOpen(true)
  }

  const handleDeleteCategory = async () => {
    if (!deletingCategory) return
    await deleteCategory(deletingCategory.id)
    setDeletingCategory(null)
  }

  // ── Atributos ──────────────────────────────────────────────────────────────
  const resetAttrForm = () => {
    setAttrFormOpen(false); setEditingAttr(null)
    setAttrLabel(""); setAttrKey(""); setAttrKeyManuallyEdited(false)
    setAttrType("text"); setAttrPlaceholder(""); setAttrError(null)
  }

  const openNewAttr = () => {
    setEditingAttr(null)
    setAttrLabel(""); setAttrKey(""); setAttrKeyManuallyEdited(false)
    setAttrType("text"); setAttrPlaceholder("")
    setAttrFormOpen(true)
  }

  const openEditAttr = (attr: CategoryAttribute) => {
    setEditingAttr(attr)
    setAttrLabel(attr.label)
    setAttrKey(attr.key)
    setAttrKeyManuallyEdited(true)
    setAttrType(attr.input_type)
    setAttrPlaceholder(attr.placeholder || "")
    setAttrFormOpen(true)
  }

  const handleAttrLabelChange = (value: string) => {
    setAttrLabel(value)
    if (!attrKeyManuallyEdited) {
      setAttrKey(slugify(value))
    }
  }

  const handleSaveAttr = async () => {
    if (!attrLabel.trim() || !attrKey.trim() || !editingCategory) return
    setSavingAttr(true)
    setAttrError(null)
    try {
      if (editingAttr) {
        await updateCategoryAttribute(editingAttr.id, {
          label: attrLabel.trim(),
          key: attrKey.trim(),
          input_type: attrType,
          placeholder: attrPlaceholder.trim() || null,
        })
        resetAttrForm()
      } else {
        const maxOrder = currentCategoryAttrs.length > 0
          ? Math.max(...currentCategoryAttrs.map(a => a.sort_order))
          : 0
        const result = await addCategoryAttribute({
          category_id: editingCategory.id,
          label: attrLabel.trim(),
          key: attrKey.trim(),
          input_type: attrType,
          placeholder: attrPlaceholder.trim() || null,
          sort_order: maxOrder + 1,
          is_active: true,
        })
        if (result) {
          resetAttrForm()
        } else {
          setAttrError("No se pudo guardar el atributo. Verificá que la key no esté repetida en esta categoría.")
        }
      }
    } finally {
      setSavingAttr(false)
    }
  }

  const handleDeleteAttr = async () => {
    if (!deletingAttr) return
    await deleteCategoryAttribute(deletingAttr.id)
    setDeletingAttr(null)
  }

  // ── Proveedores ────────────────────────────────────────────────────────────
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [supplierDialogName, setSupplierDialogName] = useState("")
  const [supplierDialogContact, setSupplierDialogContact] = useState("")
  const [supplierDialogActive, setSupplierDialogActive] = useState(true)
  const [savingSupplier, setSavingSupplier] = useState(false)
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null)

  const handleSaveSupplier = async () => {
    if (!supplierDialogName.trim()) return
    setSavingSupplier(true)
    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, {
          name: supplierDialogName.trim(),
          contact: supplierDialogContact.trim() || null,
          is_active: supplierDialogActive,
        })
      } else {
        await addSupplier({
          name: supplierDialogName.trim(),
          contact: supplierDialogContact.trim() || null,
        })
      }
      resetSupplierForm()
      setSupplierDialogOpen(false)
    } finally {
      setSavingSupplier(false)
    }
  }

  const resetSupplierForm = () => {
    setSupplierDialogName(""); setSupplierDialogContact(""); setSupplierDialogActive(true); setEditingSupplier(null)
  }

  const openEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    setSupplierDialogName(supplier.name)
    setSupplierDialogContact(supplier.contact || "")
    setSupplierDialogActive(supplier.is_active)
    setSupplierDialogOpen(true)
  }

  const handleDeleteSupplier = async () => {
    if (!deletingSupplier) return
    await deleteSupplier(deletingSupplier.id)
    setDeletingSupplier(null)
  }

  // ── Especialistas (joyeros y relojeros) ──────────────────────────────────────
  const [jewelerDialogOpen, setJewelerDialogOpen] = useState(false)
  const [editingJeweler, setEditingJeweler] = useState<Jeweler | null>(null)
  const [jewelerDialogName, setJewelerDialogName] = useState("")
  const [jewelerDialogType, setJewelerDialogType] = useState<WorkerType>("jeweler")
  const [jewelerDialogActive, setJewelerDialogActive] = useState(true)
  const [savingJeweler, setSavingJeweler] = useState(false)
  const [deletingJeweler, setDeletingJeweler] = useState<Jeweler | null>(null)

  const handleSaveJeweler = async () => {
    if (!jewelerDialogName.trim()) return
    setSavingJeweler(true)
    try {
      if (editingJeweler) {
        await updateJeweler(editingJeweler.id, { name: jewelerDialogName.trim(), worker_type: jewelerDialogType, is_active: jewelerDialogActive })
      } else {
        await addJeweler(jewelerDialogName.trim(), jewelerDialogType)
      }
      resetJewelerForm()
      setJewelerDialogOpen(false)
    } finally {
      setSavingJeweler(false)
    }
  }

  const resetJewelerForm = () => {
    setJewelerDialogName(""); setJewelerDialogType("jeweler"); setJewelerDialogActive(true); setEditingJeweler(null)
  }

  const openEditJeweler = (j: Jeweler) => {
    setEditingJeweler(j); setJewelerDialogName(j.name); setJewelerDialogType(j.worker_type); setJewelerDialogActive(j.is_active)
    setJewelerDialogOpen(true)
  }

  const handleDeleteJeweler = async () => {
    if (!deletingJeweler) return
    await deleteJeweler(deletingJeweler.id)
    setDeletingJeweler(null)
  }

  // ── Empleados ───────────────────────────────────────────────────────────────
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [employeeDialogName, setEmployeeDialogName] = useState("")
  const [employeeDialogActive, setEmployeeDialogActive] = useState(true)
  const [savingEmployee, setSavingEmployee] = useState(false)
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null)
  const [deleteEmployeeError, setDeleteEmployeeError] = useState<string | null>(null)

  const handleSaveEmployee = async () => {
    if (!employeeDialogName.trim()) return
    setSavingEmployee(true)
    try {
      if (editingEmployee) {
        await updateEmployee(editingEmployee.id, { name: employeeDialogName.trim(), is_active: employeeDialogActive })
      } else {
        await addEmployee(employeeDialogName.trim())
      }
      resetEmployeeForm()
      setEmployeeDialogOpen(false)
    } finally {
      setSavingEmployee(false)
    }
  }

  const resetEmployeeForm = () => {
    setEmployeeDialogName(""); setEmployeeDialogActive(true); setEditingEmployee(null)
  }

  const openEditEmployee = (e: Employee) => {
    setEditingEmployee(e); setEmployeeDialogName(e.name); setEmployeeDialogActive(e.is_active)
    setEmployeeDialogOpen(true)
  }

  const handleDeleteEmployee = async () => {
    if (!deletingEmployee) return
    setDeleteEmployeeError(null)
    const result = await deleteEmployee(deletingEmployee.id)
    if (!result.success) {
      setDeleteEmployeeError(result.error || "No se pudo eliminar el empleado.")
      return
    }
    setDeletingEmployee(null)
  }

  // ── Marcas ─────────────────────────────────────────────────────────────────
  const [brandDialogOpen, setBrandDialogOpen] = useState(false)
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null)
  const [brandDialogName, setBrandDialogName] = useState("")
  const [brandDialogDescription, setBrandDialogDescription] = useState("")
  const [brandDialogActive, setBrandDialogActive] = useState(true)
  const [savingBrand, setSavingBrand] = useState(false)

  const handleSaveBrand = async () => {
    if (!brandDialogName.trim()) return
    setSavingBrand(true)
    try {
      if (editingBrand) {
        await updateBrand(editingBrand.id, {
          name: brandDialogName.trim(),
          description: brandDialogDescription.trim() || null,
          is_active: brandDialogActive,
        })
      } else {
        await addBrand({
          name: brandDialogName.trim(),
          description: brandDialogDescription.trim() || null,
          is_active: true,
        })
      }
      resetBrandForm()
      setBrandDialogOpen(false)
    } finally {
      setSavingBrand(false)
    }
  }

  const resetBrandForm = () => {
    setBrandDialogName(""); setBrandDialogDescription(""); setBrandDialogActive(true); setEditingBrand(null)
  }

  const [deletingBrand, setDeletingBrand] = useState<Brand | null>(null)

  const handleDeleteBrand = async () => {
    if (!deletingBrand) return
    await deleteBrand(deletingBrand.id)
    setDeletingBrand(null)
  }

  const openEditBrand = (brand: Brand) => {
    setEditingBrand(brand)
    setBrandDialogName(brand.name)
    setBrandDialogDescription(brand.description || "")
    setBrandDialogActive(brand.is_active)
    setBrandDialogOpen(true)
  }

  const moveAttr = async (attr: CategoryAttribute, direction: "up" | "down") => {
    const sorted = [...currentCategoryAttrs]
    const idx = sorted.findIndex(a => a.id === attr.id)
    const swapIdx = direction === "up" ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return

    const current = sorted[idx]
    const swap = sorted[swapIdx]
    await Promise.all([
      updateCategoryAttribute(current.id, { sort_order: swap.sort_order }),
      updateCategoryAttribute(swap.id, { sort_order: current.sort_order }),
    ])
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Configuración" />

      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mx-auto max-w-4xl space-y-6">

          {/* Datos del Negocio */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Datos del Negocio
              </CardTitle>
              <CardDescription>Información general del negocio</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="businessName">Nombre del Negocio</Label>
                <Input id="businessName" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
              </div>
              <Button>Guardar Cambios</Button>
            </CardContent>
          </Card>

          {/* Configuración de Inventario */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Configuración de Inventario
              </CardTitle>
              <CardDescription>Parámetros para la gestión del stock</CardDescription>
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

          {/* Notificaciones */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notificaciones
              </CardTitle>
              <CardDescription>Configurar alertas y notificaciones</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Alertas de Stock Bajo</Label>
                  <p className="text-sm text-muted-foreground">
                    Recibir notificaciones cuando un producto tenga stock bajo
                  </p>
                </div>
                <Switch checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} />
              </div>
            </CardContent>
          </Card>

          {/* Depósitos */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Warehouse className="h-5 w-5" />
                  Depósitos
                </CardTitle>
                <CardDescription>Administrar ubicaciones de almacenamiento</CardDescription>
              </div>
              <Dialog open={warehouseDialogOpen} onOpenChange={(open) => { setWarehouseDialogOpen(open); if (!open) resetWarehouseForm() }}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 h-4 w-4" />Agregar Depósito</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingWarehouse ? "Editar Depósito" : "Nuevo Depósito"}</DialogTitle>
                    <DialogDescription>
                      {editingWarehouse ? "Modifique los datos del depósito" : "Agregue una nueva ubicación de almacenamiento"}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Nombre</Label>
                      <Input value={warehouseName} onChange={(e) => setWarehouseName(e.target.value)} placeholder="Nombre del depósito" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Descripción</Label>
                      <Textarea value={warehouseDescription} onChange={(e) => setWarehouseDescription(e.target.value)} placeholder="Descripción opcional" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Activo</Label>
                      <Switch checked={warehouseActive} onCheckedChange={setWarehouseActive} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setWarehouseDialogOpen(false); resetWarehouseForm() }}>Cancelar</Button>
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
                  <div key={warehouse.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div className="flex items-center gap-3">
                      <div className={`h-3 w-3 rounded-full ${warehouse.isActive ? "bg-green-500" : "bg-muted"}`} />
                      <div>
                        <p className="font-medium">{warehouse.name}</p>
                        <p className="text-sm text-muted-foreground">{warehouse.description}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => openEditWarehouse(warehouse)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Categorías */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Tags className="h-5 w-5" />
                  Categorías
                </CardTitle>
                <CardDescription>Administrar categorías y sus atributos específicos</CardDescription>
              </div>
              <Dialog open={categoryDialogOpen} onOpenChange={(open) => {
                setCategoryDialogOpen(open)
                if (!open) resetCategoryForm()
              }}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 h-4 w-4" />Agregar Categoría</Button>
                </DialogTrigger>

                <DialogContent className="max-w-lg flex flex-col max-h-[90dvh]">
                  <DialogHeader className="shrink-0">
                    <DialogTitle>{editingCategory ? `Editar: ${editingCategory.name}` : "Nueva Categoría"}</DialogTitle>
                    <DialogDescription>
                      {editingCategory
                        ? "Modificá los datos y administrá los atributos de esta categoría"
                        : "Completá los datos para crear una nueva categoría"}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="overflow-y-auto flex-1 pr-1">
                    {/* Datos de la categoría */}
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label>Nombre</Label>
                        <Input
                          value={categoryName}
                          onChange={(e) => setCategoryName(e.target.value)}
                          placeholder="Nombre de la categoría"
                          autoFocus
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Descripción</Label>
                        <Textarea
                          value={categoryDescription}
                          onChange={(e) => setCategoryDescription(e.target.value)}
                          placeholder="Descripción opcional"
                          rows={2}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Activa</Label>
                        <Switch checked={categoryActive} onCheckedChange={setCategoryActive} />
                      </div>
                    </div>

                    {/* Atributos — solo disponible al editar una categoría existente */}
                    {editingCategory && (
                      <>
                        <Separator className="my-2" />
                        <div className="py-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold">Atributos específicos</p>
                            {!attrFormOpen && (
                              <Button type="button" variant="outline" size="sm" onClick={openNewAttr}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" />
                                Agregar atributo
                              </Button>
                            )}
                          </div>

                          {/* Lista de atributos existentes */}
                          {currentCategoryAttrs.length > 0 && (
                            <div className="space-y-2">
                              {currentCategoryAttrs.map((attr, idx) => (
                                <div
                                  key={attr.id}
                                  className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
                                >
                                  {/* Reordenar */}
                                  <div className="flex flex-col gap-0.5">
                                    <button
                                      type="button"
                                      onClick={() => moveAttr(attr, "up")}
                                      disabled={idx === 0}
                                      className="text-muted-foreground hover:text-foreground disabled:opacity-20"
                                    >
                                      <ChevronUp className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => moveAttr(attr, "down")}
                                      disabled={idx === currentCategoryAttrs.length - 1}
                                      className="text-muted-foreground hover:text-foreground disabled:opacity-20"
                                    >
                                      <ChevronDown className="h-3 w-3" />
                                    </button>
                                  </div>

                                  {/* Info */}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium leading-none">{attr.label}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      key: <span className="font-mono">{attr.key}</span>
                                    </p>
                                  </div>

                                  {/* Tipo */}
                                  <Badge variant="outline" className="shrink-0 text-xs gap-1">
                                    {attr.input_type === "number"
                                      ? <><Hash className="h-2.5 w-2.5" />Número</>
                                      : <><Type className="h-2.5 w-2.5" />Texto</>
                                    }
                                  </Badge>

                                  {/* Acciones */}
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => openEditAttr(attr)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => setDeletingAttr(attr)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}

                          {currentCategoryAttrs.length === 0 && !attrFormOpen && (
                            <p className="text-sm text-muted-foreground text-center py-2">
                              Sin atributos. Usá "Agregar atributo" para definir campos como Talle, Hilo, Largo, etc.
                            </p>
                          )}

                          {/* Formulario inline de atributo */}
                          {attrFormOpen && (
                            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-3">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                {editingAttr ? "Editar atributo" : "Nuevo atributo"}
                              </p>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="grid gap-1.5">
                                  <Label className="text-xs">Nombre visible</Label>
                                  <Input
                                    value={attrLabel}
                                    onChange={(e) => handleAttrLabelChange(e.target.value)}
                                    placeholder="Ej: Talle"
                                    className="h-8 text-sm"
                                    autoFocus
                                  />
                                </div>
                                <div className="grid gap-1.5">
                                  <Label className="text-xs">Tipo</Label>
                                  <Select value={attrType} onValueChange={(v) => setAttrType(v as "text" | "number")}>
                                    <SelectTrigger className="h-8 text-sm">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="text">Texto libre</SelectItem>
                                      <SelectItem value="number">Número</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="grid gap-1.5">
                                  <Label className="text-xs">
                                    Key interna
                                    <span className="ml-1 font-normal text-muted-foreground">(auto)</span>
                                  </Label>
                                  <Input
                                    value={attrKey}
                                    onChange={(e) => { setAttrKey(e.target.value); setAttrKeyManuallyEdited(true) }}
                                    placeholder="ej: talle"
                                    className="h-8 text-sm font-mono"
                                  />
                                </div>
                                <div className="grid gap-1.5">
                                  <Label className="text-xs">Placeholder</Label>
                                  <Input
                                    value={attrPlaceholder}
                                    onChange={(e) => setAttrPlaceholder(e.target.value)}
                                    placeholder="Ej: 16"
                                    className="h-8 text-sm"
                                  />
                                </div>
                              </div>

                              {attrError && (
                                <p className="text-xs text-destructive rounded-md bg-destructive/10 px-2 py-1.5">
                                  {attrError}
                                </p>
                              )}
                              <div className="flex gap-2 justify-end pt-1">
                                <Button type="button" variant="outline" size="sm" onClick={resetAttrForm}>
                                  Cancelar
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={handleSaveAttr}
                                  disabled={!attrLabel.trim() || !attrKey.trim() || savingAttr}
                                >
                                  {savingAttr ? "Guardando..." : editingAttr ? "Guardar" : "Agregar"}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  <DialogFooter className="shrink-0 pt-2 border-t border-border mt-2">
                    <Button variant="outline" onClick={() => { setCategoryDialogOpen(false); resetCategoryForm() }}>
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
                  const attrCount = categoryAttributes.filter(a => a.category_id === category.id).length
                  return (
                    <div
                      key={category.id}
                      className="flex items-center justify-between rounded-lg border border-border p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-3 w-3 shrink-0 rounded-full ${category.is_active ? "bg-green-500" : "bg-muted"}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{category.name}</p>
                            {attrCount > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {attrCount} atributo{attrCount !== 1 ? "s" : ""}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {productCount === 0 ? "Sin productos" : `${productCount} producto${productCount !== 1 ? "s" : ""}`}
                            {!category.is_active && " · Inactiva"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditCategory(category)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={productCount > 0}
                          title={productCount > 0
                            ? `No se puede eliminar: ${productCount} producto${productCount !== 1 ? "s" : ""} la usan. Desactivala en cambio.`
                            : "Eliminar categoría"}
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

          {/* Marcas */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Marcas
                </CardTitle>
                <CardDescription>Administrar marcas de productos</CardDescription>
              </div>
              <Dialog open={brandDialogOpen} onOpenChange={(open) => { setBrandDialogOpen(open); if (!open) resetBrandForm() }}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 h-4 w-4" />Agregar Marca</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingBrand ? "Editar Marca" : "Nueva Marca"}</DialogTitle>
                    <DialogDescription>
                      {editingBrand ? "Modificá los datos de la marca" : "Completá los datos para crear una nueva marca"}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Nombre</Label>
                      <Input
                        value={brandDialogName}
                        onChange={(e) => setBrandDialogName(e.target.value)}
                        placeholder="Nombre de la marca"
                        autoFocus
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Descripción</Label>
                      <Textarea
                        value={brandDialogDescription}
                        onChange={(e) => setBrandDialogDescription(e.target.value)}
                        placeholder="Descripción opcional"
                        rows={2}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Activa</Label>
                      <Switch checked={brandDialogActive} onCheckedChange={setBrandDialogActive} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setBrandDialogOpen(false); resetBrandForm() }}>Cancelar</Button>
                    <Button onClick={handleSaveBrand} disabled={!brandDialogName.trim() || savingBrand}>
                      {savingBrand ? "Guardando..." : editingBrand ? "Guardar Cambios" : "Crear Marca"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {brands.map(brand => {
                  const productCount = products.filter(p => p.brand_id === brand.id).length
                  return (
                    <div
                      key={brand.id}
                      className="flex items-center justify-between rounded-lg border border-border p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-3 w-3 shrink-0 rounded-full ${brand.is_active ? "bg-green-500" : "bg-muted"}`} />
                        <div>
                          <p className="font-medium">{brand.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {productCount === 0 ? "Sin productos" : `${productCount} producto${productCount !== 1 ? "s" : ""}`}
                            {!brand.is_active && " · Inactiva"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditBrand(brand)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={productCount > 0}
                          title={productCount > 0
                            ? `No se puede eliminar: ${productCount} producto${productCount !== 1 ? "s" : ""} la usan. Desactivala en cambio.`
                            : "Eliminar marca"}
                          onClick={() => setDeletingBrand(brand)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
                {brands.length === 0 && (
                  <p className="text-sm text-muted-foreground">No hay marcas cargadas.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Confirmar eliminar categoría */}
          <AlertDialog open={!!deletingCategory} onOpenChange={(open) => !open && setDeletingCategory(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
                <AlertDialogDescription>
                  Vas a eliminar <strong>{deletingCategory?.name}</strong> y todos sus atributos. Esta acción no se puede deshacer.
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

          {/* Confirmar eliminar marca */}
          <AlertDialog open={!!deletingBrand} onOpenChange={(open) => !open && setDeletingBrand(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar marca?</AlertDialogTitle>
                <AlertDialogDescription>
                  Vas a eliminar <strong>{deletingBrand?.name}</strong>. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleDeleteBrand}
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Proveedores */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Proveedores
                </CardTitle>
                <CardDescription>Administrar proveedores de productos</CardDescription>
              </div>
              <Dialog open={supplierDialogOpen} onOpenChange={(open) => { setSupplierDialogOpen(open); if (!open) resetSupplierForm() }}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 h-4 w-4" />Agregar Proveedor</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingSupplier ? "Editar Proveedor" : "Nuevo Proveedor"}</DialogTitle>
                    <DialogDescription>
                      {editingSupplier ? "Modificá los datos del proveedor" : "Completá los datos para crear un nuevo proveedor"}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Nombre <span className="text-destructive">*</span></Label>
                      <Input
                        value={supplierDialogName}
                        onChange={(e) => setSupplierDialogName(e.target.value)}
                        placeholder="Nombre del proveedor"
                        autoFocus
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Descripción / Contacto <span className="text-xs font-normal text-muted-foreground">(Opcional)</span></Label>
                      <Textarea
                        value={supplierDialogContact}
                        onChange={(e) => setSupplierDialogContact(e.target.value)}
                        placeholder="Ej: contacto@proveedor.com · +54 11 1234-5678"
                        rows={2}
                      />
                    </div>
                    {editingSupplier && (
                      <div className="flex items-center justify-between">
                        <Label>Activo</Label>
                        <Switch checked={supplierDialogActive} onCheckedChange={setSupplierDialogActive} />
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setSupplierDialogOpen(false); resetSupplierForm() }}>Cancelar</Button>
                    <Button onClick={handleSaveSupplier} disabled={!supplierDialogName.trim() || savingSupplier}>
                      {savingSupplier ? "Guardando..." : editingSupplier ? "Guardar Cambios" : "Crear Proveedor"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {suppliers.map(supplier => {
                  const productCount = products.filter(p => p.supplier_id === supplier.id).length
                  return (
                    <div
                      key={supplier.id}
                      className="flex items-center justify-between rounded-lg border border-border p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-3 w-3 shrink-0 rounded-full ${supplier.is_active !== false ? "bg-green-500" : "bg-muted"}`} />
                        <div>
                          <p className="font-medium">{supplier.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {productCount === 0 ? "Sin productos" : `${productCount} producto${productCount !== 1 ? "s" : ""}`}
                            {supplier.contact && ` · ${supplier.contact}`}
                            {supplier.is_active === false && " · Inactivo"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditSupplier(supplier)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={productCount > 0}
                          title={productCount > 0
                            ? `No se puede eliminar: ${productCount} producto${productCount !== 1 ? "s" : ""} lo usan. Desactivalo en cambio.`
                            : "Eliminar proveedor"}
                          onClick={() => setDeletingSupplier(supplier)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
                {suppliers.length === 0 && (
                  <p className="text-sm text-muted-foreground">No hay proveedores cargados.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Confirmar eliminar proveedor */}
          <AlertDialog open={!!deletingSupplier} onOpenChange={(open) => !open && setDeletingSupplier(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar proveedor?</AlertDialogTitle>
                <AlertDialogDescription>
                  Vas a eliminar <strong>{deletingSupplier?.name}</strong>. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleDeleteSupplier}
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Confirmar eliminar atributo */}
          <AlertDialog open={!!deletingAttr} onOpenChange={(open) => !open && setDeletingAttr(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar atributo?</AlertDialogTitle>
                <AlertDialogDescription>
                  Vas a eliminar el atributo <strong>{deletingAttr?.label}</strong>. Los productos que ya tienen este
                  valor guardado lo conservan internamente, pero dejará de mostrarse en formularios y fichas.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleDeleteAttr}
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Especialistas (joyeros y relojeros) */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Especialistas
                  </CardTitle>
                  <CardDescription>Joyeros y relojeros externos para reparaciones</CardDescription>
                </div>
                <Dialog open={jewelerDialogOpen} onOpenChange={(open) => { setJewelerDialogOpen(open); if (!open) resetJewelerForm() }}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={() => resetJewelerForm()}>
                      <Plus className="mr-1.5 h-4 w-4" />
                      Agregar
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                      <DialogTitle>{editingJeweler ? "Editar especialista" : "Nuevo especialista"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-3 py-2">
                      <div className="grid gap-1.5">
                        <Label>Nombre</Label>
                        <Input value={jewelerDialogName} onChange={(e) => setJewelerDialogName(e.target.value)} placeholder="Ej: Carlos Pérez" autoFocus />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Especialidad</Label>
                        <Select value={jewelerDialogType} onValueChange={(v) => setJewelerDialogType(v as WorkerType)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="jeweler">Joyero</SelectItem>
                            <SelectItem value="watchmaker">Relojero</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {editingJeweler && (
                        <div className="flex items-center gap-2">
                          <Switch checked={jewelerDialogActive} onCheckedChange={setJewelerDialogActive} id="jeweler-active" />
                          <Label htmlFor="jeweler-active">Activo</Label>
                        </div>
                      )}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => { setJewelerDialogOpen(false); resetJewelerForm() }}>Cancelar</Button>
                      <Button onClick={handleSaveJeweler} disabled={!jewelerDialogName.trim() || savingJeweler}>
                        {savingJeweler ? "Guardando..." : editingJeweler ? "Guardar" : "Crear"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {jewelers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay especialistas registrados.</p>
              ) : (
                <div className="divide-y divide-border rounded-md border">
                  {jewelers.map((j) => (
                    <div key={j.id} className="flex items-center justify-between px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{j.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {j.worker_type === "watchmaker" ? "Relojero" : "Joyero"}
                        </Badge>
                        {!j.is_active && <Badge variant="secondary" className="text-xs">Inactivo</Badge>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditJeweler(j)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeletingJeweler(j)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Confirmar eliminar especialista */}
          <AlertDialog open={!!deletingJeweler} onOpenChange={(open) => !open && setDeletingJeweler(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar especialista?</AlertDialogTitle>
                <AlertDialogDescription>
                  Vas a eliminar <strong>{deletingJeweler?.name}</strong>. Los sobres asignados a este especialista quedarán sin asignar.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={(e) => { e.preventDefault(); handleDeleteJeweler() }}
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Empleados */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Empleados
                  </CardTitle>
                  <CardDescription>Personal que puede recibir sobres</CardDescription>
                </div>
                <Dialog open={employeeDialogOpen} onOpenChange={(open) => { setEmployeeDialogOpen(open); if (!open) resetEmployeeForm() }}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={() => resetEmployeeForm()}>
                      <Plus className="mr-1.5 h-4 w-4" />
                      Agregar
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                      <DialogTitle>{editingEmployee ? "Editar empleado" : "Nuevo empleado"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-3 py-2">
                      <div className="grid gap-1.5">
                        <Label>Nombre</Label>
                        <Input value={employeeDialogName} onChange={(e) => setEmployeeDialogName(e.target.value)} placeholder="Ej: María García" autoFocus />
                      </div>
                      {editingEmployee && (
                        <div className="flex items-center gap-2">
                          <Switch checked={employeeDialogActive} onCheckedChange={setEmployeeDialogActive} id="employee-active" />
                          <Label htmlFor="employee-active">Activo</Label>
                        </div>
                      )}
                    </div>
                    <DialogFooter>
                      <Button onClick={handleSaveEmployee} disabled={!employeeDialogName.trim() || savingEmployee}>
                        {savingEmployee ? "Guardando..." : "Guardar"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {employees.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay empleados registrados.</p>
              ) : (
                <div className="divide-y divide-border">
                  {employees.map((e) => (
                    <div key={e.id} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${!e.is_active ? "text-muted-foreground line-through" : ""}`}>
                          {e.name}
                        </span>
                        {!e.is_active && <Badge variant="secondary" className="text-xs">Inactivo</Badge>}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditEmployee(e)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                          onClick={() => setDeletingEmployee(e)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Confirmar eliminar empleado */}
          <AlertDialog open={!!deletingEmployee} onOpenChange={(open) => { if (!open) { setDeletingEmployee(null); setDeleteEmployeeError(null) } }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar empleado?</AlertDialogTitle>
                <AlertDialogDescription>
                  Vas a eliminar <strong>{deletingEmployee?.name}</strong>. Los sobres recibidos por este empleado mantendrán el registro histórico.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {deleteEmployeeError && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-md p-2">{deleteEmployeeError}</p>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={(e) => { e.preventDefault(); handleDeleteEmployee() }}
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Usuarios */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Usuarios
              </CardTitle>
              <CardDescription>Gestión de usuarios del sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">La gestión de usuarios estará disponible próximamente.</p>
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  )
}
