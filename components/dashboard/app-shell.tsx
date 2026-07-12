"use client"

// next/navigation is intentionally absent — navigation is AuthNavigator's job.
import { useAuth } from "@/lib/auth-context"
import { useIsAuthRoute } from "@/components/auth/auth-navigator"
import { InventoryProvider } from "@/lib/inventory-context"
import { DashboardLayout } from "./dashboard-layout"
import {
  AuthLoadingScreen,
  SigningOutOverlay,
  SessionExpiredScreen,
  AccountNotProvisionedScreen,
} from "@/components/auth/session-screen"

export function AppShell({ children }: { children: React.ReactNode }) {
  const { authState, dismissExpired, signOut } = useAuth()
  const isAuthRoute = useIsAuthRoute()

  // Auth pages (login, reset-password) render without any wrapper.
  if (isAuthRoute) return <>{children}</>

  switch (authState.status) {
    // ── Resolving ───────────────────────────────────────────────────────────
    case "checking":
    case "loadingProfile":
      return <AuthLoadingScreen />

    // ── User-action transitions (AuthNavigator handles the navigation) ──────
    case "signingOut":
      return <SigningOutOverlay />

    case "redirecting":
      return <AuthLoadingScreen message="Redirigiendo..." />

    // ── System states (middleware handles route protection) ──────────────────
    case "unauthenticated":
      // Middleware already blocked this route server-side.
      // This screen shows only during the brief client-side hydration window.
      return <AuthLoadingScreen message="Verificando acceso..." />

    // ── Recoverable error states ─────────────────────────────────────────────
    case "sessionExpired":
      return <SessionExpiredScreen onLogin={dismissExpired} />

    case "accountNotProvisioned":
      return <AccountNotProvisionedScreen onSignOut={signOut} />

    // ── Authenticated ────────────────────────────────────────────────────────
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
