import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const demoUsers = [
  { id: 'seed-admin', email: 'admin@fleet.com', name: 'Fleet Admin', password: 'demo-admin', role: 'ADMIN' },
  { id: 'seed-manager', email: 'manager@fleet.com', name: 'Operation Manager', password: 'demo-manager', role: 'MANAGER' },
  { id: 'seed-driver', email: 'driver@fleet.com', name: 'Driver Portal', password: 'demo-driver', role: 'DRIVER' },
  { id: 'seed-viewer', email: 'viewer@fleet.com', name: 'Accounting Viewer', password: 'demo-viewer', role: 'READ_ONLY' },
]

try {
  await prisma.user.createMany({ data: demoUsers, skipDuplicates: true })
} finally {
  await prisma.$disconnect()
}
