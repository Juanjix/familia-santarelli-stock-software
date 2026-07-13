"use client"

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react"
import { createClient } from "@/lib/supabase/client"
import { getBootstrapSession } from "@/app/actions/auth"
import type { AppUser, ModulePermission } from "@/lib/types"

// ── State machine ─────────────────────────────────────────────────────────────

export type AuthState =
  | { status: "checking" }
  | { status: "loadingProfile" }
  | { status: "authenticated"; user: AppUser }
  | { status: "accountNotProvisioned" }
  | { status: "unauthenticated" }
  | { status: "sessionExpired" }
  | { status: "signingOut" }
  | { status: "redirecting" }

// ── Context interface ─────────────────────────────────────────────────────────

interface AuthContextType {
  authState:      AuthState
  user:           AppUser | null
  canView:        (module: string) => boolean
  canCreate:      (module: string) => boolean
  canEdit:        (module: string) => boolean
  canDelete:      (module: string) => boolean
  perm:           (module: string) => ModulePermission
  signOut:        () => Promise<void>
  refreshUser:    () => Promise<void>
  dismissExpired: () => void
  reBootstrap:    () => Promise<boolean>
}

const DEFAULT_PERM: ModulePermission = {
  can_view: false, can_create: false, can_edit: false, can_delete: false,
}

const AuthContext = createContext<AuthContextType | null>(null)

// ── Profile loader ────────────────────────────────────────────────────────────
// Always goes through the Server Action — the middleware has already refreshed
// the token server-side, so this never triggers a client-side token refresh.

async function loadProfile(): Promise<AppUser | null> {
  try {
    return await getBootstrapSession()
  } catch {
    return null
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({ status: "checking" })

  const supabaseRef         = useRef(createClient())
  const supabase            = supabaseRef.current
  const signingOutRef       = useRef(false)
  const wasAuthenticatedRef = useRef(false)

  const user = authState.status === "authenticated" ? authState.user : null

  // ── Core bootstrap ──────────────────────────────────────────────────────────
  // Reads the session server-side and hydrates auth state.
  // Safe to call from any "loading" state; respects state changes that may
  // have occurred during the async call (e.g. SIGNED_OUT firing mid-flight).

  const doBootstrap = useCallback(async (): Promise<AppUser | null> => {
    const profile = await loadProfile()
    setAuthState(prev => {
      // If an extraordinary event (SIGNED_OUT) changed state while we were
      // loading, don't overwrite it.
      if (prev.status !== "checking" && prev.status !== "loadingProfile") return prev
      if (profile) {
        wasAuthenticatedRef.current = true
        return { status: "authenticated", user: profile }
      }
      return { status: "unauthenticated" }
    })
    return profile
  }, [])

  useEffect(() => {
    // Initial bootstrap — runs once on mount.
    doBootstrap()

    // Listener only for extraordinary events.
    // Token refresh and login are handled by bootstrap/reBootstrap — not here.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        const wasActive = wasAuthenticatedRef.current
        wasAuthenticatedRef.current = false
        if (signingOutRef.current) return
        setAuthState(wasActive ? { status: "sessionExpired" } : { status: "unauthenticated" })
      }
    })

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── reBootstrap ─────────────────────────────────────────────────────────────
  // Called by the login page after signInWithPassword() succeeds.
  // Returns true if a profile was loaded (user is provisioned), false otherwise.
  // AuthNavigator handles the redirect once state becomes "authenticated".

  const reBootstrap = useCallback(async (): Promise<boolean> => {
    setAuthState({ status: "loadingProfile" })
    const profile = await doBootstrap()
    return !!profile
  }, [doBootstrap])

  // ── Sign out ────────────────────────────────────────────────────────────────

  const signOut = useCallback(async () => {
    signingOutRef.current = true
    setAuthState({ status: "signingOut" })
    if (authState.status === "authenticated") {
      await supabase.from("session_logs").insert({
        action:     "logout",
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      })
    }
    wasAuthenticatedRef.current = false
    await supabase.auth.signOut()
  }, [supabase, authState.status])

  const dismissExpired = useCallback(() => {
    setAuthState({ status: "redirecting" })
  }, [])

  // Silent refresh — does not show a loading state.
  const refreshUser = useCallback(async () => {
    const profile = await loadProfile()
    if (profile) setAuthState({ status: "authenticated", user: profile })
  }, [])

  const perm = useCallback(
    (module: string): ModulePermission =>
      user?.permissions?.[module] ?? DEFAULT_PERM,
    [user]
  )

  return (
    <AuthContext.Provider value={{
      authState,
      user,
      canView:   (m) => perm(m).can_view,
      canCreate: (m) => perm(m).can_create,
      canEdit:   (m) => perm(m).can_edit,
      canDelete: (m) => perm(m).can_delete,
      perm,
      signOut,
      refreshUser,
      dismissExpired,
      reBootstrap,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>")
  return ctx
}
