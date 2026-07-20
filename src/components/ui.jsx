// Small shadcn-style UI kit (hand-built, no external component lib).
import { clsx } from './clsx.js'

export function Card({ className = '', children, ...rest }) {
  return (
    <div
      className={clsx(
        'rounded-2xl bg-white ring-1 ring-slate-200/70 shadow-sm',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, icon: Icon, action, dark = false, className = '' }) {
  if (dark) {
    // Dark header bar matching the navigation sidebar (bg-ink-900).
    return (
      <div className={clsx('flex items-center justify-between gap-3 bg-ink-900 px-5 py-3.5', className)}>
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <span className="grid place-items-center h-8 w-8 rounded-lg bg-white/10 text-teal-300 shrink-0">
              <Icon size={17} />
            </span>
          )}
          <div className="min-w-0">
            <h3 className="font-semibold text-white truncate">{title}</h3>
            {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
    )
  }
  return (
    <div className={clsx('flex items-center justify-between gap-3 px-5 pt-4 pb-3', className)}>
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && (
          <span className="grid place-items-center h-8 w-8 rounded-lg bg-teal-50 text-teal-600 shrink-0">
            <Icon size={17} />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-800 truncate">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

const BADGE_TONES = {
  teal: 'bg-teal-100 text-teal-700 ring-teal-200',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  amber: 'bg-amber-100 text-amber-700 ring-amber-200',
  red: 'bg-red-100 text-red-700 ring-red-200',
  blue: 'bg-blue-100 text-blue-700 ring-blue-200',
  green: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  purple: 'bg-purple-100 text-purple-700 ring-purple-200',
}

export function Badge({ tone = 'slate', className = '', children }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap',
        BADGE_TONES[tone] || BADGE_TONES.slate,
        className,
      )}
    >
      {children}
    </span>
  )
}

const BTN_VARIANTS = {
  primary: 'bg-teal-600 text-white hover:bg-teal-700 shadow-sm',
  soft: 'bg-teal-50 text-teal-700 hover:bg-teal-100',
  ghost: 'text-slate-600 hover:bg-slate-100',
  outline: 'ring-1 ring-slate-300 text-slate-700 hover:bg-slate-50',
  danger: 'bg-red-50 text-red-600 hover:bg-red-100',
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...rest }) {
  const sizes = { sm: 'h-8 px-3 text-sm', md: 'h-9 px-4 text-sm', lg: 'h-11 px-5' }
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none',
        BTN_VARIANTS[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

const KPI_TONES = {
  teal: 'bg-teal-100 text-teal-600',
  blue: 'bg-sky-100 text-sky-600',
  amber: 'bg-amber-100 text-amber-600',
  green: 'bg-emerald-100 text-emerald-600',
  purple: 'bg-purple-100 text-purple-600',
}

export function Kpi({ label, value, delta, deltaTone = 'green', icon: Icon, tone = 'teal' }) {
  return (
    <Card className="p-4 flex items-center gap-3.5">
      {Icon && (
        <span className={clsx('grid place-items-center h-11 w-11 rounded-xl shrink-0', KPI_TONES[tone] || KPI_TONES.teal)}>
          <Icon size={21} />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-xs text-slate-400 truncate">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-800 tabular-nums">{value}</span>
          {delta && (
            <span className={clsx('text-xs font-medium', deltaTone === 'green' ? 'text-emerald-600' : 'text-red-500')}>
              {delta}
            </span>
          )}
        </div>
      </div>
    </Card>
  )
}

export function Avatar({ initials, color = '#0d9488', size = 36 }) {
  return (
    <span
      className="grid place-items-center rounded-full text-white font-semibold shrink-0"
      style={{ backgroundColor: color, width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </span>
  )
}

export function Empty({ icon: Icon, title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-6 text-slate-400">
      {Icon && <Icon size={30} className="mb-2 opacity-60" />}
      <p className="font-medium text-slate-500">{title}</p>
      {hint && <p className="text-sm mt-0.5">{hint}</p>}
    </div>
  )
}
