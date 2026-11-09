import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { putAudit } from '@/lib/audit'
import { canAccessVehicle, forbiddenResponse, getRequestUser, isManager, unauthorizedResponse } from '@/lib/server-auth'

export async function GET(req: NextRequest) {
  const user = await getRequestUser(req)
  if (!user) return unauthorizedResponse()
  const { searchParams } = new URL(req.url)
  const vehicleId = searchParams.get('vehicleId')
  const driverId = searchParams.get('driverId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 500

  const where: any = { deletedAt: null }
  if (vehicleId) where.vehicleId = vehicleId
  if (driverId) where.driverId = driverId
  if (user.role === 'DRIVER') {
    where.driverId = user.driverProfile!.id
    where.vehicleId = user.driverProfile!.assignedVehicleId || '__unassigned__'
  }
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
  if (invoice) {
    const duplicate = await db.fuelEntry.findFirst({ where: { invoiceNumber: { equals: invoice, mode: 'insensitive' }, deletedAt: null } })
    const maintenanceDuplicate = await db.maintenance.findFirst({ where: { invoiceNumber: { equals: invoice, mode: 'insensitive' }, deletedAt: null } })
    if (duplicate || maintenanceDuplicate) return NextResponse.json({ error: 'This invoice number has already been recorded' }, { status: 409 })
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
      userId: user.id,
    },
    include: { vehicle: true, driver: true },
  })

  // Update vehicle current odometer if this is the highest reading
  if (Number(odometer) > vehicle.currentOdometer) {
    await db.vehicle.update({ where: { id: vehicleId }, data: { currentOdometer: Number(odometer) } })
  }

  await putAudit({ userId: user.id, action: 'CREATE', entity: 'FuelEntry', entityId: entry.id, details: `Fuel entry for ${entry.vehicle?.vehicleNumber}: ${liters}L` })
  return NextResponse.json({ entry })
}
