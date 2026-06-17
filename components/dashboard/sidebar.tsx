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
  Mail,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"

// Agrupación por frecuencia de uso operativo
const navOperacion = [
  { name: "Panel", href: "/", icon: LayoutDashboard },
  { name: "Escanear", href: "/scan", icon: ScanLine },
  { name: "Productos", href: "/products", icon: Package },
  { name: "Inventario", href: "/inventory", icon: Boxes },
  { name: "Sobres", href: "/sobres", icon: Mail },
  { name: "Ticket de Cambio", href: "/coupons", icon: Ticket },
]

const navGestion = [
  { name: "Movimientos", href: "/movements", icon: ArrowLeftRight },
  { name: "Reportes", href: "/reports", icon: BarChart3 },
]

const navConfiguracion = [
  { name: "Etiquetas", href: "/labels", icon: Tags },
  { name: "Depósitos", href: "/warehouses", icon: Warehouse },
  { name: "Configuración", href: "/settings", icon: Settings },
]

function NavGroup({
  items,
  label,
  pathname,
  collapsed,
}: {
  items: { name: string; href: string; icon: React.ElementType }[]
  label: string
  pathname: string
  collapsed: boolean
}) {
  return (
    <div className="space-y-0.5">
      {!collapsed && (
        <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          {label}
        </p>
      )}
      {items.map((item) => {
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
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem("sidebar-collapsed") === "true"
  })

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(collapsed))
  }, [collapsed])

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-16 items-center border-b border-sidebar-border px-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
            <span className="text-sm font-semibold tracking-tight text-primary-foreground">FS</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">Familia Santarelli</span>
              <span className="text-[11px] text-muted-foreground tracking-wide uppercase">Sistema de Stock</span>
            </div>
          )}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <NavGroup items={navOperacion} label="Operación" pathname={pathname} collapsed={collapsed} />
        <div className="my-2 border-t border-sidebar-border" />
        <NavGroup items={navGestion} label="Gestión" pathname={pathname} collapsed={collapsed} />
        <div className="my-2 border-t border-sidebar-border" />
        <NavGroup items={navConfiguracion} label="Configuración" pathname={pathname} collapsed={collapsed} />
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
