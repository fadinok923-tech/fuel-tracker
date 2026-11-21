import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { recalculateFuelMetrics, recalculateVehicleOdometer } from '@/lib/odometer'
import { putAudit } from '@/lib/audit'
import { canAccessVehicle, forbiddenResponse, getRequestUser, isManager, unauthorizedResponse } from '@/lib/server-auth'

export async function GET(req: NextRequest) {
  const user = await getRequestUser(req)
  if (!user) return unauthorizedResponse()
  const { searchParams } = new URL(req.url)
  const vehicleId = searchParams.get('vehicleId')
  const driverId = searchParams.get('driverId')
  const paymentMethod = searchParams.get('paymentMethod')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const requestedLimit = Number(searchParams.get('limit') || 100)
  const limit = Math.min(500, Math.max(1, Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 100))
  const requestedOffset = Number(searchParams.get('offset') || 0)
  const skip = Math.max(0, Number.isFinite(requestedOffset) ? Math.floor(requestedOffset) : 0)

  const where: any = { deletedAt: null }
  if (vehicleId) where.vehicleId = vehicleId
  if (driverId) where.driverId = driverId
  if (paymentMethod && ['CASH', 'CARD', 'BANK_TRANSFER', 'FLEET_CARD', 'UPI', 'OTHER'].includes(paymentMethod)) {
    where.paymentMethod = paymentMethod
  }
  if (user.role === 'DRIVER') {
    where.driverId = user.driverProfile!.id
  }
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = new Date(from)
    if (to) {
      const endDate = new Date(to)
      endDate.setUTCHours(23, 59, 59, 999)
      where.date.lte = endDate
    }
  }

  const entries = await db.fuelEntry.findMany({
    where,
    select: {
      id: true, date: true, vehicleId: true, driverId: true, odometer: true,
      previousOdometer: true, distance: true, liters: true, pricePerLiter: true,
      totalCost: true, fuelStation: true, invoiceNumber: true, paymentMethod: true,
      notes: true, kmPerLiter: true, costPerKm: true,
      vehicle: { select: { vehicleNumber: true } }, driver: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
    take: limit + 1,
    skip,
  })
  const hasMore = entries.length > limit
  const page = entries.slice(0, limit)
  const receiptRows = page.length
    ? await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id" FROM "FuelEntry"
        WHERE "id" IN (${Prisma.join(page.map(entry => entry.id))}) AND "receiptImage" IS NOT NULL
      `)
    : []
  const receiptIds = new Set(receiptRows.map(row => row.id))
  return NextResponse.json({ entries: page.map(entry => ({ ...entry, hasReceipt: receiptIds.has(entry.id) })), hasMore, offset: skip, limit })
}

export async function POST(req: NextRequest) {
  const user = await getRequestUser(req)
  if (!user) return unauthorizedResponse()
  if (!isManager(user) && user.role !== 'DRIVER') return forbiddenResponse()
  const body = await req.json()
  let {
    date, vehicleId, driverId, odometer, liters, pricePerLiter,
    fuelStation, invoiceNumber, paymentMethod, notes, receiptImage,
  } = body

  if (user.role === 'DRIVER') {
    if (!user.driverProfile?.assignedVehicleId) return forbiddenResponse()
    vehicleId = user.driverProfile.assignedVehicleId
    driverId = user.driverProfile.id
  }

  if (!vehicleId || odometer == null || !liters || !pricePerLiter) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (Number(liters) <= 0 || Number(pricePerLiter) <= 0 || Number(odometer) < 0) {
    return NextResponse.json({ error: 'Liters and price must be positive; odometer cannot be negative' }, { status: 400 })
  }

  if (!canAccessVehicle(user, vehicleId)) return forbiddenResponse()
  const invoice = String(invoiceNumber || '').trim()
  const totalCost = +(Number(liters) * Number(pricePerLiter)).toFixed(2)
  const entryDate = date ? new Date(date) : new Date()
  const dayStart = new Date(Date.UTC(entryDate.getUTCFullYear(), entryDate.getUTCMonth(), entryDate.getUTCDate()))
  const nextDay = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
  const sameText = (a: unknown, b: unknown, insensitive = false) => {
    const left = String(a || '').trim()
    const right = String(b || '').trim()
    return insensitive ? left.toLocaleLowerCase('en-US') === right.toLocaleLowerCase('en-US') : left === right
  }
  const sameNumber = (a: number | null, b: number) => a != null && Math.abs(a - b) < 0.000001
  const sameDay = (a: Date, b: Date) => a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10)

  const sameDayEntries = await db.fuelEntry.findMany({
    where: { vehicleId, odometer: Number(odometer), date: { gte: dayStart, lt: nextDay }, deletedAt: null },
    select: {
      id: true, date: true, vehicleId: true, driverId: true, odometer: true,
      liters: true, pricePerLiter: true, totalCost: true, fuelStation: true,
      invoiceNumber: true, paymentMethod: true, notes: true,
      vehicle: { select: { vehicleNumber: true } },
    },
  })
  const exactDuplicates = sameDayEntries.filter(entry =>
    entry.driverId === (driverId || null) &&
    sameDay(entry.date, entryDate) &&
    sameNumber(entry.liters, Number(liters)) &&
    sameNumber(entry.pricePerLiter, Number(pricePerLiter)) &&
    sameNumber(entry.totalCost, totalCost) &&
    sameText(entry.fuelStation, fuelStation, true) &&
    sameText(entry.invoiceNumber, invoice, true) &&
    entry.paymentMethod === (paymentMethod || 'CASH') &&
    sameText(entry.notes, notes),
  )
  const duplicate = exactDuplicates[0]

  if (duplicate && body.confirmDuplicate !== true) {
    return NextResponse.json({
      error: 'An identical fuel entry already exists. Confirm if you want to record it again.',
      duplicateConfirmationRequired: true,
      duplicate: { vehicleNumber: duplicate.vehicle.vehicleNumber, date: duplicate.date, liters: duplicate.liters, totalCost: duplicate.totalCost, odometer: duplicate.odometer },
    }, { status: 409 })
  }

  if (invoice) {
    const duplicateInvoice = await db.fuelEntry.findFirst({ where: { invoiceNumber: { equals: invoice, mode: 'insensitive' }, deletedAt: null } })
    const maintenanceDuplicate = await db.maintenance.findFirst({ where: { invoiceNumber: { equals: invoice, mode: 'insensitive' }, deletedAt: null } })
    const invoiceMatchesOtherEntry = duplicateInvoice && !exactDuplicates.some(entry => entry.id === duplicateInvoice.id)
    if (invoiceMatchesOtherEntry || maintenanceDuplicate) {
      return NextResponse.json({ error: 'This invoice number has already been recorded' }, { status: 409 })
    }
  }

  // Use the nearest lower or equal odometer reading for this vehicle, regardless of entry date or driver.
  const prev = await db.fuelEntry.findFirst({
    where: { vehicleId, deletedAt: null, odometer: { lte: Number(odometer) } },
    orderBy: [{ odometer: 'desc' }, { date: 'desc' }, { createdAt: 'desc' }],
  })
  // Also check that odometer >= vehicle.currentOdometer (allow equal for first fill)
  const vehicle = await db.vehicle.findUnique({ where: { id: vehicleId } })
  if (!vehicle) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })

  const prevOdo = prev ? prev.odometer : vehicle.currentOdometer
  const distance = Number(odometer) - prevOdo
  if (distance < 0) {
    return NextResponse.json({ error: `Odometer reading cannot be less than previous reading (${prevOdo} km)` }, { status: 400 })
  }
  const kmPerLiter = distance > 0 ? +(distance / Number(liters)).toFixed(2) : null
  const costPerKm = distance > 0 ? +(totalCost / distance).toFixed(3) : null

  const entry = await db.$transaction(async tx => {
    const created = await tx.fuelEntry.create({
      data: {
        date: entryDate,
        vehicleId, driverId: driverId || null,
        odometer: Number(odometer),
        previousOdometer: prevOdo,
        distance,
        liters: Number(liters),
        pricePerLiter: Number(pricePerLiter),
        totalCost,
        fuelStation, invoiceNumber,
        paymentMethod: paymentMethod || 'CASH',
        notes, receiptImage,
        kmPerLiter, costPerKm,
        userId: user.id,
      },
      select: {
        id: true, vehicleId: true, date: true, totalCost: true,
        vehicle: { select: { vehicleNumber: true } },
      },
    })
    await recalculateFuelMetrics(tx, vehicleId)
    await recalculateVehicleOdometer(tx, vehicleId)
    return created
  })

  await putAudit({ userId: user.id, action: 'CREATE', entity: 'FuelEntry', entityId: entry.id, details: `Fuel entry for ${entry.vehicle?.vehicleNumber}: ${liters}L` })
  return NextResponse.json({ entry })
}
