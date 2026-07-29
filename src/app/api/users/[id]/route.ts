import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { putAudit } from '@/lib/audit'

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = await req.json()
  const existing = await db.user.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const data: any = {}
  if (body.name !== undefined) data.name = body.name
  if (body.email !== undefined) data.email = body.email
  if (body.role !== undefined) data.role = body.role
  if (body.active !== undefined) data.active = body.active
  if (body.password) data.password = body.password // demo only

  const user = await db.user.update({ where: { id }, data, select: { id: true, email: true, name: true, role: true, active: true, createdAt: true } })
  await putAudit({ userId: body.userId || 'seed', action: 'UPDATE', entity: 'User', entityId: id, details: `Updated ${user.email}` })
  return NextResponse.json({ user })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId') || 'seed'
  await db.user.update({ where: { id }, data: { deletedAt: new Date(), active: false } })
  await putAudit({ userId, action: 'DELETE', entity: 'User', entityId: id, details: `Soft-deleted user` })
  return NextResponse.json({ ok: true })
}
