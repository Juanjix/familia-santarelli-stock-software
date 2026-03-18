"use client"

import { Search, Plus, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group"
import { ThemeToggle } from "./theme-toggle"

interface HeaderProps {
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function Header({ title, description, action }: HeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-6">
      <div className="flex flex-col">
        <h1 className="text-base font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>

      <div className="flex items-center gap-3">
        <InputGroup className="w-72">
          <InputGroupAddon>
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
          </InputGroupAddon>
          <InputGroupInput 
            placeholder="Buscar productos, SKU..." 
            className="h-8 bg-muted/50 border-0 text-sm focus:bg-muted" 
          />
        </InputGroup>

        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <Bell className="h-4 w-4" />
          </Button>

          <ThemeToggle />
        </div>

        {action && (
          <Button onClick={action.onClick} size="sm" className="ml-2 h-8 text-xs">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {action.label}
          </Button>
        )}
      </div>
    </header>
  )
}
