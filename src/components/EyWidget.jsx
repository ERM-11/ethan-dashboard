import React, { useState } from 'react'
import useLocalStorage from '../hooks/useLocalStorage.js'
import { todayISO, parseISO, mondayOf } from '../config.js'
import { Card, Chip, Badge, ProgressBar, GhostBtn, focusRing } from './ui.jsx'
import data from '../data/ey-milestones.json'

// EY categories use a non-overlapping palette (CIMA module colours are reserved)
const CATS = {
  modelling: 'bg-cyan-500',
  tools: 'bg-pink-500',
  communication: 'bg-indigo-500',
  cima: 'bg-slate-500'
}
const FILTERS = ['All', 'modelling', 'tools', 'communication', 'cima']
const START = parseISO(data.startDate)
const WINDOW_START = parseISO('2026-04-01')

export default function EyWidget() {
  const [status, setStatus] = useLocalStorage('dashboard_ey_milestoneStatus', {})
  const [hoursLog, setHoursLog] = useLocalStorage('dashboard_ey_hoursLog', [])
  const [filter, setFilter] = useLocalStorage('dashboard_ey_categoryFilter', 'All')
  const [showAll, setShowAll] = useState(false)
  const [hoursInput, setHoursInput] = useState('')

  const now = new Date()
  const daysLeft = Math.max(0, Math.ceil((START - now) / 86400000))
  const windowPct = Math.max(0, Math.min(100, ((now - WINDOW_START) / (START - WINDOW_START)) * 100))
  const week = Math.max(1, Math.min(22, Math.floor((mondayOf(now) - mondayOf(WINDOW_START)) / (7 * 86400000)) + 1))

  const milestones = [...data.milestones].sort((a, b) => a.deadline.localeCompare(b.deadline))
  const filtered = milestones.filter((m) => filter === 'All' || m.category === filter)
  const visible = showAll ? filtered : filtered.filter((m) => !status[m.id]?.completed).slice(0, 5)

  const toggle = (id) => {
    const done = status[id]?.completed
    setStatus({ ...status, [id]: { completed: !done, completedDate: !done ? todayISO() : null } })
  }

  // hours: Log REPLACES the current week's value
  const weekStart = todayISO(mondayOf(now))
  const currentWeek = hoursLog.find((h) => h.weekStart === weekStart)
  const logHours = () => {
    const h = parseFloat(hoursInput)
    if (isNaN(h) || h < 0) return
    setHoursLog([...hoursLog.filter((x) => x.weekStart !== weekStart), { weekStart, hours: h }].slice(-26))
    setHoursInput('')
  }
  const last8 = Array.from({ length: 8 }, (_, i) => {
    const d = mondayOf(now); d.setDate(d.getDate() - 7 * (7 - i))
    const ws = todayISO(d)
    return { ws, hours: hoursLog.find((h) => h.weekStart === ws)?.hours ?? null }
  })
  const maxH = Math.max(data.weeklyHourTarget, ...last8.map((w) => w.hours ?? 0))
  const checkinDue = now.getDate() >= 26

  return (
    <Card icon="🎯" title="EY Pre-Start">
      <div className="text-center">
        <p className="font-mono text-4xl font-bold text-blue-500 tabular-nums">{daysLeft}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">days until EY start · Week {week} of 22</p>
      </div>
      <ProgressBar pct={windowPct} label={`${Math.round(windowPct)}%`} />

      <div className="scroller flex gap-1.5">
        {FILTERS.map((f) => <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>{f === 'All' ? 'All' : f}</Chip>)}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-3">
          {filtered.length ? 'All caught up in this view ✓' : `No ${filter} milestones`}
        </p>
      ) : (
        <ul className="flex flex-col">
          {visible.map((m) => {
            const done = status[m.id]?.completed
            const overdue = !done && m.deadline < todayISO()
            const soon = !done && !overdue && (parseISO(m.deadline) - now) / 86400000 <= 7
            return (
              <li key={m.id} className="relative pl-4 border-l border-slate-300 dark:border-slate-700 pb-1">
                <span className={`absolute -left-[5px] top-3 w-2.5 h-2.5 rounded-full ${CATS[m.category]}`} aria-hidden="true" />
                <button onClick={() => toggle(m.id)} className={`w-full flex items-center gap-2 text-left py-1.5 min-h-[44px] ${focusRing}`}
                  aria-pressed={!!done} title={m.description}>
                  <span className={`w-5 h-5 shrink-0 rounded border flex items-center justify-center text-xs ${
                    done ? 'bg-emerald-400/20 border-emerald-500 text-emerald-500' : 'border-slate-400 dark:border-slate-500'
                  }`} aria-hidden="true">{done ? '✓' : ''}</span>
                  <span className={`text-sm flex-1 ${done ? 'line-through text-slate-500 dark:text-slate-400' : ''}`}>
                    {m.title}
                    {m.category === 'cima' && <span className="ml-1 text-[10px] font-mono text-slate-500 dark:text-slate-400">CIMA</span>}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                    {parseISO(m.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                  {overdue && <Badge tone="danger">overdue</Badge>}
                  {soon && <Badge tone="warn">due soon</Badge>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <GhostBtn onClick={() => setShowAll(!showAll)} className="self-start -mt-1">
        {showAll ? 'Show upcoming only' : `Show all ${filtered.length}`}
      </GhostBtn>

      <div className="border-t border-slate-300 dark:border-slate-700 pt-2 flex flex-col gap-2">
        <form onSubmit={(e) => { e.preventDefault(); logHours() }} className="flex items-center gap-2">
          <label htmlFor="ey-hours" className="text-sm shrink-0">Hours this week</label>
          <input id="ey-hours" type="number" min="0" step="0.5" value={hoursInput} onChange={(e) => setHoursInput(e.target.value)}
            placeholder={currentWeek ? String(currentWeek.hours) : '0'}
            className={`w-16 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-2 text-sm font-mono ${focusRing}`} />
          <button type="submit" className={`bg-blue-500 hover:bg-blue-400 text-white rounded-lg px-3 py-2 text-sm font-medium ${focusRing}`}>Log</button>
          <span className="ml-auto font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {currentWeek?.hours ?? 0}/{data.weeklyHourTarget}h target
          </span>
        </form>
        {last8.some((w) => w.hours != null) ? (
          <div className="relative flex items-end gap-1.5 h-12" aria-label="8-week hours history">
            <div className="absolute left-0 right-0 border-t border-dashed border-slate-400 dark:border-slate-500"
              style={{ bottom: `${(data.weeklyHourTarget / maxH) * 40 + 8}px` }} aria-hidden="true" />
            {last8.map((w) => (
              <div key={w.ws} className="flex-1 flex flex-col items-center gap-0.5" title={`w/c ${w.ws}: ${w.hours ?? '—'}h`}>
                <span className="text-[9px] text-emerald-500 h-3">{w.hours != null && w.hours >= data.weeklyHourTarget ? '✓' : ''}</span>
                <div className="w-full rounded-t bg-blue-500/70" style={{ height: `${((w.hours ?? 0) / maxH) * 40}px` }} />
                <span className="font-mono text-[9px] text-slate-500 dark:text-slate-400">{w.hours ?? '·'}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">No weeks logged yet</p>
        )}
        {checkinDue ? (
          <p className="text-xs rounded-lg bg-amber-400/15 text-amber-600 dark:text-amber-400 px-2 py-1.5">
            📋 Monthly check-in due — review progress with Claude and update milestones
          </p>
        ) : (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Next check-in: 26 {now.toLocaleDateString('en-GB', { month: 'long' })}
          </p>
        )}
      </div>
    </Card>
  )
}
