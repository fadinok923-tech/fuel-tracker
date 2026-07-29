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
import { useAuth, useUI } from '@/lib/store'
import { PERMISSIONS } from '@/lib/types'
import { api, fmtNumber, fmtDate, fmtDateTime } from '@/lib/fleet'
import { Route, Plus, Edit, Trash2, MapPin, Clock } from 'lucide-react'
import { toast } from 'sonner'

const today = () => new Date().toISOString().split('T')[0]
const PURPOSES = ['Delivery', 'Pickup', 'Customer Visit', 'Maintenance Run', 'Inspection', 'Other']

export function TripsView() {
  const { user } = useAuth()
  const { searchQuery } = useUI()
  const canEdit = user ? PERMISSIONS[user.role].canEdit : false

  const [trips, setTrips] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [form, setForm] = useState<any>({
    date: today(), vehicleId: '', driverId: '', startKm: '', endKm: '', purpose: '', customer: '', startLocation: '', endLocation: '', timeOut: '', timeIn: '', notes: '',
  })

  const load = async () => {
    setLoading(true)
    const [t, v, d] = await Promise.all([api('/api/trips?limit=500'), api('/api/vehicles'), api('/api/drivers')])
    setTrips(t.trips); setVehicles(v.vehicles); setDrivers(d.drivers); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = trips.filter(t => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return [t.vehicle?.vehicleNumber, t.driver?.name, t.customer, t.purpose, t.startLocation, t.endLocation].some(f => (f || '').toLowerCase().includes(q))
  })

  const totalKm = filtered.reduce((s, t) => s + (t.distance || 0), 0)

  const openAdd = () => {
    setEditing(null)
    setForm({ date: today(), vehicleId: vehicles[0]?.id || '', driverId: vehicles[0]?.assignedDriverId || '', startKm: vehicles[0] ? String(vehicles[0].currentOdometer) : '', endKm: '', purpose: '', customer: '', startLocation: '', endLocation: '', timeOut: '', timeIn: '', notes: '' })
    setModalOpen(true)
  }
  const openEdit = (t: any) => {
    setEditing(t)
    setForm({
      ...t, date: t.date ? t.date.split('T')[0] : today(),
      timeOut: t.timeOut ? t.timeOut.slice(0, 16) : '',
      timeIn: t.timeIn ? t.timeIn.slice(0, 16) : '',
      driverId: t.driverId || '',
    })
    setModalOpen(true)
  }

  const save = async () => {
    try {
      const payload = { ...form, userId: user?.id }
      if (editing) {
        await api(`/api/trips/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        toast.success('Trip updated')
      } else {
        await api('/api/trips', { method: 'POST', body: JSON.stringify(payload) })
        toast.success('Trip added')
      }
      setModalOpen(false); load()
    } catch (e: any) { toast.error(e.message) }
  }

  const remove = async (t: any) => {
    if (!confirm('Delete this trip?')) return
    await api(`/api/trips/${t.id}?userId=${user?.id}`, { method: 'DELETE' })
    toast.success('Trip deleted'); load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-muted/40">{filtered.length} trips</Badge>
          <Badge variant="outline" className="bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-400">{fmtNumber(totalKm)} km total</Badge>
        </div>
        {canEdit && <Button onClick={openAdd} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="size-4 mr-1" /> Add Trip</Button>}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading trips…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground"><Route className="size-12 mx-auto mb-2 opacity-30" /> No trips found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead className="text-right">Start KM</TableHead>
                    <TableHead className="text-right">End KM</TableHead>
                    <TableHead className="text-right">Distance</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Duration</TableHead>
                    {canEdit && <TableHead></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(t => {
                    const duration = t.timeOut && t.timeIn ? (new Date(t.timeIn).getTime() - new Date(t.timeOut).getTime()) / (1000 * 60) : null
                    return (
                      <TableRow key={t.id} className="hover:bg-muted/50">
                        <TableCell className="text-sm whitespace-nowrap">{fmtDate(t.date)}</TableCell>
                        <TableCell className="font-medium text-sm">{t.vehicle?.vehicleNumber}</TableCell>
                        <TableCell className="text-sm">{t.driver?.name || '—'}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{fmtNumber(t.startKm)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{fmtNumber(t.endKm)}</TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold">{fmtNumber(t.distance)} km</TableCell>
                        <TableCell className="text-sm">{t.customer || '—'}</TableCell>
                        <TableCell className="text-xs">
                          {t.startLocation || t.endLocation ? (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <MapPin className="size-3" />
                              <span>{t.startLocation}</span>
                              <span>→</span>
                              <span>{t.endLocation}</span>
                            </div>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {duration != null ? (
                            <div className="flex items-center gap-1"><Clock className="size-3" /> {duration < 60 ? `${Math.round(duration)} min` : `${Math.floor(duration / 60)}h ${Math.round(duration % 60)}m`}</div>
                          ) : '—'}
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Edit className="size-3.5" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => remove(t)} className="text-rose-600"><Trash2 className="size-3.5" /></Button>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Trip' : 'Add Trip'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5"><Label className="text-xs">Date</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Vehicle</Label>
              <Select value={form.vehicleId} onValueChange={v => {
                const veh = vehicles.find(x => x.id === v)
                setForm({ ...form, vehicleId: v, driverId: veh?.assignedDriverId || form.driverId, startKm: !editing && veh ? String(veh.currentOdometer) : form.startKm })
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.vehicleNumber} — {v.vehicleName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Driver</Label>
              <Select value={form.driverId || 'none'} onValueChange={v => setForm({ ...form, driverId: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">— Unspecified —</SelectItem>{drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Purpose</Label>
              <Select value={form.purpose || 'none'} onValueChange={v => setForm({ ...form, purpose: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Select purpose" /></SelectTrigger>
                <SelectContent><SelectItem value="none">— None —</SelectItem>{PURPOSES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Start KM *</Label><Input type="number" value={form.startKm} onChange={e => setForm({ ...form, startKm: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">End KM *</Label><Input type="number" value={form.endKm} onChange={e => setForm({ ...form, endKm: e.target.value })} />
              {form.startKm && form.endKm && (parseFloat(form.endKm) - parseFloat(form.startKm)) > 0 && (
                <div className="text-[10px] text-emerald-600 font-medium">Distance: {fmtNumber(parseFloat(form.endKm) - parseFloat(form.startKm))} km</div>
              )}
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Customer</Label><Input value={form.customer} onChange={e => setForm({ ...form, customer: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Start Location</Label><Input value={form.startLocation} onChange={e => setForm({ ...form, startLocation: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">End Location</Label><Input value={form.endLocation} onChange={e => setForm({ ...form, endLocation: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Time Out</Label><Input type="datetime-local" value={form.timeOut} onChange={e => setForm({ ...form, timeOut: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Time In</Label><Input type="datetime-local" value={form.timeIn} onChange={e => setForm({ ...form, timeIn: e.target.value })} /></div>
            <div className="space-y-1.5 col-span-2"><Label className="text-xs">Notes</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} className="bg-emerald-600 hover:bg-emerald-700">{editing ? 'Update' : 'Create'} Trip</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
