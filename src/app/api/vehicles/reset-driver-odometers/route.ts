import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { putAudit } from '@/lib/audit'
import { forbiddenResponse, getRequestUser, unauthorizedResponse } from '@/lib/server-auth'

export async function POST(req: NextRequest) {
  const actor = await getRequestUser(req)
  if (!actor) return unauthorizedResponse()
  if (actor.role !== 'ADMIN') return forbiddenResponse()

  const assignments = await db.driver.findMany({
    where: { deletedAt: null, assignedVehicleId: { not: null } },
    select: { assignedVehicleId: true },
  })
  const vehicleIds = [...new Set(assignments.flatMap(driver => driver.assignedVehicleId ? [driver.assignedVehicleId] : []))]
  if (!vehicleIds.length) return NextResponse.json({ vehiclesReset: 0, vehicleNumbers: [] })

  const vehicles = await db.vehicle.findMany({
    where: { id: { in: vehicleIds }, deletedAt: null },
    select: { id: true, vehicleNumber: true, currentOdometer: true },
  })

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
  await putAudit({
    userId: actor.id,
    action: 'UPDATE',
    entity: 'Vehicle',
    entityId: 'bulk-driver-odometer-reset',
    details: `Reset odometers to zero for ${vehicles.length} driver-assigned vehicles: ${vehicleNumbers.join(', ')}`,
  })

  return NextResponse.json({ vehiclesReset: vehicles.length, vehicleNumbers })
}
