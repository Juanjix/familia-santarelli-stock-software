"use client"

import { Search, X, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { useState } from "react"

const categories = ["Todos", "Anillos", "Collares", "Pulseras", "Aros", "Cadenas", "Relojes", "Accesorios"]
const materials = ["Todos", "Oro", "Plata", "Acero", "Mixto"]
const stockStatuses = [
  { value: "all", label: "Todos los Estados" },
  { value: "in_stock", label: "En Stock" },
  { value: "low_stock", label: "Stock Bajo" },
  { value: "out_of_stock", label: "Sin Stock" },
]

interface ProductsFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  category: string
  onCategoryChange: (value: string) => void
  material: string
  onMaterialChange: (value: string) => void
  stockStatus: string
  onStockStatusChange: (value: string) => void
  onClearFilters: () => void
}

export function ProductsFilters({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  material,
  onMaterialChange,
  stockStatus,
  onStockStatusChange,
  onClearFilters,
}: ProductsFiltersProps) {
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const hasActiveFilters = search || category !== "Todos" || material !== "Todos" || stockStatus !== "all"
  const activeFilterCount = [
    category !== "Todos",
    material !== "Todos",
    stockStatus !== "all",
  ].filter(Boolean).length

  return (
    <div className="space-y-3">
      {/* Search - full width on all screens */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, SKU, código..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 bg-secondary border-0"
          />
        </div>
        
        {/* Mobile filter button */}
        <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0 md:hidden h-10 w-10 relative">
              <Filter className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
              <span className="sr-only">Filtros</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[80vh]">
            <SheetHeader>
              <SheetTitle>Filtros</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select value={category} onValueChange={onCategoryChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Material</Label>
                <Select value={material} onValueChange={onMaterialChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Material" />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.map((mat) => (
                      <SelectItem key={mat} value={mat}>
                        {mat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Estado de Stock</Label>
                <Select value={stockStatus} onValueChange={onStockStatusChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Estado de Stock" />
                  </SelectTrigger>
                  <SelectContent>
                    {stockStatuses.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <SheetFooter className="flex-row gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  onClearFilters()
                  setFilterSheetOpen(false)
                }}
              >
                Limpiar
              </Button>
              <Button 
                className="flex-1"
                onClick={() => setFilterSheetOpen(false)}
              >
                Aplicar
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop filters - hidden on mobile */}
      <div className="hidden md:flex md:flex-wrap md:items-center md:gap-3">
        <Select value={category} onValueChange={onCategoryChange}>
          <SelectTrigger className="w-[140px] bg-secondary border-0">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={material} onValueChange={onMaterialChange}>
          <SelectTrigger className="w-[120px] bg-secondary border-0">
            <SelectValue placeholder="Material" />
          </SelectTrigger>
          <SelectContent>
            {materials.map((mat) => (
              <SelectItem key={mat} value={mat}>
                {mat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={stockStatus} onValueChange={onStockStatusChange}>
          <SelectTrigger className="w-[160px] bg-secondary border-0">
            <SelectValue placeholder="Estado de Stock" />
          </SelectTrigger>
          <SelectContent>
            {stockStatuses.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-muted-foreground">
            <X className="mr-2 h-4 w-4" />
            Limpiar filtros
          </Button>
        )}

        {hasActiveFilters && (
          <Badge variant="secondary" className="font-normal ml-auto">
            Filtrado
          </Badge>
        )}
      </div>
      
      {/* Mobile active filters display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 md:hidden">
          {category !== "Todos" && (
            <Badge variant="secondary" className="gap-1">
              {category}
              <button onClick={() => onCategoryChange("Todos")} className="ml-1 hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {material !== "Todos" && (
            <Badge variant="secondary" className="gap-1">
              {material}
              <button onClick={() => onMaterialChange("Todos")} className="ml-1 hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {stockStatus !== "all" && (
            <Badge variant="secondary" className="gap-1">
              {stockStatuses.find(s => s.value === stockStatus)?.label}
              <button onClick={() => onStockStatusChange("all")} className="ml-1 hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}
