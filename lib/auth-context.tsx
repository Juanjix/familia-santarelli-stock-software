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
  authState:   AuthState
  user:        AppUser | null
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

  const supabaseRef         = useRef(createClient())
  const supabase            = supabaseRef.current
  const signingOutRef       = useRef(false)
  const wasAuthenticatedRef = useRef(false)
  // Guards against SIGNED_IN from onAuthStateChange racing with the bootstrap.
  // SIGNED_IN is ignored until bootstrap completes; afterwards it handles
  // fresh logins (post-submit) and token refreshes that re-authenticate.
  const bootstrapDoneRef    = useRef(false)

  const user = authState.status === "authenticated" ? authState.user : null

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
    let cancelled = false

    // Bootstrap via Server Action.
    // The middleware refreshes the token server-side on every request, so by
    // the time this runs the cookies are guaranteed to be fresh — no
    // client-side token-refresh round-trip needed (those can hang indefinitely
    // when the Supabase auth service has latency issues).
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        bootstrapDoneRef.current = true
        setAuthState({ status: "unauthenticated" })
      }
    }, 10_000)

    ;(async () => {
      try {
        const profile = await getBootstrapSession()
        if (cancelled) return
        if (profile) {
          wasAuthenticatedRef.current = true
          setAuthState({ status: "authenticated", user: profile })
        } else {
          setAuthState({ status: "unauthenticated" })
        }
      } catch {
        if (!cancelled) setAuthState({ status: "unauthenticated" })
      } finally {
        bootstrapDoneRef.current = true
        clearTimeout(timeoutId)
      }
    })()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "INITIAL_SESSION") return

        if (event === "SIGNED_IN" && session) {
          if (!bootstrapDoneRef.current) return
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

        if (event === "SIGNED_OUT") {
          const wasActive = wasAuthenticatedRef.current
          wasAuthenticatedRef.current = false
          if (signingOutRef.current) return
          setAuthState(wasActive ? { status: "sessionExpired" } : { status: "unauthenticated" })
          return
        }

        if (event === "TOKEN_REFRESHED" && session) {
          setAuthState(prev => {
            if (prev.status === "authenticated") updateLastSeen(prev.user.id)
            return prev
          })
        }
      }
    )

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
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
  }, [supabase, authState.status])

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
