import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { putAudit } from '@/lib/audit'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const driver = await db.driver.findUnique({ where: { id }, include: { assignedVehicle: true } })
  if (!driver) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ driver })
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = await req.json()
  const existing = await db.driver.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (body.licenseNumber) {
    const dup = await db.driver.findFirst({
      where: { licenseNumber: body.licenseNumber, id: { not: id }, deletedAt: null },
    })
    if (dup) return NextResponse.json({ error: 'License number already exists' }, { status: 400 })
  }

  const data: any = {}
  const fields = ['name','mobile','licenseNumber','status','notes']
  for (const f of fields) if (body[f] !== undefined) data[f] = body[f]
  if (body.licenseExpiry !== undefined) data.licenseExpiry = body.licenseExpiry ? new Date(body.licenseExpiry) : null

  if (body.assignedVehicleId !== undefined) {
    // disconnect old vehicle from this driver
    if (existing.assignedVehicleId) {
      await db.vehicle.update({ where: { id: existing.assignedVehicleId }, data: { assignedDriver: { disconnect: true } } }).catch(()=>{})
    }
    if (body.assignedVehicleId) {
      // remove this vehicle from any other driver currently holding it
      await db.driver.updateMany({ where: { assignedVehicleId: body.assignedVehicleId, id: { not: id } }, data: { assignedVehicleId: null } })
      data.assignedVehicle = { connect: { id: body.assignedVehicleId } }
      // ensure vehicle.assignedDriver is set
      await db.vehicle.update({ where: { id: body.assignedVehicleId }, data: { assignedDriver: { connect: { id } } } })
    } else {
      data.assignedVehicle = { disconnect: true }
    }
  }

  const driver = await db.driver.update({ where: { id }, data, include: { assignedVehicle: true } })
  await putAudit({ userId: body.userId || 'seed', action: 'UPDATE', entity: 'Driver', entityId: id, details: `Updated ${driver.name}` })
  return NextResponse.json({ driver })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId') || 'seed'
  const driver = await db.driver.update({ where: { id }, data: { deletedAt: new Date(), status: 'INACTIVE' } })
  await putAudit({ userId, action: 'DELETE', entity: 'Driver', entityId: id, details: `Soft-deleted ${driver.name}` })
  return NextResponse.json({ ok: true })
}
