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
  const existing = await db.fuelEntry.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (body.invoiceNumber !== undefined && String(body.invoiceNumber || '').trim()) {
    const invoice = String(body.invoiceNumber).trim()
    const duplicateFuel = await db.fuelEntry.findFirst({ where: { invoiceNumber: { equals: invoice, mode: 'insensitive' }, deletedAt: null, id: { not: id } } })
    const duplicateMaintenance = await db.maintenance.findFirst({ where: { invoiceNumber: { equals: invoice, mode: 'insensitive' }, deletedAt: null } })
    if (duplicateFuel || duplicateMaintenance) return NextResponse.json({ error: 'This invoice number has already been recorded' }, { status: 409 })
  }

  const data: any = {}
  if (body.date !== undefined) data.date = new Date(body.date)
  if (body.driverId !== undefined) data.driverId = body.driverId || null
  if (body.fuelStation !== undefined) data.fuelStation = body.fuelStation
  if (body.invoiceNumber !== undefined) data.invoiceNumber = body.invoiceNumber
  if (body.paymentMethod !== undefined) data.paymentMethod = body.paymentMethod
  if (body.notes !== undefined) data.notes = body.notes
  if (body.receiptImage !== undefined) data.receiptImage = body.receiptImage

  // if odometer/liters/price changes, recompute
  const newOdo = body.odometer !== undefined ? Number(body.odometer) : existing.odometer
  const newLiters = body.liters !== undefined ? Number(body.liters) : existing.liters
  const newPrice = body.pricePerLiter !== undefined ? Number(body.pricePerLiter) : existing.pricePerLiter

  if (body.odometer !== undefined) {
    const prev = await db.fuelEntry.findFirst({
      where: { vehicleId: existing.vehicleId, deletedAt: null, id: { not: id }, odometer: { lte: newOdo } },
      orderBy: { date: 'desc' },
    })
    const prevOdo = prev ? prev.odometer : 0
    data.odometer = newOdo
    data.previousOdometer = prevOdo
    data.distance = newOdo - prevOdo
    if (data.distance < 0) return NextResponse.json({ error: 'Odometer cannot be less than previous reading' }, { status: 400 })
  }
  if (body.liters !== undefined) data.liters = newLiters
  if (body.pricePerLiter !== undefined) data.pricePerLiter = newPrice

  const totalCost = +(newLiters * newPrice).toFixed(2)
  data.totalCost = totalCost
  const distance = data.distance !== undefined ? data.distance : existing.distance || 0
  data.kmPerLiter = distance > 0 ? +(distance / newLiters).toFixed(2) : null
  data.costPerKm = distance > 0 ? +(totalCost / distance).toFixed(3) : null

  const entry = await db.fuelEntry.update({ where: { id }, data, include: { vehicle: true, driver: true } })

  // Update vehicle odometer if needed
  if (body.odometer !== undefined) {
    const v = await db.vehicle.findUnique({ where: { id: existing.vehicleId } })
    if (v && newOdo > v.currentOdometer) {
      await db.vehicle.update({ where: { id: v.id }, data: { currentOdometer: newOdo } })
    }
  }

  await putAudit({ userId: actor.id, action: 'UPDATE', entity: 'FuelEntry', entityId: id, details: `Updated fuel entry` })
  return NextResponse.json({ entry })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getRequestUser(req)
  if (!actor) return unauthorizedResponse()
  if (!isManager(actor)) return forbiddenResponse()
  const { id } = await ctx.params
  await db.fuelEntry.update({ where: { id }, data: { deletedAt: new Date() } })
  await putAudit({ userId: actor.id, action: 'DELETE', entity: 'FuelEntry', entityId: id, details: `Soft-deleted fuel entry` })
  return NextResponse.json({ ok: true })
}
