"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { Header } from "@/components/dashboard/header"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ShoppingCart, Wrench as WrenchIcon, Repeat2, Tags,
  ScanLine, Ticket, ChevronRight, CheckCircle2,
} from "lucide-react"

interface OperationalStats {
  readyRepairs: number
  pendingTransfers: number
}

interface ActionTile {
  label: string
  href: string
  icon: React.ElementType
  module: string
  description: string
}

const ACTION_TILES: ActionTile[] = [
  { label: "Nueva Venta",      href: "/pos",       icon: ShoppingCart, module: "pos",       description: "Punto de Venta" },
  { label: "Reparaciones",     href: "/sobres",    icon: WrenchIcon,   module: "sobres",    description: "Registrar o entregar" },
  { label: "Transferencias",   href: "/transfers", icon: Repeat2,      module: "transfers", description: "Enviar o recibir stock" },
  { label: "Escanear",         href: "/scan",      icon: ScanLine,     module: "scan",      description: "Consultar producto" },
  { label: "Ticket de Canje",  href: "/coupons",   icon: Ticket,       module: "coupons",   description: "Registrar canje" },
  { label: "Imprimir Etiquetas",href: "/labels",   icon: Tags,         module: "labels",    description: "Seleccionar e imprimir" },
]

export function EmployeeHome() {
  const { user, canView } = useAuth()
  const [stats, setStats] = useState<OperationalStats | null>(null)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from("envelopes").select("id", { count: "exact", head: true }).eq("status", "ready"),
      supabase.from("stock_transfers").select("id", { count: "exact", head: true }).eq("status", "in_transit"),
    ]).then(([repairsRes, transfersRes]) => {
      setStats({
        readyRepairs:     repairsRes.count ?? 0,
        pendingTransfers: transfersRes.count ?? 0,
      })
    })
  }, [])

  const visibleTiles = ACTION_TILES.filter(tile => canView(tile.module))
  const hasAlerts    = stats && (stats.readyRepairs > 0 || stats.pendingTransfers > 0)

  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return "Buenos días"
    if (hour < 19) return "Buenas tardes"
    return "Buenas noches"
  })()

  const dateLabel = new Intl.DateTimeFormat("es-AR", {
    weekday: "long", day: "numeric", month: "long",
  }).format(new Date())

  return (
    <>
      <Header title="Inicio" description={`${greeting}${user?.display_name ? `, ${user.display_name}` : ""} · ${dateLabel}`} />

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">

        {/* Acciones rápidas */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Acciones rápidas</p>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
            {visibleTiles.map(({ label, href, icon: Icon, description }) => (
              <Link key={href} href={href}>
                <Card className="h-full transition-colors hover:bg-accent hover:border-accent-foreground/10 cursor-pointer">
                  <CardContent className="p-5 flex flex-col gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-tight">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Alertas operativas */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Estado operativo</p>

          {!stats ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </div>
          ) : hasAlerts ? (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-400 mb-3">
                  Requieren atención
                </p>
                {stats.readyRepairs > 0 && (
                  <Link href="/sobres" className="flex items-center justify-between rounded-md hover:bg-amber-500/10 px-2 py-1.5 transition-colors group">
                    <div className="flex items-center gap-2.5 text-sm">
                      <WrenchIcon className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="font-medium">
                        {stats.readyRepairs} {stats.readyRepairs === 1 ? "reparación lista" : "reparaciones listas"} para entregar
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </Link>
                )}
                {stats.pendingTransfers > 0 && (
                  <Link href="/transfers" className="flex items-center justify-between rounded-md hover:bg-amber-500/10 px-2 py-1.5 transition-colors group">
                    <div className="flex items-center gap-2.5 text-sm">
                      <Repeat2 className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="font-medium">
                        {stats.pendingTransfers} {stats.pendingTransfers === 1 ? "transferencia pendiente" : "transferencias pendientes"} de recibir
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </Link>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">Todo al día</p>
                  <p className="text-xs text-muted-foreground">Sin reparaciones ni transferencias pendientes</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

      </div>
    </>
  )
}
