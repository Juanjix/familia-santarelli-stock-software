"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react"
import { createClient } from "@/lib/supabase/client"
import type { AppUser, ModulePermission } from "@/lib/types"

interface AuthContextType {
  user:      AppUser | null
  loading:   boolean
  canView:   (module: string) => boolean
  canCreate: (module: string) => boolean
  canEdit:   (module: string) => boolean
  canDelete: (module: string) => boolean
  perm:      (module: string) => ModulePermission
  signOut:   () => Promise<void>
  refreshUser: () => Promise<void>
}

const DEFAULT_PERM: ModulePermission = {
  can_view: false, can_create: false, can_edit: false, can_delete: false,
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase              = createClient()

  const loadProfile = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_current_user_profile")
    if (error || !data) { setUser(null); return }
    setUser(data as AppUser)
  }, [supabase])

  const updateLastSeen = useCallback(async (appUserId: string) => {
    await supabase
      .from("app_users")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", appUserId)
  }, [supabase])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        await loadProfile()
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session) {
          await loadProfile()
          // Registrar login en session_logs (best-effort)
          supabase.from("session_logs").insert({
            action:     "login",
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          }).then(() => {})
        }
        if (event === "SIGNED_OUT") {
          setUser(null)
        }
        if (event === "TOKEN_REFRESHED" && session) {
          // Actualizar last_seen silenciosamente
          if (user) updateLastSeen(user.id)
        }
        setLoading(false)
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
    if (user) {
      await supabase.from("session_logs").insert({
        action:     "logout",
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      })
    }
    await supabase.auth.signOut()
    setUser(null)
  }, [supabase, user])

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      canView:     (m) => perm(m).can_view,
      canCreate:   (m) => perm(m).can_create,
      canEdit:     (m) => perm(m).can_edit,
      canDelete:   (m) => perm(m).can_delete,
      perm,
      signOut,
      refreshUser: loadProfile,
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
