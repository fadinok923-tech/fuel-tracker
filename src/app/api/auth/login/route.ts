import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { putAudit } from '@/lib/audit'

// POST /api/auth/login
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { email, password } = body
  if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 })

  const user = await db.user.findFirst({ where: { email, deletedAt: null, active: true } })
  if (!user || user.password !== password) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  await putAudit({ userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id, details: `Login as ${user.role}` })

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    token: Buffer.from(`${user.id}:${user.role}:${Date.now()}`).toString('base64'),
  })
}
