import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { putAudit } from '@/lib/audit'

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = await req.json()
  const existing = await db.trip.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const data: any = {}
  if (body.date !== undefined) data.date = new Date(body.date)
  if (body.driverId !== undefined) data.driverId = body.driverId || null
  if (body.purpose !== undefined) data.purpose = body.purpose
  if (body.customer !== undefined) data.customer = body.customer
  if (body.startLocation !== undefined) data.startLocation = body.startLocation
  if (body.endLocation !== undefined) data.endLocation = body.endLocation
  if (body.timeOut !== undefined) data.timeOut = body.timeOut ? new Date(body.timeOut) : null
  if (body.timeIn !== undefined) data.timeIn = body.timeIn ? new Date(body.timeIn) : null
  if (body.notes !== undefined) data.notes = body.notes

  const s = body.startKm !== undefined ? Number(body.startKm) : existing.startKm
  const e = body.endKm !== undefined ? Number(body.endKm) : existing.endKm
  if (e < s) return NextResponse.json({ error: 'End KM cannot be less than Start KM' }, { status: 400 })
  data.startKm = s
  data.endKm = e
  data.distance = e - s

  const trip = await db.trip.update({ where: { id }, data, include: { vehicle: true, driver: true } })
  await putAudit({ userId: body.userId || 'seed', action: 'UPDATE', entity: 'Trip', entityId: id, details: `Updated trip ${trip.distance} km` })
  return NextResponse.json({ trip })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId') || 'seed'
  await db.trip.update({ where: { id }, data: { deletedAt: new Date() } })
  await putAudit({ userId, action: 'DELETE', entity: 'Trip', entityId: id, details: `Soft-deleted trip` })
  return NextResponse.json({ ok: true })
}
