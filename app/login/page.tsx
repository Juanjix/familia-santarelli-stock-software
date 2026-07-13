"use client"

import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Eye, EyeOff } from "lucide-react"

type View = "login" | "forgot"

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const searchParams      = useSearchParams()
  const supabase          = createClient()
  const { reBootstrap }   = useAuth()

  const [view, setView]             = useState<View>("login")
  const [email, setEmail]           = useState("")
  const [password, setPassword]     = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [success, setSuccess]       = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(
        authError.message === "Invalid login credentials"
          ? "Email o contraseña incorrectos"
          : authError.message
      )
      setLoading(false)
      return
    }

    // Log the session server-side — this is a deliberate login action.
    supabase.from("session_logs").insert({
      action:     "login",
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    }).then(() => {})

    // Hydrate auth state via the server action.
    // AuthNavigator detects authenticated+isAuthRoute and handles the redirect.
    const provisioned = await reBootstrap()
    if (!provisioned) {
      // Auth succeeded but the user has no app_users profile.
      // AuthProvider already set accountNotProvisioned — nothing else needed.
      setLoading(false)
    }
    // On success: spinner keeps showing, AuthNavigator redirects to searchParams.redirect ?? "/"
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      setError(error.message)
    } else {
      setSuccess("Te enviamos un email con el enlace para restablecer tu contraseña.")
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">

        {/* Logo / título */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Familia Santarelli
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Sistema de Stock</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">

          {view === "login" ? (
            <>
              <h2 className="mb-5 text-base font-medium text-foreground">Iniciar sesión</h2>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="nombre@joyeria.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showPassword
                        ? <EyeOff className="h-4 w-4" />
                        : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Entrar
                </Button>
              </form>

              <button
                onClick={() => { setView("forgot"); setError(null) }}
                className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Olvidé mi contraseña
              </button>
            </>
          ) : (
            <>
              <h2 className="mb-1 text-base font-medium text-foreground">Recuperar contraseña</h2>
              <p className="mb-5 text-xs text-muted-foreground">
                Ingresá tu email y te enviamos un enlace para crear una nueva contraseña.
              </p>

              {success ? (
                <p className="text-sm text-green-600">{success}</p>
              ) : (
                <form onSubmit={handleForgot} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="forgot-email">Email</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="nombre@joyeria.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>

                  {error && <p className="text-sm text-destructive">{error}</p>}

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Enviar enlace
                  </Button>
                </form>
              )}

              <button
                onClick={() => { setView("login"); setError(null); setSuccess(null) }}
                className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Volver al login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
