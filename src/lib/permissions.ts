type Role = 'ADMIN' | 'MANAGER' | 'DRIVER' | 'READ_ONLY'

export function canReadFleetInsights(role: Role) {
  return role === 'ADMIN' || role === 'MANAGER' || role === 'READ_ONLY'
}
