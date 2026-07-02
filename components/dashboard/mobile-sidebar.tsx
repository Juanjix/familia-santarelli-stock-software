"use client"

import { createContext, useContext, useState, useCallback } from "react"
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
  Boxes,
  X,
  TruckIcon,
} from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"

const navOperacion = [
  { name: "Panel", href: "/", icon: LayoutDashboard },
  { name: "Escanear", href: "/scan", icon: ScanLine },
  { name: "Productos", href: "/products", icon: Package },
  { name: "Inventario", href: "/inventory", icon: Boxes },
  { name: "Sobres", href: "/sobres", icon: Boxes },
  { name: "Ticket de Cambio", href: "/coupons", icon: Ticket },
]

const navGestion = [
  { name: "Transferencias", href: "/transfers", icon: TruckIcon },
  { name: "Movimientos", href: "/movements", icon: ArrowLeftRight },
  { name: "Reportes", href: "/reports", icon: BarChart3 },
]

const navConfiguracion = [
  { name: "Etiquetas", href: "/labels", icon: Tags },
  { name: "Depósitos", href: "/warehouses", icon: Warehouse },
  { name: "Configuración", href: "/settings", icon: Settings },
]

interface MobileSidebarContextType {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

const MobileSidebarContext = createContext<MobileSidebarContextType | null>(null)

export function useMobileSidebar() {
  const context = useContext(MobileSidebarContext)
  if (!context) {
    throw new Error("useMobileSidebar must be used within MobileSidebarProvider")
  }
  return context
}

export function MobileSidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])

  return (
    <MobileSidebarContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </MobileSidebarContext.Provider>
  )
}

export function MobileSidebar() {
  const pathname = usePathname()
  const { isOpen, close } = useMobileSidebar()

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent side="left" className="w-72 p-0 bg-sidebar">
        <SheetHeader className="border-b border-sidebar-border px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3" onClick={close}>
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
                <span className="text-sm font-semibold tracking-tight text-primary-foreground">FS</span>
              </div>
              <div className="flex flex-col">
                <SheetTitle className="text-sm font-semibold tracking-tight text-sidebar-foreground">
                  Familia Santarelli
                </SheetTitle>
                <span className="text-[11px] text-muted-foreground tracking-wide uppercase">Sistema de Stock</span>
              </div>
            </Link>
          </div>
        </SheetHeader>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {[
            { label: "Operación", items: navOperacion },
            { label: "Gestión", items: navGestion },
            { label: "Configuración", items: navConfiguracion },
          ].map((group, gi) => (
            <div key={group.label}>
              {gi > 0 && <div className="my-2 border-t border-sidebar-border" />}
              <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {group.label}
              </p>
              {group.items.map((item) => {
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
                    <item.icon className={cn(
                      "h-5 w-5 shrink-0",
                      isActive ? "text-sidebar-primary" : "text-muted-foreground"
                    )} />
                    <span>{item.name}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
