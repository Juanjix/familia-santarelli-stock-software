import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

// Cliente con service role key (sin cookies — bypassa RLS para operaciones de admin)
function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}

// GET /api/users — listar todos los usuarios (solo admin)
export async function GET(request: Request) {
  const cookieStore = await cookies()
  const sessionClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { session } } = await sessionClient.auth.getSession()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const admin = createAdminClient()
  const { data: requester } = await admin
    .from("app_users")
    .select("role:roles(slug)")
    .eq("auth_id", session.user.id)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((requester?.role as any)?.slug !== "admin") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  const { data, error } = await admin
    .from("app_users")
    .select("*, role:roles(id, name, slug), session_logs(created_at)")
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// POST /api/users — crear nuevo usuario (solo admin)
export async function POST(request: Request) {
  // Verificar sesión del solicitante con su cookie
  const cookieStore = await cookies()
  const sessionClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { session } } = await sessionClient.auth.getSession()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  // Verificar que el solicitante es admin
  const admin = createAdminClient()
  const { data: requester } = await admin
    .from("app_users")
    .select("role:roles(slug)")
    .eq("auth_id", session.user.id)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((requester?.role as any)?.slug !== "admin") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  const { email, password, display_name, role_id } = await request.json()
  if (!email || !password || !display_name || !role_id) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
  }

  // Crear en Auth
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  // Crear en app_users
  const { error: appError } = await admin.from("app_users").insert({
    auth_id:      authData.user.id,
    role_id,
    display_name,
    email,
  })
  if (appError) {
    await admin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: appError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
