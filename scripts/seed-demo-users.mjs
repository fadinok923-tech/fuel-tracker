import { PrismaClient } from '@prisma/client'
import { randomBytes, scryptSync } from 'node:crypto'

const prisma = new PrismaClient()

const demoUsers = [
  { id: 'seed-admin', email: 'admin@fleet.com', username: 'admin', name: 'Fleet Admin', password: 'demo-admin', role: 'ADMIN' },
  { id: 'seed-manager', email: 'manager@fleet.com', username: 'manager', name: 'Operation Manager', password: 'demo-manager', role: 'MANAGER' },
  { id: 'seed-driver', email: 'driver@fleet.com', username: 'driver', name: 'Driver Portal', password: 'demo-driver', role: 'DRIVER' },
  { id: 'seed-viewer', email: 'viewer@fleet.com', username: 'viewer', name: 'Accounting Viewer', password: 'demo-viewer', role: 'READ_ONLY' },
]

try {
  await prisma.user.createMany({ data: demoUsers, skipDuplicates: true })

  // Backfill username-only sign-ins for existing administrator, manager, and viewer accounts.
  const staffUsers = await prisma.user.findMany({ where: { role: { not: 'DRIVER' }, deletedAt: null, username: null } })
  for (const staffUser of staffUsers) {
    const base = (staffUser.email?.split('@')[0] || staffUser.name).toLowerCase().trim().replace(/[^a-z0-9._-]+/g, '-') || 'user'
    let username = base
    const duplicate = await prisma.user.findFirst({ where: { username: { equals: username, mode: 'insensitive' }, id: { not: staffUser.id }, deletedAt: null } })
    if (duplicate) username = `${base}.${staffUser.id.toLowerCase()}`
    await prisma.user.update({ where: { id: staffUser.id }, data: { username } })
  }

  const demoDriverAccount = await prisma.user.findFirst({ where: { OR: [{ id: 'seed-driver' }, { email: 'driver@fleet.com' }] } })
  if (demoDriverAccount && !demoDriverAccount.username) {
    await prisma.user.update({ where: { id: demoDriverAccount.id }, data: { username: 'driver' } })
  }
  if (demoDriverAccount) {
    const linked = await prisma.driver.findFirst({ where: { userId: demoDriverAccount.id } })
    if (!linked) {
      const matching = await prisma.driver.findFirst({ where: { name: { equals: 'Driver Portal', mode: 'insensitive' }, deletedAt: null, userId: null } })
      if (matching) {
        await prisma.driver.update({ where: { id: matching.id }, data: { userId: demoDriverAccount.id } })
      } else {
        await prisma.driver.create({ data: { id: 'seed-driver-profile', name: 'Driver Portal', mobile: '', licenseNumber: 'DEMO-DRIVER', status: 'ACTIVE', userId: demoDriverAccount.id } })
      }
    }
  }

  const driverUsers = await prisma.user.findMany({ where: { role: 'DRIVER', deletedAt: null } })
  for (const driverUser of driverUsers) {
    let profile = await prisma.driver.findFirst({ where: { userId: driverUser.id } })
    if (!profile) {
      profile = await prisma.driver.findFirst({ where: { name: { equals: driverUser.name, mode: 'insensitive' }, deletedAt: null, userId: null } })
      if (profile) await prisma.driver.update({ where: { id: profile.id }, data: { userId: driverUser.id } })
      else profile = await prisma.driver.create({ data: { name: driverUser.name, mobile: '', licenseNumber: `LEGACY-${driverUser.id.slice(-8)}`, status: 'ACTIVE', userId: driverUser.id } })
    }
    if (!driverUser.username) {
      const base = driverUser.email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9._-]+/g, '-') || `driver-${driverUser.id.slice(-6)}`
      const username = `${base}-${driverUser.id.slice(-5).toLowerCase()}`
      await prisma.user.update({ where: { id: driverUser.id }, data: { username } })
    }
  }

  const unlinkedDrivers = await prisma.driver.findMany({ where: { deletedAt: null, userId: null } })
  for (const driver of unlinkedDrivers) {
    const base = driver.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '') || 'driver'
    const username = `${base}.${driver.id.slice(-6).toLowerCase()}`
    const temporaryPassword = randomBytes(32).toString('base64url')
    const salt = randomBytes(16).toString('hex')
    const passwordHash = `scrypt$${salt}$${scryptSync(temporaryPassword, salt, 64).toString('hex')}`
    const account = await prisma.user.create({ data: { name: driver.name, username, email: null, password: passwordHash, role: 'DRIVER', active: false } })
    await prisma.driver.update({ where: { id: driver.id }, data: { userId: account.id } })
  }
} finally {
  await prisma.$disconnect()
}
