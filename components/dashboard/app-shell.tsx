"use client"

import { usePathname } from "next/navigation"
import { InventoryProvider } from "@/lib/inventory-context"
import { DashboardLayout } from "./dashboard-layout"

const AUTH_ROUTES = ["/login", "/reset-password"]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuthRoute = AUTH_ROUTES.some(r => pathname.startsWith(r))

  if (isAuthRoute) {
    return <>{children}</>
  }

  return (
    <InventoryProvider>
      <DashboardLayout>
        {children}
      </DashboardLayout>
    </InventoryProvider>
  )
}
