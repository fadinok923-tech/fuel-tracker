import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthUser, Role, ViewKey } from './types'

interface AuthState {
  user: AuthUser | null
  setUser: (u: AuthUser | null) => void
  logout: () => void
  hasRole: (...roles: Role[]) => boolean
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      setUser: (u) => set({ user: u }),
      logout: () => set({ user: null }),
      hasRole: (...roles) => {
        const u = get().user
        return !!u && roles.includes(u.role)
      },
    }),
    { name: 'fleet-auth' }
  )
)

interface UIState {
  view: ViewKey
  setView: (v: ViewKey) => void
  sidebarOpen: boolean
  setSidebarOpen: (b: boolean) => void
  searchQuery: string
  setSearchQuery: (q: string) => void
}

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      view: 'dashboard',
      setView: (view) => set({ view }),
      sidebarOpen: false,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      searchQuery: '',
      setSearchQuery: (searchQuery) => set({ searchQuery }),
    }),
    { name: 'fleet-ui', partialize: (s) => ({ view: s.view }) }
  )
)
