"use client"

import { createContext, useContext, useState, useCallback } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard, Package, Warehouse, Tags, ScanLine,
  ArrowLeftRight, Ticket, BarChart3, Settings, Boxes,
  TruckIcon, Mail, Users, LogOut,
} from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import { getRoleConfig } from "@/lib/role-config"

const navOperacion = [
  { name: "Inicio",           href: "/",         icon: LayoutDashboard, module: "dashboard" },
  { name: "Escanear",         href: "/scan",      icon: ScanLine,        module: "scan" },
  { name: "Productos",        href: "/products",  icon: Package,         module: "products" },
  { name: "Inventario",       href: "/inventory", icon: Boxes,           module: "inventory" },
  { name: "Sobres",           href: "/sobres",    icon: Mail,            module: "sobres" },
  { name: "Ticket de Cambio", href: "/coupons",   icon: Ticket,          module: "coupons" },
]

const navGestion = [
  { name: "Transferencias", href: "/transfers", icon: TruckIcon,      module: "transfers" },
  { name: "Movimientos",    href: "/movements", icon: ArrowLeftRight, module: "movements" },
  { name: "Reportes",       href: "/reports",   icon: BarChart3,      module: "reports" },
]

const navConfiguracion = [
  { name: "Etiquetas",     href: "/labels",         icon: Tags,      module: "labels" },
  { name: "Depósitos",     href: "/warehouses",     icon: Warehouse, module: "warehouses" },
  { name: "Configuración", href: "/settings",       icon: Settings,  module: "settings" },
  { name: "Usuarios",      href: "/settings/users", icon: Users,     module: "users" },
]

interface MobileSidebarContextType {
  isOpen: boolean
  open:   () => void
  close:  () => void
  toggle: () => void
}

const MobileSidebarContext = createContext<MobileSidebarContextType | null>(null)

export function useMobileSidebar() {
  const context = useContext(MobileSidebarContext)
  if (!context) throw new Error("useMobileSidebar must be used within MobileSidebarProvider")
  return context
}

export function MobileSidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const open   = useCallback(() => setIsOpen(true), [])
  const close  = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen(prev => !prev), [])

  return (
    <MobileSidebarContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </MobileSidebarContext.Provider>
  )
}

export function MobileSidebar() {
  const pathname        = usePathname()
  const { isOpen, close } = useMobileSidebar()
  const { user, canView, signOut } = useAuth()

  const dynamicNavOperacion = [
    { ...navOperacion[0], name: getRoleConfig(user?.role?.slug).navLabel },
    ...navOperacion.slice(1),
  ]

  const groups = [
    { label: "Operación",     items: dynamicNavOperacion },
    { label: "Gestión",       items: navGestion       },
    { label: "Configuración", items: navConfiguracion },
  ]

  return (
    <Sheet open={isOpen} onOpenChange={open => !open && close()}>
      <SheetContent side="left" className="w-72 p-0 bg-sidebar flex flex-col">
        <SheetHeader className="border-b border-sidebar-border px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary shrink-0">
              <span className="text-sm font-semibold tracking-tight text-primary-foreground">FS</span>
            </div>
            <div className="flex flex-col">
              <SheetTitle className="text-sm font-semibold tracking-tight text-sidebar-foreground">
                Familia Santarelli
              </SheetTitle>
              <span className="text-[11px] text-muted-foreground tracking-wide uppercase">Sistema de Stock</span>
            </div>
          </div>
        </SheetHeader>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {groups.map((group, gi) => {
            const visible = group.items.filter(i => canView(i.module))
            if (visible.length === 0) return null
            return (
              <div key={group.label}>
                {gi > 0 && <div className="my-2 border-t border-sidebar-border" />}
                <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  {group.label}
                </p>
                {visible.map(item => {
                  const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={close}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      )}
                    >
                      <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-sidebar-primary" : "text-muted-foreground")} />
                      <span>{item.name}</span>
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* Usuario + logout */}
        <div className="border-t border-sidebar-border p-3 space-y-1">
          {user && (
            <div className="px-3 py-2">
              <p className="text-sm font-medium text-sidebar-foreground">{user.display_name}</p>
              <p className="text-xs text-muted-foreground">{user.role.name}</p>
            </div>
          )}
          <Button
            variant="ghost" size="sm"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-sidebar-accent"
            onClick={() => { close(); signOut() }}
          >
            <LogOut className="h-4 w-4" />
            <span className="text-sm">Cerrar sesión</span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
