'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/lib/store'
import { PERMISSIONS, ROLE_LABELS, type Role } from '@/lib/types'
import { api, fmtDate } from '@/lib/fleet'
import { Shield, Plus, Edit, Trash2, UserCog } from 'lucide-react'
import { toast } from 'sonner'

const ROLES: Role[] = ['ADMIN', 'MANAGER', 'DRIVER', 'READ_ONLY']

const ROLE_PERMISSIONS_MATRIX = [
  { role: 'ADMIN' as Role, views: 'All 12 views', edit: true, delete: true, manage: true },
  { role: 'MANAGER' as Role, views: '11 views (no Users)', edit: true, delete: true, manage: false },
  { role: 'DRIVER' as Role, views: '4 views: Dashboard, Quick Entry, Fuel, Alerts', edit: true, delete: false, manage: false },
  { role: 'READ_ONLY' as Role, views: '9 views (read-only)', edit: false, delete: false, manage: false },
]

export function UsersView() {
  const { user } = useAuth()
  const canManage = user ? PERMISSIONS[user.role].canManageUsers : false
  const [users, setUsers] = useState<any[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [form, setForm] = useState<any>({ name: '', email: '', password: '', role: 'MANAGER', active: true })

  const load = () => api('/api/users').then(d => setUsers(d.users))
  useEffect(() => { load() }, [])

  const openAdd = () => { setEditing(null); setForm({ name: '', email: '', password: '', role: 'MANAGER', active: true }); setModalOpen(true) }
  const openEdit = (u: any) => { setEditing(u); setForm({ ...u, password: '' }); setModalOpen(true) }

  const save = async () => {
    try {
      if (!editing && (!form.name || !form.email || !form.password)) { toast.error('Fill all required fields'); return }
      const payload = { ...form, userId: user?.id }
      if (editing) {
        if (!form.password) delete payload.password
        await api(`/api/users/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        toast.success('User updated')
      } else {
        await api('/api/users', { method: 'POST', body: JSON.stringify(payload) })
        toast.success('User created')
      }
      setModalOpen(false); load()
    } catch (e: any) { toast.error(e.message) }
  }

  const remove = async (u: any) => {
    if (u.id === user?.id) { toast.error('Cannot delete yourself'); return }
    if (!confirm(`Deactivate ${u.email}?`)) return
    await api(`/api/users/${u.id}?userId=${user?.id}`, { method: 'DELETE' })
    toast.success('User deactivated'); load()
  }

  return (
    <div className="space-y-6">
      {/* Permission matrix */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="size-4" /> Role-Based Access Control</CardTitle>
          <CardDescription>Permission matrix per role in this fleet system</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Accessible Views</TableHead>
                  <TableHead className="text-center">Create / Edit</TableHead>
                  <TableHead className="text-center">Delete</TableHead>
                  <TableHead className="text-center">Manage Users</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ROLE_PERMISSIONS_MATRIX.map(r => (
                  <TableRow key={r.role}>
                    <TableCell><Badge variant="outline" className="font-medium">{ROLE_LABELS[r.role]}</Badge></TableCell>
                    <TableCell className="text-sm">{r.views}</TableCell>
                    <TableCell className="text-center">{r.edit ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-center">{r.delete ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-center">{r.manage ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">{users.length} user accounts</div>
        {canManage && <Button onClick={openAdd} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="size-4 mr-1" /> Add User</Button>}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  {canManage && <TableHead></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-sm">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        u.role === 'ADMIN' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400' :
                        u.role === 'MANAGER' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400' :
                        u.role === 'DRIVER' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' :
                        'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }>{ROLE_LABELS[u.role as Role]}</Badge>
                    </TableCell>
                    <TableCell>
                      {u.active ? <span className="text-xs text-emerald-600">● Active</span> : <span className="text-xs text-muted-foreground">● Inactive</span>}
                    </TableCell>
                    <TableCell className="text-xs">{fmtDate(u.createdAt)}</TableCell>
                    {canManage && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(u)}><Edit className="size-3.5" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => remove(u)} className="text-rose-600"><Trash2 className="size-3.5" /></Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><UserCog className="size-4" /> {editing ? 'Edit User' : 'Add User'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label className="text-xs">Full Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Email *</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">{editing ? 'New Password (leave blank to keep)' : 'Password *'}</Label><Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Role</Label>
              <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div><div className="text-sm font-medium">Active Account</div><div className="text-xs text-muted-foreground">Inactive users cannot log in</div></div>
              <Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} className="bg-emerald-600 hover:bg-emerald-700">{editing ? 'Update' : 'Create'} User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
