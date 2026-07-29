'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useAuth, useUI } from '@/lib/store'
import { PERMISSIONS } from '@/lib/types'
import { api, fmtCurrency, fmtNumber, fmtDate, daysUntil, VEHICLE_STATUS_COLORS, FUEL_TYPE_COLORS } from '@/lib/fleet'
import { Car, Plus, Edit, Trash2, Search, AlertTriangle, ShieldCheck, Calendar, Gauge } from 'lucide-react'
import { toast } from 'sonner'

const FUEL_TYPES = ['PETROL', 'DIESEL', 'HYBRID', 'ELECTRIC']
const STATUSES = ['ACTIVE', 'IN_SERVICE', 'IDLE', 'RETIRED']

const empty = {
  vehicleNumber: '', plateNumber: '', vehicleName: '', brand: '', model: '', year: new Date().getFullYear(),
  fuelType: 'PETROL', tankCapacity: 80, status: 'ACTIVE',
  insuranceExpiry: '', registrationExpiry: '', purchaseDate: '', purchasePrice: '',
  currentOdometer: 0, notes: '',
  oilChangeKmInterval: 5000, serviceKmInterval: 10000, tyreKmInterval: 40000, batteryIntervalDays: 730,
  assignedDriverId: '',
}

export function VehiclesView() {
  const { user } = useAuth()
  const { searchQuery } = useUI()
  const canEdit = user ? PERMISSIONS[user.role].canEdit : false

  const [vehicles, setVehicles] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [form, setForm] = useState<any>(empty)

  const load = async () => {
    setLoading(true)
    const [v, d] = await Promise.all([api('/api/vehicles'), api('/api/drivers')])
    setVehicles(v.vehicles)
    setDrivers(d.drivers)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = vehicles.filter(v => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return [v.vehicleNumber, v.plateNumber, v.vehicleName, v.brand, v.model, v.assignedDriver?.name].some(f => (f || '').toLowerCase().includes(q))
  })

  const openAdd = () => { setEditing(null); setForm(empty); setModalOpen(true) }
  const openEdit = (v: any) => {
    setEditing(v)
    setForm({
      ...empty,
      ...v,
      insuranceExpiry: v.insuranceExpiry ? v.insuranceExpiry.split('T')[0] : '',
      registrationExpiry: v.registrationExpiry ? v.registrationExpiry.split('T')[0] : '',
      purchaseDate: v.purchaseDate ? v.purchaseDate.split('T')[0] : '',
      assignedDriverId: v.assignedDriverId || '',
    })
    setModalOpen(true)
  }

  const save = async () => {
    try {
      const payload = { ...form, year: Number(form.year), tankCapacity: Number(form.tankCapacity), currentOdometer: Number(form.currentOdometer), purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null, userId: user?.id }
      if (editing) {
        await api(`/api/vehicles/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        toast.success(`Updated ${form.vehicleNumber}`)
      } else {
        await api('/api/vehicles', { method: 'POST', body: JSON.stringify(payload) })
        toast.success(`Added ${form.vehicleNumber}`)
      }
      setModalOpen(false); load()
    } catch (e: any) { toast.error(e.message) }
  }

  const remove = async (v: any) => {
    if (!confirm(`Retire ${v.vehicleNumber}? This will soft-delete the record.`)) return
    try {
      await api(`/api/vehicles/${v.id}?userId=${user?.id}`, { method: 'DELETE' })
      toast.success(`${v.vehicleNumber} retired`)
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-muted/40">{vehicles.length} total</Badge>
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">{vehicles.filter(v => v.status === 'ACTIVE').length} active</Badge>
          <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400">{vehicles.filter(v => v.status === 'IN_SERVICE').length} in service</Badge>
        </div>
        {canEdit && (
          <Button onClick={openAdd} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="size-4 mr-1" /> Add Vehicle
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading vehicles…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Car className="size-12 mx-auto mb-2 opacity-30" />
              No vehicles found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Plate</TableHead>
                    <TableHead>Brand & Model</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Fuel</TableHead>
                    <TableHead className="text-right">Odometer</TableHead>
                    <TableHead>Insurance</TableHead>
                    <TableHead>Registration</TableHead>
                    <TableHead>Status</TableHead>
                    {canEdit && <TableHead></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(v => {
                    const insDays = daysUntil(v.insuranceExpiry)
                    const regDays = daysUntil(v.registrationExpiry)
                    return (
                      <TableRow key={v.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{v.vehicleNumber}</span>
                            <span className="text-xs text-muted-foreground">{v.vehicleName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{v.plateNumber}</TableCell>
                        <TableCell>
                          <div className="text-sm">{v.brand} {v.model}</div>
                          <div className="text-xs text-muted-foreground">{v.year}</div>
                        </TableCell>
                        <TableCell className="text-sm">{v.assignedDriver?.name || <span className="text-muted-foreground italic">—</span>}</TableCell>
                        <TableCell>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${FUEL_TYPE_COLORS[v.fuelType] || ''}`}>{v.fuelType}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmtNumber(v.currentOdometer)} km</TableCell>
                        <TableCell>
                          <ExpiryCell date={v.insuranceExpiry} days={insDays} />
                        </TableCell>
                        <TableCell>
                          <ExpiryCell date={v.registrationExpiry} days={regDays} />
                        </TableCell>
                        <TableCell>
                          <span className={`text-[10px] font-medium px-2 py-1 rounded-full ${VEHICLE_STATUS_COLORS[v.status] || ''}`}>{v.status.replace('_', ' ')}</span>
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => openEdit(v)}><Edit className="size-3.5" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => remove(v)} className="text-rose-600"><Trash2 className="size-3.5" /></Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.vehicleNumber}` : 'Add New Vehicle'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <Field label="Vehicle Number *">
              <Input value={form.vehicleNumber} onChange={e => setForm({ ...form, vehicleNumber: e.target.value })} placeholder="VAN-01" />
            </Field>
            <Field label="Plate Number *">
              <Input value={form.plateNumber} onChange={e => setForm({ ...form, plateNumber: e.target.value })} placeholder="RYD-1001" />
            </Field>
            <Field label="Vehicle Name">
              <Input value={form.vehicleName} onChange={e => setForm({ ...form, vehicleName: e.target.value })} placeholder="Delivery Van 1" />
            </Field>
            <Field label="Assigned Driver">
              <Select value={form.assignedDriverId} onValueChange={v => setForm({ ...form, assignedDriverId: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Unassigned —</SelectItem>
                  {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Brand">
              <Input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} placeholder="Toyota" />
            </Field>
            <Field label="Model">
              <Input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="HiAce" />
            </Field>
            <Field label="Year">
              <Input type="number" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} />
            </Field>
            <Field label="Tank Capacity (L)">
              <Input type="number" value={form.tankCapacity} onChange={e => setForm({ ...form, tankCapacity: e.target.value })} />
            </Field>
            <Field label="Fuel Type">
              <Select value={form.fuelType} onValueChange={v => setForm({ ...form, fuelType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FUEL_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Current Odometer (km)">
              <Input type="number" value={form.currentOdometer} onChange={e => setForm({ ...form, currentOdometer: e.target.value })} />
            </Field>
            <Field label="Purchase Price">
              <Input type="number" value={form.purchasePrice} onChange={e => setForm({ ...form, purchasePrice: e.target.value })} placeholder="95000" />
            </Field>
            <Field label="Purchase Date">
              <Input type="date" value={form.purchaseDate} onChange={e => setForm({ ...form, purchaseDate: e.target.value })} />
            </Field>
            <Field label="Insurance Expiry">
              <Input type="date" value={form.insuranceExpiry} onChange={e => setForm({ ...form, insuranceExpiry: e.target.value })} />
            </Field>
            <Field label="Registration Expiry">
              <Input type="date" value={form.registrationExpiry} onChange={e => setForm({ ...form, registrationExpiry: e.target.value })} />
            </Field>
            <div className="col-span-2 border-t pt-3 mt-1">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Maintenance Intervals</div>
            </div>
            <Field label="Oil Change Interval (km)">
              <Input type="number" value={form.oilChangeKmInterval} onChange={e => setForm({ ...form, oilChangeKmInterval: e.target.value })} />
            </Field>
            <Field label="Service Interval (km)">
              <Input type="number" value={form.serviceKmInterval} onChange={e => setForm({ ...form, serviceKmInterval: e.target.value })} />
            </Field>
            <Field label="Tyre Interval (km)">
              <Input type="number" value={form.tyreKmInterval} onChange={e => setForm({ ...form, tyreKmInterval: e.target.value })} />
            </Field>
            <Field label="Battery Interval (days)">
              <Input type="number" value={form.batteryIntervalDays} onChange={e => setForm({ ...form, batteryIntervalDays: e.target.value })} />
            </Field>
            <Field label="Notes" full>
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes about this vehicle" />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} className="bg-emerald-600 hover:bg-emerald-700">{editing ? 'Update' : 'Create'} Vehicle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-1.5 ${full ? 'col-span-2' : ''}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}

function ExpiryCell({ date, days }: { date: string; days: number | null }) {
  if (!date) return <span className="text-xs text-muted-foreground">—</span>
  if (days == null) return <span className="text-xs">{fmtDate(date)}</span>
  const overdue = days < 0
  const soon = days <= 30
  return (
    <div className="flex flex-col">
      <span className="text-xs">{fmtDate(date)}</span>
      <span className={`text-[10px] font-medium flex items-center gap-0.5 ${overdue ? 'text-rose-600' : soon ? 'text-amber-600' : 'text-muted-foreground'}`}>
        {overdue ? <AlertTriangle className="size-2.5" /> : soon ? <Calendar className="size-2.5" /> : <ShieldCheck className="size-2.5" />}
        {overdue ? `${Math.abs(days)}d overdue` : `${days}d left`}
      </span>
    </div>
  )
}
