"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { InventoryProvider } from "@/lib/inventory-context"
import { DashboardLayout } from "./dashboard-layout"
import {
  AuthLoadingScreen,
  SigningOutOverlay,
  SessionExpiredScreen,
} from "@/components/auth/session-screen"

const AUTH_ROUTES = ["/login", "/reset-password"]
const SIGN_OUT_MIN_MS = 800

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const { loading, user, signingOut, sessionExpired, dismissExpired } = useAuth()

  const isAuthRoute = AUTH_ROUTES.some(r => pathname.startsWith(r))

  // Navigate to /login after the signing-out overlay has been visible long enough
  useEffect(() => {
    if (!signingOut) return
    const timer = setTimeout(() => router.push("/login"), SIGN_OUT_MIN_MS)
    return () => clearTimeout(timer)
  }, [signingOut, router])

  // Redirect to /login when session resolves but no user exists (client-side fallback)
  useEffect(() => {
    if (!isAuthRoute && !loading && !signingOut && !sessionExpired && !user) {
      router.push("/login")
    }
  }, [isAuthRoute, loading, signingOut, sessionExpired, user, router])

  // ── Render ───────────────────────────────────────────────────────────────────

  // Auth routes (login, reset-password) render without any wrapper
  if (isAuthRoute) return <>{children}</>

  // Actively signing out → full-screen overlay
  if (signingOut) return <SigningOutOverlay />

  // Session expired mid-use → friendly prompt, no broken UI
  if (sessionExpired) {
    return (
      <SessionExpiredScreen
        onLogin={() => { dismissExpired(); router.push("/login") }}
      />
    )
  }

  // Still resolving the session on first load → auth loading screen
  if (loading) return <AuthLoadingScreen />

  // Session resolved, no user → show redirect screen (useEffect handles navigation)
  if (!user) return <AuthLoadingScreen message="Redirigiendo..." />

  // Authenticated — render the full app
  return (
    <InventoryProvider>
      <DashboardLayout>
        {children}
      </DashboardLayout>
    </InventoryProvider>
  )
}
