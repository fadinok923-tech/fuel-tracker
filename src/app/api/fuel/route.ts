import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { putAudit, resolveUserId } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const vehicleId = searchParams.get('vehicleId')
  const driverId = searchParams.get('driverId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 500

  const where: any = { deletedAt: null }
  if (vehicleId) where.vehicleId = vehicleId
  if (driverId) where.driverId = driverId
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = new Date(from)
    if (to) where.date.lte = new Date(to)
  }

  const entries = await db.fuelEntry.findMany({
    where,
    include: { vehicle: true, driver: true },
    orderBy: { date: 'desc' },
    take: limit,
  })
  return NextResponse.json({ entries })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    date, vehicleId, driverId, odometer, liters, pricePerLiter,
    fuelStation, invoiceNumber, paymentMethod, notes, receiptImage,
    userId = 'seed',
  } = body

  if (!vehicleId || odometer == null || !liters || !pricePerLiter) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Find previous fuel entry for this vehicle (most recent by odometer OR date)
  const prev = await db.fuelEntry.findFirst({
    where: { vehicleId, deletedAt: null, odometer: { lte: Number(odometer) } },
    orderBy: { date: 'desc' },
  })
  // Also check that odometer >= vehicle.currentOdometer (allow equal for first fill)
  const vehicle = await db.vehicle.findUnique({ where: { id: vehicleId } })
  if (!vehicle) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })

  const prevOdo = prev ? prev.odometer : vehicle.currentOdometer
  const distance = Number(odometer) - prevOdo
  if (distance < 0) {
    return NextResponse.json({ error: `Odometer reading cannot be less than previous reading (${prevOdo} km)` }, { status: 400 })
  }
  const totalCost = +(Number(liters) * Number(pricePerLiter)).toFixed(2)
  const kmPerLiter = distance > 0 ? +(distance / Number(liters)).toFixed(2) : null
  const costPerKm = distance > 0 ? +(totalCost / distance).toFixed(3) : null

  const validUserId = await resolveUserId(userId)
  const entry = await db.fuelEntry.create({
    data: {
      date: date ? new Date(date) : new Date(),
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
      userId: validUserId,
    },
    include: { vehicle: true, driver: true },
  })

  // Update vehicle current odometer if this is the highest reading
  if (Number(odometer) > vehicle.currentOdometer) {
    await db.vehicle.update({ where: { id: vehicleId }, data: { currentOdometer: Number(odometer) } })
  }

  await putAudit({ userId: validUserId || undefined, action: 'CREATE', entity: 'FuelEntry', entityId: entry.id, details: `Fuel entry for ${entry.vehicle?.vehicleNumber}: ${liters}L` })
  return NextResponse.json({ entry })
}
