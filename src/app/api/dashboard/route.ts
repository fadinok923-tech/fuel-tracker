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
  const fuelTripScope = user.role === 'DRIVER' ? { ...recordScope, driverId: user.driverProfile!.id } : recordScope
  const vehicles = await db.vehicle.findMany({ where: vehicleWhere, include: { assignedDriver: true } })
  const fuelEntries = await db.fuelEntry.findMany({
    where: { ...fuelTripScope, date: { gte: from, lte: to } },
    include: { vehicle: true },
  })
  const trips = await db.trip.findMany({
    where: { ...fuelTripScope, date: { gte: from, lte: to } },
    include: { vehicle: true },
  })
  const maintenance = await db.maintenance.findMany({
    where: { ...recordScope, date: { gte: from, lte: to } },
    include: { vehicle: true },
  })
  const todayTrips = await db.trip.findMany({
    where: { ...fuelTripScope, date: { gte: startOfToday, lte: endOfToday } },
  })

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
  const perVehicle = await Promise.all(vehicles.map(async (v) => {
    const vFuel = fuelEntries.filter(f => f.vehicleId === v.id)
    const vTrips = trips.filter(t => t.vehicleId === v.id)
    const vMaint = maintenance.filter(m => m.vehicleId === v.id)
    const vKm = vTrips.reduce((s, t) => s + (t.distance || 0), 0)
    const vLiters = vFuel.reduce((s, f) => s + (f.liters || 0), 0)
    const vFuelCost = vFuel.reduce((s, f) => s + (f.totalCost || 0), 0)
    const vMaintCost = vMaint.reduce((s, m) => s + (m.amount || 0), 0)
    const vAvgKmL = vFuel.filter(f => f.distance && f.distance > 0)
    const kmL = vAvgKmL.length > 0 ? vAvgKmL.reduce((s, f) => s + (f.kmPerLiter || 0), 0) / vAvgKmL.length : 0
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
  }))

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
