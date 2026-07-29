'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api, ALERT_SEVERITY_COLORS } from '@/lib/fleet'
import { useUI } from '@/lib/store'
import { Bell, AlertTriangle, ShieldAlert, Info, RefreshCw, Car, Calendar, Fuel, Wrench, Battery, Gauge, MapPin } from 'lucide-react'

const TYPE_ICONS: Record<string, typeof Bell> = {
  INSURANCE_EXPIRED: ShieldAlert,
  INSURANCE_EXPIRING: Calendar,
  REGISTRATION_EXPIRED: ShieldAlert,
  REGISTRATION_EXPIRING: Calendar,
  OIL_CHANGE_DUE: Wrench,
  OIL_CHANGE_SOON: Wrench,
  SERVICE_DUE: Wrench,
  SERVICE_SOON: Wrench,
  TYRES_DUE: Car,
  TYRES_SOON: Car,
  BATTERY_DUE: Battery,
  BATTERY_SOON: Battery,
  NO_FUEL: Fuel,
  ABNORMAL_FUEL: Gauge,
  NO_TRIPS: MapPin,
  INACTIVE_VEHICLE: Car,
  LICENSE_EXPIRED: ShieldAlert,
  LICENSE_EXPIRING: Calendar,
}

const SEVERITY_LABEL: Record<string, string> = { critical: 'Critical', warning: 'Warning', info: 'Info' }

export function AlertsView() {
  const { setView } = useUI()
  const [data, setData] = useState<{ alerts: any[]; counts: any } | null>(null)
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all')

  const load = () => api('/api/alerts').then(setData)
  useEffect(() => { load() }, [])

  const filtered = data ? (filter === 'all' ? data.alerts : data.alerts.filter(a => a.severity === filter)) : []

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-rose-200 dark:border-rose-900">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-lg bg-rose-500/10 text-rose-600 grid place-items-center"><AlertTriangle className="size-5" /></div>
              <div>
                <div className="text-2xl font-bold">{data.counts.critical}</div>
                <div className="text-xs text-muted-foreground">Critical</div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-200 dark:border-amber-900">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-lg bg-amber-500/10 text-amber-600 grid place-items-center"><Bell className="size-5" /></div>
              <div>
                <div className="text-2xl font-bold">{data.counts.warning}</div>
                <div className="text-xs text-muted-foreground">Warning</div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-sky-200 dark:border-sky-900">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-lg bg-sky-500/10 text-sky-600 grid place-items-center"><Info className="size-5" /></div>
              <div>
                <div className="text-2xl font-bold">{data.counts.info}</div>
                <div className="text-xs text-muted-foreground">Info</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
          {(['all', 'critical', 'warning', 'info'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${filter === f ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
            >{f} {f === 'all' ? `(${data?.alerts.length || 0})` : `(${data?.counts[f] || 0})`}</button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="size-3.5 mr-1" /> Refresh</Button>
      </div>

      {/* Alerts list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card><CardContent className="p-12 text-center">
            <div className="size-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950 grid place-items-center mb-3">
              <Bell className="size-8 text-emerald-600" />
            </div>
            <div className="font-semibold">All clear!</div>
            <div className="text-sm text-muted-foreground">No alerts match the current filter.</div>
          </CardContent></Card>
        ) : (
          filtered.map((a, idx) => {
            const Icon = TYPE_ICONS[a.type] || Bell
            return (
              <Card key={idx} className={`border-l-4 ${a.severity === 'critical' ? 'border-l-rose-500' : a.severity === 'warning' ? 'border-l-amber-500' : 'border-l-sky-500'}`}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`size-10 rounded-lg grid place-items-center ${ALERT_SEVERITY_COLORS[a.severity]}`}>
                    <Icon className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{a.message}</span>
                      <Badge variant="outline" className={`text-[10px] ${ALERT_SEVERITY_COLORS[a.severity]}`}>{SEVERITY_LABEL[a.severity]}</Badge>
                      <Badge variant="outline" className="text-[10px]">{a.type.replace(/_/g, ' ')}</Badge>
                    </div>
                    {a.dueDate && <div className="text-xs text-muted-foreground mt-0.5">Due: {new Date(a.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>}
                  </div>
                  {a.vehicleNumber && (
                    <Button variant="ghost" size="sm" onClick={() => setView('vehicles')}>
                      View {a.vehicleNumber}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
