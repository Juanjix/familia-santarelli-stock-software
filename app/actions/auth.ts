"use server"

import { createClient } from "@/lib/supabase/server"
import type { AppUser } from "@/lib/types"

/**
 * Bootstrap the client auth state from the server.
 *
 * The middleware already refreshes the access token on every request, so by
 * the time this action runs the cookies are guaranteed to be fresh.  We read
 * them server-side — no client-side token-refresh round-trip needed.
 *
 * Returns the full AppUser profile when authenticated, or null otherwise.
 */
export async function getBootstrapSession(): Promise<AppUser | null> {
  const supabase = await createClient()

  // getUser() validates the token against the Auth server.
  // Fast because the server is co-located with Supabase infrastructure.
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: profile, error: rpcError } = await supabase.rpc("get_current_user_profile")
  if (rpcError || !profile) return null

  return profile as AppUser
}
