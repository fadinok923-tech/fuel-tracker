import { NextRequest, NextResponse } from 'next/server'
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

  const vehicles = await db.vehicle.findMany({ where: { deletedAt: null, ...(user.role === 'DRIVER' ? { id: user.driverProfile!.assignedVehicleId || '__unassigned__' } : {}) }, include: { assignedDriver: true } })

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
  const drivers = await db.driver.findMany({ where: { deletedAt: null, ...(user.role === 'DRIVER' ? { id: user.driverProfile!.id } : {}) } })
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
  for (const v of vehicles) {
    if (v.status === 'IN_SERVICE') {
      alerts.push({ severity: 'critical', type: 'IMMEDIATE_SERVICE', vehicleId: v.id, vehicleNumber: v.vehicleNumber, message: `${v.vehicleNumber} requires immediate servicing` })
    }
    const lastFuel = await db.fuelEntry.findFirst({
      where: { vehicleId: v.id, deletedAt: null, ...(user.role === 'DRIVER' ? { driverId: user.driverProfile!.id } : {}) },
      orderBy: { date: 'desc' },
    })
    if (lastFuel) {
      const daysSinceFuel = Math.floor((now.getTime() - lastFuel.date.getTime()) / (1000 * 60 * 60 * 24))
      if (daysSinceFuel >= lowFuelThresholdDays * 2) {
        alerts.push({ severity: 'warning', type: 'NO_FUEL', vehicleId: v.id, vehicleNumber: v.vehicleNumber, message: `${v.vehicleNumber} not fueled for ${daysSinceFuel} days` })
      }
      // Abnormal fuel consumption: KM/L drops by >30% vs vehicle average
      const allFuels = await db.fuelEntry.findMany({ where: { vehicleId: v.id, deletedAt: null, distance: { gt: 0 }, ...(user.role === 'DRIVER' ? { driverId: user.driverProfile!.id } : {}) }, orderBy: { date: 'desc' } })
      if (allFuels.length >= 3) {
        const last = allFuels[0]
        const baseline = allFuels.slice(1).filter(f => f.kmPerLiter && f.kmPerLiter > 0)
        const avgKmL = baseline.length ? baseline.reduce((s, f) => s + (f.kmPerLiter || 0), 0) / baseline.length : 0
        if (last.kmPerLiter && avgKmL > 0 && last.kmPerLiter < avgKmL * 0.7) {
          alerts.push({ severity: 'warning', type: 'ABNORMAL_FUEL', vehicleId: v.id, vehicleNumber: v.vehicleNumber, message: `${v.vehicleNumber} abnormal fuel consumption: ${last.kmPerLiter.toFixed(2)} km/L vs previous average ${avgKmL.toFixed(2)}` })
        }
      }
    }
    // Vehicle hasn't moved (no trips recently)
    const lastTrip = await db.trip.findFirst({
      where: { vehicleId: v.id, deletedAt: null, ...(user.role === 'DRIVER' ? { driverId: user.driverProfile!.id } : {}) },
      orderBy: { date: 'desc' },
    })
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
