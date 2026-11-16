import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { putAudit } from '@/lib/audit'
import { canAccessVehicle, forbiddenResponse, getRequestUser, isManager, unauthorizedResponse } from '@/lib/server-auth'
import { validateTripReadings } from '@/lib/trip-validation'

export async function GET(req: NextRequest) {
  const user = await getRequestUser(req)
  if (!user) return unauthorizedResponse()
  const { searchParams } = new URL(req.url)
  const vehicleId = searchParams.get('vehicleId')
  const driverId = searchParams.get('driverId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const customer = searchParams.get('customer')
  const requestedLimit = Number(searchParams.get('limit') || 100)
  const limit = Math.min(500, Math.max(1, Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 100))
  const requestedOffset = Number(searchParams.get('offset') || 0)
  const skip = Math.max(0, Number.isFinite(requestedOffset) ? Math.floor(requestedOffset) : 0)

  const where: any = { deletedAt: null }
  if (vehicleId) where.vehicleId = vehicleId
  if (driverId) where.driverId = driverId
  if (user.role === 'DRIVER') {
    where.driverId = user.driverProfile!.id
  }
  if (customer) where.customer = { contains: customer }
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = new Date(from)
    if (to) where.date.lte = new Date(to)
  }

  const trips = await db.trip.findMany({
    where,
    select: {
      id: true, date: true, vehicleId: true, driverId: true, startKm: true,
      endKm: true, distance: true, purpose: true, customer: true,
      startLocation: true, endLocation: true, timeOut: true, timeIn: true,
      notes: true, vehicle: { select: { vehicleNumber: true } }, driver: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
    take: limit + 1,
    skip,
  })
  const hasMore = trips.length > limit
  return NextResponse.json({ trips: trips.slice(0, limit), hasMore, offset: skip, limit })
}

export async function POST(req: NextRequest) {
  const user = await getRequestUser(req)
  if (!user) return unauthorizedResponse()
  if (!isManager(user) && user.role !== 'DRIVER') return forbiddenResponse()
  const body = await req.json()
  let {
    date, vehicleId, driverId, startKm, endKm,
    purpose, customer, startLocation, endLocation,
    timeOut, timeIn, notes,
  } = body

  if (user.role === 'DRIVER') {
    if (!user.driverProfile?.assignedVehicleId) return forbiddenResponse()
    vehicleId = user.driverProfile.assignedVehicleId
    driverId = user.driverProfile.id
  }

  if (!vehicleId || startKm == null || endKm == null) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!canAccessVehicle(user, vehicleId)) return forbiddenResponse()
  const s = Number(startKm), e = Number(endKm)
  const readingCheck = validateTripReadings(s, e)
  if (!readingCheck.valid) return NextResponse.json({ error: readingCheck.error }, { status: 400 })
  const distance = readingCheck.distance

  const trip = await db.trip.create({
    data: {
      date: date ? new Date(date) : new Date(),
      vehicleId, driverId: driverId || null,
      startKm: s, endKm: e, distance,
      purpose, customer, startLocation, endLocation,
      timeOut: timeOut ? new Date(timeOut) : null,
      timeIn: timeIn ? new Date(timeIn) : null,
      notes, userId: user.id,
    },
    include: { vehicle: true, driver: true },
  })

  // Update vehicle odometer if endKm > current
  const v = await db.vehicle.findUnique({ where: { id: vehicleId } })
  if (v && e > v.currentOdometer) {
    await db.vehicle.update({ where: { id: vehicleId }, data: { currentOdometer: e } })
  }

  await putAudit({ userId: user.id, action: 'CREATE', entity: 'Trip', entityId: trip.id, details: `Trip for ${trip.vehicle?.vehicleNumber}: ${distance} km` })
  return NextResponse.json({ trip })
}
