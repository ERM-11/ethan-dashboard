// Shared UI primitives — design tokens live here so widgets stay consistent.
import React, { useRef, useState } from 'react'
import { ChevronRight, TriangleAlert } from 'lucide-react'

export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 ring-offset-bg'

// tap feedback (scale-down press state, see index.css)
export const press = 'press'

// short haptic tick on quiz answers / checkboxes; no-op where unsupported
export function buzz() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(10)
}

// The one card treatment: card surface + 1px low-opacity border, no shadow
// (elevation shadows vanish on the amoled theme). Header row is identical
// across widgets: small lucide icon + display-font title + optional action.
export function Card({ icon: Icon, title, right, children, className = '' }) {
  return (
    <section className={`bg-card rounded-2xl border border-line p-4 flex flex-col gap-3 min-w-0 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display font-semibold text-xs uppercase tracking-[0.12em] text-mut flex items-center gap-2 min-w-0">
          {Icon && <Icon size={15} strokeWidth={2} aria-hidden="true" className="shrink-0" />}
          <span className="truncate">{title}</span>
        </h2>
        {right}
      </div>
      {children}
    </section>
  )
}

export function Skeleton({ className = 'h-4 w-full' }) {
  return <div className={`shimmer rounded-lg ${className}`} aria-hidden="true" />
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <p className="text-sm text-mut flex items-center gap-1.5">
        <TriangleAlert size={14} aria-hidden="true" /> Couldn't load data{message ? <span className="num"> ({message})</span> : ''}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className={`bg-card2 border border-line text-ink rounded-lg px-3 py-2 min-h-[44px] text-sm font-medium ${press} ${focusRing}`}
        >
          Retry
        </button>
      )}
    </div>
  )
}

export function Empty({ children }) {
  return <p className="text-center text-sm text-mut py-6">{children}</p>
}

// status badge with the level word — never colour-only
const badgeTints = {
  ok: 'bg-emerald-400/15 text-emerald-400',
  warn: 'bg-amber-400/15 text-amber-400',
  danger: 'bg-rose-400/15 text-rose-400',
  muted: 'bg-slate-400/15 text-mut'
}
export function Badge({ tone = 'muted', children }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${badgeTints[tone]}`}>
      {children}
    </span>
  )
}

export function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 text-xs font-medium border transition-colors min-h-[36px] ${press} ${focusRing} ${
        active ? 'bg-ink border-ink text-bg' : 'border-line2 text-mut hover:bg-veil'
      }`}
    >
      {children}
    </button>
  )
}

// segmented control (mode/level switchers) — identical treatment everywhere
export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="flex rounded-full border border-line2 overflow-hidden text-xs" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          aria-pressed={value === o}
          className={`num px-3 py-1.5 min-h-[36px] capitalize text-xs ${press} ${focusRing} ${
            value === o ? 'bg-ink text-bg font-semibold' : 'text-mut hover:bg-veil'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

// standard accordion: chevron trigger + max-height panel measured via ref
export function Accordion({ label, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const ref = useRef(null)
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-2 text-sm text-mut py-2 min-h-[44px] ${press} ${focusRing}`}
      >
        <span>{label}</span>
        <ChevronRight size={16} aria-hidden="true" className={`transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
      </button>
      <div
        style={{ maxHeight: open ? (ref.current?.scrollHeight ?? 9999) : 0 }}
        className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
      >
        <div ref={ref}>{children}</div>
      </div>
    </div>
  )
}

export function ProgressBar({ pct, colorClass = 'bg-ink', label }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 rounded-full bg-card2 overflow-hidden">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
      {label !== undefined && <span className="num text-xs text-mut shrink-0">{label}</span>}
    </div>
  )
}

export function PrimaryBtn({ onClick, disabled, children, className = '' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`bg-ink text-bg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-3 py-2 min-h-[44px] text-sm font-semibold ${press} ${focusRing} ${className}`}
    >
      {children}
    </button>
  )
}
export function SecondaryBtn({ onClick, disabled, children, className = '', ariaDisabled }) {
  return (
    <button
      onClick={ariaDisabled ? undefined : onClick}
      disabled={disabled}
      aria-disabled={ariaDisabled}
      className={`bg-card2 border border-line text-ink hover:bg-veil rounded-lg px-3 py-2 min-h-[44px] text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed ${ariaDisabled ? 'opacity-40 cursor-not-allowed' : ''} ${press} ${focusRing} ${className}`}
    >
      {children}
    </button>
  )
}
export function GhostBtn({ onClick, children, className = '', danger }) {
  return (
    <button
      onClick={onClick}
      className={`text-sm px-2 py-2 min-h-[44px] rounded-lg ${danger ? 'text-rose-400 hover:text-rose-300' : 'text-mut hover:text-ink'} ${press} ${focusRing} ${className}`}
    >
      {children}
    </button>
  )
}

// text input — one treatment for every field
export function inputCls(invalid) {
  return `rounded-lg border bg-card2 px-2 py-2 min-h-[44px] text-sm placeholder:text-mut ${
    invalid ? 'border-rose-500' : 'border-line2'
  } ${focusRing}`
}
