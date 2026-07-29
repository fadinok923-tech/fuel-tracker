// Shared types
export type Role = 'ADMIN' | 'MANAGER' | 'DRIVER' | 'READ_ONLY'

export type ViewKey =
  | 'dashboard'
  | 'vehicles'
  | 'drivers'
  | 'fuel'
  | 'driver-quick'
  | 'trips'
  | 'maintenance'
  | 'reports'
  | 'analytics'
  | 'alerts'
  | 'users'
  | 'audit'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: Role
}

// Role-based permission matrix
export const PERMISSIONS: Record<Role, {
  views: ViewKey[]
  canEdit: boolean
  canDelete: boolean
  canManageUsers: boolean
}> = {
  ADMIN: {
    views: ['dashboard','vehicles','drivers','fuel','driver-quick','trips','maintenance','reports','analytics','alerts','users','audit'],
    canEdit: true, canDelete: true, canManageUsers: true,
  },
  MANAGER: {
    views: ['dashboard','vehicles','drivers','fuel','driver-quick','trips','maintenance','reports','analytics','alerts','audit'],
    canEdit: true, canDelete: true, canManageUsers: false,
  },
  DRIVER: {
    views: ['dashboard','driver-quick','fuel','alerts'],
    canEdit: true, canDelete: false, canManageUsers: false,
  },
  READ_ONLY: {
    views: ['dashboard','vehicles','drivers','fuel','trips','maintenance','reports','analytics','alerts'],
    canEdit: false, canDelete: false, canManageUsers: false,
  },
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrator',
  MANAGER: 'Manager',
  DRIVER: 'Driver',
  READ_ONLY: 'Read Only',
}

export const DEMO_USERS: Array<{ email: string; password: string; role: Role; name: string }> = [
  { email: 'admin@fleet.com', password: 'demo-admin', role: 'ADMIN', name: 'Fleet Admin' },
  { email: 'manager@fleet.com', password: 'demo-manager', role: 'MANAGER', name: 'Operation Manager' },
  { email: 'driver@fleet.com', password: 'demo-driver', role: 'DRIVER', name: 'Driver Portal' },
  { email: 'viewer@fleet.com', password: 'demo-viewer', role: 'READ_ONLY', name: 'Accounting Viewer' },
]
