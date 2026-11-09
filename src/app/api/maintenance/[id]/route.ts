import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { putAudit } from '@/lib/audit'
import { forbiddenResponse, getRequestUser, isManager, unauthorizedResponse } from '@/lib/server-auth'

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getRequestUser(req)
  if (!actor) return unauthorizedResponse()
  if (!isManager(actor)) return forbiddenResponse()
  const { id } = await ctx.params
  const body = await req.json()
  const existing = await db.maintenance.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (body.invoiceNumber !== undefined && String(body.invoiceNumber || '').trim()) {
    const invoice = String(body.invoiceNumber).trim()
    const duplicateMaintenance = await db.maintenance.findFirst({ where: { invoiceNumber: { equals: invoice, mode: 'insensitive' }, deletedAt: null, id: { not: id } } })
    const duplicateFuel = await db.fuelEntry.findFirst({ where: { invoiceNumber: { equals: invoice, mode: 'insensitive' }, deletedAt: null } })
    if (duplicateMaintenance || duplicateFuel) return NextResponse.json({ error: 'This invoice number has already been recorded' }, { status: 409 })
  }

  const data: any = {}
  if (body.date !== undefined) data.date = new Date(body.date)
  if (body.expenseType !== undefined) data.expenseType = body.expenseType
  if (body.amount !== undefined) data.amount = Number(body.amount)
  if (body.workshop !== undefined) data.workshop = body.workshop
  if (body.invoiceNumber !== undefined) data.invoiceNumber = body.invoiceNumber
  if (body.notes !== undefined) data.notes = body.notes
  if (body.invoiceImage !== undefined) data.invoiceImage = body.invoiceImage

  const item = await db.maintenance.update({ where: { id }, data, include: { vehicle: true } })
  await putAudit({ userId: actor.id, action: 'UPDATE', entity: 'Maintenance', entityId: id, details: `Updated maintenance` })
  return NextResponse.json({ item })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getRequestUser(req)
  if (!actor) return unauthorizedResponse()
  if (!isManager(actor)) return forbiddenResponse()
  const { id } = await ctx.params
  await db.maintenance.update({ where: { id }, data: { deletedAt: new Date() } })
  await putAudit({ userId: actor.id, action: 'DELETE', entity: 'Maintenance', entityId: id, details: `Soft-deleted maintenance` })
  return NextResponse.json({ ok: true })
}
