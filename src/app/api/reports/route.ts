import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { forbiddenResponse, getRequestUser, unauthorizedResponse } from '@/lib/server-auth'
import { escapeCsvCell } from '@/lib/csv'
import { canReadFleetInsights } from '@/lib/permissions'

// GET /api/reports?type=vehicle|driver|fuel|maintenance|trip&...filters
export async function GET(req: NextRequest) {
  const user = await getRequestUser(req)
  if (!user) return unauthorizedResponse()
  if (!canReadFleetInsights(user.role)) return forbiddenResponse()
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'vehicle'
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const vehicleId = searchParams.get('vehicleId')
  const driverId = searchParams.get('driverId')
  const customer = searchParams.get('customer')
  const expenseType = searchParams.get('expenseType')
  const format = searchParams.get('format') || 'json' // json | csv
  const requestedOffset = Number(searchParams.get('offset') || 0)
  const offset = Math.max(0, Number.isFinite(requestedOffset) ? Math.floor(requestedOffset) : 0)
  const requestedLimit = Number(searchParams.get('limit') || 100)
  const pageLimit = Math.min(500, Math.max(1, Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 100))
  const csvLimit = 10000
  const take = format === 'csv' ? csvLimit + 1 : pageLimit + 1
  if (!['vehicle', 'driver', 'fuel', 'maintenance', 'trip'].includes(type)) {
    return NextResponse.json({ error: 'Unsupported report type' }, { status: 400 })
  }

  const dateFilter: any = {}
  if (from) dateFilter.gte = new Date(from)
  if (to) dateFilter.lte = new Date(to)
  const hasDate = from || to

  let rows: any[] = []
  let columns: string[] = []

  if (type === 'vehicle') {
    columns = ['Vehicle Number', 'Brand', 'Model', 'Year', 'Plate', 'Fuel Type', 'Tank (L)', 'Driver', 'Status', 'Current Odometer', 'Insurance Expiry', 'Registration Expiry', 'Purchase Price']
    rows = await db.vehicle.findMany({ where: { deletedAt: null, ...(vehicleId ? { id: vehicleId } : {}) }, include: { assignedDriver: { select: { name: true } } }, orderBy: { vehicleNumber: 'asc' }, take, skip: offset })
  } else if (type === 'driver') {
    columns = ['Name', 'Mobile', 'License Number', 'License Expiry', 'Assigned Vehicle', 'Status']
    rows = await db.driver.findMany({ where: { deletedAt: null, ...(driverId ? { id: driverId } : {}) }, include: { assignedVehicle: { select: { vehicleNumber: true } } }, orderBy: { name: 'asc' }, take, skip: offset })
  } else if (type === 'fuel') {
    columns = ['Date', 'Vehicle', 'Driver', 'Odometer', 'Previous Odometer', 'Distance', 'Liters', 'Price/Liter', 'Total Cost', 'KM/L', 'Cost/KM', 'Station', 'Invoice', 'Payment Method']
    const where: any = { deletedAt: null }
    if (vehicleId) where.vehicleId = vehicleId
    if (driverId) where.driverId = driverId
    if (hasDate) where.date = dateFilter
    rows = await db.fuelEntry.findMany({ where, select: { id: true, date: true, vehicleId: true, driverId: true, odometer: true, previousOdometer: true, distance: true, liters: true, pricePerLiter: true, totalCost: true, kmPerLiter: true, costPerKm: true, fuelStation: true, invoiceNumber: true, paymentMethod: true, vehicle: { select: { vehicleNumber: true } }, driver: { select: { name: true } } }, orderBy: { date: 'desc' }, take, skip: offset })
  } else if (type === 'trip') {
    columns = ['Date', 'Vehicle', 'Driver', 'Start KM', 'End KM', 'Distance', 'Purpose', 'Customer', 'Start Location', 'End Location', 'Time Out', 'Time In']
    const where: any = { deletedAt: null }
    if (vehicleId) where.vehicleId = vehicleId
    if (driverId) where.driverId = driverId
    if (customer) where.customer = { contains: customer }
    if (hasDate) where.date = dateFilter
    rows = await db.trip.findMany({ where, select: { date: true, vehicleId: true, driverId: true, startKm: true, endKm: true, distance: true, purpose: true, customer: true, startLocation: true, endLocation: true, timeOut: true, timeIn: true, vehicle: { select: { vehicleNumber: true } }, driver: { select: { name: true } } }, orderBy: { date: 'desc' }, take, skip: offset })
  } else if (type === 'maintenance') {
    columns = ['Date', 'Vehicle', 'Expense Type', 'Amount', 'Workshop', 'Invoice', 'Notes']
    const where: any = { deletedAt: null }
    if (vehicleId) where.vehicleId = vehicleId
    if (expenseType) where.expenseType = expenseType
    if (hasDate) where.date = dateFilter
    rows = await db.maintenance.findMany({ where, select: { id: true, date: true, vehicleId: true, expenseType: true, amount: true, workshop: true, invoiceNumber: true, notes: true, vehicle: { select: { vehicleNumber: true } } }, orderBy: { date: 'desc' }, take, skip: offset })
  }

  if (format === 'csv') {
    const truncated = rows.length > csvLimit
    if (truncated) rows = rows.slice(0, csvLimit)
    let csv = columns.join(',') + '\n'
    for (const row of rows) {
      let values: any[] = []
      if (type === 'vehicle') {
        values = [row.vehicleNumber, row.brand, row.model, row.year, row.plateNumber, row.fuelType, row.tankCapacity, row.assignedDriver?.name || '', row.status, row.currentOdometer, row.insuranceExpiry?.toISOString().split('T')[0] || '', row.registrationExpiry?.toISOString().split('T')[0] || '', row.purchasePrice || '']
      } else if (type === 'driver') {
        values = [row.name, row.mobile, row.licenseNumber, row.licenseExpiry?.toISOString().split('T')[0] || '', row.assignedVehicle?.vehicleNumber || '', row.status]
      } else if (type === 'fuel') {
        values = [row.date.toISOString().split('T')[0], row.vehicle?.vehicleNumber, row.driver?.name || '', row.odometer, row.previousOdometer, row.distance, row.liters, row.pricePerLiter, row.totalCost, row.kmPerLiter, row.costPerKm, row.fuelStation, row.invoiceNumber, row.paymentMethod]
      } else if (type === 'trip') {
        values = [row.date.toISOString().split('T')[0], row.vehicle?.vehicleNumber, row.driver?.name || '', row.startKm, row.endKm, row.distance, row.purpose, row.customer, row.startLocation, row.endLocation, row.timeOut?.toISOString() || '', row.timeIn?.toISOString() || '']
      } else if (type === 'maintenance') {
        values = [row.date.toISOString().split('T')[0], row.vehicle?.vehicleNumber, row.expenseType, row.amount, row.workshop, row.invoiceNumber, row.notes]
      }
      csv += values.map(escapeCsvCell).join(',') + '\n'
    }
    return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${type}-report.csv"`, 'X-Report-Truncated': String(truncated) } })
  }

  const hasMore = format !== 'csv' && rows.length > pageLimit
  if (hasMore) rows = rows.slice(0, pageLimit)
  return NextResponse.json({ type, columns, rows, count: rows.length, hasMore, offset, limit: pageLimit })
}
