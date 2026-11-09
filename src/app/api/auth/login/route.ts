import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSessionToken, hashPassword, sessionCookie, verifyPassword } from '@/lib/server-auth'
import { putAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const identifier = String(body.identifier ?? body.email ?? body.username ?? '').trim()
  const password = String(body.password ?? '')
  if (!identifier || !password) {
    return NextResponse.json({ error: 'Username or email and password required' }, { status: 400 })
  }

  const user = await db.user.findFirst({
    where: {
      OR: [
        { username: { equals: identifier, mode: 'insensitive' } },
        { email: { equals: identifier, mode: 'insensitive' } },
      ],
      active: true,
      deletedAt: null,
    },
    include: { driverProfile: true },
  })

  if (!user || !verifyPassword(password, user.password) ||
    (user.role === 'DRIVER' && (!user.driverProfile || user.driverProfile.deletedAt || user.driverProfile.status !== 'ACTIVE'))) {
    return NextResponse.json({ error: 'Invalid username/email or password' }, { status: 401 })
  }

  if (!user.password.startsWith('scrypt$')) {
    await db.user.update({ where: { id: user.id }, data: { password: hashPassword(password) } })
  }

  await putAudit({ userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id, details: `Login as ${user.role}` })
  const response = NextResponse.json({
    user: { id: user.id, email: user.email, username: user.username, name: user.name, role: user.role },
  })
  response.cookies.set('fleet_session', createSessionToken(user.id), sessionCookie)
  return response
}
