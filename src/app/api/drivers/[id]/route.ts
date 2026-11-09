import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { putAudit } from '@/lib/audit'
import { forbiddenResponse, getRequestUser, hashPassword, isAdmin, isManager, unauthorizedResponse } from '@/lib/server-auth'

const driverInclude = { assignedVehicle: true, user: { select: { id: true, username: true, active: true } } }

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(req)
  if (!user) return unauthorizedResponse()
  const { id } = await ctx.params
  if (user.role === 'DRIVER' && user.driverProfile?.id !== id) return forbiddenResponse()
  const driver = await db.driver.findUnique({ where: { id }, include: driverInclude })
  if (!driver) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ driver })
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getRequestUser(req)
  if (!actor) return unauthorizedResponse()
  if (!isManager(actor)) return forbiddenResponse()
  const { id } = await ctx.params
  const body = await req.json()
  const existing = await db.driver.findUnique({ where: { id }, include: { user: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const changesAccount = body.username !== undefined || body.password !== undefined || body.status === 'INACTIVE' || body.active !== undefined
  if (changesAccount && !isAdmin(actor)) return forbiddenResponse()
  if (body.username) {
    const duplicate = await db.user.findFirst({ where: { username: { equals: body.username.trim(), mode: 'insensitive' }, id: { not: existing.userId || '' }, deletedAt: null } })
    if (duplicate) return NextResponse.json({ error: 'Username already exists' }, { status: 409 })
  }
  if (body.licenseNumber) {
    const duplicate = await db.driver.findFirst({ where: { licenseNumber: body.licenseNumber, id: { not: id }, deletedAt: null } })
    if (duplicate) return NextResponse.json({ error: 'License number already exists' }, { status: 409 })
  }

  const data: any = {}
  for (const field of ['name', 'mobile', 'licenseNumber', 'status', 'notes'] as const) if (body[field] !== undefined) data[field] = body[field]
  if (body.licenseExpiry !== undefined) data.licenseExpiry = body.licenseExpiry ? new Date(body.licenseExpiry) : null
  if (body.assignedVehicleId !== undefined) data.assignedVehicleId = body.assignedVehicleId || null

  const driver = await db.$transaction(async tx => {
    const updated = await tx.driver.update({ where: { id }, data, include: driverInclude })
    if (existing.userId) {
      const accountData: any = { active: body.active !== undefined ? Boolean(body.active) : body.status !== undefined ? body.status !== 'INACTIVE' : existing.user?.active ?? true }
      if (body.username !== undefined) accountData.username = body.username.trim()
      if (body.password) accountData.password = hashPassword(String(body.password))
      if (body.name !== undefined) accountData.name = body.name
      await tx.user.update({ where: { id: existing.userId }, data: accountData })
    } else if (body.username && body.password) {
      const account = await tx.user.create({ data: { name: body.name || existing.name, username: body.username.trim(), email: null, password: hashPassword(String(body.password)), role: 'DRIVER', active: body.status !== 'INACTIVE' } })
      await tx.driver.update({ where: { id }, data: { userId: account.id } })
    } else if (body.username || body.password) {
      throw new Error('A username and password are both required to create the driver account.')
    }
    return tx.driver.findUniqueOrThrow({ where: { id }, include: driverInclude })
  })

  await putAudit({ userId: actor.id, action: 'UPDATE', entity: 'Driver', entityId: id, details: `Updated ${driver.name}` })
  return NextResponse.json({ driver })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getRequestUser(req)
  if (!actor) return unauthorizedResponse()
  if (!isAdmin(actor)) return forbiddenResponse()
  const { id } = await ctx.params
  const current = await db.driver.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const driver = await db.$transaction(async tx => {
    if (current.userId) await tx.user.update({ where: { id: current.userId }, data: { active: false } })
    return tx.driver.update({ where: { id }, data: { deletedAt: new Date(), status: 'INACTIVE' }, include: driverInclude })
  })
  await putAudit({ userId: actor.id, action: 'DELETE', entity: 'Driver', entityId: id, details: `Deactivated ${driver.name} and login` })
  return NextResponse.json({ ok: true })
}
