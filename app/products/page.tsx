"use client"

import { useState, useMemo } from "react"
import { useInventory } from "@/lib/inventory-context"
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

export default function ProductsPage() {
  const { products, suppliers, categories, brands, warehouses, addProduct, updateProduct, toggleProductStatus, addSupplier, addCategory, addBrand, adjustStock, loading } = useInventory()
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("Todos")
  const [material, setMaterial] = useState("Todos")
  const [stockStatus, setStockStatus] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)
  
  // Form state
  const [formName, setFormName] = useState("")
  const [formCategory, setFormCategory] = useState("")
  const [formBrand, setFormBrand] = useState("")
  const [formMaterial, setFormMaterial] = useState("")
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
    setEditingProduct(null)
  }

  const openCreateDialog = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEditDialog = (product: Product) => {
    setEditingProduct(product)
    setFormName(product.name)
    setFormCategory(product.category)
    setFormBrand(product.brand_id || "")
    setFormMaterial(product.material || "")
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
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formName || !formCategory || !formPrice) {
      console.log("[v0] handleSave validation failed - name:", formName, "category:", formCategory, "price:", formPrice)
      return
    }
    
    console.log("[v0] handleSave starting - saving product:", formName)
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
      let categoryId = formCategory || null
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
      
      if (editingProduct) {
        console.log("[v0] handleSave updating existing product:", editingProduct.id)
        await updateProduct(editingProduct.id, {
          name: formName,
          category: formCategory,
          category_id: categoryId || null,
          brand_id: brandId,
          material: materialValue,
          sell_price: parseFloat(formPrice),
          cost_price: parseFloat(formCostPrice) || 0,
          weight: parseFloat(formWeight) || null,
          min_stock: parseInt(formMinStock) || 5,
          is_active: formActive,
          supplier_id: supplierId,
          factory_code: formFactoryCode || null,
          internal_code: formInternalCode || null,
        })
      } else {
        console.log("[v0] handleSave creating new product")
        const newProduct = await addProduct({
          name: formName,
          sku: generateSKU(formCategory),
          category: formCategory,
          category_id: categoryId || null,
          brand_id: brandId,
          material: materialValue,
          weight: parseFloat(formWeight) || null,
          barcode: generateBarcode(),
          sell_price: parseFloat(formPrice),
          cost_price: parseFloat(formCostPrice) || 0,
          min_stock: parseInt(formMinStock) || 5,
          is_active: formActive,
          supplier_id: supplierId,
          factory_code: formFactoryCode || null,
          internal_code: formInternalCode || null,
        })
        
        console.log("[v0] handleSave product created:", newProduct?.id, newProduct?.name)
        
        // Auto-create stock record in "Shopping" warehouse if product was created successfully
        if (newProduct && warehouses.length > 0) {
          const shoppingWarehouse = warehouses.find(w => w.name === "Shopping") || warehouses[0]
          if (shoppingWarehouse) {
            console.log("[v0] handleSave creating stock record in warehouse:", shoppingWarehouse.name)
            await adjustStock(newProduct.id, shoppingWarehouse.id, 1, "in", "Stock inicial creado automáticamente")
          }
        }
      }

      console.log("[v0] handleSave completed successfully")
      setDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error("[v0] handleSave error:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = (productId: string) => {
    toggleProductStatus(productId)
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

      {/* Create/Edit Product Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
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
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Nombre</Label>
              <Input
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
                  <div className="flex gap-2">
                    <Input
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Nombre de categoría"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowNewCategoryInput(false)
                        setNewCategoryName("")
                      }}
                      className="px-2"
                    >
                      Cancelar
                    </Button>
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
                  <div className="flex gap-2">
                    <Input
                      value={newBrandName}
                      onChange={(e) => setNewBrandName(e.target.value)}
                      placeholder="Nombre de marca"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowNewBrandInput(false)
                        setNewBrandName("")
                      }}
                      className="px-2"
                    >
                      Cancelar
                    </Button>
                  </div>
                )}
              </div>
            </div>
            
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
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!formName || !formCategory || !formPrice || saving}
            >
              {saving ? "Guardando..." : editingProduct ? "Guardar Cambios" : "Crear Producto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
