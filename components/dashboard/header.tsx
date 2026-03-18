"use client"

import { Search, Plus, Bell, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group"
import { ThemeToggle } from "./theme-toggle"
import { useMobileSidebar } from "./mobile-sidebar"

interface HeaderProps {
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function Header({ title, description, action }: HeaderProps) {
  const { open } = useMobileSidebar()
  
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 md:px-6 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile menu button */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-9 w-9 shrink-0 md:hidden" 
          onClick={open}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Abrir menú</span>
        </Button>
        
        <div className="flex flex-col min-w-0">
          <h1 className="text-base font-semibold tracking-tight text-foreground truncate">{title}</h1>
          {description && <p className="text-xs text-muted-foreground truncate hidden sm:block">{description}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        {/* Search - hidden on mobile, visible on tablet+ */}
        <InputGroup className="hidden lg:flex w-72">
          <InputGroupAddon>
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
          </InputGroupAddon>
          <InputGroupInput 
            placeholder="Buscar productos, SKU..." 
            className="h-8 bg-muted/50 border-0 text-sm focus:bg-muted" 
          />
        </InputGroup>

        <div className="flex items-center gap-0.5">
          {/* Search icon on mobile */}
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground lg:hidden">
            <Search className="h-4 w-4" />
            <span className="sr-only">Buscar</span>
          </Button>
          
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground hidden sm:flex">
            <Bell className="h-4 w-4" />
            <span className="sr-only">Notificaciones</span>
          </Button>

          <ThemeToggle />
        </div>

        {action && (
          <>
            {/* Full button on tablet+ */}
            <Button onClick={action.onClick} size="sm" className="hidden sm:flex ml-2 h-8 text-xs">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {action.label}
            </Button>
            {/* Icon-only button on mobile */}
            <Button onClick={action.onClick} size="icon" className="sm:hidden h-9 w-9">
              <Plus className="h-4 w-4" />
              <span className="sr-only">{action.label}</span>
            </Button>
          </>
        )}
      </div>
    </header>
  )
}
