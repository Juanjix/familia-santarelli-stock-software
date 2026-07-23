// Configuración centralizada de experiencia por rol.
// Agregar un nuevo rol = una entrada en ROLE_CONFIG. Sin condicionales dispersos.

export type HomeView = "admin-dashboard" | "manager-dashboard" | "employee-home"

export interface RoleConfig {
  /** Componente de pantalla inicial para este rol. */
  homeView: HomeView
  /** Etiqueta del ítem de navegación que apunta a "/". */
  navLabel: string
}

export const ROLE_CONFIG: Record<string, RoleConfig> = {
  admin:    { homeView: "admin-dashboard",   navLabel: "Panel" },
  manager:  { homeView: "manager-dashboard", navLabel: "Panel" },
  employee: { homeView: "employee-home",     navLabel: "Inicio" },
  readonly: { homeView: "employee-home",     navLabel: "Inicio" },
}

export const DEFAULT_ROLE_CONFIG: RoleConfig = {
  homeView: "employee-home",
  navLabel: "Inicio",
}

export function getRoleConfig(slug: string | undefined): RoleConfig {
  return ROLE_CONFIG[slug ?? ""] ?? DEFAULT_ROLE_CONFIG
}
