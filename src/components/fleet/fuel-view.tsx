'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useAuth, useUI } from '@/lib/store'
import { PERMISSIONS } from '@/lib/types'
import { api, fmtCurrency, fmtNumber, fmtDate } from '@/lib/fleet'
import { Fuel, Plus, Edit, Trash2, Gauge, TrendingUp, Receipt, ScanLine } from 'lucide-react'
import { toast } from 'sonner'

const PAYMENT_METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'FLEET_CARD', 'UPI', 'OTHER']
const today = () => new Date().toISOString().split('T')[0]

export function FuelView() {
  const { user } = useAuth()
  const { searchQuery } = useUI()
  const canEdit = user ? PERMISSIONS[user.role].canEdit : false

  const [entries, setEntries] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [form, setForm] = useState<any>({
    date: today(), vehicleId: '', driverId: '', odometer: '', liters: '', pricePerLiter: '',
    fuelStation: '', invoiceNumber: '', paymentMethod: 'FLEET_CARD', notes: '', receiptImage: '',
  })

  const load = async () => {
    setLoading(true)
    const [f, v, d] = await Promise.all([api('/api/fuel?limit=500'), api('/api/vehicles'), api('/api/drivers')])
    setEntries(f.entries); setVehicles(v.vehicles); setDrivers(d.drivers); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = entries.filter(e => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return [e.vehicle?.vehicleNumber, e.driver?.name, e.fuelStation, e.invoiceNumber].some(f => (f || '').toLowerCase().includes(q))
  })

  const openAdd = () => {
    setEditing(null)
    setForm({ date: today(), vehicleId: vehicles[0]?.id || '', driverId: vehicles[0]?.assignedDriverId || '', odometer: '', liters: '', pricePerLiter: '', fuelStation: '', invoiceNumber: '', paymentMethod: 'FLEET_CARD', notes: '', receiptImage: '' })
    setModalOpen(true)
  }
  const openEdit = (e: any) => {
    setEditing(e)
    setForm({
      ...e,
      date: e.date ? e.date.split('T')[0] : today(),
      driverId: e.driverId || '',
    })
    setModalOpen(true)
  }

  const computed = (() => {
    const liters = parseFloat(form.liters) || 0
    const price = parseFloat(form.pricePerLiter) || 0
    const total = +(liters * price).toFixed(2)
    const v = vehicles.find(v => v.id === form.vehicleId)
    const odo = parseFloat(form.odometer) || 0
    const prevOdo = v?.currentOdometer || 0
    const distance = odo - prevOdo
    const kmL = distance > 0 && liters > 0 ? +(distance / liters).toFixed(2) : null
    const costPerKm = distance > 0 && total > 0 ? +(total / distance).toFixed(3) : null
    return { total, distance, kmL, costPerKm, prevOdo, v }
  })()

  const save = async () => {
    try {
      if (!form.vehicleId || !form.odometer || !form.liters || !form.pricePerLiter) {
        toast.error('Please fill all required fields')
        return
      }
      const payload = { ...form, userId: user?.id }
      if (editing) {
        await api(`/api/fuel/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        toast.success('Fuel entry updated')
      } else {
        await api('/api/fuel', { method: 'POST', body: JSON.stringify(payload) })
        toast.success(`Fuel entry added · ${computed.total.toFixed(2)} SAR`)
      }
      setModalOpen(false); load()
    } catch (e: any) { toast.error(e.message) }
  }

  const remove = async (e: any) => {
    if (!confirm('Delete this fuel entry?')) return
    await api(`/api/fuel/${e.id}?userId=${user?.id}`, { method: 'DELETE' })
    toast.success('Entry deleted')
    load()
  }

  // Aggregate stats
  const totalCost = filtered.reduce((s, e) => s + (e.totalCost || 0), 0)
  const totalLiters = filtered.reduce((s, e) => s + (e.liters || 0), 0)
  const totalKm = filtered.reduce((s, e) => s + (e.distance || 0), 0)
  const avgKmL = filtered.filter(e => e.kmPerLiter).length > 0
    ? filtered.filter(e => e.kmPerLiter).reduce((s, e) => s + (e.kmPerLiter || 0), 0) / filtered.filter(e => e.kmPerLiter).length
    : 0

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Fuel} label="Total Cost" value={fmtCurrency(totalCost)} color="orange" />
        <StatCard icon={Fuel} label="Total Liters" value={`${fmtNumber(totalLiters, 1)} L`} color="sky" />
        <StatCard icon={Gauge} label="Total Distance" value={`${fmtNumber(totalKm)} km`} color="emerald" />
        <StatCard icon={TrendingUp} label="Avg KM/L" value={`${fmtNumber(avgKmL, 2)}`} color="violet" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <Badge variant="outline" className="bg-muted/40">{filtered.length} entries</Badge>
        {canEdit && (
          <Button onClick={openAdd} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="size-4 mr-1" /> Add Fuel Entry
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading fuel entries…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Fuel className="size-12 mx-auto mb-2 opacity-30" /> No fuel entries found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead className="text-right">Odometer</TableHead>
                    <TableHead className="text-right">Distance</TableHead>
                    <TableHead className="text-right">Liters</TableHead>
                    <TableHead className="text-right">Price/L</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">KM/L</TableHead>
                    <TableHead className="text-right">Cost/KM</TableHead>
                    <TableHead>Station</TableHead>
                    <TableHead>Invoice</TableHead>
                    {canEdit && <TableHead></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(e => (
                    <TableRow key={e.id} className="hover:bg-muted/50">
                      <TableCell className="text-sm whitespace-nowrap">{fmtDate(e.date)}</TableCell>
                      <TableCell className="font-medium text-sm">{e.vehicle?.vehicleNumber}</TableCell>
                      <TableCell className="text-sm">{e.driver?.name || '—'}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{fmtNumber(e.odometer)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{e.distance ? `${fmtNumber(e.distance)} km` : '—'}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{fmtNumber(e.liters, 2)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{fmtNumber(e.pricePerLiter, 2)}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold">{fmtCurrency(e.totalCost)}</TableCell>
                      <TableCell className="text-right">
                        {e.kmPerLiter ? <Badge variant="outline" className="font-mono text-xs">{fmtNumber(e.kmPerLiter, 2)}</Badge> : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{e.costPerKm ? e.costPerKm.toFixed(3) : '—'}</TableCell>
                      <TableCell className="text-xs max-w-[160px] truncate" title={e.fuelStation}>{e.fuelStation || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{e.invoiceNumber || '—'}</TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openEdit(e)}><Edit className="size-3.5" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => remove(e)} className="text-rose-600"><Trash2 className="size-3.5" /></Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Fuel Entry' : 'Add Fuel Entry'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5"><Label className="text-xs">Date *</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Vehicle *</Label>
              <Select value={form.vehicleId} onValueChange={v => {
                const veh = vehicles.find(x => x.id === v)
                setForm({ ...form, vehicleId: v, driverId: veh?.assignedDriverId || form.driverId, odometer: veh ? String(veh.currentOdometer) : form.odometer })
              }}>
                <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                <SelectContent>{vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.vehicleNumber} — {v.vehicleName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Driver</Label>
              <Select value={form.driverId || 'none'} onValueChange={v => setForm({ ...form, driverId: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Unspecified —</SelectItem>
                  {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Odometer Reading (km) *</Label>
              <Input type="number" value={form.odometer} onChange={e => setForm({ ...form, odometer: e.target.value })} placeholder={computed.prevOdo ? `Prev: ${computed.prevOdo}` : ''} />
              <div className="text-[10px] text-muted-foreground">Previous odometer: <span className="font-mono">{fmtNumber(computed.prevOdo)} km</span></div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Fuel Quantity (Liters) *</Label><Input type="number" step="0.01" value={form.liters} onChange={e => setForm({ ...form, liters: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Price per Liter *</Label><Input type="number" step="0.01" value={form.pricePerLiter} onChange={e => setForm({ ...form, pricePerLiter: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Fuel Station</Label><Input value={form.fuelStation} onChange={e => setForm({ ...form, fuelStation: e.target.value })} placeholder="Aramco - Olaya" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Invoice Number</Label><Input value={form.invoiceNumber} onChange={e => setForm({ ...form, invoiceNumber: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Payment Method</Label>
              <Select value={form.paymentMethod} onValueChange={v => setForm({ ...form, paymentMethod: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m.replace('_', ' ')}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Notes</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>

            {/* Computed preview */}
            <div className="col-span-2 grid grid-cols-4 gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
              <Preview label="Distance" value={`${fmtNumber(computed.distance)} km`} />
              <Preview label="Total Cost" value={fmtCurrency(computed.total)} />
              <Preview label="KM/L" value={computed.kmL !== null ? fmtNumber(computed.kmL, 2) : '—'} />
              <Preview label="Cost/KM" value={computed.costPerKm !== null ? computed.costPerKm.toFixed(3) : '—'} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} className="bg-emerald-600 hover:bg-emerald-700">{editing ? 'Update' : 'Create'} Entry</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-600 dark:text-emerald-400', orange: 'text-orange-600 dark:text-orange-400',
    sky: 'text-sky-600 dark:text-sky-400', violet: 'text-violet-600 dark:text-violet-400',
  }
  return (
    <Card><CardContent className="p-4 flex items-center gap-3">
      <Icon className={`size-5 ${colors[color]}`} />
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-bold">{value}</div>
      </div>
    </CardContent></Card>
  )
}

function Preview({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-sm font-bold font-mono">{value}</div>
    </div>
  )
}
