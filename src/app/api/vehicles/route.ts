import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { putAudit } from '@/lib/audit'

// GET /api/vehicles - list all vehicles
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const includeDeleted = searchParams.get('includeDeleted') === 'true'
  const where: any = includeDeleted ? {} : { deletedAt: null }

  const vehicles = await db.vehicle.findMany({
    where,
    include: { assignedDriver: true },
    orderBy: { vehicleNumber: 'asc' },
  })
  return NextResponse.json({ vehicles })
}

// POST /api/vehicles - create new vehicle
export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    vehicleNumber, plateNumber, vehicleName, brand, model, year,
    fuelType, tankCapacity, status, insuranceExpiry, registrationExpiry,
    purchaseDate, purchasePrice, currentOdometer, notes,
    oilChangeKmInterval, serviceKmInterval, tyreKmInterval, batteryIntervalDays,
    assignedDriverId, userId = 'seed',
  } = body

  const dup = await db.vehicle.findFirst({
    where: { OR: [{ vehicleNumber }, { plateNumber }], deletedAt: null },
  })
  if (dup) {
    return NextResponse.json({ error: 'Vehicle number or plate number already exists' }, { status: 400 })
  }

  const data: any = {
    vehicleNumber, plateNumber, vehicleName, brand, model, year: Number(year),
    fuelType: fuelType || 'PETROL', tankCapacity: Number(tankCapacity) || 0,
    status: status || 'ACTIVE',
    insuranceExpiry: insuranceExpiry ? new Date(insuranceExpiry) : null,
    registrationExpiry: registrationExpiry ? new Date(registrationExpiry) : null,
    purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
    purchasePrice: purchasePrice ? Number(purchasePrice) : null,
    currentOdometer: Number(currentOdometer) || 0,
    notes,
    oilChangeKmInterval: Number(oilChangeKmInterval) || 5000,
    serviceKmInterval: Number(serviceKmInterval) || 10000,
    tyreKmInterval: Number(tyreKmInterval) || 40000,
    batteryIntervalDays: Number(batteryIntervalDays) || 730,
  }
  if (assignedDriverId) data.assignedDriver = { connect: { id: assignedDriverId } }

  const vehicle = await db.vehicle.create({ data })
  if (assignedDriverId) {
    await db.driver.update({ where: { id: assignedDriverId }, data: { assignedVehicleId: vehicle.id } })
  }

  await putAudit({ userId, action: 'CREATE', entity: 'Vehicle', entityId: vehicle.id, details: `Created ${vehicle.vehicleNumber}` })
  return NextResponse.json({ vehicle })
}
