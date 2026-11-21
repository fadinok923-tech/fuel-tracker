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


export async function recalculateFuelMetrics(tx: Prisma.TransactionClient, vehicleId: string) {
  const entries = await tx.fuelEntry.findMany({
    where: { vehicleId, deletedAt: null },
    select: {
      id: true,
      date: true,
      createdAt: true,
      odometer: true,
      previousOdometer: true,
      liters: true,
      totalCost: true,
      distance: true,
      kmPerLiter: true,
      costPerKm: true,
    },
    orderBy: [
      { odometer: 'asc' },
      { date: 'asc' },
      { createdAt: 'asc' },
      { id: 'asc' },
    ],
  })

  let previousOdometer = entries[0]?.previousOdometer
  if (previousOdometer == null || previousOdometer > (entries[0]?.odometer ?? 0)) {
    previousOdometer = 0
  }

  let updatedEntries = 0
  for (const [index, entry] of entries.entries()) {
    if (index > 0) previousOdometer = entries[index - 1].odometer
    const distance = Math.max(0, entry.odometer - previousOdometer)
    const kmPerLiter = distance > 0 && entry.liters > 0 ? +(distance / entry.liters).toFixed(2) : null
    const costPerKm = distance > 0 ? +(entry.totalCost / distance).toFixed(3) : null
    const differs = (a: number | null, b: number | null) =>
      a === null || b === null ? a !== b : Math.abs(a - b) > 0.000001

    if (
      differs(entry.previousOdometer, previousOdometer) ||
      differs(entry.distance, distance) ||
      differs(entry.kmPerLiter, kmPerLiter) ||
      differs(entry.costPerKm, costPerKm)
    ) {
      await tx.fuelEntry.update({
        where: { id: entry.id },
        data: { previousOdometer, distance, kmPerLiter, costPerKm },
      })
      updatedEntries += 1
    }
  }

  return updatedEntries
}
