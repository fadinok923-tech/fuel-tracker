import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { putAudit } from '@/lib/audit'
import { forbiddenResponse, getRequestUser, unauthorizedResponse } from '@/lib/server-auth'

export async function POST(req: NextRequest) {
  const actor = await getRequestUser(req)
  if (!actor) return unauthorizedResponse()
  if (actor.role !== 'ADMIN') return forbiddenResponse()

  const body = await req.json().catch(() => ({}))
  const requestedDriverId = typeof body.driverId === 'string' && body.driverId.trim()
    ? body.driverId.trim()
    : null

  const assignments = requestedDriverId
    ? await db.driver.findMany({
        where: { id: requestedDriverId, deletedAt: null, assignedVehicleId: { not: null } },
        select: { id: true, name: true, assignedVehicleId: true },
      })
    : await db.driver.findMany({
        where: { deletedAt: null, assignedVehicleId: { not: null } },
        select: { id: true, name: true, assignedVehicleId: true },
      })
  if (requestedDriverId && !assignments.length) {
    return NextResponse.json({ error: 'Driver not found or has no assigned vehicle' }, { status: 404 })
  }

  const vehicleIds = [...new Set(assignments.flatMap(driver => driver.assignedVehicleId ? [driver.assignedVehicleId] : []))]
  if (!vehicleIds.length) return NextResponse.json({ vehiclesReset: 0, vehicleNumbers: [] })

  const vehicles = await db.vehicle.findMany({
    where: { id: { in: vehicleIds }, deletedAt: null },
    select: { id: true, vehicleNumber: true, currentOdometer: true },
  })
  if (requestedDriverId && !vehicles.length) {
    return NextResponse.json({ error: 'The driver’s assigned vehicle is unavailable' }, { status: 404 })
  }

  await db.$transaction(async tx => {
    for (const vehicle of vehicles) {
      await tx.vehicle.update({
        where: { id: vehicle.id },
        data: {
          odometerOffset: { increment: vehicle.currentOdometer },
          currentOdometer: 0,
          odometerCycle: { increment: 1 },
        },
      })
    }
  })

  const vehicleNumbers = vehicles.map(vehicle => vehicle.vehicleNumber)
  const driverName = requestedDriverId ? assignments[0].name : null
  await putAudit({
    userId: actor.id,
    action: 'UPDATE',
    entity: 'Vehicle',
    entityId: requestedDriverId ? vehicles[0].id : 'bulk-driver-odometer-reset',
    details: requestedDriverId
      ? `Reset odometer to zero for ${driverName}’s vehicle ${vehicleNumbers[0]}`
      : `Reset odometers to zero for ${vehicles.length} driver-assigned vehicles: ${vehicleNumbers.join(', ')}`,
  })

  return NextResponse.json({ vehiclesReset: vehicles.length, vehicleNumbers, driverName })
}
