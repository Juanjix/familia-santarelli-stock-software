"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Pencil, Eye, Tag, ArrowUpDown, Power, PowerOff, ChevronRight } from "lucide-react"
import type { Product } from "@/lib/types"
import { cn } from "@/lib/utils"

interface ProductsTableProps {
  products: Product[]
  onEdit?: (product: Product) => void
  onToggleStatus?: (productId: string) => void
}

const stockStatusConfig = {
  in_stock: { label: "En Stock", className: "bg-green-500/10 text-green-500 border-green-500/20" },
  low_stock: { label: "Stock Bajo", className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
  out_of_stock: { label: "Sin Stock", className: "bg-red-500/10 text-red-500 border-red-500/20" },
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value)
}

export function ProductsTable({ products, onEdit, onToggleStatus }: ProductsTableProps) {
  const [sortField, setSortField] = useState<string>("name")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  const sortedProducts = [...products].sort((a, b) => {
    const aVal = (a as Record<string, unknown>)[sortField]
    const bVal = (b as Record<string, unknown>)[sortField]
    if (aVal === undefined || aVal === null) return 1
    if (bVal === undefined || bVal === null) return -1
    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1
    return 0
  })

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const SortableHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 text-xs font-medium text-muted-foreground hover:text-foreground"
      onClick={() => handleSort(field)}
    >
      {children}
      <ArrowUpDown className="ml-2 h-3 w-3" />
    </Button>
  )

  const ProductActions = ({ product }: { product: Product }) => {
    const isActive = product.is_active !== false
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Acciones</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link href={`/products/${product.id}`}>
              <Eye className="mr-2 h-4 w-4" />
              Ver Detalles
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEdit?.(product)}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar Producto
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/labels">
              <Tag className="mr-2 h-4 w-4" />
              Imprimir Etiqueta
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onToggleStatus?.(product.id)}>
            {isActive ? (
              <>
                <PowerOff className="mr-2 h-4 w-4" />
                Desactivar
              </>
            ) : (
              <>
                <Power className="mr-2 h-4 w-4" />
                Activar
              </>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <>
      {/* Mobile Card View */}
      <div className="space-y-3 md:hidden">
        {sortedProducts.map((product) => {
          const stockStatus = product.stockStatus || (product.total_stock === 0 ? "out_of_stock" : product.total_stock < (product.min_stock || 5) ? "low_stock" : "in_stock")
          const statusConfig = stockStatusConfig[stockStatus]
          const isActive = product.is_active !== false
          const totalStock = product.total_stock || 0
          const price = product.sell_price || product.price || 0
          
          return (
            <Card key={product.id} className={cn(!isActive && "opacity-60")}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/products/${product.id}`} className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-foreground truncate">{product.name}</span>
                      {!isActive && (
                        <Badge variant="outline" className="text-[10px] shrink-0">Inactivo</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mb-3">{product.sku}</p>
                    
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Badge variant="secondary" className="font-normal text-xs">
                        {product.category}
                      </Badge>
                      {product.material && (
                        <Badge variant="outline" className="font-normal text-xs">
                          {product.material}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase">Stock</p>
                          <p className="text-sm font-mono font-medium">{totalStock}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase">Precio</p>
                          <p className="text-sm font-mono">{formatCurrency(price)}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={cn("font-normal text-xs", statusConfig.className)}>
                        {statusConfig.label}
                      </Badge>
                    </div>
                  </Link>
                  
                  <div className="flex items-center gap-1 shrink-0">
                    <ProductActions product={product} />
                    <Link href={`/products/${product.id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
        {sortedProducts.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            No hay productos que coincidan con los filtros
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-lg border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[300px]">
                <SortableHeader field="name">Producto</SortableHeader>
              </TableHead>
              <TableHead>
                <SortableHeader field="sku">SKU</SortableHeader>
              </TableHead>
              <TableHead>
                <SortableHeader field="category">Categoría</SortableHeader>
              </TableHead>
              <TableHead>
                <SortableHeader field="material">Material</SortableHeader>
              </TableHead>
              <TableHead className="text-right">
                <SortableHeader field="sell_price">Precio</SortableHeader>
              </TableHead>
              <TableHead className="text-center">
                <SortableHeader field="stockStatus">Estado</SortableHeader>
              </TableHead>
              <TableHead className="text-right">
                <SortableHeader field="total_stock">Stock</SortableHeader>
              </TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProducts.map((product) => {
              const stockStatus = product.stockStatus || (product.total_stock === 0 ? "out_of_stock" : product.total_stock < (product.min_stock || 5) ? "low_stock" : "in_stock")
              const statusConfig = stockStatusConfig[stockStatus]
              const isActive = product.is_active !== false
              const totalStock = product.total_stock || 0
              const price = product.sell_price || product.price || 0
              
              return (
                <TableRow key={product.id} className={cn("group", !isActive && "opacity-50")}>
                  <TableCell>
                    <Link href={`/products/${product.id}`} className="block">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                            {product.name}
                          </span>
                          {!isActive && (
                            <Badge variant="outline" className="text-xs">Inactivo</Badge>
                          )}
                        </div>
                        {product.barcode && (
                          <span className="text-xs text-muted-foreground font-mono">{product.barcode}</span>
                        )}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{product.sku}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal">
                      {product.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{product.material || "-"}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">{formatCurrency(price)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={cn("font-normal", statusConfig.className)}>
                      {statusConfig.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">{totalStock}</TableCell>
                  <TableCell>
                    <div className="opacity-0 group-hover:opacity-100">
                      <ProductActions product={product} />
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {sortedProducts.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No hay productos que coincidan con los filtros
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
