import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { putAudit } from '@/lib/audit'
import { forbiddenResponse, getRequestUser, hashPassword, isAdmin, unauthorizedResponse } from '@/lib/server-auth'

const driverInclude = { assignedVehicle: true, user: { select: { id: true, username: true, active: true } } }

export async function GET(req: NextRequest) {
  const user = await getRequestUser(req)
  if (!user) return unauthorizedResponse()
  const where: any = user.role === 'DRIVER' ? { id: user.driverProfile!.id } : { deletedAt: null }
  const drivers = await db.driver.findMany({ where, include: driverInclude, orderBy: { name: 'asc' } })
  return NextResponse.json({ drivers })
}

export async function POST(req: NextRequest) {
  const user = await getRequestUser(req)
  if (!user) return unauthorizedResponse()
  if (!isAdmin(user)) return forbiddenResponse()
  const body = await req.json()
  const { name, mobile, licenseNumber, licenseExpiry, status, notes, assignedVehicleId, username, password } = body
  if (!name || !licenseNumber || !username || !password) {
    return NextResponse.json({ error: 'Name, license number, username, and password are required' }, { status: 400 })
  }
  const duplicate = await db.driver.findFirst({ where: { licenseNumber, deletedAt: null } })
  if (duplicate) return NextResponse.json({ error: 'License number already exists' }, { status: 409 })
  const duplicateUsername = await db.user.findFirst({ where: { username: { equals: username.trim(), mode: 'insensitive' }, deletedAt: null } })
  if (duplicateUsername) return NextResponse.json({ error: 'Username already exists' }, { status: 409 })

  const driver = await db.$transaction(async tx => {
    const account = await tx.user.create({ data: { name, username: username.trim(), email: null, password: hashPassword(String(password)), role: 'DRIVER', active: status !== 'INACTIVE' } })
    return tx.driver.create({
      data: {
        name, mobile: mobile || '', licenseNumber,
        licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : null,
        status: status || 'ACTIVE', notes: notes || null,
        assignedVehicleId: assignedVehicleId || null,
        userId: account.id,
      },
      include: driverInclude,
    })
  })

  await putAudit({ userId: user.id, action: 'CREATE', entity: 'Driver', entityId: driver.id, details: `Created driver account for ${driver.name}` })
  return NextResponse.json({ driver })
}
