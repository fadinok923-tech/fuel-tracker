import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { forbiddenResponse, getRequestUser, isManager, unauthorizedResponse } from '@/lib/server-auth'

const money = (n: number) => Number(n.toFixed(2))

export async function GET(req: NextRequest) {
  const user = await getRequestUser(req)
  if (!user) return unauthorizedResponse()
  if (!isManager(user)) return forbiddenResponse()
  const requestedMonths = Number(new URL(req.url).searchParams.get('months') || 6)
  const months = Math.min(12, Math.max(1, Number.isFinite(requestedMonths) ? requestedMonths : 6))
  const now = new Date()
  const selectedStart = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)
  const annualStart = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  const historyStart = selectedStart < annualStart ? selectedStart : annualStart

  const [fuelEntries, trips, maintenance, vehicles, drivers, budgetSetting] = await Promise.all([
    db.fuelEntry.findMany({ where: { deletedAt: null, date: { gte: historyStart } } }),
    db.trip.findMany({ where: { deletedAt: null, date: { gte: historyStart } } }),
    db.maintenance.findMany({ where: { deletedAt: null, date: { gte: historyStart } } }),
    db.vehicle.findMany({ where: { deletedAt: null }, orderBy: { vehicleNumber: 'asc' } }),
    db.driver.findMany({ where: { deletedAt: null }, include: { assignedVehicle: true } }),
    db.setting.findUnique({ where: { key: `fuel-budget-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` } }),
  ])

  const monthlyData: any[] = []
  const monthlyVehicleCosts: any[] = []
  const fuelPriceHistory: any[] = []
  for (let i = months - 1; i >= 0; i--) {
    const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999)
    const label = mStart.toLocaleString('en', { month: 'short' })
    const mFuel = fuelEntries.filter(f => f.date >= mStart && f.date <= mEnd)
    const mTrips = trips.filter(t => t.date >= mStart && t.date <= mEnd)
    const mMaint = maintenance.filter(m => m.date >= mStart && m.date <= mEnd)
    const totalFuelCost = mFuel.reduce((s, f) => s + f.totalCost, 0)
    const totalKm = mTrips.reduce((s, t) => s + t.distance, 0)
    const totalMaintCost = mMaint.reduce((s, m) => s + m.amount, 0)
    const validFuel = mFuel.filter(f => f.distance && f.distance > 0 && f.kmPerLiter)
    const avgKmL = validFuel.length ? validFuel.reduce((s, f) => s + (f.kmPerLiter || 0), 0) / validFuel.length : 0
    const priceWeight = mFuel.reduce((s, f) => s + f.liters, 0)
    const averagePrice = priceWeight ? mFuel.reduce((s, f) => s + f.pricePerLiter * f.liters, 0) / priceWeight : 0
    monthlyData.push({ month: label, year: mStart.getFullYear(), fuelCost: money(totalFuelCost), maintenanceCost: money(totalMaintCost), km: Math.round(totalKm), avgKmL: Number(avgKmL.toFixed(2)), fuelLiters: Number(mFuel.reduce((s, f) => s + f.liters, 0).toFixed(1)) })
    fuelPriceHistory.push({ month: `${label} ${mStart.getFullYear()}`, averagePrice: Number(averagePrice.toFixed(3)), entries: mFuel.length })

    const monthlyRow: Record<string, string | number> = { month: `${label} ${mStart.getFullYear()}` }
    for (const v of vehicles) {
      const fuelCost = mFuel.filter(f => f.vehicleId === v.id).reduce((s, f) => s + f.totalCost, 0)
      const maintenanceCost = mMaint.filter(m => m.vehicleId === v.id).reduce((s, m) => s + m.amount, 0)
      monthlyRow[v.vehicleNumber] = money(fuelCost + maintenanceCost)
    }
    monthlyVehicleCosts.push(monthlyRow)
  }

  const vehicleComparison = vehicles.map(v => {
    const vFuel = fuelEntries.filter(f => f.vehicleId === v.id)
    const vTrips = trips.filter(t => t.vehicleId === v.id)
    const vMaint = maintenance.filter(m => m.vehicleId === v.id)
    const fuelCost = vFuel.reduce((s, f) => s + f.totalCost, 0)
    const km = vTrips.filter(t => t.date >= selectedStart).reduce((s, t) => s + t.distance, 0)
    const maintenanceCost = vMaint.filter(m => !['REPAIRS', 'UNEXPECTED', 'INSURANCE', 'REGISTRATION'].includes(m.expenseType)).reduce((s, m) => s + m.amount, 0)
    const repairCost = vMaint.filter(m => ['REPAIRS', 'UNEXPECTED'].includes(m.expenseType)).reduce((s, m) => s + m.amount, 0)
    const insuranceCost = vMaint.filter(m => m.expenseType === 'INSURANCE').reduce((s, m) => s + m.amount, 0)
    const registrationCost = vMaint.filter(m => m.expenseType === 'REGISTRATION').reduce((s, m) => s + m.amount, 0)
    const totalCost = fuelCost + maintenanceCost + repairCost + insuranceCost + registrationCost
    const annualFuel = vFuel.reduce((s, f) => s + f.totalCost, 0)
    const annualMaintenance = vMaint.reduce((s, m) => s + m.amount, 0)
    const annualKm = vTrips.reduce((s, t) => s + t.distance, 0)
    const validFuel = vFuel.filter(f => f.distance && f.distance > 0 && f.kmPerLiter)
    const kmL = validFuel.length ? validFuel.reduce((s, f) => s + (f.kmPerLiter || 0), 0) / validFuel.length : 0
    return {
      id: v.id, vehicleNumber: v.vehicleNumber, vehicleName: v.vehicleName,
      fuelCost: money(fuelCost), maintenanceCost: money(maintenanceCost), repairCost: money(repairCost),
      insuranceCost: money(insuranceCost), registrationCost: money(registrationCost), totalCost: money(totalCost),
      annualCost: money(annualFuel + annualMaintenance), annualKm: Math.round(annualKm),
      km: Math.round(km), liters: Number(vFuel.reduce((s, f) => s + f.liters, 0).toFixed(1)),
      kmL: Number(kmL.toFixed(2)), costPerKm: km > 0 ? Number((totalCost / km).toFixed(3)) : 0,
    }
  })

  const driverComparison = drivers.map(d => {
    const dFuel = fuelEntries.filter(f => f.driverId === d.id && f.date >= selectedStart)
    const dTrips = trips.filter(t => t.driverId === d.id && t.date >= selectedStart)
    const validFuel = dFuel.filter(f => f.distance && f.distance > 0 && f.kmPerLiter)
    const kmL = validFuel.length ? validFuel.reduce((s, f) => s + (f.kmPerLiter || 0), 0) / validFuel.length : 0
    return { driverName: d.name, vehicleNumber: d.assignedVehicle?.vehicleNumber || null, trips: dTrips.length, km: Math.round(dTrips.reduce((s, t) => s + t.distance, 0)), fuelCost: money(dFuel.reduce((s, f) => s + f.totalCost, 0)), kmL: Number(kmL.toFixed(2)) }
  })

  const stationMap = new Map<string, number>()
  for (const f of fuelEntries.filter(f => f.date >= selectedStart)) stationMap.set(f.fuelStation || 'Unknown', (stationMap.get(f.fuelStation || 'Unknown') || 0) + f.totalCost)
  const maintenanceTypeMap = new Map<string, number>()
  for (const m of maintenance.filter(m => m.date >= selectedStart)) maintenanceTypeMap.set(m.expenseType, (maintenanceTypeMap.get(m.expenseType) || 0) + m.amount)
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthlyFuelSpend = fuelEntries.filter(f => f.date >= thisMonthStart).reduce((s, f) => s + f.totalCost, 0)

  return NextResponse.json({
    monthly: monthlyData,
    monthlyVehicleCosts,
    vehicleComparison,
    driverComparison,
    fuelPriceHistory,
    fuelBudget: { amount: Number(budgetSetting?.value || 0), spent: money(monthlyFuelSpend), month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` },
    fuelStationDist: Array.from(stationMap.entries()).map(([station, cost]) => ({ station, cost: money(cost) })).sort((a, b) => b.cost - a.cost),
    maintenanceByType: Array.from(maintenanceTypeMap.entries()).map(([type, amount]) => ({ type, amount: money(amount) })).sort((a, b) => b.amount - a.amount),
  })
}
