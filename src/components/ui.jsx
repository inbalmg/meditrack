// Small shadcn-style UI kit (hand-built, no external component lib).
import { forwardRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { clsx } from './clsx.js'

export const Card = forwardRef(function Card({ as: Tag = 'div', className = '', children, ...rest }, ref) {
  return (
    <Tag
      ref={ref}
      className={clsx(
        'rounded-2xl bg-white ring-1 ring-slate-200/70 shadow-sm',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
})

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
            {subtitle && <p className="text-xs text-slate-300 truncate">{subtitle}</p>}
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
          {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
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
  // Teal-bordered secondary — used for non-urgent CTAs so the full-teal button
  // stays reserved for urgent actions, while this stays readable (teal-700).
  tealOutline: 'ring-1 ring-teal-600 text-teal-700 hover:bg-teal-50',
  danger: 'bg-red-50 text-red-600 hover:bg-red-100',
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...rest }) {
  // `icon` — a square, comfortable tap target for icon-only buttons (compact rows).
  const sizes = { sm: 'h-8 px-3 text-sm', md: 'h-9 px-4 text-sm', lg: 'h-11 px-5', icon: 'h-9 w-9 text-sm' }
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
  red: 'bg-red-100 text-red-600',
  slate: 'bg-slate-100 text-slate-500',
}

// Colored ring for the action tiles; the rest stay neutral so color reads as
// "this needs action" rather than decoration.
const KPI_ACCENTS = {
  red: '!ring-red-200',
  amber: '!ring-amber-200',
}

// A summary tile. When `onClick` is given it becomes a button that navigates /
// scrolls to its section, with a chevron affordance centered on the left edge.
// `sub` renders inline, on the same baseline as the value (so every card's main
// number sits on one shared row). `chevron` (default true for clickable cards) can
// be turned off for tiles that only scroll within the page rather than navigate away.
export function Kpi({ label, value, delta, deltaTone = 'green', icon: Icon, tone = 'teal', accent, onClick, compact = false, sub, chevron = true }) {
  const clickable = typeof onClick === 'function'
  const showChevron = clickable && chevron
  return (
    <Card
      as={clickable ? 'button' : undefined}
      onClick={onClick}
      className={clsx(
        'relative flex items-center w-full text-right',
        compact ? 'p-3 gap-3' : 'p-4 gap-3.5',
        showChevron && 'pl-8',
        accent && KPI_ACCENTS[accent],
        clickable && 'cursor-pointer hover:bg-slate-50 transition-colors',
      )}
    >
      {Icon && (
        <span className={clsx('grid place-items-center rounded-xl shrink-0', compact ? 'h-10 w-10' : 'h-11 w-11', KPI_TONES[tone] || KPI_TONES.teal)}>
          <Icon size={compact ? 20 : 21} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className={clsx('text-slate-500 truncate', compact ? 'text-sm' : 'text-xs')}>{label}</p>
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-bold text-slate-800 tabular-nums shrink-0 text-2xl">{value}</span>
          {delta && (
            <span className={clsx('text-xs font-medium shrink-0', deltaTone === 'green' ? 'text-emerald-600' : 'text-red-500')}>
              {delta}
            </span>
          )}
          {sub && (
            <span className="text-xs text-slate-500 truncate" title={typeof sub === 'string' ? sub : undefined}>
              {sub}
            </span>
          )}
        </div>
      </div>
      {showChevron && (
        <ChevronDown size={16} className="absolute top-1/2 -translate-y-1/2 left-3 text-slate-400" />
      )}
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

// Clear "mandatory field" marker: a red asterisk with an accessible label,
// placed next to a form field's label so required fields read at a glance.
export function RequiredMark({ className = '' }) {
  return (
    <span className={clsx('text-rose-500', className)} aria-label="שדה חובה" title="שדה חובה">*</span>
  )
}

export function Empty({ icon: Icon, title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-6 text-slate-400">
      {Icon && <Icon size={30} className="mb-2 opacity-60" />}
      <p className="font-medium text-slate-600">{title}</p>
      {hint && <p className="text-sm mt-0.5 text-slate-500">{hint}</p>}
    </div>
  )
}
