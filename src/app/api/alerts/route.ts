import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getRequestUser, unauthorizedResponse } from '@/lib/server-auth'

// GET /api/alerts - compute live alerts based on current state
export async function GET(req: NextRequest) {
  const user = await getRequestUser(req)
  if (!user) return unauthorizedResponse()
  const now = new Date()
  const alerts: Array<{
    severity: 'critical' | 'warning' | 'info'
    type: string
    vehicleId?: string
    vehicleNumber?: string
    message: string
    dueDate?: string
    daysOverdue?: number
  }> = []

  const vehicles = await db.vehicle.findMany({
    where: { deletedAt: null, ...(user.role === 'DRIVER' ? { id: user.driverProfile!.assignedVehicleId || '__unassigned__' } : {}) },
    select: {
      id: true, vehicleNumber: true, status: true, insuranceExpiry: true,
      registrationExpiry: true, lastOilChangeKm: true, oilChangeKmInterval: true,
      currentOdometer: true, lastServiceKm: true, serviceKmInterval: true,
      lastTyreChangeKm: true, tyreKmInterval: true, lastBatteryChange: true,
      batteryIntervalDays: true,
    },
  })

  for (const v of vehicles) {
    // Insurance expiry
    if (v.insuranceExpiry) {
      const days = Math.floor((v.insuranceExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (days < 0) {
        alerts.push({ severity: 'critical', type: 'INSURANCE_EXPIRED', vehicleId: v.id, vehicleNumber: v.vehicleNumber, message: `${v.vehicleNumber} insurance expired`, dueDate: v.insuranceExpiry.toISOString(), daysOverdue: Math.abs(days) })
      } else if (days <= 30) {
        alerts.push({ severity: 'warning', type: 'INSURANCE_EXPIRING', vehicleId: v.id, vehicleNumber: v.vehicleNumber, message: `${v.vehicleNumber} insurance expires in ${days} days`, dueDate: v.insuranceExpiry.toISOString(), daysOverdue: -days })
      }
    }
    // Registration expiry
    if (v.registrationExpiry) {
      const days = Math.floor((v.registrationExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (days < 0) {
        alerts.push({ severity: 'critical', type: 'REGISTRATION_EXPIRED', vehicleId: v.id, vehicleNumber: v.vehicleNumber, message: `${v.vehicleNumber} registration expired`, dueDate: v.registrationExpiry.toISOString(), daysOverdue: Math.abs(days) })
      } else if (days <= 15) {
        alerts.push({ severity: 'warning', type: 'REGISTRATION_EXPIRING', vehicleId: v.id, vehicleNumber: v.vehicleNumber, message: `${v.vehicleNumber} registration expires in ${days} days`, dueDate: v.registrationExpiry.toISOString(), daysOverdue: -days })
      }
    }
    // Oil change due
    if (v.lastOilChangeKm != null && v.oilChangeKmInterval) {
      const kmSince = v.currentOdometer - v.lastOilChangeKm
      if (kmSince >= v.oilChangeKmInterval) {
        alerts.push({ severity: 'critical', type: 'OIL_CHANGE_DUE', vehicleId: v.id, vehicleNumber: v.vehicleNumber, message: `${v.vehicleNumber} oil change overdue by ${(kmSince - v.oilChangeKmInterval).toFixed(0)} km` })
      } else if (v.oilChangeKmInterval - kmSince <= 500) {
        alerts.push({ severity: 'warning', type: 'OIL_CHANGE_SOON', vehicleId: v.id, vehicleNumber: v.vehicleNumber, message: `${v.vehicleNumber} oil change due in ${(v.oilChangeKmInterval - kmSince).toFixed(0)} km` })
      }
    }
    // Service due
    if (v.lastServiceKm != null && v.serviceKmInterval) {
      const kmSince = v.currentOdometer - v.lastServiceKm
      if (kmSince >= v.serviceKmInterval) {
        alerts.push({ severity: 'critical', type: 'SERVICE_DUE', vehicleId: v.id, vehicleNumber: v.vehicleNumber, message: `${v.vehicleNumber} general service overdue by ${(kmSince - v.serviceKmInterval).toFixed(0)} km` })
      } else if (v.serviceKmInterval - kmSince <= 500) {
        alerts.push({ severity: 'warning', type: 'SERVICE_SOON', vehicleId: v.id, vehicleNumber: v.vehicleNumber, message: `${v.vehicleNumber} service due in ${(v.serviceKmInterval - kmSince).toFixed(0)} km` })
      }
    }
    // Tyres due
    if (v.lastTyreChangeKm != null && v.tyreKmInterval) {
      const kmSince = v.currentOdometer - v.lastTyreChangeKm
      if (kmSince >= v.tyreKmInterval) {
        alerts.push({ severity: 'critical', type: 'TYRES_DUE', vehicleId: v.id, vehicleNumber: v.vehicleNumber, message: `${v.vehicleNumber} tyre replacement overdue by ${(kmSince - v.tyreKmInterval).toFixed(0)} km` })
      } else if (v.tyreKmInterval - kmSince <= 1000) {
        alerts.push({ severity: 'warning', type: 'TYRES_SOON', vehicleId: v.id, vehicleNumber: v.vehicleNumber, message: `${v.vehicleNumber} tyres due in ${(v.tyreKmInterval - kmSince).toFixed(0)} km` })
      }
    }
    // Battery due (by days)
    if (v.lastBatteryChange && v.batteryIntervalDays) {
      const days = Math.floor((now.getTime() - v.lastBatteryChange.getTime()) / (1000 * 60 * 60 * 24))
      if (days >= v.batteryIntervalDays) {
        alerts.push({ severity: 'critical', type: 'BATTERY_DUE', vehicleId: v.id, vehicleNumber: v.vehicleNumber, message: `${v.vehicleNumber} battery overdue by ${days - v.batteryIntervalDays} days` })
      } else if (days >= v.batteryIntervalDays - 30) {
        alerts.push({ severity: 'warning', type: 'BATTERY_SOON', vehicleId: v.id, vehicleNumber: v.vehicleNumber, message: `${v.vehicleNumber} battery due in ${v.batteryIntervalDays - days} days` })
      }
    }
  }

  // Driver license expiry alerts
  const drivers = await db.driver.findMany({
    where: { deletedAt: null, ...(user.role === 'DRIVER' ? { id: user.driverProfile!.id } : {}) },
    select: { id: true, name: true, licenseExpiry: true },
  })
  for (const d of drivers) {
    if (d.licenseExpiry) {
      const days = Math.floor((d.licenseExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (days < 0) {
        alerts.push({ severity: 'critical', type: 'LICENSE_EXPIRED', message: `${d.name} license expired` })
      } else if (days <= 30) {
        alerts.push({ severity: 'warning', type: 'LICENSE_EXPIRING', message: `${d.name} license expires in ${days} days` })
      }
    }
  }

  // Vehicle not fueled for X days + abnormal fuel consumption
  const lowFuelThresholdDays = 5
  const inactiveThresholdDays = 3
  const vehicleIds = vehicles.map(vehicle => vehicle.id)
  const driverFilter = user.role === 'DRIVER' ? Prisma.sql`AND "driverId" = ${user.driverProfile!.id}` : Prisma.empty
  const [latestFuelRows, latestEfficientFuelRows, fuelHistory, latestTripRows] = vehicleIds.length
    ? await Promise.all([
        db.$queryRaw<Array<{ vehicleId: string; date: Date }>>(Prisma.sql`
          SELECT DISTINCT ON ("vehicleId") "vehicleId", "date"
          FROM "FuelEntry"
          WHERE "deletedAt" IS NULL AND "vehicleId" IN (${Prisma.join(vehicleIds)}) ${driverFilter}
          ORDER BY "vehicleId", "date" DESC
        `),
        db.$queryRaw<Array<{ vehicleId: string; kmPerLiter: number | null }>>(Prisma.sql`
          SELECT DISTINCT ON ("vehicleId") "vehicleId", "kmPerLiter"
          FROM "FuelEntry"
          WHERE "deletedAt" IS NULL AND "distance" > 0 AND "vehicleId" IN (${Prisma.join(vehicleIds)}) ${driverFilter}
          ORDER BY "vehicleId", "date" DESC
        `),
        db.fuelEntry.groupBy({
          by: ['vehicleId'],
          where: { vehicleId: { in: vehicleIds }, deletedAt: null, distance: { gt: 0 }, ...(user.role === 'DRIVER' ? { driverId: user.driverProfile!.id } : {}) },
          _avg: { kmPerLiter: true },
          _count: { kmPerLiter: true, _all: true },
        }),
        db.$queryRaw<Array<{ vehicleId: string; date: Date }>>(Prisma.sql`
          SELECT DISTINCT ON ("vehicleId") "vehicleId", "date"
          FROM "Trip"
          WHERE "deletedAt" IS NULL AND "vehicleId" IN (${Prisma.join(vehicleIds)}) ${driverFilter}
          ORDER BY "vehicleId", "date" DESC
        `),
      ])
    : [[], [], [], []]
  const latestFuelByVehicle = new Map(latestFuelRows.map(row => [row.vehicleId, row]))
  const latestEfficientFuelByVehicle = new Map(latestEfficientFuelRows.map(row => [row.vehicleId, row]))
  const fuelHistoryByVehicle = new Map(fuelHistory.map(row => [row.vehicleId, row]))
  const latestTripByVehicle = new Map(latestTripRows.map(row => [row.vehicleId, row]))

  for (const v of vehicles) {
    if (v.status === 'IN_SERVICE') {
      alerts.push({ severity: 'critical', type: 'IMMEDIATE_SERVICE', vehicleId: v.id, vehicleNumber: v.vehicleNumber, message: `${v.vehicleNumber} requires immediate servicing` })
    }
    const lastFuel = latestFuelByVehicle.get(v.id)
    if (lastFuel) {
      const daysSinceFuel = Math.floor((now.getTime() - lastFuel.date.getTime()) / (1000 * 60 * 60 * 24))
      if (daysSinceFuel >= lowFuelThresholdDays * 2) {
        alerts.push({ severity: 'warning', type: 'NO_FUEL', vehicleId: v.id, vehicleNumber: v.vehicleNumber, message: `${v.vehicleNumber} not fueled for ${daysSinceFuel} days` })
      }
      // Abnormal fuel consumption: KM/L drops by >30% vs vehicle average
      const recent = latestEfficientFuelByVehicle.get(v.id)
      const history = fuelHistoryByVehicle.get(v.id)
      if (history && history._count._all >= 3) {
        const totalValid = history._count.kmPerLiter
        const lastIsValid = recent?.kmPerLiter != null && recent.kmPerLiter > 0
        const baselineCount = totalValid - (lastIsValid ? 1 : 0)
        const validTotal = (history._avg.kmPerLiter || 0) * totalValid
        const avgKmL = baselineCount > 0 ? (validTotal - (lastIsValid ? recent!.kmPerLiter! : 0)) / baselineCount : 0
        if (recent?.kmPerLiter && avgKmL > 0 && recent.kmPerLiter < avgKmL * 0.7) {
          alerts.push({ severity: 'warning', type: 'ABNORMAL_FUEL', vehicleId: v.id, vehicleNumber: v.vehicleNumber, message: `${v.vehicleNumber} abnormal fuel consumption: ${recent.kmPerLiter.toFixed(2)} km/L vs previous average ${avgKmL.toFixed(2)}` })
        }
      }
    }
    // Vehicle hasn't moved (no trips recently)
    const lastTrip = latestTripByVehicle.get(v.id)
    if (!lastTrip) {
      if (v.status === 'ACTIVE') alerts.push({ severity: 'info', type: 'NO_TRIPS', vehicleId: v.id, vehicleNumber: v.vehicleNumber, message: `${v.vehicleNumber} has no recorded trips` })
    } else {
      const daysSinceTrip = Math.floor((now.getTime() - lastTrip.date.getTime()) / (1000 * 60 * 60 * 24))
      if (daysSinceTrip >= inactiveThresholdDays && v.status === 'ACTIVE') {
        alerts.push({ severity: 'info', type: 'INACTIVE_VEHICLE', vehicleId: v.id, vehicleNumber: v.vehicleNumber, message: `${v.vehicleNumber} has not moved in ${daysSinceTrip} days` })
      }
    }
  }

  // Sort by severity
  const severityRank = { critical: 0, warning: 1, info: 2 }
  alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity])

  return NextResponse.json({
    alerts,
    counts: {
      critical: alerts.filter(a => a.severity === 'critical').length,
      warning: alerts.filter(a => a.severity === 'warning').length,
      info: alerts.filter(a => a.severity === 'info').length,
    },
  })
}
