"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Package,
  Warehouse,
  Tags,
  ScanLine,
  ArrowLeftRight,
  Ticket,
  BarChart3,
  Settings,
  ChevronLeft,
  Boxes,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"
import { useState } from "react"

const navigation = [
  { name: "Panel", href: "/", icon: LayoutDashboard },
  { name: "Productos", href: "/products", icon: Package },
  { name: "Inventario", href: "/inventory", icon: Boxes },
  { name: "Depósitos", href: "/warehouses", icon: Warehouse },
  { name: "Etiquetas", href: "/labels", icon: Tags },
  { name: "Escanear", href: "/scan", icon: ScanLine },
  { name: "Movimientos", href: "/movements", icon: ArrowLeftRight },
  { name: "Ticket de Cambio", href: "/coupons", icon: Ticket },
  { name: "Reportes", href: "/reports", icon: BarChart3 },
  { name: "Configuración", href: "/settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-16 items-center justify-center border-b border-sidebar-border px-4 gap-3 md:justify-start">
        <Logo href="/" size="md" className="h-9 w-9" />
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">Familia Santarelli</span>
            <span className="text-[11px] text-muted-foreground tracking-wide uppercase">Sistema de Stock</span>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className={cn(
                "h-4 w-4 shrink-0",
                isActive ? "text-sidebar-primary" : "text-muted-foreground"
              )} />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
          onClick={() => setCollapsed(!collapsed)}
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </Button>
      </div>
    </aside>
  )
}
