import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/analytics - aggregated chart data
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const months = Number(searchParams.get('months') || '6')

  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)

  const fuelEntries = await db.fuelEntry.findMany({
    where: { deletedAt: null, date: { gte: start } },
    include: { vehicle: true },
  })
  const trips = await db.trip.findMany({
    where: { deletedAt: null, date: { gte: start } },
    include: { vehicle: true },
  })
  const maintenance = await db.maintenance.findMany({
    where: { deletedAt: null, date: { gte: start } },
    include: { vehicle: true },
  })

  // Monthly aggregations
  const monthlyData: any[] = []
  for (let i = months - 1; i >= 0; i--) {
    const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999)
    const label = mStart.toLocaleString('en', { month: 'short' })
    const mFuel = fuelEntries.filter(f => f.date >= mStart && f.date <= mEnd)
    const mTrips = trips.filter(t => t.date >= mStart && t.date <= mEnd)
    const mMaint = maintenance.filter(m => m.date >= mStart && m.date <= mEnd)
    const totalFuelCost = mFuel.reduce((s, f) => s + (f.totalCost || 0), 0)
    const totalKm = mTrips.reduce((s, t) => s + (t.distance || 0), 0)
    const totalMaintCost = mMaint.reduce((s, m) => s + (m.amount || 0), 0)
    const validFuel = mFuel.filter(f => f.distance && f.distance > 0)
    const avgKmL = validFuel.length > 0 ? validFuel.reduce((s, f) => s + (f.kmPerLiter || 0), 0) / validFuel.length : 0
    monthlyData.push({
      month: label,
      year: mStart.getFullYear(),
      fuelCost: +totalFuelCost.toFixed(2),
      maintenanceCost: +totalMaintCost.toFixed(2),
      km: +totalKm.toFixed(0),
      avgKmL: +avgKmL.toFixed(2),
      fuelLiters: +mFuel.reduce((s, f) => s + (f.liters || 0), 0).toFixed(1),
    })
  }

  // Per-vehicle comparison
  const vehicles = await db.vehicle.findMany({ where: { deletedAt: null } })
  const vehicleComparison = await Promise.all(vehicles.map(async (v) => {
    const vFuel = fuelEntries.filter(f => f.vehicleId === v.id)
    const vTrips = trips.filter(t => t.vehicleId === v.id)
    const vMaint = maintenance.filter(m => m.vehicleId === v.id)
    const fuelCost = vFuel.reduce((s, f) => s + (f.totalCost || 0), 0)
    const km = vTrips.reduce((s, t) => s + (t.distance || 0), 0)
    const maintCost = vMaint.reduce((s, m) => s + (m.amount || 0), 0)
    const liters = vFuel.reduce((s, f) => s + (f.liters || 0), 0)
    const validFuel = vFuel.filter(f => f.distance && f.distance > 0)
    const kmL = validFuel.length > 0 ? validFuel.reduce((s, f) => s + (f.kmPerLiter || 0), 0) / validFuel.length : 0
    return {
      vehicleNumber: v.vehicleNumber,
      vehicleName: v.vehicleName,
      fuelCost: +fuelCost.toFixed(2),
      maintenanceCost: +maintCost.toFixed(2),
      totalCost: +(fuelCost + maintCost).toFixed(2),
      km: +km.toFixed(0),
      liters: +liters.toFixed(1),
      kmL: +kmL.toFixed(2),
    }
  }))

  // Per-driver comparison
  const drivers = await db.driver.findMany({ where: { deletedAt: null }, include: { assignedVehicle: true } })
  const driverComparison = await Promise.all(drivers.map(async (d) => {
    const dFuel = fuelEntries.filter(f => f.driverId === d.id)
    const dTrips = trips.filter(t => t.driverId === d.id)
    const fuelCost = dFuel.reduce((s, f) => s + (f.totalCost || 0), 0)
    const km = dTrips.reduce((s, t) => s + (t.distance || 0), 0)
    const validFuel = dFuel.filter(f => f.distance && f.distance > 0)
    const kmL = validFuel.length > 0 ? validFuel.reduce((s, f) => s + (f.kmPerLiter || 0), 0) / validFuel.length : 0
    return {
      driverName: d.name,
      vehicleNumber: d.assignedVehicle?.vehicleNumber || null,
      trips: dTrips.length,
      km: +km.toFixed(0),
      fuelCost: +fuelCost.toFixed(2),
      kmL: +kmL.toFixed(2),
    }
  }))

  // Fuel station distribution
  const stationMap = new Map<string, number>()
  for (const f of fuelEntries) {
    const k = f.fuelStation || 'Unknown'
    stationMap.set(k, (stationMap.get(k) || 0) + (f.totalCost || 0))
  }
  const fuelStationDist = Array.from(stationMap.entries())
    .map(([station, cost]) => ({ station, cost: +cost.toFixed(2) }))
    .sort((a, b) => b.cost - a.cost)

  // Maintenance by type
  const maintTypeMap = new Map<string, number>()
  for (const m of maintenance) {
    maintTypeMap.set(m.expenseType, (maintTypeMap.get(m.expenseType) || 0) + (m.amount || 0))
  }
  const maintenanceByType = Array.from(maintTypeMap.entries())
    .map(([type, amount]) => ({ type, amount: +amount.toFixed(2) }))
    .sort((a, b) => b.amount - a.amount)

  return NextResponse.json({
    monthly: monthlyData,
    vehicleComparison,
    driverComparison,
    fuelStationDist,
    maintenanceByType,
  })
}
