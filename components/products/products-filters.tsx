"use client"

import { Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group"

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
  const hasActiveFilters = search || category !== "Todos" || material !== "Todos" || stockStatus !== "all"

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-3">
        <InputGroup className="w-full max-w-sm">
          <InputGroupAddon>
            <Search className="h-4 w-4 text-muted-foreground" />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Buscar por nombre, SKU, código de barras..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-secondary border-0"
          />
        </InputGroup>

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
      </div>

      <div className="flex items-center gap-2">
        {hasActiveFilters && (
          <Badge variant="secondary" className="font-normal">
            Filtrado
          </Badge>
        )}
      </div>
    </div>
  )
}
