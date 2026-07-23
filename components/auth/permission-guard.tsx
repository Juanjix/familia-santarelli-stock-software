"use client"

import type { ReactNode } from "react"
import { ShieldOff } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

interface PermissionGuardProps {
  /** Módulo del sistema de permisos (debe existir en role_permissions). */
  module: string
  children: ReactNode
}

/**
 * Envuelve cualquier página o sección que requiera canView(module).
 * Si el usuario no tiene permiso, muestra una pantalla de acceso denegado
 * en lugar del contenido. Nunca renderiza el contenido de forma condicional
 * en el mismo árbol — evita que datos se filtren en el DOM antes de validar.
 *
 * Uso:
 *   export default function MyPage() {
 *     return (
 *       <PermissionGuard module="reports">
 *         <MyPageContent />
 *       </PermissionGuard>
 *     )
 *   }
 */
export function PermissionGuard({ module, children }: PermissionGuardProps) {
  const { canView } = useAuth()

  if (!canView(module)) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <ShieldOff className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-medium">Acceso restringido</p>
            <p className="text-sm text-muted-foreground">
              No tenés permisos para ver esta sección.
              <br />
              Contactá al administrador si necesitás acceso.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
