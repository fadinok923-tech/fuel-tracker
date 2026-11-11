import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { putAudit } from '@/lib/audit'
import { forbiddenResponse, getRequestUser, hashPassword, isAdmin, unauthorizedResponse } from '@/lib/server-auth'

export async function GET(req: NextRequest) {
  const actor = await getRequestUser(req)
  if (!actor) return unauthorizedResponse()
  if (!isAdmin(actor)) return forbiddenResponse()
  const users = await db.user.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
    select: { id: true, email: true, username: true, name: true, role: true, active: true, createdAt: true, updatedAt: true, driverProfile: { select: { id: true, name: true } } },
  })
  return NextResponse.json({ users })
}

export async function POST(req: NextRequest) {
  const actor = await getRequestUser(req)
  if (!actor) return unauthorizedResponse()
  if (!isAdmin(actor)) return forbiddenResponse()
  const body = await req.json()
  const { name, username, email, password, role, active, driverProfileId } = body
  if (!name || !username || !password || !['ADMIN', 'MANAGER', 'DRIVER', 'READ_ONLY'].includes(role)) {
    return NextResponse.json({ error: 'Enter a name, username, password, and valid role' }, { status: 400 })
  }
  if (role === 'DRIVER' && !driverProfileId) {
    return NextResponse.json({ error: 'Select a driver profile to link this login to' }, { status: 400 })
  }
  const normalizedUsername = String(username).trim()
  if (!normalizedUsername) return NextResponse.json({ error: 'Username is required' }, { status: 400 })
  const duplicateUsername = await db.user.findFirst({ where: { username: { equals: normalizedUsername, mode: 'insensitive' }, deletedAt: null } })
  if (duplicateUsername) return NextResponse.json({ error: 'Username already exists' }, { status: 409 })
  const normalizedEmail = role === 'DRIVER' ? null : String(email || '').trim() || null
  if (normalizedEmail) {
    const duplicateEmail = await db.user.findFirst({ where: { email: { equals: normalizedEmail, mode: 'insensitive' }, deletedAt: null } })
    if (duplicateEmail) return NextResponse.json({ error: 'Email already exists' }, { status: 409 })
  }
  const user = await db.$transaction(async tx => {
    const driver = role === 'DRIVER'
      ? await tx.driver.findFirst({ where: { id: String(driverProfileId), userId: null, deletedAt: null, status: 'ACTIVE' } })
      : null
    if (role === 'DRIVER' && !driver) throw new Error('DRIVER_PROFILE_UNAVAILABLE')
    const account = await tx.user.create({
      data: { name: driver?.name || name, username: normalizedUsername, email: role === 'DRIVER' ? null : normalizedEmail, password: hashPassword(String(password)), role, active: active !== false },
      select: { id: true, email: true, username: true, name: true, role: true, active: true, createdAt: true },
    })
    if (driver) await tx.driver.update({ where: { id: driver.id }, data: { userId: account.id } })
    return account
  }).catch(error => {
    if (error instanceof Error && error.message === 'DRIVER_PROFILE_UNAVAILABLE') return null
    throw error
  })
  if (!user) return NextResponse.json({ error: 'That driver profile is already linked or inactive. Refresh and choose another profile.' }, { status: 409 })
  await putAudit({ userId: actor.id, action: 'CREATE', entity: 'User', entityId: user.id, details: `Created ${user.username} (${user.role})` })
  return NextResponse.json({ user })
}
