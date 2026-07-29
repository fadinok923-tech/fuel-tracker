// Formatting helpers
export const fmtCurrency = (n: number | null | undefined, currency = 'SAR') => {
  if (n == null) return '-'
  return `${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })} ${currency}`
}

export const fmtNumber = (n: number | null | undefined, decimals = 0) => {
  if (n == null) return '-'
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })
}

export const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return '-'
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const fmtDateTime = (d: string | Date | null | undefined) => {
  if (!d) return '-'
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export const fmtRelative = (d: string | Date | null | undefined) => {
  if (!d) return 'never'
  const date = typeof d === 'string' ? new Date(d) : d
  const diff = Date.now() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  return `${Math.floor(days / 365)} years ago`
}

export const daysUntil = (d: string | Date | null | undefined) => {
  if (!d) return null
  const date = typeof d === 'string' ? new Date(d) : d
  return Math.floor((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export const api = async (url: string, opts: RequestInit = {}) => {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export const VEHICLE_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  IN_SERVICE: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  IDLE: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  RETIRED: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400',
}

export const DRIVER_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  ON_LEAVE: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  INACTIVE: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

export const FUEL_TYPE_COLORS: Record<string, string> = {
  PETROL: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400',
  DIESEL: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
  HYBRID: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  ELECTRIC: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400',
}

export const MAINT_TYPE_LABELS: Record<string, string> = {
  OIL_CHANGE: 'Oil Change',
  TYRES: 'Tyres',
  BATTERY: 'Battery',
  BRAKE_SERVICE: 'Brake Service',
  INSURANCE: 'Insurance',
  REGISTRATION: 'Registration',
  REPAIRS: 'Repairs',
  UNEXPECTED: 'Unexpected',
  OTHER: 'Other',
}

export const ALERT_SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-900',
  warning: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-900',
  info: 'bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-950/50 dark:text-sky-400 dark:border-sky-900',
}
