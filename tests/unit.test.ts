import assert from 'node:assert/strict'
import test from 'node:test'
import { escapeCsvCell } from '../src/lib/csv.ts'
import { canReadFleetInsights } from '../src/lib/permissions.ts'
import { hashPassword, verifyPassword } from '../src/lib/password-utils.ts'
import { validateTripReadings } from '../src/lib/trip-validation.ts'

test('password security: verifies scrypt hashes and rejects plaintext legacy credentials', () => {
  const password = 'fleet-password-123'
  const hashed = hashPassword(password)
  assert.equal(verifyPassword(password, hashed), true)
  assert.equal(verifyPassword('wrong-password', hashed), false)
  assert.equal(verifyPassword('demo-admin', 'demo-admin'), false)
})

test('report permissions allow read-only staff and deny driver accounts', () => {
  assert.equal(canReadFleetInsights('ADMIN'), true)
  assert.equal(canReadFleetInsights('MANAGER'), true)
  assert.equal(canReadFleetInsights('READ_ONLY'), true)
  assert.equal(canReadFleetInsights('DRIVER'), false)
})

test('trip odometer validation accepts increasing readings and calculates distance', () => {
  assert.deepEqual(validateTripReadings(120, 180), { valid: true, distance: 60 })
})

test('trip odometer validation rejects invalid readings', () => {
  assert.equal(validateTripReadings(-1, 10).valid, false)
  assert.equal(validateTripReadings(Number.NaN, 10).valid, false)
  assert.equal(validateTripReadings(10, 9).valid, false)
})

test('CSV output quotes cells and neutralizes spreadsheet formulas', () => {
  assert.equal(escapeCsvCell('=SUM(A1:A2)'), "'=SUM(A1:A2)")
  assert.equal(escapeCsvCell('North, "Main"'), '"North, ""Main"""')
  assert.equal(escapeCsvCell(null), '')
})
