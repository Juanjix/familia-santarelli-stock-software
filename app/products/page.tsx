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

const categories = ["Anillos", "Collares", "Pulseras", "Aros", "Cadenas", "Relojes", "Accesorios"]
const materials = ["Oro", "Plata", "Acero", "Mixto"]
const pricingTypes = ["Fijo", "Base oro", "Base plata", "Base USD", "Por peso", "Personalizado"]

function generateSKU(category: string): string {
  const prefix = category.substring(0, 3).toUpperCase()
  return `${prefix}-${String(Date.now()).slice(-5)}`
}

function generateBarcode(): string {
  return `78${Math.random().toString().slice(2, 14)}`
}

export default function ProductsPage() {
  const { products, addProduct, updateProduct, toggleProductStatus } = useInventory()
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("Todos")
  const [material, setMaterial] = useState("Todos")
  const [stockStatus, setStockStatus] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  
  // Form state
  const [formName, setFormName] = useState("")
  const [formCategory, setFormCategory] = useState("")
  const [formMaterial, setFormMaterial] = useState("")
  const [formPrice, setFormPrice] = useState("")
  const [formWeight, setFormWeight] = useState("")
  const [formPricingType, setFormPricingType] = useState("")
  const [formActive, setFormActive] = useState(true)

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        search === "" ||
        product.name.toLowerCase().includes(search.toLowerCase()) ||
        product.sku.toLowerCase().includes(search.toLowerCase()) ||
        product.barcode.includes(search)
      
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
    setFormMaterial("")
    setFormPrice("")
    setFormWeight("")
    setFormPricingType("")
    setFormActive(true)
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
    setFormMaterial(product.material)
    setFormPrice(String(product.price))
    setFormWeight(String(product.weight))
    setFormPricingType(product.pricingType)
    setFormActive(product.isActive)
    setDialogOpen(true)
  }

  const handleSave = () => {
    if (!formName || !formCategory || !formMaterial || !formPrice) return

    if (editingProduct) {
      updateProduct(editingProduct.id, {
        name: formName,
        category: formCategory,
        material: formMaterial,
        price: parseFloat(formPrice),
        weight: parseFloat(formWeight) || 0,
        pricingType: formPricingType,
        isActive: formActive,
      })
    } else {
      addProduct({
        name: formName,
        sku: generateSKU(formCategory),
        category: formCategory,
        material: formMaterial,
        weight: parseFloat(formWeight) || 0,
        barcode: generateBarcode(),
        pricingType: formPricingType,
        stockStatus: "out_of_stock",
        isActive: formActive,
        totalStock: 0,
        price: parseFloat(formPrice),
      })
    }

    setDialogOpen(false)
    resetForm()
  }

  const handleToggleStatus = (productId: string) => {
    toggleProductStatus(productId)
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

      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
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
          />

          <ProductsTable 
            products={paginatedProducts} 
            onEdit={openEditDialog}
            onToggleStatus={handleToggleStatus}
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a{" "}
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)} de{" "}
                {filteredProducts.length.toLocaleString("es-AR")} productos
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <div className="flex items-center gap-1">
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
                        className="w-9"
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Siguiente
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
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
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
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
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
                <Input
                  type="number"
                  min="0"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  placeholder="0"
                />
              </div>
              
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
            </div>
            
            <div className="grid gap-2">
              <Label>Tipo de Precio</Label>
              <Select value={formPricingType} onValueChange={setFormPricingType}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {pricingTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              disabled={!formName || !formCategory || !formMaterial || !formPrice}
            >
              {editingProduct ? "Guardar Cambios" : "Crear Producto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
