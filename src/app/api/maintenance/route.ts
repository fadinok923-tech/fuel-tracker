import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { putAudit, resolveUserId } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const vehicleId = searchParams.get('vehicleId')
  const expenseType = searchParams.get('expenseType')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const where: any = { deletedAt: null }
  if (vehicleId) where.vehicleId = vehicleId
  if (expenseType) where.expenseType = expenseType
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = new Date(from)
    if (to) where.date.lte = new Date(to)
  }

  const items = await db.maintenance.findMany({
    where,
    include: { vehicle: true },
    orderBy: { date: 'desc' },
  })
  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { date, vehicleId, expenseType, amount, workshop, invoiceNumber, notes, invoiceImage, userId = 'seed' } = body

  if (!vehicleId || !expenseType || amount == null) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const validUserId = await resolveUserId(userId)
  const item = await db.maintenance.create({
    data: {
      date: date ? new Date(date) : new Date(),
      vehicleId, expenseType, amount: Number(amount),
      workshop, invoiceNumber, notes, invoiceImage, userId: validUserId,
    },
    include: { vehicle: true },
  })

  // When maintenance type is OIL_CHANGE / TYRES / BATTERY / BRAKE_SERVICE, update the vehicle's last service tracking fields
  const v = await db.vehicle.findUnique({ where: { id: vehicleId } })
  if (v) {
    const update: any = {}
    if (expenseType === 'OIL_CHANGE') update.lastOilChangeKm = v.currentOdometer
    if (expenseType === 'TYRES') update.lastTyreChangeKm = v.currentOdometer
    if (expenseType === 'BATTERY') update.lastBatteryChange = new Date(date || Date.now())
    if (expenseType === 'BRAKE_SERVICE') update.lastServiceKm = v.currentOdometer
    // For INSURANCE / REGISTRATION, update corresponding expiry to +1 year from date
    if (expenseType === 'INSURANCE') {
      const d = new Date(date || Date.now()); d.setFullYear(d.getFullYear() + 1)
      update.insuranceExpiry = d
    }
    if (expenseType === 'REGISTRATION') {
      const d = new Date(date || Date.now()); d.setFullYear(d.getFullYear() + 1)
      update.registrationExpiry = d
    }
    if (Object.keys(update).length > 0) {
      await db.vehicle.update({ where: { id: vehicleId }, data: update })
    }
  }

  await putAudit({ userId: validUserId || undefined, action: 'CREATE', entity: 'Maintenance', entityId: item.id, details: `${expenseType} on ${item.vehicle?.vehicleNumber} - ${amount}` })
  return NextResponse.json({ item })
}
