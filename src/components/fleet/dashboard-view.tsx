'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, fmtCurrency, fmtNumber, fmtDate, VEHICLE_STATUS_COLORS } from '@/lib/fleet'
import { Fuel, TrendingUp, TrendingDown, Car, Route, Wrench, Wallet, Gauge, Trophy, AlertCircle, ArrowUp, ArrowDown, Calendar } from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell,
} from 'recharts'

interface DashboardData {
  kpis: {
    totalVehicles: number; runningVehicles: number; inServiceVehicles: number
    todayKm: number; monthlyKm: number
    totalFuelCost: number; totalFuelLiters: number
    totalMaintenanceCost: number; totalOperatingCost: number
    avgFuelCost: number; avgKmPerLiter: number; avgCostPerKm: number
    fuelEntries: number; trips: number; maintenanceCount: number
  }
  perVehicle: Array<{
    id: string; vehicleNumber: string; vehicleName: string; brand: string; model: string
    driver: string | null; monthlyKm: number; fuelLiters: number; fuelCost: number
    maintenanceCost: number; totalCost: number; kmPerLiter: number; costPerKm: number
    currentOdometer: number; status: string
  }>
  topFuelConsumer: any; mostEfficient: any; leastEfficient: any
  highestRunning: any; lowestRunning: any
}

interface AnalyticsData {
  monthly: Array<{ month: string; year: number; fuelCost: number; maintenanceCost: number; km: number; avgKmL: number; fuelLiters: number }>
  vehicleComparison: Array<{ vehicleNumber: string; fuelCost: number; maintenanceCost: number; totalCost: number; km: number; liters: number; kmL: number }>
  fuelStationDist: Array<{ station: string; cost: number }>
  maintenanceByType: Array<{ type: string; amount: number }>
}

const CHART_COLORS = ['#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16']

export function DashboardView() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api('/api/dashboard'),
      api('/api/analytics?months=6'),
    ]).then(([d, a]) => {
      setData(d); setAnalytics(a); setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading || !data || !analytics) {
    return <DashboardSkeleton />
  }

  const k = data.kpis

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard icon={Car} label="Total Vehicles" value={fmtNumber(k.totalVehicles)} subValue={`${k.runningVehicles} running · ${k.inServiceVehicles} in service`} color="emerald" />
        <KpiCard icon={Route} label="Today's KM" value={`${fmtNumber(k.todayKm)} km`} subValue={`This month: ${fmtNumber(k.monthlyKm)} km`} color="sky" />
        <KpiCard icon={Fuel} label="Total Fuel Cost" value={fmtCurrency(k.totalFuelCost)} subValue={`${fmtNumber(k.totalFuelLiters, 1)} L · ${k.fuelEntries} entries`} color="orange" />
        <KpiCard icon={Gauge} label="Avg KM/L" value={`${fmtNumber(k.avgKmPerLiter, 2)} km/L`} subValue={`Cost/KM: ${fmtCurrency(k.avgCostPerKm, '')}`} color="violet" />
        <KpiCard icon={Wrench} label="Maintenance Cost" value={fmtCurrency(k.totalMaintenanceCost)} subValue={`${k.maintenanceCount} records`} color="amber" />
        <KpiCard icon={Wallet} label="Operating Cost" value={fmtCurrency(k.totalOperatingCost)} subValue="Fuel + Maintenance" color="rose" />
        <KpiCard icon={TrendingUp} label="Monthly KM" value={`${fmtNumber(k.monthlyKm)} km`} subValue={`${k.trips} trips recorded`} color="cyan" />
        <KpiCard icon={Fuel} label="Avg Fuel Cost" value={fmtCurrency(k.avgFuelCost)} subValue="Per fill-up" color="lime" />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Fuel Cost (6 months)</CardTitle>
            <CardDescription>Total spending on fuel per month</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={analytics.monthly}>
                <defs>
                  <linearGradient id="fuelGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip formatter={(v: any) => fmtCurrency(v)} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="fuelCost" stroke="#f97316" fill="url(#fuelGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Distance & Efficiency</CardTitle>
            <CardDescription>KM driven and average fuel economy</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={analytics.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line yAxisId="left" type="monotone" dataKey="km" stroke="#0ea5e9" name="KM" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="avgKmL" stroke="#10b981" name="KM/L" strokeWidth={2} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Hero stats - top/bottom performers */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <HighlightCard icon={Trophy} label="Most Efficient" value={data.mostEfficient?.vehicleNumber || '-'} sub={data.mostEfficient ? `${fmtNumber(data.mostEfficient.kmPerLiter, 2)} km/L` : ''} color="emerald" />
        <HighlightCard icon={AlertCircle} label="Least Efficient" value={data.leastEfficient?.vehicleNumber || '-'} sub={data.leastEfficient ? `${fmtNumber(data.leastEfficient.kmPerLiter, 2)} km/L` : ''} color="rose" />
        <HighlightCard icon={ArrowUp} label="Highest Running" value={data.highestRunning?.vehicleNumber || '-'} sub={data.highestRunning ? `${fmtNumber(data.highestRunning.monthlyKm)} km/mo` : ''} color="sky" />
        <HighlightCard icon={ArrowDown} label="Lowest Running" value={data.lowestRunning?.vehicleNumber || '-'} sub={data.lowestRunning ? `${fmtNumber(data.lowestRunning.monthlyKm)} km/mo` : ''} color="amber" />
      </div>

      {/* Vehicle comparison table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vehicle Performance Comparison</CardTitle>
          <CardDescription>
            <Calendar className="size-3 inline mr-1" />
            Current month · Identifies which van is most fuel-efficient and which has the highest operating cost
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead className="text-right">Monthly KM</TableHead>
                  <TableHead className="text-right">Fuel (L)</TableHead>
                  <TableHead className="text-right">Fuel Cost</TableHead>
                  <TableHead className="text-right">Maint. Cost</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead className="text-right">KM/L</TableHead>
                  <TableHead className="text-right">Cost/KM</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.perVehicle.map(v => (
                  <TableRow key={v.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{v.vehicleNumber}</span>
                        <span className="text-xs text-muted-foreground">{v.brand} {v.model}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{v.driver || <span className="text-muted-foreground italic">Unassigned</span>}</TableCell>
                    <TableCell className="text-right font-mono">{fmtNumber(v.monthlyKm)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtNumber(v.fuelLiters, 1)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtCurrency(v.fuelCost)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtCurrency(v.maintenanceCost)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{fmtCurrency(v.totalCost)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={v.kmPerLiter >= 8 ? 'default' : v.kmPerLiter >= 7 ? 'secondary' : 'destructive'} className="font-mono">
                        {fmtNumber(v.kmPerLiter, 2)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{v.costPerKm.toFixed(3)}</TableCell>
                    <TableCell>
                      <span className={`text-[10px] font-medium px-2 py-1 rounded-full ${VEHICLE_STATUS_COLORS[v.status] || ''}`}>{v.status.replace('_', ' ')}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Bottom row charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vehicle Cost Comparison</CardTitle>
            <CardDescription>Fuel vs maintenance cost per vehicle</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={analytics.vehicleComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="vehicleNumber" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip formatter={(v: any) => fmtCurrency(v)} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="fuelCost" name="Fuel Cost" fill="#f97316" radius={[4, 4, 0, 0]} />
                <Bar dataKey="maintenanceCost" name="Maintenance Cost" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Maintenance Cost by Type</CardTitle>
            <CardDescription>Distribution of maintenance spending</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={analytics.maintenanceByType}
                  dataKey="amount"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                >
                  {analytics.maintenanceByType.map((_, idx) => (
                    <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => fmtCurrency(v)} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, subValue, color }: { icon: any; label: string; value: string; subValue?: string; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    cyan: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    lime: 'bg-lime-500/10 text-lime-600 dark:text-lime-400',
  }
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`size-10 rounded-lg grid place-items-center ${colors[color] || colors.emerald}`}>
            <Icon className="size-5" />
          </div>
        </div>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        <div className="text-xs text-muted-foreground font-medium mt-1">{label}</div>
        {subValue && <div className="text-[11px] text-muted-foreground/80 mt-0.5">{subValue}</div>}
      </CardContent>
    </Card>
  )
}

function HighlightCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string; sub: string; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900',
    sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-900',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900',
  }
  return (
    <Card className={`border ${colors[color]}`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`size-10 rounded-lg grid place-items-center ${colors[color]}`}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground font-medium">{label}</div>
          <div className="text-lg font-bold truncate">{value}</div>
          <div className="text-xs text-muted-foreground">{sub}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  )
}
