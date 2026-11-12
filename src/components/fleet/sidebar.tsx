'use client'
import { useAuth, useUI } from '@/lib/store'
import { PERMISSIONS, ROLE_LABELS, type ViewKey } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Truck, LayoutDashboard, Car, Users, Fuel, Route, Wrench, FileBarChart, BarChart3, Bell, Shield, ScrollText, Zap } from 'lucide-react'

const NAV: Array<{ key: ViewKey; label: string; icon: typeof Truck; group?: string }> = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Overview' },
  { key: 'alerts', label: 'Alerts', icon: Bell, group: 'Overview' },
  { key: 'analytics', label: 'Analytics', icon: BarChart3, group: 'Overview' },

  { key: 'vehicles', label: 'Vehicles', icon: Car, group: 'Fleet' },
  { key: 'drivers', label: 'Drivers', icon: Users, group: 'Fleet' },
  { key: 'fuel', label: 'Fuel Entries', icon: Fuel, group: 'Fleet' },
  { key: 'trips', label: 'Trips', icon: Route, group: 'Fleet' },
  { key: 'maintenance', label: 'Maintenance', icon: Wrench, group: 'Fleet' },

  { key: 'driver-quick', label: 'Driver Quick Entry', icon: Zap, group: 'Driver' },

  { key: 'reports', label: 'Reports', icon: FileBarChart, group: 'System' },
  { key: 'audit', label: 'Audit Log', icon: ScrollText, group: 'System' },
  { key: 'users', label: 'Users & Roles', icon: Shield, group: 'System' },
]

export function Sidebar({ alertsCount = 0, onClose }: { alertsCount?: number; onClose?: () => void }) {
  const { user } = useAuth()
  const { view, setView } = useUI()

  if (!user) return null
  const allowedViews = PERMISSIONS[user.role].views
  const items = NAV.filter(n => allowedViews.includes(n.key)).map(n => user.role === 'DRIVER' && n.key === 'maintenance'
    ? { ...n, label: 'Maintenance Entry', group: 'Driver' }
    : n)

  // Group items
  const groups: Record<string, typeof items> = {}
  for (const it of items) {
    const g = it.group || 'Other'
    if (!groups[g]) groups[g] = []
    groups[g].push(it)
  }

  return (
    <aside className="h-full w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-emerald-600 text-white grid place-items-center shadow-md shadow-emerald-600/30">
            <Truck className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">Fleet Operations</div>
            <div className="text-xs text-muted-foreground truncate">Fuel & Mileage</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin">
        {Object.entries(groups).map(([group, groupItems]) => (
          <div key={group}>
            <div className="px-3 mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {group}
            </div>
            <div className="space-y-1">
              {groupItems.map(item => {
                const Icon = item.icon
                const active = view === item.key
                return (
                  <button
                    key={item.key}
                    onClick={() => { setView(item.key); onClose?.() }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      active
                        ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                        : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                    )}
                  >
                    <Icon className={cn('size-4', active ? 'text-white' : 'text-muted-foreground')} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.key === 'alerts' && alertsCount > 0 && (
                      <span className={cn(
                        'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                        active ? 'bg-white/20 text-white' : 'bg-rose-500 text-white'
                      )}>
                        {alertsCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User card */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-sidebar-accent/50">
          <div className="size-9 rounded-full bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 grid place-items-center text-sm font-bold">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{user.name}</div>
            <div className="text-xs text-muted-foreground truncate">{ROLE_LABELS[user.role]}</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
