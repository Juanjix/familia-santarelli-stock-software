"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { UserPlus, Pencil, ShieldOff, Shield, KeyRound, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import type { AppUser, Role } from "@/lib/types"

type UserRow = AppUser & { session_logs?: { created_at: string }[] }

export default function UsersPage() {
  const { user: currentUser, canView } = useAuth()
  const supabase = createClient()

  const [users, setUsers]   = useState<UserRow[]>([])
  const [roles, setRoles]   = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState<"create" | "edit" | null>(null)
  const [editing, setEditing] = useState<UserRow | null>(null)

  // Form state
  const [formEmail, setFormEmail]     = useState("")
  const [formName, setFormName]       = useState("")
  const [formRole, setFormRole]       = useState("")
  const [formPassword, setFormPassword] = useState("")
  const [saving, setSaving]           = useState(false)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/users")
    if (res.ok) {
      const data = await res.json()
      setUsers(data ?? [])
    } else {
      toast.error("No se pudieron cargar los usuarios. Revisá tu conexión e intentá de nuevo.")
    }
    setLoading(false)
  }, [])

  const loadRoles = useCallback(async () => {
    const { data } = await supabase.from("roles").select("*").order("name")
    setRoles((data as Role[]) ?? [])
  }, [supabase])

  useEffect(() => {
    loadUsers()
    loadRoles()
  }, [loadUsers, loadRoles])

  const openCreate = () => {
    setFormEmail(""); setFormName(""); setFormRole(""); setFormPassword("")
    setEditing(null)
    setDialog("create")
  }

  const openEdit = (u: UserRow) => {
    setFormName(u.display_name)
    setFormRole(u.role.id)
    setEditing(u)
    setDialog("edit")
  }

  const handleCreate = async () => {
    if (!formEmail || !formName || !formRole || !formPassword) {
      toast.error("Completá todos los campos")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email:        formEmail,
          password:     formPassword,
          display_name: formName,
          role_id:      formRole,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success("Usuario creado correctamente")
      setDialog(null)
      await loadUsers()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear el usuario. Verificá los datos e intentá nuevamente.")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async () => {
    if (!editing || !formName || !formRole) return
    setSaving(true)
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, display_name: formName, role_id: formRole }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success("Usuario actualizado")
      setDialog(null)
      await loadUsers()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar el usuario. Intentá nuevamente.")
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (u: UserRow) => {
    const res = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, is_active: !u.is_active }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error); return }
    toast.success(u.is_active ? "Usuario desactivado" : "Usuario activado")
    await loadUsers()
  }

  const sendPasswordReset = async (u: UserRow) => {
    const { error } = await supabase.auth.resetPasswordForEmail(u.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) { toast.error(error.message); return }
    toast.success(`Email de recuperación enviado a ${u.email}`)
  }

  const lastSeen = (u: UserRow) => {
    const logs = u.session_logs
    if (!logs || logs.length === 0) return "Nunca"
    const latest = logs.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0]
    return formatDistanceToNow(new Date(latest.created_at), { locale: es, addSuffix: true })
  }

  if (!canView("users")) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Usuarios" />
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          No tenés permisos para ver esta sección.
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Usuarios" />

      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {users.length} usuario{users.length !== 1 ? "s" : ""} en el sistema
          </p>
          <Button onClick={openCreate}>
            <UserPlus className="mr-2 h-4 w-4" /> Nuevo usuario
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Último acceso</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : users.map(u => (
                <TableRow key={u.id} className={!u.is_active ? "opacity-50" : ""}>
                  <TableCell className="font-medium">
                    {u.display_name}
                    {u.id === currentUser?.id && (
                      <span className="ml-2 text-xs text-muted-foreground">(vos)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{u.role.name}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{lastSeen(u)}</TableCell>
                  <TableCell>
                    <Badge variant={u.is_active ? "default" : "outline"}>
                      {u.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(u)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => sendPasswordReset(u)} title="Resetear contraseña">
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      {u.id !== currentUser?.id && (
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => toggleActive(u)}
                          title={u.is_active ? "Desactivar" : "Activar"}
                        >
                          {u.is_active
                            ? <ShieldOff className="h-4 w-4 text-destructive" />
                            : <Shield className="h-4 w-4 text-green-600" />}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>

      {/* Dialog crear / editar */}
      <Dialog open={!!dialog} onOpenChange={() => setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog === "create" ? "Nuevo usuario" : "Editar usuario"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input
                placeholder="Juan García"
                value={formName}
                onChange={e => setFormName(e.target.value)}
              />
            </div>
            {dialog === "create" && (
              <>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="juan@joyeria.com"
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Contraseña inicial</Label>
                  <Input
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    value={formPassword}
                    onChange={e => setFormPassword(e.target.value)}
                  />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Select value={formRole} onValueChange={setFormRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná un rol" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button
              onClick={dialog === "create" ? handleCreate : handleEdit}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dialog === "create" ? "Crear usuario" : "Guardar cambios"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
