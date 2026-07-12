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
import type { AppUser, ModulePermission } from "@/lib/types"

// ── State machine ─────────────────────────────────────────────────────────────

export type AuthState =
  | { status: "checking" }           // montando la app, esperando INITIAL_SESSION
  | { status: "loadingProfile" }     // JWT válido, fetcheando app_users
  | { status: "authenticated"; user: AppUser } // sesión + perfil resueltos
  | { status: "accountNotProvisioned" } // JWT válido pero sin registro en app_users
  | { status: "unauthenticated" }    // sin sesión en el arranque (estable en /login)
  | { status: "sessionExpired" }     // estaba autenticado, SIGNED_OUT automático
  | { status: "signingOut" }         // logout manual en curso
  | { status: "redirecting" }        // transición activa hacia /login (dismissExpired/signout)

// ── Context interface ─────────────────────────────────────────────────────────

interface AuthContextType {
  authState:   AuthState
  user:        AppUser | null   // derivado: solo presente en estado "authenticated"
  canView:     (module: string) => boolean
  canCreate:   (module: string) => boolean
  canEdit:     (module: string) => boolean
  canDelete:   (module: string) => boolean
  perm:        (module: string) => ModulePermission
  signOut:     () => Promise<void>
  refreshUser: () => Promise<void>
  dismissExpired: () => void
}

const DEFAULT_PERM: ModulePermission = {
  can_view: false, can_create: false, can_edit: false, can_delete: false,
}

const AuthContext = createContext<AuthContextType | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({ status: "checking" })

  const supabase            = createClient()
  const signingOutRef       = useRef(false)
  const wasAuthenticatedRef = useRef(false)

  // Derived convenience accessor — consumers that only need `user` don't have
  // to switch on authState.status themselves.
  const user = authState.status === "authenticated" ? authState.user : null

  // Fetch profile from DB without mutating state — callers decide the transition.
  const fetchProfile = useCallback(async (): Promise<AppUser | null> => {
    const { data, error } = await supabase.rpc("get_current_user_profile")
    if (error || !data) return null
    return data as AppUser
  }, [supabase])

  const updateLastSeen = useCallback(async (appUserId: string) => {
    await supabase
      .from("app_users")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", appUserId)
  }, [supabase])

  useEffect(() => {
    // Single authoritative source: onAuthStateChange with INITIAL_SESSION.
    // Eliminates the race condition between getSession() + SIGNED_IN that caused
    // two concurrent fetchProfile() calls on every page reload.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // ── Initial page load ────────────────────────────────────────────────
        if (event === "INITIAL_SESSION") {
          if (!session) {
            setAuthState({ status: "unauthenticated" })
            return
          }
          setAuthState({ status: "loadingProfile" })
          try {
            const profile = await fetchProfile()
            if (profile) {
              wasAuthenticatedRef.current = true
              setAuthState({ status: "authenticated", user: profile })
            } else {
              setAuthState({ status: "accountNotProvisioned" })
            }
          } catch {
            setAuthState({ status: "accountNotProvisioned" })
          }
          return
        }

        // ── Fresh login ──────────────────────────────────────────────────────
        if (event === "SIGNED_IN" && session) {
          signingOutRef.current = false
          setAuthState({ status: "loadingProfile" })
          try {
            const profile = await fetchProfile()
            if (profile) {
              wasAuthenticatedRef.current = true
              setAuthState({ status: "authenticated", user: profile })
            } else {
              setAuthState({ status: "accountNotProvisioned" })
            }
          } catch {
            setAuthState({ status: "accountNotProvisioned" })
          }
          supabase.from("session_logs").insert({
            action:     "login",
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          }).then(() => {})
          return
        }

        // ── Session ended ────────────────────────────────────────────────────
        if (event === "SIGNED_OUT") {
          const wasActive = wasAuthenticatedRef.current
          wasAuthenticatedRef.current = false
          if (signingOutRef.current) {
            // Manual logout — signingOut state was already set; timer handles redirect.
            return
          }
          setAuthState(wasActive ? { status: "sessionExpired" } : { status: "unauthenticated" })
          return
        }

        // ── Token refreshed ──────────────────────────────────────────────────
        if (event === "TOKEN_REFRESHED" && session) {
          setAuthState(prev => {
            if (prev.status === "authenticated") updateLastSeen(prev.user.id)
            return prev
          })
        }
      }
    )

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const perm = useCallback(
    (module: string): ModulePermission =>
      user?.permissions?.[module] ?? DEFAULT_PERM,
    [user]
  )

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
    // SIGNED_OUT event fires but signingOutRef guards prevent state change.
    // AppShell timer handles the redirect after the overlay delay.
  }, [supabase, authState.status])

  // Transitions "sessionExpired" → "redirecting", triggering AppShell navigation.
  const dismissExpired = useCallback(() => {
    setAuthState({ status: "redirecting" })
  }, [])

  const refreshUser = useCallback(async () => {
    const profile = await fetchProfile()
    if (profile) setAuthState({ status: "authenticated", user: profile })
  }, [fetchProfile])

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
