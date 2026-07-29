'use client'
import { useEffect, useState } from 'react'
import { useAuth, useUI } from '@/lib/store'
import { PERMISSIONS, type ViewKey } from '@/lib/types'
import { api } from '@/lib/fleet'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { LoginScreen } from './login-screen'
import { DashboardView } from './dashboard-view'
import { VehiclesView } from './vehicles-view'
import { DriversView } from './drivers-view'
import { FuelView } from './fuel-view'
import { DriverQuickView } from './driver-quick-view'
import { TripsView } from './trips-view'
import { MaintenanceView } from './maintenance-view'
import { ReportsView } from './reports-view'
import { AnalyticsView } from './analytics-view'
import { AlertsView } from './alerts-view'
import { UsersView } from './users-view'
import { AuditView } from './audit-view'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { ShieldAlert } from 'lucide-react'

const VIEWS: Record<ViewKey, () => JSX.Element> = {
  dashboard: DashboardView,
  vehicles: VehiclesView,
  drivers: DriversView,
  fuel: FuelView,
  'driver-quick': DriverQuickView,
  trips: TripsView,
  maintenance: MaintenanceView,
  reports: ReportsView,
  analytics: AnalyticsView,
  alerts: AlertsView,
  users: UsersView,
  audit: AuditView,
}

export function AppShell() {
  const { user } = useAuth()
  const { view, sidebarOpen, setSidebarOpen } = useUI()
  const [alertsCount, setAlertsCount] = useState(0)

  // Live alerts badge count (critical + warning only)
  useEffect(() => {
    if (!user) return
    const tick = () => api('/api/alerts').then(d => {
      setAlertsCount(d.counts.critical + d.counts.warning)
    }).catch(() => {})
    tick()
    const t = setInterval(tick, 30000)
    return () => clearInterval(t)
  }, [user])

  if (!user) return <LoginScreen />

  const allowed = PERMISSIONS[user.role].views
  const activeView = allowed.includes(view) ? view : 'dashboard'
  const ViewComp = VIEWS[activeView] || DashboardView

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <Sidebar alertsCount={alertsCount} />
      </div>

      {/* Mobile sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0 w-64">
          <Sidebar alertsCount={alertsCount} onClose={() => setSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} alertsCount={alertsCount} />
        <main className="flex-1 p-4 lg:p-6">
          {!allowed.includes(view) && view !== 'dashboard' ? (
            <div className="flex flex-col items-center justify-center py-16">
              <ShieldAlert className="size-12 text-rose-500 mb-3" />
              <div className="font-semibold text-lg">Access Restricted</div>
              <div className="text-sm text-muted-foreground">Your role ({user.role}) does not have access to this view.</div>
            </div>
          ) : (
            <ViewComp />
          )}
        </main>
        <footer className="mt-auto border-t border-border bg-muted/30 px-6 py-3 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
          <div>© {new Date().getFullYear()} Fleet Operations Co. — Fuel & Mileage Management System</div>
          <div className="flex items-center gap-3">
            <span>Logged in as <span className="font-medium text-foreground">{user.name}</span></span>
            <span>·</span>
            <span>Role: <span className="font-medium text-foreground">{user.role}</span></span>
            <span>·</span>
            <span>Data: PostgreSQL-compatible (SQLite dev)</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
