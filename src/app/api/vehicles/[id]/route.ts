import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { putAudit } from '@/lib/audit'

// GET /api/vehicles/[id]
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const vehicle = await db.vehicle.findUnique({ where: { id }, include: { assignedDriver: true } })
  if (!vehicle) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ vehicle })
}

// PUT /api/vehicles/[id] - update vehicle
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = await req.json()
  const existing = await db.vehicle.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (body.vehicleNumber || body.plateNumber) {
    const dup = await db.vehicle.findFirst({
      where: {
        AND: [
          { id: { not: id } },
          { OR: [{ vehicleNumber: body.vehicleNumber }, { plateNumber: body.plateNumber }] },
          { deletedAt: null },
        ],
      },
    })
    if (dup) return NextResponse.json({ error: 'Vehicle number or plate already exists on another record' }, { status: 400 })
  }

  const data: any = {}
  const fields = ['vehicleNumber','plateNumber','vehicleName','brand','model','fuelType','status','notes']
  for (const f of fields) if (body[f] !== undefined) data[f] = body[f]
  if (body.year !== undefined) data.year = Number(body.year)
  if (body.tankCapacity !== undefined) data.tankCapacity = Number(body.tankCapacity)
  if (body.currentOdometer !== undefined) data.currentOdometer = Number(body.currentOdometer)
  if (body.purchasePrice !== undefined) data.purchasePrice = body.purchasePrice === null ? null : Number(body.purchasePrice)
  if (body.insuranceExpiry !== undefined) data.insuranceExpiry = body.insuranceExpiry ? new Date(body.insuranceExpiry) : null
  if (body.registrationExpiry !== undefined) data.registrationExpiry = body.registrationExpiry ? new Date(body.registrationExpiry) : null
  if (body.purchaseDate !== undefined) data.purchaseDate = body.purchaseDate ? new Date(body.purchaseDate) : null
  if (body.oilChangeKmInterval !== undefined) data.oilChangeKmInterval = Number(body.oilChangeKmInterval)
  if (body.serviceKmInterval !== undefined) data.serviceKmInterval = Number(body.serviceKmInterval)
  if (body.tyreKmInterval !== undefined) data.tyreKmInterval = Number(body.tyreKmInterval)
  if (body.batteryIntervalDays !== undefined) data.batteryIntervalDays = Number(body.batteryIntervalDays)
  if (body.lastOilChangeKm !== undefined) data.lastOilChangeKm = body.lastOilChangeKm === null ? null : Number(body.lastOilChangeKm)
  if (body.lastServiceKm !== undefined) data.lastServiceKm = body.lastServiceKm === null ? null : Number(body.lastServiceKm)
  if (body.lastTyreChangeKm !== undefined) data.lastTyreChangeKm = body.lastTyreChangeKm === null ? null : Number(body.lastTyreChangeKm)
  if (body.lastBatteryChange !== undefined) data.lastBatteryChange = body.lastBatteryChange ? new Date(body.lastBatteryChange) : null

  if (body.assignedDriverId !== undefined) {
    if (existing.assignedDriverId) {
      await db.driver.update({ where: { id: existing.assignedDriverId }, data: { assignedVehicleId: null } }).catch(()=>{})
    }
    if (body.assignedDriverId) {
      await db.driver.updateMany({ where: { assignedVehicleId: id }, data: { assignedVehicleId: null } })
      await db.driver.update({ where: { id: body.assignedDriverId }, data: { assignedVehicleId: id } })
      data.assignedDriver = { connect: { id: body.assignedDriverId } }
    } else {
      data.assignedDriver = { disconnect: true }
    }
  }

  const vehicle = await db.vehicle.update({ where: { id }, data, include: { assignedDriver: true } })
  await putAudit({ userId: body.userId || 'seed', action: 'UPDATE', entity: 'Vehicle', entityId: id, details: `Updated ${vehicle.vehicleNumber}` })
  return NextResponse.json({ vehicle })
}

// DELETE - soft delete
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId') || 'seed'
  const vehicle = await db.vehicle.update({ where: { id }, data: { deletedAt: new Date(), status: 'RETIRED' } })
  await putAudit({ userId, action: 'DELETE', entity: 'Vehicle', entityId: id, details: `Soft-deleted ${vehicle.vehicleNumber}` })
  return NextResponse.json({ ok: true })
}
