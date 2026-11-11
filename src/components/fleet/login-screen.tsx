'use client'
import { useState } from 'react'
import { useAuth, useUI } from '@/lib/store'
import { api } from '@/lib/fleet'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Truck, User, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

export function LoginScreen() {
  const { setUser } = useAuth()
  const { setView } = useUI()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      setUser(data.user)
      setView('dashboard')
      toast.success(`Welcome back, ${data.user.name}!`)
    } catch (e: any) {
      toast.error(e.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-gradient-to-br from-background via-background to-muted/30">
      {/* Hero panel */}
      <div className="flex-1 flex flex-col justify-between p-8 lg:p-16 bg-gradient-to-br from-emerald-600/10 via-emerald-500/5 to-transparent">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-xl bg-emerald-600 text-white grid place-items-center shadow-lg shadow-emerald-600/30">
            <Truck className="size-6" />
          </div>
          <div>
            <div className="text-xl font-bold">Fleet Operations</div>
            <div className="text-xs text-muted-foreground">Fuel & Mileage Management System</div>
          </div>
        </div>

        <div className="max-w-lg my-12">
          <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            Run your fleet with<br />
            <span className="text-emerald-600">precision and clarity</span>
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Track every kilometer, every drop of fuel, and every Saudi Riyal spent. Get real-time
            insights into vehicle efficiency, driver performance, and operating costs — all in one
            beautiful, fast, modern dashboard.
          </p>
          <div className="grid grid-cols-3 gap-4 mt-8 max-w-md">
            <Stat label="Vehicles" value="4+" />
            <Stat label="Data points" value="100+" />
            <Stat label="Real-time" value="Live" />
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Fleet Operations Co. — All rights reserved.
        </div>
      </div>

      {/* Login panel */}
      <div className="lg:w-[480px] p-6 lg:p-12 flex items-center">
        <Card className="w-full shadow-xl border-border/60">
          <CardHeader>
            <CardTitle className="text-2xl">Sign in to your account</CardTitle>
            <p className="text-sm text-muted-foreground">Sign in with the username and password assigned to your account.</p>
          </CardHeader>
          <CardContent>
            <form id="login-form" onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" type="text" value={username} onChange={e => setUsername(e.target.value)} required autoComplete="username" placeholder="Enter your username" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
              </div>
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
                {loading ? 'Signing in…' : <>Sign in <ArrowRight className="size-4 ml-2" /></>}
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t border-border text-xs text-muted-foreground flex items-center gap-2">
              <User className="size-3" />
              <span>Role-based access · Soft-deleted records · Full audit log</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}
