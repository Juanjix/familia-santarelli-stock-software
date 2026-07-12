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
  AccountNotProvisionedScreen,
} from "@/components/auth/session-screen"

const AUTH_ROUTES = ["/login", "/reset-password"]
const SIGN_OUT_MIN_MS = 800

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const { authState, dismissExpired, signOut } = useAuth()

  const isAuthRoute = AUTH_ROUTES.some(r => pathname.startsWith(r))

  // Redirect to /login after the signing-out overlay has been visible long enough.
  useEffect(() => {
    if (authState.status !== "signingOut") return
    const timer = setTimeout(() => router.push("/login"), SIGN_OUT_MIN_MS)
    return () => clearTimeout(timer)
  }, [authState.status, router])

  // Navigate to /login whenever the state machine decides to redirect.
  useEffect(() => {
    if (authState.status === "redirecting") router.push("/login")
  }, [authState.status, router])

  // ── Render ───────────────────────────────────────────────────────────────────

  if (isAuthRoute) return <>{children}</>

  switch (authState.status) {
    case "checking":
    case "loadingProfile":
      return <AuthLoadingScreen />

    case "signingOut":
      return <SigningOutOverlay />

    case "sessionExpired":
      return (
        <SessionExpiredScreen
          onLogin={dismissExpired}
        />
      )

    case "accountNotProvisioned":
      return <AccountNotProvisionedScreen onSignOut={signOut} />

    case "redirecting":
      return <AuthLoadingScreen message="Redirigiendo..." />

    case "authenticated":
      return (
        <InventoryProvider>
          <DashboardLayout>
            {children}
          </DashboardLayout>
        </InventoryProvider>
      )
  }
}
