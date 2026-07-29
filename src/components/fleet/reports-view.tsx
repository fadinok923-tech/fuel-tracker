'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, fmtCurrency, fmtNumber, fmtDate } from '@/lib/fleet'
import { FileBarChart, Download, FileText, FileSpreadsheet, Filter } from 'lucide-react'
import { toast } from 'sonner'

const REPORT_TYPES = [
  { value: 'vehicle', label: 'Vehicles' },
  { value: 'driver', label: 'Drivers' },
  { value: 'fuel', label: 'Fuel Entries' },
  { value: 'trip', label: 'Trips' },
  { value: 'maintenance', label: 'Maintenance' },
]

export function ReportsView() {
  const [type, setType] = useState('vehicle')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [vehicleId, setVehicleId] = useState('all')
  const [driverId, setDriverId] = useState('all')
  const [customer, setCustomer] = useState('')
  const [expenseType, setExpenseType] = useState('all')

  const [vehicles, setVehicles] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [result, setResult] = useState<{ columns: string[]; rows: any[]; count: number } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([api('/api/vehicles'), api('/api/drivers')]).then(([v, d]) => { setVehicles(v.vehicles); setDrivers(d.drivers) })
  }, [])

  const runReport = async () => {
    setLoading(true)
    const params = new URLSearchParams({ type, format: 'json' })
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (vehicleId !== 'all') params.set('vehicleId', vehicleId)
    if (driverId !== 'all') params.set('driverId', driverId)
    if (customer) params.set('customer', customer)
    if (expenseType !== 'all') params.set('expenseType', expenseType)
    try {
      const data = await api(`/api/reports?${params}`)
      setResult(data)
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  const exportCsv = () => {
    const params = new URLSearchParams({ type, format: 'csv' })
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (vehicleId !== 'all') params.set('vehicleId', vehicleId)
    if (driverId !== 'all') params.set('driverId', driverId)
    if (customer) params.set('customer', customer)
    if (expenseType !== 'all') params.set('expenseType', expenseType)
    window.open(`/api/reports?${params}`, '_blank')
  }

  const print = () => window.print()

  useEffect(() => { runReport() }, [type])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Filter className="size-4" /> Report Filters</CardTitle>
          <CardDescription>Choose report type and filter criteria, then export to Excel/CSV/PDF</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="space-y-1.5"><Label className="text-xs">Report Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{REPORT_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">From Date</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div className="space-y-1.5"><Label className="text-xs">To Date</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          {(type === 'fuel' || type === 'trip' || type === 'maintenance') && (
            <div className="space-y-1.5"><Label className="text-xs">Vehicle</Label>
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vehicles</SelectItem>
                  {vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.vehicleNumber}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {(type === 'fuel' || type === 'trip') && (
            <div className="space-y-1.5"><Label className="text-xs">Driver</Label>
              <Select value={driverId} onValueChange={setDriverId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Drivers</SelectItem>
                  {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {type === 'maintenance' && (
            <div className="space-y-1.5"><Label className="text-xs">Expense Type</Label>
              <Select value={expenseType} onValueChange={setExpenseType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="OIL_CHANGE">Oil Change</SelectItem>
                  <SelectItem value="TYRES">Tyres</SelectItem>
                  <SelectItem value="BATTERY">Battery</SelectItem>
                  <SelectItem value="BRAKE_SERVICE">Brake Service</SelectItem>
                  <SelectItem value="INSURANCE">Insurance</SelectItem>
                  <SelectItem value="REGISTRATION">Registration</SelectItem>
                  <SelectItem value="REPAIRS">Repairs</SelectItem>
                  <SelectItem value="UNEXPECTED">Unexpected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {type === 'trip' && (
            <div className="space-y-1.5"><Label className="text-xs">Customer (contains)</Label><Input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Almarai" /></div>
          )}
          <div className="flex items-end gap-2">
            <Button onClick={runReport} disabled={loading}><FileBarChart className="size-4 mr-1" /> Generate</Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Report Result — {result.count} records</CardTitle>
                <CardDescription>{result.columns.length} columns · {type} report</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportCsv}><FileSpreadsheet className="size-3.5 mr-1" /> CSV</Button>
                <Button variant="outline" size="sm" onClick={print}><FileText className="size-3.5 mr-1" /> Print</Button>
                <Button variant="outline" size="sm" onClick={exportCsv}><Download className="size-3.5 mr-1" /> Export</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>{result.columns.map(c => <TableHead key={c}>{c}</TableHead>)}</TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((row, idx) => (
                    <TableRow key={idx}>
                      {rowCell(row, type, result.columns).map((cell, ci) => <TableCell key={ci} className="text-xs">{cell}</TableCell>)}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function rowCell(row: any, type: string, columns: string[]) {
  if (type === 'vehicle') return [row.vehicleNumber, row.brand, row.model, row.year, row.plateNumber, row.fuelType, row.tankCapacity, row.assignedDriver?.name || '', row.status, fmtNumber(row.currentOdometer), fmtDate(row.insuranceExpiry), fmtDate(row.registrationExpiry), row.purchasePrice ? fmtCurrency(row.purchasePrice) : '']
  if (type === 'driver') return [row.name, row.mobile, row.licenseNumber, fmtDate(row.licenseExpiry), row.assignedVehicle?.vehicleNumber || '', row.status]
  if (type === 'fuel') return [fmtDate(row.date), row.vehicle?.vehicleNumber, row.driver?.name || '', fmtNumber(row.odometer), fmtNumber(row.previousOdometer), fmtNumber(row.distance), fmtNumber(row.liters, 2), fmtNumber(row.pricePerLiter, 2), fmtCurrency(row.totalCost), row.kmPerLiter ? fmtNumber(row.kmPerLiter, 2) : '—', row.costPerKm ? row.costPerKm.toFixed(3) : '—', row.fuelStation, row.invoiceNumber, row.paymentMethod]
  if (type === 'trip') return [fmtDate(row.date), row.vehicle?.vehicleNumber, row.driver?.name || '', fmtNumber(row.startKm), fmtNumber(row.endKm), fmtNumber(row.distance), row.purpose, row.customer, row.startLocation, row.endLocation, fmtDate(row.timeOut), fmtDate(row.timeIn)]
  if (type === 'maintenance') return [fmtDate(row.date), row.vehicle?.vehicleNumber, row.expenseType, fmtCurrency(row.amount), row.workshop, row.invoiceNumber, row.notes]
  return columns.map(c => row[c] != null ? String(row[c]) : '')
}
