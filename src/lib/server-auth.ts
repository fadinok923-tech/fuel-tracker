import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'

const SESSION_COOKIE = 'fleet_session'
const SESSION_SECONDS = 60 * 60 * 24 * 7

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `scrypt$${salt}$${hash}`
}

export function verifyPassword(password: string, stored: string) {
  if (!stored.startsWith('scrypt$')) return stored === password // Legacy demo accounts are upgraded on successful login.
  const [, salt, hash] = stored.split('$')
  if (!salt || !hash) return false
  const expected = Buffer.from(hash, 'hex')
  const actual = scryptSync(password, salt, expected.length)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export type RequestUser = {
  id: string
  name: string
  username: string | null
  email: string | null
  role: 'ADMIN' | 'MANAGER' | 'DRIVER' | 'READ_ONLY'
  driverProfile: {
    id: string
    status: string
    deletedAt: Date | null
    assignedVehicleId: string | null
  } | null
}

function sessionSecret() {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be configured with at least 32 characters.')
  return secret
}

function signature(payload: string) {
  return createHmac('sha256', sessionSecret()).update(payload).digest('base64url')
}

export function createSessionToken(userId: string) {
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS })).toString('base64url')
  return `${payload}.${signature(payload)}`
}

export const sessionCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_SECONDS,
}

export async function getRequestUser(req: NextRequest): Promise<RequestUser | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return null

  const [payload, suppliedSignature, extra] = token.split('.')
  if (!payload || !suppliedSignature || extra) return null

  let expected: Buffer
  let supplied: Buffer
  try {
    expected = Buffer.from(signature(payload), 'base64url')
    supplied = Buffer.from(suppliedSignature, 'base64url')
  } catch {
    return null
  }
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: string; exp?: number }
    if (!claims.sub || !claims.exp || claims.exp <= Math.floor(Date.now() / 1000)) return null

    const user = await db.user.findUnique({
      where: { id: claims.sub },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        active: true,
        deletedAt: true,
        driverProfile: { select: { id: true, status: true, deletedAt: true, assignedVehicleId: true } },
      },
    })

    if (!user || !user.active || user.deletedAt) return null
    if (user.role === 'DRIVER' && (!user.driverProfile || user.driverProfile.deletedAt || user.driverProfile.status !== 'ACTIVE')) return null
    return user
  } catch {
    return null
  }
}

export function isManager(user: RequestUser) {
  return user.role === 'ADMIN' || user.role === 'MANAGER'
}

export function isAdmin(user: RequestUser) {
  return user.role === 'ADMIN'
}

export function canAccessVehicle(user: RequestUser, vehicleId: string) {
  return user.role !== 'DRIVER' || user.driverProfile?.assignedVehicleId === vehicleId
}

export function driverRecordScope(user: RequestUser) {
  return user.role === 'DRIVER' ? { driverId: user.driverProfile!.id } : {}
}

export const unauthorizedResponse = () => NextResponse.json({ error: 'Sign in required' }, { status: 401 })
export const forbiddenResponse = () => NextResponse.json({ error: 'You do not have permission to perform this action' }, { status: 403 })

