// Shared UI primitives — design tokens live here so widgets stay consistent.
import React, { useRef, useState } from 'react'

export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ring-offset-slate-50 dark:ring-offset-slate-900'

export function Card({ icon, title, right, children, className = '' }) {
  return (
    <section
      className={`bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 shadow-lg p-4 flex flex-col gap-3 min-w-0 ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display font-semibold text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400 flex items-center gap-2">
          <span aria-hidden="true">{icon}</span> {title}
        </h2>
        {right}
      </div>
      {children}
    </section>
  )
}

export function Skeleton({ className = 'h-4 w-full' }) {
  return <div className={`bg-slate-300/60 dark:bg-slate-700/60 rounded animate-pulse ${className}`} aria-hidden="true" />
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        ⚠️ Couldn't load data{message ? ` (${message})` : ''}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className={`bg-blue-500 hover:bg-blue-400 text-white rounded-lg px-3 py-2 text-sm font-medium ${focusRing}`}
        >
          Retry
        </button>
      )}
    </div>
  )
}

export function Empty({ children }) {
  return <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-6">{children}</p>
}

// status badge with the level word — never colour-only
const badgeTints = {
  ok: 'bg-emerald-400/15 text-emerald-600 dark:text-emerald-400',
  warn: 'bg-amber-400/15 text-amber-600 dark:text-amber-400',
  danger: 'bg-rose-400/15 text-rose-600 dark:text-rose-400',
  muted: 'bg-slate-400/15 text-slate-500 dark:text-slate-400'
}
export function Badge({ tone = 'muted', children }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${badgeTints[tone]}`}>
      {children}
    </span>
  )
}

export function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 text-xs font-medium border transition-colors min-h-[36px] ${focusRing} ${
        active
          ? 'bg-blue-500 border-blue-500 text-white'
          : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
      }`}
    >
      {children}
    </button>
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
        className={`w-full flex items-center justify-between gap-2 text-sm text-slate-600 dark:text-slate-300 py-2 min-h-[44px] ${focusRing}`}
      >
        <span>{label}</span>
        <span aria-hidden="true" className={`transition-transform duration-150 ${open ? 'rotate-90' : ''}`}>▸</span>
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

export function ProgressBar({ pct, colorClass = 'bg-blue-500', label }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 overflow-hidden">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
      {label !== undefined && (
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums shrink-0">{label}</span>
      )}
    </div>
  )
}

export function PrimaryBtn({ onClick, disabled, children, className = '' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`bg-blue-500 hover:bg-blue-400 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg px-3 py-2 text-sm font-medium active:scale-[0.98] transition-transform ${focusRing} ${className}`}
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
      className={`bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed ${ariaDisabled ? 'opacity-40 cursor-not-allowed' : ''} ${focusRing} ${className}`}
    >
      {children}
    </button>
  )
}
export function GhostBtn({ onClick, children, className = '', danger }) {
  return (
    <button
      onClick={onClick}
      className={`text-sm px-2 py-2 rounded-lg ${danger ? 'text-rose-500 hover:text-rose-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'} ${focusRing} ${className}`}
    >
      {children}
    </button>
  )
}
