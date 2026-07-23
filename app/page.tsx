"use client"

import { useAuth } from "@/lib/auth-context"
import { getRoleConfig } from "@/lib/role-config"
import { AdminDashboard }   from "@/components/dashboard/admin-dashboard"
import { ManagerDashboard } from "@/components/dashboard/manager-dashboard"
import { EmployeeHome }     from "@/components/dashboard/employee-home"
import type { HomeView }    from "@/lib/role-config"
import type { ComponentType } from "react"

// Mapa de vistas por tipo. Agregar aquí cuando se crea una nueva pantalla inicial.
const HOME_VIEWS: Record<HomeView, ComponentType> = {
  "admin-dashboard":   AdminDashboard,
  "manager-dashboard": ManagerDashboard,
  "employee-home":     EmployeeHome,
}

export default function HomePage() {
  const { user } = useAuth()
  const config        = getRoleConfig(user?.role?.slug)
  const HomeComponent = HOME_VIEWS[config.homeView]
  return <HomeComponent />
}
