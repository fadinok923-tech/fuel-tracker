import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { putAudit } from '@/lib/audit'

// POST /api/auth/login
export async function POST(req: NextRequest) {
  const body = await req.json()
  const identifier = String(body.identifier ?? body.email ?? body.name ?? '').trim()
  const password = body.password
  if (!identifier || !password) {
    return NextResponse.json({ error: 'Name or email and password required' }, { status: 400 })
  }

  // Drivers can sign in with their name. Other roles continue to use email.
  const user = identifier.includes('@')
    ? await db.user.findFirst({
        where: { email: identifier, deletedAt: null, active: true },
      })
    : await db.user.findFirst({
        where: {
          name: { equals: identifier, mode: 'insensitive' },
          role: 'DRIVER',
          deletedAt: null,
          active: true,
        },
      })

  if (!user || user.password !== password) {
    return NextResponse.json({ error: 'Invalid name/email or password' }, { status: 401 })
  }

  await putAudit({ userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id, details: `Login as ${user.role}` })

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    token: Buffer.from(`${user.id}:${user.role}:${Date.now()}`).toString('base64'),
  })
}
