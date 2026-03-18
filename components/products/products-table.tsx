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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Pencil, Eye, Tag, ArrowUpDown, Power, PowerOff } from "lucide-react"
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

export function ProductsTable({ products, onEdit, onToggleStatus }: ProductsTableProps) {
  const [sortField, setSortField] = useState<keyof Product>("name")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  const sortedProducts = [...products].sort((a, b) => {
    const aVal = a[sortField]
    const bVal = b[sortField]
    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1
    return 0
  })

  const handleSort = (field: keyof Product) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const SortableHeader = ({ field, children }: { field: keyof Product; children: React.ReactNode }) => (
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

  return (
    <div className="rounded-lg border border-border bg-card">
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
              <SortableHeader field="weight">Peso (g)</SortableHeader>
            </TableHead>
            <TableHead>
              <SortableHeader field="pricingType">Precio</SortableHeader>
            </TableHead>
            <TableHead className="text-center">
              <SortableHeader field="stockStatus">Estado</SortableHeader>
            </TableHead>
            <TableHead className="text-right">
              <SortableHeader field="totalStock">Stock</SortableHeader>
            </TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedProducts.map((product) => {
            const statusConfig = stockStatusConfig[product.stockStatus]
            return (
              <TableRow key={product.id} className={cn("group", !product.isActive && "opacity-50")}>
                <TableCell>
                  <Link href={`/products/${product.id}`} className="block">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                          {product.name}
                        </span>
                        {!product.isActive && (
                          <Badge variant="outline" className="text-xs">Inactivo</Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">{product.barcode}</span>
                    </div>
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">{product.sku}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="font-normal">
                    {product.category}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{product.material}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">{product.weight}</TableCell>
                <TableCell className="text-muted-foreground">{product.pricingType}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className={cn("font-normal", statusConfig.className)}>
                    {statusConfig.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono font-medium">{product.totalStock}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                        <MoreHorizontal className="h-4 w-4" />
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
                        {product.isActive ? (
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
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
