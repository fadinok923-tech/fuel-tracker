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
import { api, fmtDate, daysUntil, DRIVER_STATUS_COLORS } from '@/lib/fleet'
import { Users, Plus, Edit, Trash2, Phone, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

const STATUSES = ['ACTIVE', 'ON_LEAVE', 'INACTIVE']
const empty = { name: '', mobile: '', licenseNumber: '', licenseExpiry: '', status: 'ACTIVE', notes: '', assignedVehicleId: '' }

export function DriversView() {
  const { user } = useAuth()
  const { searchQuery } = useUI()
  const canEdit = user ? PERMISSIONS[user.role].canEdit : false

  const [drivers, setDrivers] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [form, setForm] = useState<any>(empty)

  const load = async () => {
    setLoading(true)
    const [d, v] = await Promise.all([api('/api/drivers'), api('/api/vehicles')])
    setDrivers(d.drivers); setVehicles(v.vehicles); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = drivers.filter(d => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return [d.name, d.mobile, d.licenseNumber, d.assignedVehicle?.vehicleNumber].some(f => (f || '').toLowerCase().includes(q))
  })

  const openAdd = () => { setEditing(null); setForm(empty); setModalOpen(true) }
  const openEdit = (d: any) => {
    setEditing(d)
    setForm({ ...empty, ...d, licenseExpiry: d.licenseExpiry ? d.licenseExpiry.split('T')[0] : '', assignedVehicleId: d.assignedVehicleId || '' })
    setModalOpen(true)
  }

  const save = async () => {
    try {
      const payload = { ...form, userId: user?.id }
      if (editing) {
        await api(`/api/drivers/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        toast.success(`Updated ${form.name}`)
      } else {
        await api('/api/drivers', { method: 'POST', body: JSON.stringify(payload) })
        toast.success(`Added ${form.name}`)
      }
      setModalOpen(false); load()
    } catch (e: any) { toast.error(e.message) }
  }

  const remove = async (d: any) => {
    if (!confirm(`Deactivate ${d.name}?`)) return
    await api(`/api/drivers/${d.id}?userId=${user?.id}`, { method: 'DELETE' })
    toast.success(`${d.name} deactivated`)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-muted/40">{drivers.length} total</Badge>
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">{drivers.filter(d => d.status === 'ACTIVE').length} active</Badge>
        </div>
        {canEdit && (
          <Button onClick={openAdd} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="size-4 mr-1" /> Add Driver
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading drivers…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Users className="size-12 mx-auto mb-2 opacity-30" /> No drivers found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>License #</TableHead>
                    <TableHead>License Expiry</TableHead>
                    <TableHead>Assigned Vehicle</TableHead>
                    <TableHead>Status</TableHead>
                    {canEdit && <TableHead></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(d => {
                    const licDays = daysUntil(d.licenseExpiry)
                    return (
                      <TableRow key={d.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{d.name}</TableCell>
                        <TableCell className="text-sm">
                          <a href={`tel:${d.mobile}`} className="flex items-center gap-1 hover:text-emerald-600">
                            <Phone className="size-3" /> {d.mobile || '—'}
                          </a>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{d.licenseNumber}</TableCell>
                        <TableCell>
                          {d.licenseExpiry ? (
                            <div className="flex flex-col">
                              <span className="text-xs">{fmtDate(d.licenseExpiry)}</span>
                              <span className={`text-[10px] font-medium ${licDays! < 0 ? 'text-rose-600' : licDays! <= 30 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                                {licDays! < 0 ? `${Math.abs(licDays!)}d expired` : `${licDays}d left`}
                              </span>
                            </div>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-sm">{d.assignedVehicle?.vehicleNumber || <span className="text-muted-foreground italic">Unassigned</span>}</TableCell>
                        <TableCell>
                          <span className={`text-[10px] font-medium px-2 py-1 rounded-full ${DRIVER_STATUS_COLORS[d.status] || ''}`}>{d.status.replace('_', ' ')}</span>
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => openEdit(d)}><Edit className="size-3.5" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => remove(d)} className="text-rose-600"><Trash2 className="size-3.5" /></Button>
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
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing ? `Edit ${editing.name}` : 'Add New Driver'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5 col-span-2"><Label className="text-xs">Full Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Mobile</Label><Input value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} placeholder="+966…" /></div>
            <div className="space-y-1.5"><Label className="text-xs">License Number *</Label><Input value={form.licenseNumber} onChange={e => setForm({ ...form, licenseNumber: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">License Expiry</Label><Input type="date" value={form.licenseExpiry} onChange={e => setForm({ ...form, licenseExpiry: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1.5 col-span-2"><Label className="text-xs">Assigned Vehicle</Label>
              <Select value={form.assignedVehicleId || 'none'} onValueChange={v => setForm({ ...form, assignedVehicleId: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Unassigned —</SelectItem>
                  {vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.vehicleNumber} — {v.vehicleName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2"><Label className="text-xs">Notes</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} className="bg-emerald-600 hover:bg-emerald-700">{editing ? 'Update' : 'Create'} Driver</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
