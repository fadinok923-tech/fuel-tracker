'use client'
import { useAuth, useUI } from '@/lib/store'
import { ROLE_LABELS } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Bell, Menu, Moon, Sun, Search, LogOut, User as UserIcon, ChevronDown } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useState, useEffect } from 'react'
import { api } from '@/lib/fleet'

const VIEW_TITLES: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Real-time fleet overview and KPIs' },
  alerts: { title: 'Alerts', subtitle: 'Maintenance reminders and operational warnings' },
  analytics: { title: 'Analytics', subtitle: 'Trends and comparative analysis' },
  vehicles: { title: 'Vehicles', subtitle: 'Manage your fleet inventory' },
  drivers: { title: 'Drivers', subtitle: 'Manage driver records and assignments' },
  fuel: { title: 'Fuel Entries', subtitle: 'Track every fuel fill and consumption' },
  'driver-quick': { title: 'Driver Quick Entry', subtitle: 'Simple fuel + trip logging for drivers' },
  trips: { title: 'Trips', subtitle: 'Record and analyze every trip' },
  maintenance: { title: 'Maintenance', subtitle: 'Track all vehicle expenses and servicing' },
  reports: { title: 'Reports', subtitle: 'Generate and export detailed reports' },
  audit: { title: 'Audit Log', subtitle: 'Complete activity trail of every record' },
  users: { title: 'Users & Roles', subtitle: 'Manage user accounts and permissions' },
}

export function Header({ onMenuClick, alertsCount }: { onMenuClick: () => void; alertsCount: number }) {
  const { user, logout } = useAuth()
  const { view, setView, searchQuery, setSearchQuery } = useUI()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const meta = VIEW_TITLES[view] || { title: 'Fleet', subtitle: '' }

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="flex items-center gap-3 px-4 lg:px-6 h-16">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
          <Menu className="size-5" />
        </Button>

        <div className="min-w-0 flex-1">
          <h1 className="text-lg lg:text-xl font-bold truncate">{meta.title}</h1>
          <p className="text-xs text-muted-foreground hidden sm:block truncate">{meta.subtitle}</p>
        </div>

        {/* Search */}
        <div className="relative hidden md:block w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-9 bg-muted/50"
          />
        </div>

        {/* Alerts */}
        <Button variant="ghost" size="icon" className="relative" onClick={() => setView('alerts')}>
          <Bell className="size-5" />
          {alertsCount > 0 && (
            <span className="absolute top-1 right-1 size-4 rounded-full bg-rose-500 text-white text-[9px] font-bold grid place-items-center">
              {alertsCount > 9 ? '9+' : alertsCount}
            </span>
          )}
        </Button>

        {/* Theme toggle */}
        <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {mounted && theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full hover:bg-muted/60 transition-colors">
              <Avatar className="size-8">
                <AvatarFallback className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                  {user?.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-medium leading-tight">{user?.name}</div>
                <div className="text-[10px] text-muted-foreground">{user ? ROLE_LABELS[user.role] : ''}</div>
              </div>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{user?.name}</span>
                <span className="text-xs text-muted-foreground">{user?.username || user?.name}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs text-muted-foreground cursor-default">
              <UserIcon className="size-3.5 mr-2" /> Role: {user ? ROLE_LABELS[user.role] : ''}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={async () => { await api('/api/auth/logout', { method: 'POST' }).catch(() => {}); logout() }} className="text-rose-600 focus:text-rose-700">
              <LogOut className="size-3.5 mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
