// Shared audit log helper
import { db } from '@/lib/db'

export async function putAudit(opts: {
  userId?: string
  action: string
  entity: string
  entityId?: string
  details?: string
}) {
  try {
    return await db.auditLog.create({
      data: {
        userId: opts.userId,
        action: opts.action,
        entity: opts.entity,
        entityId: opts.entityId,
        details: opts.details,
      },
    })
  } catch (e) {
    console.error('audit log failed', e)
    return null
  }
}

// Resolve a userId to a valid one, or null if not found.
// Used to defend against stale userId references (e.g. after a re-seed).
export async function resolveUserId(userId?: string): Promise<string | null> {
  if (!userId || userId === 'seed') return null
  const u = await db.user.findUnique({ where: { id: userId }, select: { id: true } })
  return u ? u.id : null
}

