import React from 'react'
import useFetchData from '../hooks/useFetchData.js'
import { LOCATION } from '../config.js'
import { Card, Skeleton, ErrorState, Badge } from './ui.jsx'

// half-open thresholds [low, high): below low = Low, below high = Medium, else High
const TYPES = [
  { key: 'grass_pollen', label: 'Grass', t: [20, 80] },
  { key: 'birch_pollen', label: 'Birch', t: [20, 80], tree: true },
  { key: 'alder_pollen', label: 'Alder', t: [10, 50], tree: true },
  { key: 'olive_pollen', label: 'Olive', t: [10, 50], tree: true },
  { key: 'ragweed_pollen', label: 'Ragweed', t: [10, 50] },
  { key: 'mugwort_pollen', label: 'Mugwort', t: [10, 50] }
]
const LEVELS = ['Low', 'Medium', 'High']
const TONES = ['ok', 'warn', 'danger']
const level = (v, [lo, hi]) => (v == null || v < lo ? 0 : v < hi ? 1 : 2)

const URL = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LOCATION.latitude}&longitude=${LOCATION.longitude}&current=${TYPES.map((t) => t.key).join(',')}`

function Row({ label, value, lvl, bold }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={`text-sm ${bold ? 'font-semibold' : ''}`}>{label}</span>
      <span className="flex items-center gap-2">
        {value != null && <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">{Math.round(value)}</span>}
        <Badge tone={TONES[lvl]}>{LEVELS[lvl]}</Badge>
      </span>
    </div>
  )
}

export default function PollenWidget() {
  const { data, loading, error, lastUpdated, refresh } = useFetchData(URL, 15 * 60 * 1000)
  const cur = data?.current

  let rows = []
  if (cur) {
    rows = TYPES.map((t) => ({ ...t, value: cur[t.key], lvl: level(cur[t.key], t.t) }))
  }
  const treeLvl = rows.length ? Math.max(...rows.filter((r) => r.tree).map((r) => r.lvl)) : 0
  const overall = rows.length ? Math.max(...rows.map((r) => r.lvl)) : 0

  return (
    <Card icon="🌾" title="Pollen">
      {loading && <div className="flex flex-col gap-2">{Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-5" />)}</div>}
      {!loading && error && <ErrorState message={error} onRetry={refresh} />}
      {!loading && !error && cur && (
        <>
          <div className="border-l-2 border-blue-500 pl-2">
            <Row label="Tree pollen" lvl={treeLvl} bold />
          </div>
          <div className="flex flex-col gap-1.5">
            {rows.map((r) => <Row key={r.key} label={r.label} value={r.value} lvl={r.lvl} />)}
          </div>
          <div className="border-t border-slate-300 dark:border-slate-700 pt-2">
            <Row label="Overall" lvl={overall} bold />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400" aria-live="polite">
            Last updated {lastUpdated?.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · zero values out of season are normal
          </p>
        </>
      )}
    </Card>
  )
}
