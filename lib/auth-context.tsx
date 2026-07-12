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

// ── [DEBUG] timing helper ─────────────────────────────────────────────────────
const t0 = typeof performance !== "undefined" ? performance.now() : Date.now()
function dbg(step: number, msg: string, extra?: unknown) {
  const ms = ((typeof performance !== "undefined" ? performance.now() : Date.now()) - t0).toFixed(0)
  const prefix = `[AUTH ${String(step).padStart(2, "0")} +${ms}ms]`
  extra !== undefined
    ? console.log(prefix, msg, extra)
    : console.log(prefix, msg)
}
// ─────────────────────────────────────────────────────────────────────────────

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

  const user = authState.status === "authenticated" ? authState.user : null

  const fetchProfile = useCallback(async (): Promise<AppUser | null> => {
    dbg(6, "loadProfile() — calling get_current_user_profile RPC")
    const start = performance.now()
    const { data, error } = await supabase.rpc("get_current_user_profile")
    const elapsed = (performance.now() - start).toFixed(0)
    if (error) {
      dbg(7, `get_current_user_profile ERROR after ${elapsed}ms`, error)
      return null
    }
    if (!data) {
      dbg(7, `get_current_user_profile returned null/empty after ${elapsed}ms`)
      return null
    }
    dbg(7, `get_current_user_profile OK after ${elapsed}ms — user id:`, (data as AppUser).id)
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

    dbg(5, "Bootstrap — calling getSession()")
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        dbg(0, "⚠️  TIMEOUT 8s — getSession/fetchProfile never resolved, forcing unauthenticated")
        setAuthState({ status: "unauthenticated" })
      }
    }, 8000)

    ;(async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession() as any
        if (error) dbg(5, "getSession() returned error", error)
        dbg(5, `getSession() resolved — session: ${session ? "PRESENT (user: " + session.user?.email + ")" : "NULL"}`)
        if (cancelled) return
        if (!session) {
          dbg(8, "AuthState → unauthenticated (no session on boot)")
          setAuthState({ status: "unauthenticated" })
          return
        }
        dbg(8, "AuthState → loadingProfile")
        setAuthState({ status: "loadingProfile" })
        const profile = await fetchProfile()
        if (cancelled) return
        if (profile) {
          wasAuthenticatedRef.current = true
          dbg(8, "AuthState → authenticated", { userId: profile.id })
          setAuthState({ status: "authenticated", user: profile })
        } else {
          dbg(8, "AuthState → accountNotProvisioned (profile null)")
          setAuthState({ status: "accountNotProvisioned" })
        }
      } catch (err) {
        dbg(0, "⚠️  Bootstrap THREW — forcing unauthenticated", err)
        if (!cancelled) setAuthState({ status: "unauthenticated" })
      } finally {
        clearTimeout(timeoutId)
      }
    })()

    dbg(4, "onAuthStateChange() — subscription registered")
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        dbg(4, `onAuthStateChange fired — event: ${event}`, { hasSession: !!session })

        if (event === "INITIAL_SESSION") {
          dbg(4, "INITIAL_SESSION — ignored (bootstrap uses getSession())")
          return
        }

        if (event === "SIGNED_IN" && session) {
          dbg(4, "SIGNED_IN — starting loadProfile flow")
          signingOutRef.current = false
          dbg(8, "AuthState → loadingProfile (post SIGNED_IN)")
          setAuthState({ status: "loadingProfile" })
          try {
            const profile = await fetchProfile()
            if (profile) {
              wasAuthenticatedRef.current = true
              dbg(8, "AuthState → authenticated (post SIGNED_IN)", { userId: profile.id })
              setAuthState({ status: "authenticated", user: profile })
            } else {
              dbg(8, "AuthState → accountNotProvisioned (post SIGNED_IN, profile null)")
              setAuthState({ status: "accountNotProvisioned" })
            }
          } catch (err) {
            dbg(0, "⚠️  fetchProfile threw after SIGNED_IN", err)
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
          dbg(4, `SIGNED_OUT — wasActive: ${wasActive}, signingOutRef: ${signingOutRef.current}`)
          wasAuthenticatedRef.current = false
          if (signingOutRef.current) return
          const next = wasActive ? "sessionExpired" : "unauthenticated"
          dbg(8, `AuthState → ${next} (auto SIGNED_OUT)`)
          setAuthState(wasActive ? { status: "sessionExpired" } : { status: "unauthenticated" })
          return
        }

        if (event === "TOKEN_REFRESHED" && session) {
          dbg(4, "TOKEN_REFRESHED — updating last_seen, keeping authenticated")
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
    dbg(4, "signOut() called")
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
    dbg(8, "AuthState → redirecting (dismissExpired)")
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
