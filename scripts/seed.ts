// Fleet management seed data
import { db } from '../src/lib/db'

async function main() {
  console.log('Seeding fleet management data...')

  await db.auditLog.deleteMany()
  await db.fuelEntry.deleteMany()
  await db.trip.deleteMany()
  await db.maintenance.deleteMany()
  await db.vehicle.deleteMany()
  await db.driver.deleteMany()
  await db.user.deleteMany()
  await db.setting.deleteMany()

  // === Users ===
  const admin = await db.user.create({
    data: { email: 'admin@fleet.com', name: 'Fleet Admin', password: 'demo-admin', role: 'ADMIN' },
  })
  const manager = await db.user.create({
    data: { email: 'manager@fleet.com', name: 'Operation Manager', password: 'demo-manager', role: 'MANAGER' },
  })
  const driverUser = await db.user.create({
    data: { email: 'driver@fleet.com', name: 'Driver Portal', password: 'demo-driver', role: 'DRIVER' },
  })
  const readOnly = await db.user.create({
    data: { email: 'viewer@fleet.com', name: 'Accounting Viewer', password: 'demo-viewer', role: 'READ_ONLY' },
  })

  // === Drivers ===
  const driversData = [
    { name: 'Ahmed Al-Rashid', mobile: '+966 50 111 2222', licenseNumber: 'DL-1001', licenseExpiry: new Date('2027-03-15') },
    { name: 'Khalid Al-Otaibi', mobile: '+966 50 222 3333', licenseNumber: 'DL-1002', licenseExpiry: new Date('2026-09-20') },
    { name: 'Saud Al-Harbi', mobile: '+966 50 333 4444', licenseNumber: 'DL-1003', licenseExpiry: new Date('2028-01-10') },
    { name: 'Faisal Al-Qahtani', mobile: '+966 50 444 5555', licenseNumber: 'DL-1004', licenseExpiry: new Date('2027-06-30') },
  ]
  const drivers: any[] = []
  for (const d of driversData) {
    drivers.push(await db.driver.create({ data: d }))
  }

  // === Vehicles ===
  const vehiclesData = [
    { vehicleNumber: 'VAN-01', plateNumber: 'RYD-1001', vehicleName: 'Delivery Van 1', brand: 'Toyota', model: 'HiAce', year: 2022, fuelType: 'PETROL', tankCapacity: 80, purchasePrice: 95000, purchaseDate: new Date('2022-01-15'), insuranceExpiry: new Date('2026-12-31'), registrationExpiry: new Date('2027-01-31'), currentOdometer: 48200, lastOilChangeKm: 43000, lastServiceKm: 38000, lastTyreChangeKm: 8000, lastBatteryChange: new Date('2023-05-10') },
    { vehicleNumber: 'VAN-02', plateNumber: 'RYD-1002', vehicleName: 'Delivery Van 2', brand: 'Nissan', model: 'Urvan', year: 2021, fuelType: 'DIESEL', tankCapacity: 75, purchasePrice: 88000, purchaseDate: new Date('2021-08-20'), insuranceExpiry: new Date('2026-08-15'), registrationExpiry: new Date('2026-09-30'), currentOdometer: 65400, lastOilChangeKm: 60500, lastServiceKm: 55400, lastTyreChangeKm: 25400, lastBatteryChange: new Date('2022-04-15') },
    { vehicleNumber: 'VAN-03', plateNumber: 'RYD-1003', vehicleName: 'Delivery Van 3', brand: 'Hyundai', model: 'H1', year: 2023, fuelType: 'DIESEL', tankCapacity: 75, purchasePrice: 102000, purchaseDate: new Date('2023-03-10'), insuranceExpiry: new Date('2027-02-28'), registrationExpiry: new Date('2027-03-31'), currentOdometer: 31800, lastOilChangeKm: 27000, lastServiceKm: 22000, lastTyreChangeKm: 31800, lastBatteryChange: new Date('2023-03-10') },
    { vehicleNumber: 'VAN-04', plateNumber: 'RYD-1004', vehicleName: 'Delivery Van 4', brand: 'Mercedes', model: 'Sprinter', year: 2022, fuelType: 'DIESEL', tankCapacity: 100, purchasePrice: 165000, purchaseDate: new Date('2022-11-05'), insuranceExpiry: new Date('2026-10-10'), registrationExpiry: new Date('2026-11-15'), currentOdometer: 41700, lastOilChangeKm: 36800, lastServiceKm: 31800, lastTyreChangeKm: 11700, lastBatteryChange: new Date('2021-11-05') },
  ]
  const vehicles: any[] = []
  for (let i = 0; i < vehiclesData.length; i++) {
    const v = await db.vehicle.create({
      data: { ...vehiclesData[i], assignedDriver: { connect: { id: drivers[i].id } } },
    })
    vehicles.push(v)
    await db.driver.update({ where: { id: drivers[i].id }, data: { assignedVehicleId: v.id } })
  }

  // === Fuel entries: 10 per van ===
  const stations = ['Aramco Station - Olaya', 'Aldrees - King Fahd Rd', 'Sahco - Tahlia', 'Petromin - Malaz']
  const now = new Date()
  for (let vIdx = 0; vIdx < vehicles.length; vIdx++) {
    const v = vehicles[vIdx]
    const d = drivers[vIdx]
    let odo = v.currentOdometer - 12000
    for (let i = 0; i < 10; i++) {
      const fillDate = new Date(now)
      fillDate.setDate(fillDate.getDate() - (10 - i) * 9)
      const prevOdo = odo
      const distance = 800 + Math.floor(Math.random() * 600)
      odo = prevOdo + distance
      const liters = +(distance / (7 + Math.random() * 2)).toFixed(2)
      const pricePerLiter = +(1.85 + Math.random() * 0.4).toFixed(2)
      const totalCost = +(liters * pricePerLiter).toFixed(2)
      const kmPerLiter = +(distance / liters).toFixed(2)
      const costPerKm = +(totalCost / distance).toFixed(3)
      await db.fuelEntry.create({
        data: {
          date: fillDate,
          vehicleId: v.id,
          driverId: d.id,
          odometer: odo,
          previousOdometer: prevOdo,
          distance,
          liters,
          pricePerLiter,
          totalCost,
          fuelStation: stations[i % stations.length],
          invoiceNumber: `INV-${v.vehicleNumber}-${1000 + i}`,
          paymentMethod: i % 2 === 0 ? 'FLEET_CARD' : 'CASH',
          kmPerLiter,
          costPerKm,
          userId: admin.id,
        },
      })
    }
    await db.vehicle.update({ where: { id: v.id }, data: { currentOdometer: odo } })
  }

  // === Trips: 8 per van ===
  const customers = ['Almarai Co.', 'STC HQ', 'Saudi Aramco', 'Jarir Bookstore', 'Al-Othaim Markets', 'Tamimi Markets', 'Lulu Hypermarket', 'Panda Supermarket']
  const locations = ['Riyadh HQ', 'Olaya District', 'Industrial Area 5', 'Malaz', 'Diriyah', 'King Khalid Intl Airport', 'Diplomatic Quarter', 'Al-Murabba']
  for (let vIdx = 0; vIdx < vehicles.length; vIdx++) {
    const v = vehicles[vIdx]
    const d = drivers[vIdx]
    let startKm = v.currentOdometer - 4000
    for (let i = 0; i < 8; i++) {
      const tripDate = new Date(now)
      tripDate.setDate(tripDate.getDate() - (8 - i) * 3)
      const endKm = startKm + 30 + Math.floor(Math.random() * 220)
      const distance = endKm - startKm
      const timeOut = new Date(tripDate); timeOut.setHours(8, 0, 0, 0)
      const timeIn = new Date(tripDate); timeIn.setHours(16 + (i % 3), 30, 0, 0)
      await db.trip.create({
        data: {
          date: tripDate, vehicleId: v.id, driverId: d.id,
          startKm, endKm, distance,
          purpose: ['Delivery', 'Pickup', 'Customer Visit', 'Maintenance Run'][i % 4],
          customer: customers[i % customers.length],
          startLocation: locations[i % locations.length],
          endLocation: locations[(i + 1) % locations.length],
          timeOut, timeIn, userId: admin.id,
        },
      })
      startKm = endKm
    }
  }

  // === Maintenance ===
  const maintData = [
    { vehicleIdx: 0, type: 'OIL_CHANGE', amount: 350, workshop: 'Toyota Service Center', daysAgo: 30 },
    { vehicleIdx: 0, type: 'TYRES', amount: 2400, workshop: 'Bridgestone Dealer', daysAgo: 90 },
    { vehicleIdx: 1, type: 'BRAKE_SERVICE', amount: 850, workshop: 'Nissan Care', daysAgo: 15 },
    { vehicleIdx: 1, type: 'INSURANCE', amount: 3200, workshop: 'Tawuniya Insurance', daysAgo: 180 },
    { vehicleIdx: 2, type: 'OIL_CHANGE', amount: 420, workshop: 'Hyundai Motors', daysAgo: 60 },
    { vehicleIdx: 2, type: 'REPAIRS', amount: 1800, workshop: 'AutoFix Workshop', daysAgo: 20 },
    { vehicleIdx: 3, type: 'BATTERY', amount: 650, workshop: 'Bosch Service', daysAgo: 5 },
    { vehicleIdx: 3, type: 'TYRES', amount: 2800, workshop: 'Continental Dealer', daysAgo: 120 },
    { vehicleIdx: 1, type: 'UNEXPECTED', amount: 1100, workshop: 'Roadside Assist', daysAgo: 7 },
  ]
  for (const m of maintData) {
    const date = new Date(now); date.setDate(date.getDate() - m.daysAgo)
    await db.maintenance.create({
      data: {
        date, vehicleId: vehicles[m.vehicleIdx].id, expenseType: m.type as any,
        amount: m.amount, workshop: m.workshop,
        invoiceNumber: `M-${vehicles[m.vehicleIdx].vehicleNumber}-${1000 + m.daysAgo}`,
        userId: admin.id,
      },
    })
  }

  await db.setting.create({ data: { key: 'currency', value: 'SAR' } })
  await db.setting.create({ data: { key: 'companyName', value: 'Fleet Operations Co.' } })
  await db.setting.create({ data: { key: 'lowFuelThresholdDays', value: '5' } })
  await db.setting.create({ data: { key: 'inactiveVehicleDays', value: '3' } })

  for (const u of [admin, manager, driverUser, readOnly]) {
    await db.auditLog.create({
      data: { userId: u.id, action: 'LOGIN', entity: 'User', entityId: u.id, details: 'Initial seed login' },
    })
  }

  console.log('Seed complete.')
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1) })
