"use client"

import { Sidebar } from "./sidebar"
import { MobileSidebar, MobileSidebarProvider } from "./mobile-sidebar"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <MobileSidebarProvider>
      <div className="flex h-screen overflow-hidden">
        {/* Desktop sidebar - hidden on mobile */}
        <div className="hidden md:block">
          <Sidebar />
        </div>
        
        {/* Mobile sidebar drawer */}
        <MobileSidebar />
        
        <main className="flex flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </MobileSidebarProvider>
  )
}
