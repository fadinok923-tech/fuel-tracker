import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { forbiddenResponse, getRequestUser, isManager, unauthorizedResponse } from '@/lib/server-auth'

// GET /api/audit - paginated audit log
export async function GET(req: NextRequest) {
  const user = await getRequestUser(req)
  if (!user) return unauthorizedResponse()
  if (!isManager(user)) return forbiddenResponse()
  const { searchParams } = new URL(req.url)
  const requestedLimit = Number(searchParams.get('limit') || 100)
  const limit = Math.min(500, Math.max(1, Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 100))
  const requestedOffset = Number(searchParams.get('offset') || 0)
  const offset = Math.max(0, Number.isFinite(requestedOffset) ? Math.floor(requestedOffset) : 0)
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
      take: limit + 1,
      skip: offset,
    }),
    db.auditLog.count({ where }),
  ])

  const hasMore = logs.length > limit
  return NextResponse.json({ logs: logs.slice(0, limit), total, limit, offset, hasMore })
}
