import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { putAudit } from '@/lib/audit'
import { forbiddenResponse, getRequestUser, hashPassword, isAdmin, unauthorizedResponse } from '@/lib/server-auth'

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getRequestUser(req)
  if (!actor) return unauthorizedResponse()
  if (!isAdmin(actor)) return forbiddenResponse()
  const { id } = await ctx.params
  const body = await req.json()
  const existing = await db.user.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.role === 'DRIVER' || body.role === 'DRIVER') return NextResponse.json({ error: 'Manage driver accounts from the Drivers page' }, { status: 400 })

  const data: any = {}
  if (body.name !== undefined) data.name = body.name
  if (body.email !== undefined) data.email = body.email || null
  if (body.active !== undefined) data.active = Boolean(body.active)
  if (body.role !== undefined) data.role = body.role
  if (body.password) data.password = hashPassword(String(body.password))
  const user = await db.user.update({ where: { id }, data, select: { id: true, email: true, username: true, name: true, role: true, active: true, createdAt: true } })
  await putAudit({ userId: actor.id, action: 'UPDATE', entity: 'User', entityId: id, details: `Updated ${user.email || user.username || user.name}` })
  return NextResponse.json({ user })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getRequestUser(req)
  if (!actor) return unauthorizedResponse()
  if (!isAdmin(actor)) return forbiddenResponse()
  const { id } = await ctx.params
  if (id === actor.id) return NextResponse.json({ error: 'You cannot deactivate your own account' }, { status: 400 })
  await db.user.update({ where: { id }, data: { deletedAt: new Date(), active: false } })
  await putAudit({ userId: actor.id, action: 'DELETE', entity: 'User', entityId: id, details: 'Soft-deactivated user' })
  return NextResponse.json({ ok: true })
}
