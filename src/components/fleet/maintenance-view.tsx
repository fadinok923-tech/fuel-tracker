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
import { api, fmtCurrency, fmtDate, MAINT_TYPE_LABELS } from '@/lib/fleet'
import { Wrench, Plus, Edit, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

const TYPES = Object.keys(MAINT_TYPE_LABELS)
const today = () => new Date().toISOString().split('T')[0]
const TYPE_COLORS: Record<string, string> = {
  OIL_CHANGE: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  TYRES: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  BATTERY: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400',
  BRAKE_SERVICE: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400',
  INSURANCE: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400',
  REGISTRATION: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-400',
  REPAIRS: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
  UNEXPECTED: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  OTHER: 'bg-muted text-muted-foreground',
}

export function MaintenanceView() {
  const { user } = useAuth()
  const { searchQuery } = useUI()
  const canEdit = user ? PERMISSIONS[user.role].canEdit : false

  const [items, setItems] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [filterType, setFilterType] = useState<string>('all')
  const [form, setForm] = useState<any>({
    date: today(), vehicleId: '', expenseType: 'OIL_CHANGE', amount: '', workshop: '', invoiceNumber: '', notes: '', invoiceImage: '',
  })

  const load = async () => {
    setLoading(true)
    const [m, v] = await Promise.all([api('/api/maintenance'), api('/api/vehicles')])
    setItems(m.items); setVehicles(v.vehicles); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = items.filter(m => {
    if (filterType !== 'all' && m.expenseType !== filterType) return false
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return [m.vehicle?.vehicleNumber, m.workshop, m.invoiceNumber, m.notes, m.expenseType].some(f => (f || '').toLowerCase().includes(q))
  })

  const totalCost = filtered.reduce((s, m) => s + (m.amount || 0), 0)

  const openAdd = () => { setEditing(null); setForm({ date: today(), vehicleId: vehicles[0]?.id || '', expenseType: 'OIL_CHANGE', amount: '', workshop: '', invoiceNumber: '', notes: '', invoiceImage: '' }); setModalOpen(true) }
  const openEdit = (m: any) => { setEditing(m); setForm({ ...m, date: m.date ? m.date.split('T')[0] : today() }); setModalOpen(true) }

  const save = async () => {
    try {
      if (!form.vehicleId || !form.amount) { toast.error('Vehicle and amount required'); return }
      const payload = { ...form, amount: Number(form.amount), userId: user?.id }
      if (editing) {
        await api(`/api/maintenance/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        toast.success('Maintenance updated')
      } else {
        await api('/api/maintenance', { method: 'POST', body: JSON.stringify(payload) })
        toast.success('Maintenance added')
      }
      setModalOpen(false); load()
    } catch (e: any) { toast.error(e.message) }
  }

  const remove = async (m: any) => {
    if (!confirm('Delete this maintenance record?')) return
    await api(`/api/maintenance/${m.id}?userId=${user?.id}`, { method: 'DELETE' })
    toast.success('Deleted'); load()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="bg-muted/40">{filtered.length} records</Badge>
          <Badge variant="outline" className="bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400">{fmtCurrency(totalCost)}</Badge>
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-48 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {TYPES.map(t => <SelectItem key={t} value={t}>{MAINT_TYPE_LABELS[t]}</SelectItem>)}
          </SelectContent>
        </Select>
        {canEdit && <Button onClick={openAdd} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="size-4 mr-1" /> Add Maintenance</Button>}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground"><Wrench className="size-12 mx-auto mb-2 opacity-30" /> No records found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Workshop</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Notes</TableHead>
                    {canEdit && <TableHead></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(m => (
                    <TableRow key={m.id} className="hover:bg-muted/50">
                      <TableCell className="text-sm whitespace-nowrap">{fmtDate(m.date)}</TableCell>
                      <TableCell className="font-medium text-sm">{m.vehicle?.vehicleNumber}</TableCell>
                      <TableCell>
                        <span className={`text-[10px] font-medium px-2 py-1 rounded-full ${TYPE_COLORS[m.expenseType] || ''}`}>{MAINT_TYPE_LABELS[m.expenseType] || m.expenseType}</span>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">{fmtCurrency(m.amount)}</TableCell>
                      <TableCell className="text-sm">{m.workshop || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{m.invoiceNumber || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{m.notes || '—'}</TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openEdit(m)}><Edit className="size-3.5" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => remove(m)} className="text-rose-600"><Trash2 className="size-3.5" /></Button>
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
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing ? 'Edit Maintenance' : 'Add Maintenance Record'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5"><Label className="text-xs">Date</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Vehicle *</Label>
              <Select value={form.vehicleId} onValueChange={v => setForm({ ...form, vehicleId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.vehicleNumber}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Expense Type *</Label>
              <Select value={form.expenseType} onValueChange={v => setForm({ ...form, expenseType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{MAINT_TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Amount (SAR) *</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Workshop</Label><Input value={form.workshop} onChange={e => setForm({ ...form, workshop: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Invoice Number</Label><Input value={form.invoiceNumber} onChange={e => setForm({ ...form, invoiceNumber: e.target.value })} /></div>
            <div className="space-y-1.5 col-span-2"><Label className="text-xs">Notes</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} className="bg-emerald-600 hover:bg-emerald-700">{editing ? 'Update' : 'Create'} Record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
