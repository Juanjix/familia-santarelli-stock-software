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
} from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"

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
        <SheetHeader className="border-b border-sidebar-border px-6 py-8">
          <div className="flex flex-col items-center text-center">
            {/* Logo grande con background transparente */}
            <Logo 
              href="/" 
              size="lg" 
              className="h-20 w-20"
            />
            
            {/* Textos de marca */}
            <div className="flex flex-col items-center mt-4">
              <SheetTitle className="text-base font-semibold tracking-tight text-sidebar-foreground leading-tight">
                Familia Santarelli
              </SheetTitle>
              <span className="text-[11px] text-muted-foreground tracking-widest uppercase mt-2">
                Sistema de Stock
              </span>
            </div>
          </div>
        </SheetHeader>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => {
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
        </nav>
      </SheetContent>
    </Sheet>
  )
}
