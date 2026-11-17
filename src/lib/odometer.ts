import type { Prisma } from '@prisma/client'

export async function recalculateVehicleOdometer(tx: Prisma.TransactionClient, vehicleId: string) {
  const [fuel, trip] = await Promise.all([
    tx.fuelEntry.aggregate({
      where: { vehicleId, deletedAt: null },
      _max: { odometer: true },
    }),
    tx.trip.aggregate({
      where: { vehicleId, deletedAt: null },
      _max: { endKm: true },
    }),
  ])

  const currentOdometer = Math.max(
    fuel._max.odometer ?? 0,
    trip._max.endKm ?? 0,
  )

  await tx.vehicle.update({
    where: { id: vehicleId },
    data: { currentOdometer },
  })

  return currentOdometer
}
