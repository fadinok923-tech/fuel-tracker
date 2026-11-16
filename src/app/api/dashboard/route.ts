import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser, unauthorizedResponse } from '@/lib/server-auth'

// Aggregated KPI endpoint for dashboard
export async function GET(req: NextRequest) {
  const user = await getRequestUser(req)
  if (!user) return unauthorizedResponse()
  const { searchParams } = new URL(req.url)
  const fromStr = searchParams.get('from')
  const toStr = searchParams.get('to')

  // Default to current month
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  const from = fromStr ? new Date(fromStr) : monthStart
  const to = toStr ? new Date(toStr) : monthEnd

  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999)

  const vehicleWhere: any = { deletedAt: null }
  const recordScope: any = { deletedAt: null }
  if (user.role === 'DRIVER') {
    vehicleWhere.id = user.driverProfile!.assignedVehicleId || '__unassigned__'
    recordScope.vehicleId = user.driverProfile!.assignedVehicleId || '__unassigned__'
  }
  // Drivers see their own fuel and trip history, including records from a vehicle
  // they were previously assigned. Vehicle and maintenance summaries stay scoped
  // to their currently assigned vehicle.
  const fuelTripScope = user.role === 'DRIVER' ? { deletedAt: null, driverId: user.driverProfile!.id } : recordScope
  const maintenanceQuery = user.role === 'DRIVER'
    ? Promise.resolve([] as Array<{ vehicleId: string; amount: number }>)
    : db.maintenance.findMany({
        where: { ...recordScope, date: { gte: from, lte: to } },
        select: { vehicleId: true, amount: true },
      })
  const [vehicles, fuelEntries, trips, maintenance, todayTrips] = await Promise.all([
    db.vehicle.findMany({
      where: vehicleWhere,
      select: { id: true, vehicleNumber: true, vehicleName: true, brand: true, model: true, status: true, currentOdometer: true, assignedDriver: { select: { name: true } } },
    }),
    db.fuelEntry.findMany({
      where: { ...fuelTripScope, date: { gte: from, lte: to } },
      select: { vehicleId: true, totalCost: true, liters: true, distance: true, kmPerLiter: true },
    }),
    db.trip.findMany({
      where: { ...fuelTripScope, date: { gte: from, lte: to } },
      select: { vehicleId: true, distance: true },
    }),
    maintenanceQuery,
    db.trip.findMany({
      where: { ...fuelTripScope, date: { gte: startOfToday, lte: endOfToday } },
      select: { distance: true },
    }),
  ])

  const totalVehicles = vehicles.length
  const runningVehicles = vehicles.filter(v => v.status === 'ACTIVE').length
  const inServiceVehicles = vehicles.filter(v => v.status === 'IN_SERVICE').length

  const todayKm = todayTrips.reduce((s, t) => s + (t.distance || 0), 0)
  const monthlyKm = trips.reduce((s, t) => s + (t.distance || 0), 0)

  const totalFuelCost = fuelEntries.reduce((s, f) => s + (f.totalCost || 0), 0)
  const totalFuelLiters = fuelEntries.reduce((s, f) => s + (f.liters || 0), 0)
  const totalMaintenanceCost = maintenance.reduce((s, m) => s + (m.amount || 0), 0)
  const totalOperatingCost = totalFuelCost + totalMaintenanceCost

  // Average KM/L across all entries (only those with distance > 0)
  const validFuel = fuelEntries.filter(f => f.distance && f.distance > 0)
  const avgKmPerLiter = validFuel.length > 0
    ? validFuel.reduce((s, f) => s + (f.kmPerLiter || 0), 0) / validFuel.length
    : 0
  const avgFuelCost = fuelEntries.length > 0 ? totalFuelCost / fuelEntries.length : 0
  const avgCostPerKm = monthlyKm > 0 ? totalFuelCost / monthlyKm : 0

  // Per-vehicle stats for the comparison table
  const byVehicle = new Map(vehicles.map(vehicle => [vehicle.id, { km: 0, liters: 0, fuelCost: 0, maintenanceCost: 0, kmLTotal: 0, kmLCount: 0 }]))
  for (const fuel of fuelEntries) {
    const stats = byVehicle.get(fuel.vehicleId)
    if (!stats) continue
    stats.liters += fuel.liters || 0
    stats.fuelCost += fuel.totalCost || 0
    if (fuel.distance && fuel.distance > 0) { stats.kmLTotal += fuel.kmPerLiter || 0; stats.kmLCount++ }
  }
  for (const trip of trips) { const stats = byVehicle.get(trip.vehicleId); if (stats) stats.km += trip.distance || 0 }
  for (const item of maintenance) { const stats = byVehicle.get(item.vehicleId); if (stats) stats.maintenanceCost += item.amount || 0 }

  const perVehicle = vehicles.map((v) => {
    const stats = byVehicle.get(v.id)!
    const vKm = stats.km
    const vLiters = stats.liters
    const vFuelCost = stats.fuelCost
    const vMaintCost = stats.maintenanceCost
    const kmL = stats.kmLCount > 0 ? stats.kmLTotal / stats.kmLCount : 0
    const costPerKm = vKm > 0 ? (vFuelCost + vMaintCost) / vKm : 0
    return {
      id: v.id,
      vehicleNumber: v.vehicleNumber,
      vehicleName: v.vehicleName,
      brand: v.brand,
      model: v.model,
      driver: v.assignedDriver?.name || null,
      monthlyKm: +vKm.toFixed(0),
      fuelLiters: +vLiters.toFixed(1),
      fuelCost: +vFuelCost.toFixed(2),
      maintenanceCost: +vMaintCost.toFixed(2),
      totalCost: +(vFuelCost + vMaintCost).toFixed(2),
      kmPerLiter: +kmL.toFixed(2),
      costPerKm: +costPerKm.toFixed(3),
      currentOdometer: v.currentOdometer,
      status: v.status,
    }
  })

  // Top fuel consuming, most/least efficient, highest/lowest running
  const valid = perVehicle.filter(v => v.fuelLiters > 0)
  const topFuelConsumer = valid.length > 0 ? valid.reduce((a, b) => a.fuelCost > b.fuelCost ? a : b) : null
  const mostEfficient = valid.length > 0 ? valid.reduce((a, b) => a.kmPerLiter > b.kmPerLiter ? a : b) : null
  const leastEfficient = valid.length > 0 ? valid.reduce((a, b) => a.kmPerLiter < b.kmPerLiter ? a : b) : null
  const highestRunning = perVehicle.length > 0 ? perVehicle.reduce((a, b) => a.monthlyKm > b.monthlyKm ? a : b) : null
  const lowestRunning = perVehicle.length > 0 ? perVehicle.reduce((a, b) => a.monthlyKm < b.monthlyKm ? a : b) : null

  return NextResponse.json({
    range: { from, to },
    kpis: {
      totalVehicles, runningVehicles, inServiceVehicles,
      todayKm: +todayKm.toFixed(0),
      monthlyKm: +monthlyKm.toFixed(0),
      totalFuelCost: +totalFuelCost.toFixed(2),
      totalFuelLiters: +totalFuelLiters.toFixed(1),
      totalMaintenanceCost: +totalMaintenanceCost.toFixed(2),
      totalOperatingCost: +totalOperatingCost.toFixed(2),
      avgFuelCost: +avgFuelCost.toFixed(2),
      avgKmPerLiter: +avgKmPerLiter.toFixed(2),
      avgCostPerKm: +avgCostPerKm.toFixed(3),
      fuelEntries: fuelEntries.length,
      trips: trips.length,
      maintenanceCount: maintenance.length,
    },
    perVehicle,
    topFuelConsumer,
    mostEfficient,
    leastEfficient,
    highestRunning,
    lowestRunning,
  })
}
