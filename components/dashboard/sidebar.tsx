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
  TruckIcon,
  Users,
  LogOut,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"

const navOperacion = [
  { name: "Panel",           href: "/",         icon: LayoutDashboard, module: "dashboard" },
  { name: "Escanear",        href: "/scan",      icon: ScanLine,        module: "scan" },
  { name: "Productos",       href: "/products",  icon: Package,         module: "products" },
  { name: "Inventario",      href: "/inventory", icon: Boxes,           module: "inventory" },
  { name: "Sobres",          href: "/sobres",    icon: Mail,            module: "sobres" },
  { name: "Ticket de Cambio",href: "/coupons",   icon: Ticket,          module: "coupons" },
]

const navGestion = [
  { name: "Transferencias", href: "/transfers", icon: TruckIcon,       module: "transfers" },
  { name: "Movimientos",    href: "/movements", icon: ArrowLeftRight,  module: "movements" },
  { name: "Reportes",       href: "/reports",   icon: BarChart3,       module: "reports" },
]

const navConfiguracion = [
  { name: "Etiquetas",     href: "/labels",     icon: Tags,      module: "labels" },
  { name: "Depósitos",     href: "/warehouses", icon: Warehouse, module: "warehouses" },
  { name: "Configuración", href: "/settings",   icon: Settings,  module: "settings" },
]

function NavGroup({
  items,
  label,
  pathname,
  collapsed,
}: {
  items: { name: string; href: string; icon: React.ElementType; module: string }[]
  label: string
  pathname: string
  collapsed: boolean
}) {
  const { canView } = useAuth()
  const visible = items.filter(i => canView(i.module))
  if (visible.length === 0) return null

  return (
    <div className="space-y-0.5">
      {!collapsed && (
        <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          {label}
        </p>
      )}
      {visible.map((item) => {
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
  const pathname  = usePathname()
  const { user, signOut } = useAuth()
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
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-sidebar-border px-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary shrink-0">
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

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <NavGroup items={navOperacion}     label="Operación"     pathname={pathname} collapsed={collapsed} />
        <div className="my-2 border-t border-sidebar-border" />
        <NavGroup items={navGestion}       label="Gestión"       pathname={pathname} collapsed={collapsed} />
        <div className="my-2 border-t border-sidebar-border" />
        <NavGroup items={navConfiguracion} label="Configuración" pathname={pathname} collapsed={collapsed} />
      </nav>

      {/* Usuario + logout */}
      <div className="border-t border-sidebar-border p-2 space-y-1">
        {user && !collapsed && (
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-sidebar-foreground truncate">{user.display_name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{user.role.name}</p>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-sidebar-accent"
          onClick={signOut}
          title="Cerrar sesión"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="text-[13px]">Cerrar sesión</span>}
        </Button>
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
