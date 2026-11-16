export function validateTripReadings(startKm: number, endKm: number):
  | { valid: false; error: string }
  | { valid: true; distance: number } {
  if (!Number.isFinite(startKm) || !Number.isFinite(endKm) || startKm < 0 || endKm < 0) {
    return { valid: false, error: 'Odometer readings must be valid non-negative numbers' }
  }
  if (endKm < startKm) return { valid: false, error: 'End KM cannot be less than Start KM' }
  return { valid: true, distance: endKm - startKm }
}
