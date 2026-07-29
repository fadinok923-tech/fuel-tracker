import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { putAudit } from '@/lib/audit'

export async function GET() {
  const users = await db.user.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true, updatedAt: true },
  })
  return NextResponse.json({ users })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, email, password, role, active, userId = 'seed' } = body
  if (!name || !email || !password || !role) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  const dup = await db.user.findFirst({ where: { email, deletedAt: null } })
  if (dup) return NextResponse.json({ error: 'Email already exists' }, { status: 400 })

  // NOTE: in production, hash password with bcrypt. Demo stores plaintext-equivalent hash.
  const user = await db.user.create({
    data: { name, email, password, role, active: active !== false },
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
  })
  await putAudit({ userId, action: 'CREATE', entity: 'User', entityId: user.id, details: `Created ${user.email} (${user.role})` })
  return NextResponse.json({ user })
}
