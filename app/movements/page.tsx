"use client"

import { useState, useMemo } from "react"
import { useInventory } from "@/lib/inventory-context"
import { Header } from "@/components/dashboard/header"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, Settings2 } from "lucide-react"

const movementTypeLabels: Record<string, string> = {
  entry: "Entrada",
  exit: "Salida",
  transfer: "Transferencia",
  adjustment: "Ajuste",
}

const movementTypeIcons: Record<string, React.ReactNode> = {
  entry: <ArrowDownCircle className="h-4 w-4 text-green-500" />,
  exit: <ArrowUpCircle className="h-4 w-4 text-red-500" />,
  transfer: <ArrowLeftRight className="h-4 w-4 text-blue-500" />,
  adjustment: <Settings2 className="h-4 w-4 text-yellow-500" />,
}

export default function MovementsPage() {
  const { movements } = useInventory()
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")

  const filteredMovements = useMemo(() => {
    return movements.filter(movement => {
      const matchesSearch = movement.productName.toLowerCase().includes(search.toLowerCase()) ||
        movement.productId.includes(search)
      const matchesType = typeFilter === "all" || movement.type === typeFilter
      return matchesSearch && matchesType
    })
  }, [movements, search, typeFilter])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `hace ${diffMins} min`
    if (diffHours < 24) return `hace ${diffHours} hs`
    if (diffDays < 7) return `hace ${diffDays} días`
    return formatDate(dateString)
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Movimientos" />
      
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-4 md:mb-6 flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por producto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Tipo de movimiento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="entry">Entradas</SelectItem>
              <SelectItem value="exit">Salidas</SelectItem>
              <SelectItem value="transfer">Transferencias</SelectItem>
              <SelectItem value="adjustment">Ajustes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Mobile Card View */}
        <div className="space-y-3 md:hidden">
          {filteredMovements.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No se encontraron movimientos
            </div>
          ) : (
            filteredMovements.map((movement) => (
              <Card key={movement.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      {movementTypeIcons[movement.type]}
                      <Badge
                        variant={
                          movement.type === "entry"
                            ? "default"
                            : movement.type === "exit"
                            ? "destructive"
                            : movement.type === "transfer"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {movementTypeLabels[movement.type]}
                      </Badge>
                    </div>
                    <span className={`font-semibold text-lg ${movement.quantity > 0 ? "text-green-500" : "text-red-500"}`}>
                      {movement.quantity > 0 ? "+" : ""}{movement.quantity}
                    </span>
                  </div>
                  
                  <p className="font-medium text-foreground mb-1">{movement.productName}</p>
                  
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-2">
                    {movement.fromWarehouse && <span>De: {movement.fromWarehouse}</span>}
                    {movement.toWarehouse && <span>A: {movement.toWarehouse}</span>}
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                    <span>{getRelativeTime(movement.date)}</span>
                    <span>{movement.user}</span>
                  </div>
                  
                  {movement.notes && (
                    <p className="text-xs text-muted-foreground mt-2 italic truncate">
                      {movement.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block rounded-lg border border-border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Fecha</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Notas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMovements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No se encontraron movimientos
                  </TableCell>
                </TableRow>
              ) : (
                filteredMovements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{getRelativeTime(movement.date)}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(movement.date)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{movement.productName}</p>
                        <p className="text-xs text-muted-foreground">ID: {movement.productId}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {movementTypeIcons[movement.type]}
                        <Badge
                          variant={
                            movement.type === "entry"
                              ? "default"
                              : movement.type === "exit"
                              ? "destructive"
                              : movement.type === "transfer"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {movementTypeLabels[movement.type]}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-semibold ${movement.quantity > 0 ? "text-green-500" : "text-red-500"}`}>
                        {movement.quantity > 0 ? "+" : ""}{movement.quantity}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {movement.fromWarehouse || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {movement.toWarehouse || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {movement.user}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {movement.notes || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          Mostrando {filteredMovements.length} movimientos
        </div>
      </main>
    </div>
  )
}
