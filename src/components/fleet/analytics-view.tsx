'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api, fmtCurrency, fmtNumber } from '@/lib/fleet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'

const CHART_COLORS = ['#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16']

interface Analytics {
  monthly: Array<{ month: string; year: number; fuelCost: number; maintenanceCost: number; km: number; avgKmL: number; fuelLiters: number }>
  vehicleComparison: Array<{ vehicleNumber: string; fuelCost: number; maintenanceCost: number; totalCost: number; km: number; liters: number; kmL: number }>
  driverComparison: Array<{ driverName: string; vehicleNumber: string | null; trips: number; km: number; fuelCost: number; kmL: number }>
  fuelStationDist: Array<{ station: string; cost: number }>
  maintenanceByType: Array<{ type: string; amount: number }>
}

export function AnalyticsView() {
  const [data, setData] = useState<Analytics | null>(null)
  const [months, setMonths] = useState('6')

  useEffect(() => {
    api(`/api/analytics?months=${months}`).then(setData)
  }, [months])

  if (!data) return <div className="space-y-4"><Skeleton className="h-80" /><Skeleton className="h-80" /></div>

  const radarData = data.vehicleComparison.map(v => ({ vehicle: v.vehicleNumber, km: v.km, kmL: v.kmL, cost: v.totalCost / 100 }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Time range</div>
        <Select value={months} onValueChange={setMonths}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="3">Last 3 months</SelectItem>
            <SelectItem value="6">Last 6 months</SelectItem>
            <SelectItem value="12">Last 12 months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Monthly fuel cost trend */}
      <Card>
        <CardHeader><CardTitle className="text-base">Monthly Fuel Cost Trend</CardTitle>
          <CardDescription>Total fuel spending per month (SAR)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data.monthly}>
              <defs>
                <linearGradient id="fuelGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip formatter={(v: any) => fmtCurrency(v)} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="fuelCost" stroke="#f97316" fill="url(#fuelGrad2)" strokeWidth={2.5} name="Fuel Cost" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Monthly KM */}
        <Card>
          <CardHeader><CardTitle className="text-base">Monthly Distance Driven</CardTitle><CardDescription>KM per month</CardDescription></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip formatter={(v: any) => `${fmtNumber(v)} km`} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="km" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="KM" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Fuel efficiency trend */}
        <Card>
          <CardHeader><CardTitle className="text-base">Fuel Efficiency Trend</CardTitle><CardDescription>Average KM/L per month</CardDescription></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip formatter={(v: any) => `${fmtNumber(v, 2)} km/L`} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="avgKmL" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} name="KM/L" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Maintenance cost trend */}
        <Card>
          <CardHeader><CardTitle className="text-base">Maintenance Cost Trend</CardTitle><CardDescription>Monthly maintenance spending</CardDescription></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip formatter={(v: any) => fmtCurrency(v)} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="maintenanceCost" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Maintenance" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Vehicle comparison radar */}
        <Card>
          <CardHeader><CardTitle className="text-base">Vehicle Comparison Radar</CardTitle><CardDescription>Multi-dimensional comparison</CardDescription></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="vehicle" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <PolarRadiusAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Radar name="KM" dataKey="km" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.3} />
                <Radar name="KM/L" dataKey="kmL" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                <Radar name="Cost/100" dataKey="cost" stroke="#f97316" fill="#f97316" fillOpacity={0.3} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Fuel station distribution */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Fuel Station Distribution</CardTitle><CardDescription>Cost breakdown by fuel station</CardDescription></CardHeader>
          <CardContent>
            {data.fuelStationDist.length === 0 ? (
              <div className="h-64 grid place-items-center text-muted-foreground text-sm">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={data.fuelStationDist} dataKey="cost" nameKey="station" cx="50%" cy="50%" outerRadius={100} label={(e: any) => `${e.station}`}>
                    {data.fuelStationDist.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmtCurrency(v)} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Maintenance by Type</CardTitle><CardDescription>Spending distribution</CardDescription></CardHeader>
          <CardContent>
            {data.maintenanceByType.length === 0 ? (
              <div className="h-64 grid place-items-center text-muted-foreground text-sm">No maintenance data</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.maintenanceByType} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis type="category" dataKey="type" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={100} />
                  <Tooltip formatter={(v: any) => fmtCurrency(v)} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="amount" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Driver comparison table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Driver Performance Comparison</CardTitle><CardDescription>Trips, distance, fuel efficiency, and cost per driver</CardDescription></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Driver</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead className="text-right">Trips</TableHead>
                  <TableHead className="text-right">KM Driven</TableHead>
                  <TableHead className="text-right">Fuel Cost</TableHead>
                  <TableHead className="text-right">Avg KM/L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.driverComparison.map((d, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{d.driverName}</TableCell>
                    <TableCell>{d.vehicleNumber || '—'}</TableCell>
                    <TableCell className="text-right font-mono">{d.trips}</TableCell>
                    <TableCell className="text-right font-mono">{fmtNumber(d.km)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtCurrency(d.fuelCost)}</TableCell>
                    <TableCell className="text-right"><Badge variant="outline" className="font-mono">{d.kmL ? fmtNumber(d.kmL, 2) : '—'}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
