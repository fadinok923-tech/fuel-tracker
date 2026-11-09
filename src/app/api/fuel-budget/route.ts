import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { forbiddenResponse, getRequestUser, isManager, unauthorizedResponse } from '@/lib/server-auth'

const keyForMonth = (date: Date) => `fuel-budget-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

export async function GET(req: NextRequest) {
  const user = await getRequestUser(req)
  if (!user) return unauthorizedResponse()
  if (!isManager(user)) return forbiddenResponse()
  const now = new Date()
  const [setting, entries] = await Promise.all([
    db.setting.findUnique({ where: { key: keyForMonth(now) } }),
    db.fuelEntry.findMany({ where: { deletedAt: null, date: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } }, select: { totalCost: true } }),
  ])
  return NextResponse.json({ month: keyForMonth(now).replace('fuel-budget-', ''), amount: Number(setting?.value || 0), spent: Number(entries.reduce((sum, entry) => sum + entry.totalCost, 0).toFixed(2)) })
}

export async function PUT(req: NextRequest) {
  const user = await getRequestUser(req)
  if (!user) return unauthorizedResponse()
  if (!isManager(user)) return forbiddenResponse()
  const { amount } = await req.json()
  const value = Number(amount)
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000_000) return NextResponse.json({ error: 'Enter a valid non-negative budget amount' }, { status: 400 })
  const key = keyForMonth(new Date())
  const setting = await db.setting.upsert({ where: { key }, create: { key, value: String(value) }, update: { value: String(value) } })
  return NextResponse.json({ amount: Number(setting.value), month: key.replace('fuel-budget-', '') })
}
