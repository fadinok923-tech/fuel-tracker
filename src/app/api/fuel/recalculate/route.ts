import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { putAudit } from '@/lib/audit'
import { recalculateFuelMetrics } from '@/lib/odometer'
import { forbiddenResponse, getRequestUser, unauthorizedResponse } from '@/lib/server-auth'

export async function POST(req: NextRequest) {
  const user = await getRequestUser(req)
  if (!user) return unauthorizedResponse()
  if (user.role !== 'ADMIN') return forbiddenResponse()

  const vehicles = await db.fuelEntry.findMany({
    where: { deletedAt: null },
    distinct: ['vehicleId'],
    select: { vehicleId: true },
  })

  const updatedEntries = await db.$transaction(async tx => {
    let updated = 0
    for (const { vehicleId } of vehicles) {
      updated += await recalculateFuelMetrics(tx, vehicleId)
    }
    return updated
  }, { timeout: 60000 })

  await putAudit({
    userId: user.id,
    action: 'UPDATE',
    entity: 'FuelEntry',
    entityId: 'mileage-recalculation',
    details: `Recalculated mileage for ${updatedEntries} fuel entries across ${vehicles.length} vehicles`,
  })

  return NextResponse.json({ updatedEntries, vehiclesProcessed: vehicles.length })
}
