import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { putAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const includeDeleted = searchParams.get('includeDeleted') === 'true'
  const where: any = includeDeleted ? {} : { deletedAt: null }
  const drivers = await db.driver.findMany({
    where,
    include: { assignedVehicle: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ drivers })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, mobile, licenseNumber, licenseExpiry, status, notes, assignedVehicleId, userId = 'seed' } = body

  const dup = await db.driver.findFirst({ where: { licenseNumber, deletedAt: null } })
  if (dup) return NextResponse.json({ error: 'License number already exists' }, { status: 400 })

  const data: any = {
    name, mobile, licenseNumber,
    licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : null,
    status: status || 'ACTIVE', notes,
  }
  if (assignedVehicleId) {
    // remove vehicle from any other driver currently holding it
    await db.driver.updateMany({ where: { assignedVehicleId }, data: { assignedVehicleId: null } })
    data.assignedVehicle = { connect: { id: assignedVehicleId } }
  }
  const driver = await db.driver.create({ data, include: { assignedVehicle: true } })

  // back-fill vehicle.assignedDriverId (1-to-1)
  if (assignedVehicleId) {
    await db.vehicle.updateMany({ where: { assignedDriverId: { not: undefined } }, data: {} }) // no-op to keep TS happy
    await db.vehicle.update({ where: { id: assignedVehicleId }, data: { assignedDriver: { connect: { id: driver.id } } } })
  }

  await putAudit({ userId, action: 'CREATE', entity: 'Driver', entityId: driver.id, details: `Created ${driver.name}` })
  return NextResponse.json({ driver })
}
