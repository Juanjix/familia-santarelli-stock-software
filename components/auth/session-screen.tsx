"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"

// ── Shared logo mark ─────────────────────────────────────────────────────────

function FsLogo() {
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary shadow-lg">
      <span className="text-lg font-semibold tracking-tight text-primary-foreground">FS</span>
    </div>
  )
}

// ── Bootstrap / loading ───────────────────────────────────────────────────────
// After 5 s shows a manual escape link in case something hangs silently.

export function AuthLoadingScreen({ message = "Verificando sesión..." }: { message?: string }) {
  const [showEscape, setShowEscape] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setShowEscape(true), 5000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-background">
      <FsLogo />
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      {showEscape && (
        <Link
          href="/login"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Tardando más de lo esperado — Ir a iniciar sesión
        </Link>
      )}
    </div>
  )
}

// ── Signing-out overlay ───────────────────────────────────────────────────────

export function SigningOutOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-background animate-in fade-in duration-150">
      <FsLogo />
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Cerrando sesión...</p>
      </div>
    </div>
  )
}

// ── Session-expired screen ────────────────────────────────────────────────────

export function SessionExpiredScreen({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background animate-in fade-in duration-200">
      <FsLogo />
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-base font-semibold text-foreground">Tu sesión expiró</p>
        <p className="text-sm text-muted-foreground">
          Por seguridad, las sesiones tienen una duración limitada.
        </p>
      </div>
      <Button onClick={onLogin}>Volver a iniciar sesión</Button>
    </div>
  )
}

// ── Account not provisioned screen ───────────────────────────────────────────

export function AccountNotProvisionedScreen({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background animate-in fade-in duration-200">
      <FsLogo />
      <div className="flex flex-col items-center gap-3 text-center max-w-sm">
        <ShieldAlert className="h-8 w-8 text-destructive" />
        <div className="flex flex-col gap-1">
          <p className="text-base font-semibold text-foreground">Cuenta no habilitada</p>
          <p className="text-sm text-muted-foreground">
            Tu cuenta existe pero no está configurada para acceder a esta aplicación.
            Contactá al administrador del sistema.
          </p>
        </div>
      </div>
      <Button variant="outline" onClick={onSignOut}>Cerrar sesión</Button>
    </div>
  )
}
