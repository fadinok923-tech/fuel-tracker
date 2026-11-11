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
  const customer = searchParams.get('customer')
  const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 500

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
    include: { vehicle: true, driver: true },
    orderBy: { date: 'desc' },
    take: limit,
  })
  return NextResponse.json({ trips })
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
  if (e < s) return NextResponse.json({ error: 'End KM cannot be less than Start KM' }, { status: 400 })
  const distance = e - s

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
