'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api, fmtCurrency, fmtNumber, fmtDate } from '@/lib/fleet'
import { useAuth } from '@/lib/store'
import { Zap, Fuel, Route, Gauge, CheckCircle2, TrendingUp, History } from 'lucide-react'
import { toast } from 'sonner'

const today = () => new Date().toISOString().split('T')[0]

export function DriverQuickView() {
  const { user } = useAuth()
  const [vehicles, setVehicles] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [recent, setRecent] = useState<any[]>([])
  const [tab, setTab] = useState<'fuel' | 'trip'>('fuel')

  // Fuel form
  const [fuelForm, setFuelForm] = useState<any>({
    date: today(), vehicleId: '', driverId: '', odometer: '', liters: '', pricePerLiter: '', fuelStation: '',
  })
  // Trip form
  const [tripForm, setTripForm] = useState<any>({
    date: today(), vehicleId: '', driverId: '', startKm: '', endKm: '', customer: '', purpose: '', startLocation: '', endLocation: '',
  })

  const load = async () => {
    const [v, d, f] = await Promise.all([
      api('/api/vehicles'),
      api('/api/drivers'),
      api('/api/fuel?limit=5'),
    ])
    setVehicles(v.vehicles)
    setDrivers(d.drivers)
    setRecent(f.entries)
    // default selection
    if (v.vehicles[0] && !fuelForm.vehicleId) {
      setFuelForm((prev: any) => ({ ...prev, vehicleId: v.vehicles[0].id, driverId: v.vehicles[0].assignedDriverId || '' }))
      setTripForm((prev: any) => ({ ...prev, vehicleId: v.vehicles[0].id, driverId: v.vehicles[0].assignedDriverId || '', startKm: String(v.vehicles[0].currentOdometer) }))
    }
  }
  useEffect(() => { load() }, [])

  const fuelCalc = (() => {
    const liters = parseFloat(fuelForm.liters) || 0
    const price = parseFloat(fuelForm.pricePerLiter) || 0
    const total = +(liters * price).toFixed(2)
    const v = vehicles.find(x => x.id === fuelForm.vehicleId)
    const odo = parseFloat(fuelForm.odometer) || 0
    const prev = v?.currentOdometer || 0
    const dist = odo - prev
    return { total, dist, prev }
  })()

  const tripCalc = (() => {
    const s = parseFloat(tripForm.startKm) || 0
    const e = parseFloat(tripForm.endKm) || 0
    return { distance: e - s, valid: e >= s && s > 0 }
  })()

  const submitFuel = async () => {
    if (!fuelForm.vehicleId || !fuelForm.odometer || !fuelForm.liters || !fuelForm.pricePerLiter) {
      toast.error('Please fill all required fields')
      return
    }
    try {
      await api('/api/fuel', { method: 'POST', body: JSON.stringify({ ...fuelForm, paymentMethod: 'FLEET_CARD', userId: user?.id }) })
      toast.success(`Fuel logged · ${fmtCurrency(fuelCalc.total)}`)
      setFuelForm({ ...fuelForm, odometer: '', liters: '', pricePerLiter: '', fuelStation: '' })
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  const submitTrip = async () => {
    if (!tripForm.vehicleId || !tripForm.startKm || !tripForm.endKm) {
      toast.error('Please fill all required fields')
      return
    }
    if (!tripCalc.valid) { toast.error('End KM must be greater than Start KM'); return }
    try {
      await api('/api/trips', { method: 'POST', body: JSON.stringify({ ...tripForm, userId: user?.id }) })
      toast.success(`Trip logged · ${fmtNumber(tripCalc.distance)} km`)
      setTripForm({ ...tripForm, startKm: tripForm.endKm, endKm: '', customer: '', purpose: '', startLocation: '', endLocation: '' })
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20 border-emerald-200 dark:border-emerald-900">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="size-12 rounded-xl bg-emerald-600 text-white grid place-items-center">
            <Zap className="size-6" />
          </div>
          <div>
            <div className="font-bold text-lg">Driver Quick Entry</div>
            <div className="text-sm text-muted-foreground">Log fuel or trip in under 10 seconds — no clutter, just the essentials.</div>
          </div>
        </CardContent>
      </Card>

      {/* Tab toggle */}
      <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
        <button
          onClick={() => setTab('fuel')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'fuel' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
        >
          <Fuel className="size-4" /> Fuel Entry
        </button>
        <button
          onClick={() => setTab('trip')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'trip' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
        >
          <Route className="size-4" /> Trip Entry
        </button>
      </div>

      {tab === 'fuel' ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Log Fuel Fill</CardTitle>
            <CardDescription>Just 4 fields: date, odometer, liters, price. We auto-calculate everything else.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label className="text-xs">Date</Label><Input type="date" value={fuelForm.date} onChange={e => setFuelForm({ ...fuelForm, date: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Vehicle</Label>
                <Select value={fuelForm.vehicleId} onValueChange={v => {
                  const veh = vehicles.find(x => x.id === v)
                  setFuelForm({ ...fuelForm, vehicleId: v, driverId: veh?.assignedDriverId || fuelForm.driverId, odometer: veh ? String(veh.currentOdometer) : fuelForm.odometer })
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.vehicleNumber}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2"><Label className="text-xs">Odometer Reading (km)</Label>
                <Input type="number" value={fuelForm.odometer} onChange={e => setFuelForm({ ...fuelForm, odometer: e.target.value })} placeholder={`Previous: ${fuelCalc.prev}`} />
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Liters</Label><Input type="number" step="0.01" value={fuelForm.liters} onChange={e => setFuelForm({ ...fuelForm, liters: e.target.value })} placeholder="40.5" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Price / Liter (SAR)</Label><Input type="number" step="0.01" value={fuelForm.pricePerLiter} onChange={e => setFuelForm({ ...fuelForm, pricePerLiter: e.target.value })} placeholder="2.33" /></div>
              <div className="space-y-1.5 col-span-2"><Label className="text-xs">Fuel Station (optional)</Label><Input value={fuelForm.fuelStation} onChange={e => setFuelForm({ ...fuelForm, fuelStation: e.target.value })} placeholder="Aramco - Olaya" /></div>
            </div>

            <div className="grid grid-cols-3 gap-3 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
              <div className="text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Distance</div>
                <div className="text-lg font-bold font-mono">{fmtNumber(fuelCalc.dist)} km</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Cost</div>
                <div className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400">{fmtCurrency(fuelCalc.total)}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">KM/L</div>
                <div className="text-lg font-bold font-mono">{fuelCalc.dist > 0 && parseFloat(fuelForm.liters) > 0 ? fmtNumber(fuelCalc.dist / parseFloat(fuelForm.liters), 2) : '—'}</div>
              </div>
            </div>

            <Button onClick={submitFuel} className="w-full bg-emerald-600 hover:bg-emerald-700" size="lg">
              <CheckCircle2 className="size-4 mr-2" /> Submit Fuel Entry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">Log Trip</CardTitle>
            <CardDescription>Just date, start KM, end KM — and we auto-calculate distance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label className="text-xs">Date</Label><Input type="date" value={tripForm.date} onChange={e => setTripForm({ ...tripForm, date: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Vehicle</Label>
                <Select value={tripForm.vehicleId} onValueChange={v => {
                  const veh = vehicles.find(x => x.id === v)
                  setTripForm({ ...tripForm, vehicleId: v, driverId: veh?.assignedDriverId || tripForm.driverId, startKm: veh ? String(veh.currentOdometer) : tripForm.startKm })
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.vehicleNumber}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Starting KM</Label><Input type="number" value={tripForm.startKm} onChange={e => setTripForm({ ...tripForm, startKm: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Ending KM</Label><Input type="number" value={tripForm.endKm} onChange={e => setTripForm({ ...tripForm, endKm: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Customer</Label><Input value={tripForm.customer} onChange={e => setTripForm({ ...tripForm, customer: e.target.value })} placeholder="Almarai Co." /></div>
              <div className="space-y-1.5"><Label className="text-xs">Purpose</Label><Input value={tripForm.purpose} onChange={e => setTripForm({ ...tripForm, purpose: e.target.value })} placeholder="Delivery" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Start Location</Label><Input value={tripForm.startLocation} onChange={e => setTripForm({ ...tripForm, startLocation: e.target.value })} placeholder="Riyadh HQ" /></div>
              <div className="space-y-1.5"><Label className="text-xs">End Location</Label><Input value={tripForm.endLocation} onChange={e => setTripForm({ ...tripForm, endLocation: e.target.value })} placeholder="Olaya" /></div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900">
              <div className="text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Distance</div>
                <div className="text-2xl font-bold font-mono text-sky-700 dark:text-sky-400">{fmtNumber(tripCalc.distance)} km</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Status</div>
                <div className="text-sm font-medium">{tripCalc.valid || (!tripForm.startKm && !tripForm.endKm) ? <span className="text-emerald-600">Ready</span> : <span className="text-rose-600">End KM must be ≥ Start KM</span>}</div>
              </div>
            </div>

            <Button onClick={submitTrip} className="w-full bg-sky-600 hover:bg-sky-700" size="lg">
              <CheckCircle2 className="size-4 mr-2" /> Submit Trip
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent activity */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><History className="size-4" /> Recent Fuel Entries</CardTitle></CardHeader>
        <CardContent className="p-0">
          {recent.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">No recent entries</div>
          ) : (
            <div className="divide-y">
              {recent.map(e => (
                <div key={e.id} className="flex items-center justify-between p-3 hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400 grid place-items-center">
                      <Fuel className="size-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{e.vehicle?.vehicleNumber} · {fmtNumber(e.liters, 1)} L</div>
                      <div className="text-xs text-muted-foreground">{fmtDate(e.date)} · {e.fuelStation || 'No station'}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{fmtCurrency(e.totalCost)}</div>
                    {e.kmPerLiter && <div className="text-xs text-muted-foreground">{fmtNumber(e.kmPerLiter, 2)} km/L</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
