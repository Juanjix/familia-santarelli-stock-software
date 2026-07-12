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

  // After the signing-out overlay has shown long enough, navigate to /login.
  useEffect(() => {
    if (authState.status !== "signingOut") return
    const timer = setTimeout(() => router.replace("/login"), SIGN_OUT_MIN_MS)
    return () => clearTimeout(timer)
  }, [authState.status, router])

  // Redirect unauthenticated/redirecting states to /login immediately.
  // Guarded by !isAuthRoute to avoid a loop where INITIAL_SESSION(null) on
  // /login triggers a redirect back to /login while the user is logging in.
  useEffect(() => {
    if (isAuthRoute) return
    if (authState.status === "unauthenticated" || authState.status === "redirecting") {
      router.replace("/login")
    }
  }, [isAuthRoute, authState.status, router])

  // ── Render ───────────────────────────────────────────────────────────────────

  if (isAuthRoute) return <>{children}</>

  switch (authState.status) {
    case "checking":
    case "loadingProfile":
      return <AuthLoadingScreen />

    case "signingOut":
      return <SigningOutOverlay />

    case "sessionExpired":
      return <SessionExpiredScreen onLogin={dismissExpired} />

    case "accountNotProvisioned":
      return <AccountNotProvisionedScreen onSignOut={signOut} />

    case "unauthenticated":
    case "redirecting":
      // No screen — redirect fires immediately via useEffect above.
      return null

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
