'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { api, fmtDateTime } from '@/lib/fleet'
import { ScrollText } from 'lucide-react'
import { LoadError } from './load-error'

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  UPDATE: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400',
  DELETE: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400',
  LOGIN: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  LOGOUT: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

export function AuditView() {
  const [logs, setLogs] = useState<any[]>([])
  const [entity, setEntity] = useState('all')
  const [action, setAction] = useState('all')
  const [search, setSearch] = useState('')
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(false)

  const load = async (offset = 0) => {
    setError('')
    const params = new URLSearchParams({ limit: '100', offset: String(offset) })
    if (entity !== 'all') params.set('entity', entity)
    if (action !== 'all') params.set('action', action)
    try {
      const data = await api(`/api/audit?${params}`)
      setLogs((current: any[]) => offset ? [...current, ...data.logs] : data.logs)
      setTotal(data.total); setHasMore(data.hasMore)
    } catch (e: any) { setError(e.message || 'Could not load the audit log.') }
  }
  useEffect(() => { load() }, [entity, action])

  const filtered = logs.filter(l => {
    if (!search) return true
    const q = search.toLowerCase()
    return [l.user?.name, l.user?.email, l.entity, l.entityId, l.details].some(f => (f || '').toLowerCase().includes(q))
  })

  return (
    <div className="space-y-4">
      {error && <LoadError message={error} onRetry={load} />}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ScrollText className="size-4" /> Audit Log</CardTitle>
          <CardDescription>Complete activity trail — every create, update, delete, and login is logged for compliance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="space-y-1.5">
              <Select value={entity} onValueChange={setEntity}>
                <SelectTrigger><SelectValue placeholder="Entity" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  <SelectItem value="Vehicle">Vehicles</SelectItem>
                  <SelectItem value="Driver">Drivers</SelectItem>
                  <SelectItem value="FuelEntry">Fuel Entries</SelectItem>
                  <SelectItem value="Trip">Trips</SelectItem>
                  <SelectItem value="Maintenance">Maintenance</SelectItem>
                  <SelectItem value="User">Users</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger><SelectValue placeholder="Action" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="CREATE">Create</SelectItem>
                  <SelectItem value="UPDATE">Update</SelectItem>
                  <SelectItem value="DELETE">Delete</SelectItem>
                  <SelectItem value="LOGIN">Login</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input placeholder="Search details, user, entity…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="rounded-md border max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No log entries</TableCell></TableRow>
                ) : filtered.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs whitespace-nowrap">{fmtDateTime(l.timestamp)}</TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-col">
                        <span>{l.user?.name || 'System'}</span>
                        <span className="text-[10px] text-muted-foreground">{l.user?.email}</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className={`text-[10px] ${ACTION_COLORS[l.action] || ''}`}>{l.action}</Badge></TableCell>
                    <TableCell><span className="text-xs font-medium">{l.entity}</span></TableCell>
                    <TableCell className="text-xs">{l.details}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="text-xs text-muted-foreground mt-3">Showing {filtered.length} of {total} total log entries</div>
        </CardContent>
      </Card>
      {hasMore && <div className="flex justify-center"><Button variant="outline" onClick={() => load(logs.length)}>Load more audit entries</Button></div>}
    </div>
  )
}
