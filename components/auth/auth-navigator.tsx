"use client"

import { createContext, useContext, useEffect, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"

// ── Auth route detection ──────────────────────────────────────────────────────
// Provided via context so AppShell can gate its render without importing
// next/navigation directly (architectural rule: only AuthNavigator uses it).

const AUTH_ROUTES = ["/login", "/reset-password"]

const IsAuthRouteContext = createContext(false)
export const useIsAuthRoute = () => useContext(IsAuthRouteContext)

// ── Timing ────────────────────────────────────────────────────────────────────

const SIGN_OUT_OVERLAY_MS = 800

// ── AuthNavigator ─────────────────────────────────────────────────────────────
// Single component responsible for ALL auth-triggered client-side navigation.
//
// Navigates only on USER ACTIONS — never on system/automatic state changes:
//   "signingOut"  → manual logout       → overlay 800ms → router.replace(/login)
//   "redirecting" → user dismissed a screen (sessionExpired / accountNotProvisioned)
//                                        → router.replace(/login) immediately
//
// "unauthenticated" is intentionally NOT handled here — route protection for
// that case is the middleware's exclusive responsibility.

export function AuthNavigator({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const { authState } = useAuth()

  const isAuthRoute = AUTH_ROUTES.some(r => pathname.startsWith(r))

  // [DEBUG 09] Log every authState change received by AuthNavigator
  useEffect(() => {
    console.log("[AUTH 09] AuthNavigator — authState:", authState.status, "| pathname:", pathname, "| isAuthRoute:", isAuthRoute)
  })

  // User action: manual logout — wait for overlay, then navigate.
  useEffect(() => {
    if (authState.status !== "signingOut") return
    console.log("[AUTH 11] AuthNavigator — signingOut, scheduling router.replace(/login) in", SIGN_OUT_OVERLAY_MS, "ms")
    const t = setTimeout(() => {
      console.log("[AUTH 11] AuthNavigator — router.replace(/login) firing now")
      router.replace("/login")
    }, SIGN_OUT_OVERLAY_MS)
    return () => clearTimeout(t)
  }, [authState.status, router])

  // User action: dismissed sessionExpired or accountNotProvisioned screen.
  useEffect(() => {
    if (authState.status !== "redirecting") return
    console.log("[AUTH 11] AuthNavigator — redirecting, router.replace(/login)")
    router.replace("/login")
  }, [authState.status, router])

  return (
    <IsAuthRouteContext.Provider value={isAuthRoute}>
      {children}
    </IsAuthRouteContext.Provider>
  )
}
