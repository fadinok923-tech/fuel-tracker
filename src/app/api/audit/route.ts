import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/audit - paginated audit log
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit = Number(searchParams.get('limit') || 200)
  const offset = Number(searchParams.get('offset') || 0)
  const entity = searchParams.get('entity')
  const action = searchParams.get('action')

  const where: any = {}
  if (entity) where.entity = entity
  if (action) where.action = action

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: { user: { select: { name: true, email: true, role: true } } },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    }),
    db.auditLog.count({ where }),
  ])

  return NextResponse.json({ logs, total, limit, offset })
}
