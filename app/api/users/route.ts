import { createServerClient } from "@supabase/ssr"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

async function getSessionUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// POST /api/users — crear nuevo usuario (solo admin)
export async function POST(request: Request) {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  // Verificar que el solicitante es admin
  const anonClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
  const { data: requester } = await anonClient
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

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Crear en Auth
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  // Crear en app_users
  const { error: appError } = await adminClient.from("app_users").insert({
    auth_id:      authData.user.id,
    role_id,
    display_name,
    email,
  })
  if (appError) {
    // Rollback: eliminar el usuario de Auth si falla la inserción
    await adminClient.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: appError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
