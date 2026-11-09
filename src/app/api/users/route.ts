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
  const { name, email, password, role, active } = body
  if (!name || !password || !role || role === 'DRIVER' || !email) {
    return NextResponse.json({ error: 'Staff accounts require a name, email, password, and non-driver role. Create drivers from the Drivers page.' }, { status: 400 })
  }
  const duplicate = await db.user.findFirst({ where: { email: { equals: email.trim(), mode: 'insensitive' }, deletedAt: null } })
  if (duplicate) return NextResponse.json({ error: 'Email already exists' }, { status: 409 })
  const user = await db.user.create({
    data: { name, email: email.trim(), password: hashPassword(String(password)), role, active: active !== false },
    select: { id: true, email: true, username: true, name: true, role: true, active: true, createdAt: true },
  })
  await putAudit({ userId: actor.id, action: 'CREATE', entity: 'User', entityId: user.id, details: `Created ${user.email} (${user.role})` })
  return NextResponse.json({ user })
}
