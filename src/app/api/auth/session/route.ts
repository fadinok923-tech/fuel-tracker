import { NextRequest, NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/server-auth'

export async function GET(req: NextRequest) {
  const user = await getRequestUser(req)
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  return NextResponse.json({ user: { id: user.id, name: user.name, username: user.username, email: user.email, role: user.role } })
}
