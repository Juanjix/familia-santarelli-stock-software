"use client"

import { useState, useMemo, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useInventory } from "@/lib/inventory-context"
import { cn } from "@/lib/utils"
import { Header } from "@/components/dashboard/header"
import { ProductsTable } from "@/components/products/products-table"
import { ProductsFilters } from "@/components/products/products-filters"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { Product } from "@/lib/types"

const ITEMS_PER_PAGE = 20

const defaultCategories = ["Anillos", "Collares", "Pulseras", "Aros", "Cadenas", "Relojes", "Accesorios"]
const materials = ["Oro", "Plata", "Acero", "Mixto"]

function generateSKU(category: string): string {
  const prefix = category.substring(0, 3).toUpperCase()
  return `${prefix}-${String(Date.now()).slice(-5)}`
}

function generateBarcode(): string {
  return `78${Math.random().toString().slice(2, 14)}`
}

function ProductsPageInner() {
  const { products, suppliers, categories, brands, categoryAttributes, warehouses, addProduct, updateProduct, deleteProduct, toggleProductStatus, addSupplier, addCategory, addBrand, adjustStock, loading } = useInventory()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(() => searchParams.get("q") || "")
  const [category, setCategory] = useState("Todos")
  const [material, setMaterial] = useState("Todos")
  const [stockStatus, setStockStatus] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)

  // Sincronizar búsqueda cuando el param ?q= cambia desde el header global
  useEffect(() => {
    const q = searchParams.get("q") || ""
    setSearch(q)
    setCurrentPage(1)
  }, [searchParams])
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)
  
  // Form state
  const [formName, setFormName] = useState("")
  const [formCategory, setFormCategory] = useState("")
  const [formBrand, setFormBrand] = useState("")
  const [formMaterial, setFormMaterial] = useState("")
  const [formBarcode, setFormBarcode] = useState("")
  const [formPrice, setFormPrice] = useState("")
  const [formCostPrice, setFormCostPrice] = useState("")
  const [formWeight, setFormWeight] = useState("")
  const [formMinStock, setFormMinStock] = useState("5")
  const [formActive, setFormActive] = useState(true)
  const [formSupplierId, setFormSupplierId] = useState("")
  const [formFactoryCode, setFormFactoryCode] = useState("")
  const [formInternalCode, setFormInternalCode] = useState("")
  const [newSupplierName, setNewSupplierName] = useState("")
  const [newCategoryName, setNewCategoryName] = useState("")
  const [newBrandName, setNewBrandName] = useState("")
  const [showNewSupplierInput, setShowNewSupplierInput] = useState(false)
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false)
  const [showNewBrandInput, setShowNewBrandInput] = useState(false)
  // Stock inicial (solo al crear)
  const [formInitialWarehouse, setFormInitialWarehouse] = useState("")
  const [formInitialStock, setFormInitialStock] = useState("")
  // Sticky form values — se recuerdan entre productos consecutivos
  const [stickyCategory, setStickyCategory] = useState("")
  const [stickyBrand, setStickyBrand] = useState("")
  const [stickyMaterial, setStickyMaterial] = useState("")
  const [stickySupplierId, setStickySupplierId] = useState("")
  const [stickyInitialWarehouse, setStickyInitialWarehouse] = useState("")
  // Confirmación al cerrar con datos sin guardar
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false)
  // Atributos dinámicos por categoría (ej. { talle: "16", hilo: "0.8mm", largo: "45cm" })
  const [formAttributes, setFormAttributes] = useState<Record<string, string>>({})
  // Creación inline de categoría/marca — estado de loading + error
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [categoryCreateError, setCategoryCreateError] = useState<string | null>(null)
  const [creatingBrand, setCreatingBrand] = useState(false)
  const [brandCreateError, setBrandCreateError] = useState<string | null>(null)

  // Categoría "efectiva": si el usuario está creando una categoría nueva,
  // usamos el texto ingresado como categoría válida (aunque todavía no exista
  // en la tabla categories — eso se resuelve en handleSave con addCategory).
  const effectiveCategory = showNewCategoryInput && newCategoryName.trim()
    ? newCategoryName.trim()
    : formCategory

  // Atributos específicos de la categoría seleccionada (ej. Talle, Hilo, Largo).
  // Si la categoría es nueva (todavía no existe en la tabla categories), no hay
  // atributos definidos para ella y no se muestra nada extra.
  const activeCategoryAttributes = useMemo(() => {
    if (showNewCategoryInput && newCategoryName.trim()) return []
    const cat = categories.find(c => c.name === formCategory)
    if (!cat) return []
    return categoryAttributes
      .filter(a => a.category_id === cat.id && a.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
  }, [categories, categoryAttributes, formCategory, showNewCategoryInput, newCategoryName])

  const categoryNames = useMemo(() => {
    const catList = categories.length > 0 
      ? categories.filter(c => c.is_active).map(c => c.name)
      : defaultCategories
    return ["Todos", ...catList]
  }, [categories])

  const brandNames = useMemo(() => {
    return brands.filter(b => b.is_active).map(b => b.name).sort()
  }, [brands])

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        search === "" ||
        product.name.toLowerCase().includes(search.toLowerCase()) ||
        product.sku.toLowerCase().includes(search.toLowerCase()) ||
        (product.barcode && product.barcode.includes(search)) ||
        (product.factory_code && product.factory_code.includes(search)) ||
        (product.internal_code && product.internal_code.includes(search))
      
      const matchesCategory = category === "Todos" || product.category === category
      const matchesMaterial = material === "Todos" || product.material === material
      const matchesStatus = stockStatus === "all" || product.stockStatus === stockStatus

      return matchesSearch && matchesCategory && matchesMaterial && matchesStatus
    })
  }, [products, search, category, material, stockStatus])

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const handleClearFilters = () => {
    setSearch("")
    setCategory("Todos")
    setMaterial("Todos")
    setStockStatus("all")
    setCurrentPage(1)
  }

  const resetForm = () => {
    setFormName("")
    setFormCategory("")
    setFormBrand("")
    setFormMaterial("")
    setFormBarcode("")
    setFormPrice("")
    setFormCostPrice("")
    setFormWeight("")
    setFormMinStock("5")
    setFormActive(true)
    setFormSupplierId("")
    setFormFactoryCode("")
    setFormInternalCode("")
    setNewSupplierName("")
    setNewCategoryName("")
    setNewBrandName("")
    setShowNewSupplierInput(false)
    setShowNewCategoryInput(false)
    setShowNewBrandInput(false)
    setFormInitialWarehouse("")
    setFormInitialStock("")
    setFormAttributes({})
    setCategoryCreateError(null)
    setBrandCreateError(null)
    setEditingProduct(null)
  }

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim()
    if (!name || creatingCategory) return
    setCreatingCategory(true)
    setCategoryCreateError(null)
    const result = await addCategory({ name, is_active: true })
    if (result) {
      setFormCategory(result.name)
      setShowNewCategoryInput(false)
      setNewCategoryName("")
    } else {
      setCategoryCreateError("No se pudo crear. ¿Ya existe una categoría con ese nombre?")
    }
    setCreatingCategory(false)
  }

  const handleCreateBrand = async () => {
    const name = newBrandName.trim()
    if (!name || creatingBrand) return
    setCreatingBrand(true)
    setBrandCreateError(null)
    const result = await addBrand({ name, is_active: true })
    if (result) {
      setFormBrand(result.id)
      setShowNewBrandInput(false)
      setNewBrandName("")
    } else {
      setBrandCreateError("No se pudo crear. ¿Ya existe una marca con ese nombre?")
    }
    setCreatingBrand(false)
  }

  const openCreateDialog = () => {
    resetForm()
    setFormCategory(stickyCategory)
    setFormBrand(stickyBrand)
    setFormMaterial(stickyMaterial)
    setFormSupplierId(stickySupplierId)
    setFormInitialWarehouse(stickyInitialWarehouse)
    setDialogOpen(true)
  }

  const openEditDialog = (product: Product) => {
    setEditingProduct(product)
    setFormName(product.name)
    setFormCategory(product.category)
    setFormBrand(product.brand_id || "")
    setFormMaterial(product.material || "")
    setFormBarcode(product.barcode || "")
    setFormPrice(String(product.sell_price || product.price || 0))
    setFormCostPrice(String(product.cost_price || 0))
    setFormWeight(String(product.weight || 0))
    setFormMinStock(String(product.min_stock || 5))
    setFormActive(product.is_active !== false)
    setFormSupplierId(product.supplier_id || "")
    setFormFactoryCode(product.factory_code || "")
    setFormInternalCode(product.internal_code || "")
    setShowNewSupplierInput(false)
    setShowNewCategoryInput(false)
    setShowNewBrandInput(false)
    setNewSupplierName("")
    setNewCategoryName("")
    setNewBrandName("")
    setFormInitialWarehouse("")
    setFormInitialStock("")
    setFormAttributes(product.attributes || {})
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formName || !effectiveCategory || !formPrice) return
    
    setSaving(true)
    try {
      // Handle new supplier creation if needed
      let supplierId = formSupplierId || null
      if (showNewSupplierInput && newSupplierName.trim()) {
        const newSupplier = await addSupplier({ name: newSupplierName.trim() })
        if (newSupplier) {
          supplierId = newSupplier.id
        }
      }
      
      // Handle new category creation if needed
      let categoryId = effectiveCategory || null
      if (showNewCategoryInput && newCategoryName.trim()) {
        const newCategory = await addCategory({ name: newCategoryName.trim() })
        if (newCategory) {
          categoryId = newCategory.id
        }
      } else {
        // Find category ID from existing categories
        const cat = categories.find(c => c.name === formCategory)
        if (cat) categoryId = cat.id
      }
      
      // Handle new brand creation if needed
      let brandId: string | null = formBrand && formBrand !== "none" ? formBrand : null
      if (showNewBrandInput && newBrandName.trim()) {
        const newBrand = await addBrand({ name: newBrandName.trim() })
        if (newBrand) {
          brandId = newBrand.id
        }
      }

      // Handle material - convert "none" to null
      const materialValue = formMaterial && formMaterial !== "none" ? formMaterial : null

      // Solo se guardan los atributos vigentes para la categoría seleccionada,
      // con valores no vacíos (evita basura si el usuario cambió de categoría
      // después de tipear algo).
      const attributesToSave = activeCategoryAttributes.reduce((acc, attr) => {
        const value = (formAttributes[attr.key] || "").trim()
        if (value) acc[attr.key] = value
        return acc
      }, {} as Record<string, string>)

      if (editingProduct) {
        await updateProduct(editingProduct.id, {
          name: formName,
          category: effectiveCategory,
          category_id: categoryId || null,
          brand_id: brandId,
          material: materialValue,
          barcode: formBarcode.trim() || null,
          sell_price: parseFloat(formPrice),
          cost_price: parseFloat(formCostPrice) || 0,
          weight: parseFloat(formWeight) || null,
          min_stock: parseInt(formMinStock) || 5,
          is_active: formActive,
          supplier_id: supplierId,
          factory_code: formFactoryCode || null,
          internal_code: formInternalCode || null,
          attributes: attributesToSave,
        })
      } else {
        const newProduct = await addProduct({
          name: formName,
          sku: generateSKU(effectiveCategory),
          category: effectiveCategory,
          category_id: categoryId || null,
          brand_id: brandId,
          material: materialValue,
          weight: parseFloat(formWeight) || null,
          barcode: formBarcode.trim() || null,
          sell_price: parseFloat(formPrice),
          attributes: attributesToSave,
          cost_price: parseFloat(formCostPrice) || 0,
          min_stock: parseInt(formMinStock) || 5,
          is_active: formActive,
          supplier_id: supplierId,
          factory_code: formFactoryCode || null,
          internal_code: formInternalCode || null,
        })

        // Stock inicial: solo si el usuario eligió depósito y cantidad
        if (newProduct && formInitialWarehouse && formInitialStock && parseInt(formInitialStock) > 0) {
          await adjustStock(newProduct.id, formInitialWarehouse, parseInt(formInitialStock), "in", "Stock inicial")
        }

        // Recordar valores para el próximo producto
        setStickyCategory(effectiveCategory)
        setStickyBrand(formBrand)
        setStickyMaterial(formMaterial)
        setStickySupplierId(formSupplierId)
        setStickyInitialWarehouse(formInitialWarehouse)
      }

      setDialogOpen(false)
      resetForm()
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = (productId: string) => {
    toggleProductStatus(productId)
  }

  const handleDeleteProduct = async () => {
    if (!deletingProduct) return
    setSaving(true)
    try {
      await deleteProduct(deletingProduct.id)
      setDeletingProduct(null)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <>
        <Header
          title="Productos"
          description="Cargando..."
        />
        <div className="flex-1 overflow-auto p-4 md:p-6">
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Card>
              <CardContent className="p-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex gap-4 py-3 border-b last:border-0">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Header
        title="Productos"
        description={`${filteredProducts.length.toLocaleString("es-AR")} productos`}
        action={{
          label: "Agregar Producto",
          onClick: openCreateDialog,
        }}
      />

      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="space-y-4 md:space-y-6">
          <ProductsFilters
            search={search}
            onSearchChange={(value) => {
              setSearch(value)
              setCurrentPage(1)
            }}
            category={category}
            onCategoryChange={(value) => {
              setCategory(value)
              setCurrentPage(1)
            }}
            material={material}
            onMaterialChange={(value) => {
              setMaterial(value)
              setCurrentPage(1)
            }}
            stockStatus={stockStatus}
            onStockStatusChange={(value) => {
              setStockStatus(value)
              setCurrentPage(1)
            }}
            onClearFilters={handleClearFilters}
            categories={categoryNames}
          />

          <ProductsTable 
            products={paginatedProducts} 
            onEdit={openEditDialog}
            onToggleStatus={handleToggleStatus}
            onDelete={setDeletingProduct}
          />

          {totalPages > 1 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground text-center sm:text-left">
                Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a{" "}
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)} de{" "}
                {filteredProducts.length.toLocaleString("es-AR")} productos
              </p>
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-9 px-3"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline ml-1">Anterior</span>
                </Button>
                <div className="hidden sm:flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "ghost"}
                        size="sm"
                        className="w-9 h-9"
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                </div>
                <span className="sm:hidden text-sm text-muted-foreground px-2">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-9 px-3"
                >
                  <span className="hidden sm:inline mr-1">Siguiente</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Product Dialog */}
      <Dialog open={!!deletingProduct} onOpenChange={() => setDeletingProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Producto</DialogTitle>
            <DialogDescription>
              Esta accion no se puede deshacer. Se eliminara permanentemente el producto{" "}
              <strong>{deletingProduct?.name}</strong> y todos sus datos asociados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingProduct(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteProduct} disabled={saving}>
              {saving ? "Eliminando..." : "Eliminar Producto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Product Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        if (!open && (formName || formBarcode || formPrice || newCategoryName.trim())) {
          setConfirmCloseOpen(true)
        } else {
          setDialogOpen(open)
          if (!open) resetForm()
        }
      }}>
        <DialogContent className="max-w-lg flex flex-col max-h-[90dvh] sm:max-h-[85dvh]">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {editingProduct ? "Editar Producto" : "Nuevo Producto"}
            </DialogTitle>
            <DialogDescription>
              {editingProduct
                ? "Modifique los datos del producto"
                : "Complete los datos para crear un nuevo producto"
              }
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 overflow-y-auto flex-1 pr-1">
            <div className="grid gap-2">
              <Label>Nombre</Label>
              <Input
                autoFocus
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Nombre del producto"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Categoría</Label>
                {!showNewCategoryInput ? (
                  <div className="flex gap-2">
                    <Select value={formCategory} onValueChange={setFormCategory}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.length > 0 
                          ? categories.filter(c => c.is_active).map(cat => (
                              <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                            ))
                          : defaultCategories.map(cat => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))
                        }
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowNewCategoryInput(true)}
                      className="px-2"
                    >
                      Nuevo
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <div className="flex gap-1.5">
                      <Input
                        autoFocus
                        value={newCategoryName}
                        onChange={(e) => { setNewCategoryName(e.target.value); setCategoryCreateError(null) }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateCategory() } }}
                        placeholder="Nueva categoría"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => { setShowNewCategoryInput(false); setNewCategoryName(""); setCategoryCreateError(null) }}
                        className="px-2"
                      >
                        ✕
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleCreateCategory}
                        disabled={!newCategoryName.trim() || creatingCategory}
                        className="px-3"
                      >
                        {creatingCategory ? "..." : "Crear"}
                      </Button>
                    </div>
                    {categoryCreateError && (
                      <p className="text-xs text-destructive">{categoryCreateError}</p>
                    )}
                  </div>
                )}
              </div>
              
              <div className="grid gap-2">
                <Label>Marca</Label>
                {!showNewBrandInput ? (
                  <div className="flex gap-2">
                    <Select value={formBrand} onValueChange={setFormBrand}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin marca</SelectItem>
                        {brands.filter(b => b.is_active).map(brand => (
                          <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowNewBrandInput(true)}
                      className="px-2"
                    >
                      Nuevo
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <div className="flex gap-1.5">
                      <Input
                        autoFocus
                        value={newBrandName}
                        onChange={(e) => { setNewBrandName(e.target.value); setBrandCreateError(null) }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateBrand() } }}
                        placeholder="Nueva marca"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => { setShowNewBrandInput(false); setNewBrandName(""); setBrandCreateError(null) }}
                        className="px-2"
                      >
                        ✕
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleCreateBrand}
                        disabled={!newBrandName.trim() || creatingBrand}
                        className="px-3"
                      >
                        {creatingBrand ? "..." : "Crear"}
                      </Button>
                    </div>
                    {brandCreateError && (
                      <p className="text-xs text-destructive">{brandCreateError}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Atributos específicos de la categoría (ej. Talle, Hilo, Largo) */}
            {activeCategoryAttributes.length > 0 && (
              <div className={cn(
                "grid gap-4",
                activeCategoryAttributes.length > 1 ? "grid-cols-2" : "grid-cols-1"
              )}>
                {activeCategoryAttributes.map(attr => (
                  <div key={attr.key} className="grid gap-2">
                    <Label>{attr.label}</Label>
                    <Input
                      type={attr.input_type === "number" ? "number" : "text"}
                      value={formAttributes[attr.key] || ""}
                      onChange={(e) => setFormAttributes(prev => ({ ...prev, [attr.key]: e.target.value }))}
                      placeholder={attr.placeholder || attr.label}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Hint cuando se crea una categoría nueva al vuelo: sus atributos
                se configuran después desde Configuración → Categorías */}
            {showNewCategoryInput && newCategoryName.trim() && (
              <p className="text-xs text-muted-foreground rounded-md bg-muted/40 px-3 py-2">
                Los atributos específicos de <strong>{newCategoryName.trim()}</strong> (Talle, Hilo, etc.) se configuran
                desde <strong>Configuración → Categorías</strong> una vez creada.
              </p>
            )}

            <div className="grid gap-2">
              <Label>Material</Label>
              <Select value={formMaterial} onValueChange={setFormMaterial}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin especificar</SelectItem>
                  {materials.map(mat => (
                    <SelectItem key={mat} value={mat}>{mat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Código de Barras</Label>
              <Input
                value={formBarcode}
                onChange={(e) => setFormBarcode(e.target.value)}
                placeholder="Escanear o ingresar manualmente"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Código de Fábrica</Label>
                <Input
                  value={formFactoryCode}
                  onChange={(e) => setFormFactoryCode(e.target.value)}
                  placeholder="Ej: MFG-12345"
                />
              </div>

              <div className="grid gap-2">
                <Label>Código Interno</Label>
                <Input
                  value={formInternalCode}
                  onChange={(e) => setFormInternalCode(e.target.value)}
                  placeholder="Ej: INT-001"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Precio Venta (ARS)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  placeholder="0"
                />
              </div>
              
              <div className="grid gap-2">
                <Label>Precio Costo (ARS)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formCostPrice}
                  onChange={(e) => setFormCostPrice(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Peso (gr)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formWeight}
                  onChange={(e) => setFormWeight(e.target.value)}
                  placeholder="0"
                />
              </div>
              
              <div className="grid gap-2">
                <Label>Stock Mínimo</Label>
                <Input
                  type="number"
                  min="0"
                  value={formMinStock}
                  onChange={(e) => setFormMinStock(e.target.value)}
                  placeholder="5"
                />
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label>Proveedor</Label>
              {!showNewSupplierInput ? (
                <div className="flex gap-2">
                  <Select value={formSupplierId || "none"} onValueChange={(val) => setFormSupplierId(val === "none" ? "" : val)}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Seleccionar proveedor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin proveedor</SelectItem>
                      {suppliers.map(supplier => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNewSupplierInput(true)}
                  >
                    Nuevo
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={newSupplierName}
                    onChange={(e) => setNewSupplierName(e.target.value)}
                    placeholder="Nombre del proveedor"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowNewSupplierInput(false)
                      setNewSupplierName("")
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Producto Activo</Label>
                <p className="text-xs text-muted-foreground">
                  Los productos inactivos no aparecen en búsquedas
                </p>
              </div>
              <Switch
                checked={formActive}
                onCheckedChange={setFormActive}
              />
            </div>

            {!editingProduct && (
              <div className="grid gap-3 rounded-lg border border-border p-3">
                <p className="text-sm font-medium">Stock inicial (opcional)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Depósito</Label>
                    <Select value={formInitialWarehouse} onValueChange={setFormInitialWarehouse}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.filter(w => w.is_active !== false).map(w => (
                          <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Cantidad</Label>
                    <Input
                      type="number"
                      min="1"
                      value={formInitialStock}
                      onChange={(e) => setFormInitialStock(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter className="shrink-0 pt-2">
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!formName || !effectiveCategory || !formPrice || saving}
            >
              {saving ? "Guardando..." : editingProduct ? "Guardar Cambios" : "Crear Producto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmación al cerrar con datos sin guardar */}
      <AlertDialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Hay datos ingresados que no se guardaron. Si cerrás ahora, se perderán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmCloseOpen(false); setDialogOpen(false); resetForm(); }}>
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default function ProductsPage() {
  return (
    <Suspense>
      <ProductsPageInner />
    </Suspense>
  )
}
