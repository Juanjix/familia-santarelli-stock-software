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

// Minimum overlay display time so the transition feels intentional, not like a flicker
const SIGN_OUT_MIN_MS = 800

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const { loading, user, signingOut, sessionExpired, dismissExpired } = useAuth()

  const isAuthRoute = AUTH_ROUTES.some(r => pathname.startsWith(r))

  // When signing out, navigate to /login after the minimum overlay time
  useEffect(() => {
    if (!signingOut) return
    const timer = setTimeout(() => router.push("/login"), SIGN_OUT_MIN_MS)
    return () => clearTimeout(timer)
  }, [signingOut, router])

  // Auth routes (login, reset-password) render without any wrapper
  if (isAuthRoute) return <>{children}</>

  // ── Guards (only for protected routes) ──────────────────────────────────

  // 1. App is actively signing out → full-screen overlay
  if (signingOut) return <SigningOutOverlay />

  // 2. Session expired mid-use → friendly prompt, no broken UI
  if (sessionExpired) {
    return (
      <SessionExpiredScreen
        onLogin={() => { dismissExpired(); router.push("/login") }}
      />
    )
  }

  // 3. Still resolving the session on first load → loading screen
  if (loading) return <AuthLoadingScreen />

  // 4. Session resolved but no user — middleware should have redirected, but
  //    guard here too to prevent any partial render
  if (!user) {
    router.push("/login")
    return <AuthLoadingScreen message="Redirigiendo..." />
  }

  // 5. Authenticated — render the full app
  return (
    <InventoryProvider>
      <DashboardLayout>
        {children}
      </DashboardLayout>
    </InventoryProvider>
  )
}
