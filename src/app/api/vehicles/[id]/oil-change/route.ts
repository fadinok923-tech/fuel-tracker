import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { putAudit } from '@/lib/audit'
import { forbiddenResponse, getRequestUser, isManager, unauthorizedResponse } from '@/lib/server-auth'

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(req)
  if (!user) return unauthorizedResponse()

  const { id } = await ctx.params
  if (user.role === 'DRIVER') {
    if (!user.driverProfile?.assignedVehicleId || user.driverProfile.assignedVehicleId !== id) {
      return forbiddenResponse()
    }
  } else if (!isManager(user)) {
    return forbiddenResponse()
  }

  const body = await req.json()
  const odometer = Number(body.odometer)
  if (!Number.isFinite(odometer) || odometer < 0) {
    return NextResponse.json({ error: 'Enter a valid current odometer reading' }, { status: 400 })
  }

  const vehicle = await db.vehicle.findUnique({ where: { id } })
  if (!vehicle || vehicle.deletedAt) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
  if (odometer < vehicle.currentOdometer) {
    return NextResponse.json({ error: `Reading cannot be below the saved odometer (${vehicle.currentOdometer} km)` }, { status: 400 })
  }

  const updated = await db.vehicle.update({
    where: { id },
    data: {
      currentOdometer: Math.max(vehicle.currentOdometer, odometer),
      lastOilChangeKm: odometer,
    },
    select: { id: true, vehicleNumber: true, currentOdometer: true, lastOilChangeKm: true },
  })

  await putAudit({
    userId: user.id,
    action: 'UPDATE',
    entity: 'Vehicle',
    entityId: id,
    details: `Oil-service reminder reset for ${vehicle.vehicleNumber} at ${odometer} km; lifetime odometer retained`,
  })

  return NextResponse.json({ vehicle: updated })
}
