import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/reports?type=vehicle|driver|fuel|maintenance|trip&...filters
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'vehicle'
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const vehicleId = searchParams.get('vehicleId')
  const driverId = searchParams.get('driverId')
  const customer = searchParams.get('customer')
  const expenseType = searchParams.get('expenseType')
  const format = searchParams.get('format') || 'json' // json | csv

  const dateFilter: any = {}
  if (from) dateFilter.gte = new Date(from)
  if (to) dateFilter.lte = new Date(to)
  const hasDate = from || to

  let rows: any[] = []
  let columns: string[] = []

  if (type === 'vehicle') {
    columns = ['Vehicle Number', 'Brand', 'Model', 'Year', 'Plate', 'Fuel Type', 'Tank (L)', 'Driver', 'Status', 'Current Odometer', 'Insurance Expiry', 'Registration Expiry', 'Purchase Price']
    const vehicles = await db.vehicle.findMany({ where: { deletedAt: null }, include: { assignedDriver: true }, orderBy: { vehicleNumber: 'asc' } })
    if (vehicleId) {
      rows = vehicles.filter(v => v.id === vehicleId)
    } else {
      rows = vehicles
    }
  } else if (type === 'driver') {
    columns = ['Name', 'Mobile', 'License Number', 'License Expiry', 'Assigned Vehicle', 'Status']
    const drivers = await db.driver.findMany({ where: { deletedAt: null }, include: { assignedVehicle: true }, orderBy: { name: 'asc' } })
    rows = driverId ? drivers.filter(d => d.id === driverId) : drivers
  } else if (type === 'fuel') {
    columns = ['Date', 'Vehicle', 'Driver', 'Odometer', 'Previous Odometer', 'Distance', 'Liters', 'Price/Liter', 'Total Cost', 'KM/L', 'Cost/KM', 'Station', 'Invoice', 'Payment Method']
    const where: any = { deletedAt: null }
    if (vehicleId) where.vehicleId = vehicleId
    if (driverId) where.driverId = driverId
    if (hasDate) where.date = dateFilter
    rows = await db.fuelEntry.findMany({ where, include: { vehicle: true, driver: true }, orderBy: { date: 'desc' } })
  } else if (type === 'trip') {
    columns = ['Date', 'Vehicle', 'Driver', 'Start KM', 'End KM', 'Distance', 'Purpose', 'Customer', 'Start Location', 'End Location', 'Time Out', 'Time In']
    const where: any = { deletedAt: null }
    if (vehicleId) where.vehicleId = vehicleId
    if (driverId) where.driverId = driverId
    if (customer) where.customer = { contains: customer }
    if (hasDate) where.date = dateFilter
    rows = await db.trip.findMany({ where, include: { vehicle: true, driver: true }, orderBy: { date: 'desc' } })
  } else if (type === 'maintenance') {
    columns = ['Date', 'Vehicle', 'Expense Type', 'Amount', 'Workshop', 'Invoice', 'Notes']
    const where: any = { deletedAt: null }
    if (vehicleId) where.vehicleId = vehicleId
    if (expenseType) where.expenseType = expenseType
    if (hasDate) where.date = dateFilter
    rows = await db.maintenance.findMany({ where, include: { vehicle: true }, orderBy: { date: 'desc' } })
  }

  if (format === 'csv') {
    const escapeCsv = (v: any) => {
      if (v == null) return ''
      const s = String(v)
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
      return s
    }
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
      csv += values.map(escapeCsv).join(',') + '\n'
    }
    return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${type}-report.csv"` } })
  }

  return NextResponse.json({ type, columns, rows, count: rows.length })
}
