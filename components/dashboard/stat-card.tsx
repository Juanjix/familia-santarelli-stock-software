import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  className?: string
}

export function StatCard({ title, value, subtitle, icon: Icon, trend, className }: StatCardProps) {
  return (
    <Card className={cn("bg-card border-border", className)}>
      <CardContent className="p-3 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5 sm:space-y-1 min-w-0">
            <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-muted-foreground truncate">{title}</p>
            <p className="text-lg sm:text-2xl font-semibold tracking-tight text-card-foreground">{value}</p>
            {subtitle && <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2 hidden sm:block">{subtitle}</p>}
            {trend && (
              <p className={cn("text-[10px] sm:text-xs font-medium", trend.isPositive ? "text-success" : "text-destructive")}>
                {trend.isPositive ? "+" : ""}{trend.value}%
              </p>
            )}
          </div>
          <div className="rounded-md bg-muted p-1.5 sm:p-2 shrink-0">
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
