import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"

// Supabase client with service role to bypass RLS
function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}

// GET  /api/pos/cleanup-drafts  — invocado por Vercel Cron (Authorization: Bearer $CRON_SECRET)
// POST /api/pos/cleanup-drafts  — invocado manualmente desde el panel (sesión activa)
//
// Body POST (JSON, opcional):
//   { max_age_minutes?: number }  — default 120 min (2 horas)
//
// Response:
//   { ok: true, deleted: number, cutoff: string }
//   { ok: false, error: string }

async function runCleanup(maxAgeMinutes: number) {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc("cleanup_stale_drafts", {
    p_max_age_minutes: maxAgeMinutes,
  })
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Vercel Cron Jobs always use GET
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })
  }
  return runCleanup(120)
}

// Manual trigger from the sales panel — requires an active user session
export async function POST(request: Request) {
  const { createServerClient: createSession } = await import("@supabase/ssr")
  const { cookies } = await import("next/headers")
  const cookieStore = await cookies()
  const sessionClient = createSession(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { session } } = await sessionClient.auth.getSession()
  if (!session) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })
  }

  let maxAgeMinutes = 120
  try {
    const body = await request.json().catch(() => ({}))
    if (typeof body.max_age_minutes === "number" && body.max_age_minutes > 0) {
      maxAgeMinutes = body.max_age_minutes
    }
  } catch {
    // sin body — usar default
  }

  return runCleanup(maxAgeMinutes)
}
