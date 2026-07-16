"use client"

import {
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  Settings2,
  ShoppingCart,
  RotateCcw,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getMovementConfig } from "@/lib/movement-types"
import type { MovementConfig } from "@/lib/movement-types"

const ICONS = {
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  Settings2,
  ShoppingCart,
  RotateCcw,
}

interface MovementBadgeProps {
  type: string
  className?: string
}

/** Renders a type badge + icon for any movement type. */
export function MovementBadge({ type, className }: MovementBadgeProps) {
  const config: MovementConfig | null = getMovementConfig(type)

  if (!config) {
    return (
      <Badge variant="outline" className={cn("text-muted-foreground", className)}>
        {type}
      </Badge>
    )
  }

  const Icon = ICONS[config.iconName]

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Icon className={cn("h-4 w-4 shrink-0", config.colorClass)} />
      <Badge variant={config.badgeVariant}>{config.label}</Badge>
    </div>
  )
}

/** Returns the icon component + color class for a movement type. Safe to call anywhere. */
export function getMovementIcon(type: string) {
  const config = getMovementConfig(type)
  if (!config) return { Icon: Settings2, colorClass: "text-muted-foreground" }
  return { Icon: ICONS[config.iconName], colorClass: config.colorClass }
}
