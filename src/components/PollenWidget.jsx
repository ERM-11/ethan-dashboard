import React, { useState } from 'react'
import { Flower2 } from 'lucide-react'
import useFetchData from '../hooks/useFetchData.js'
import { LOCATION } from '../config.js'
import { Card, Skeleton, ErrorState, Badge, GhostBtn } from './ui.jsx'

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

// compact two-column chip: label + reading, level word always paired with the tone colour
function PollenChip({ label, value, lvl }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-line bg-card2 px-3 py-2 min-h-[44px] justify-center">
      <span className="text-xs text-mut truncate">{label}</span>
      <div className="flex items-center justify-between gap-2">
        {value != null && <span className="num text-sm">{Math.round(value)}</span>}
        <Badge tone={TONES[lvl]}>{LEVELS[lvl]}</Badge>
      </div>
    </div>
  )
}

export default function PollenWidget() {
  const { data, loading, error, lastUpdated, refresh } = useFetchData(URL, 15 * 60 * 1000)
  const [showAll, setShowAll] = useState(false)
  const cur = data?.current

  let rows = []
  if (cur) {
    rows = TYPES.map((t) => ({ ...t, value: cur[t.key], lvl: level(cur[t.key], t.t) }))
  }
  const overall = rows.length ? Math.max(...rows.map((r) => r.lvl)) : 0

  const zeroRows = rows.filter((r) => Math.round(r.value ?? 0) === 0)
  const activeRows = rows.filter((r) => Math.round(r.value ?? 0) !== 0)
  // if literally everything is out of season, nothing to gain by hiding — show it all
  const visibleRows = showAll || activeRows.length === 0 ? rows : activeRows
  const canToggle = zeroRows.length > 0 && activeRows.length > 0

  return (
    <Card icon={Flower2} title="Pollen">
      {loading && (
        // skeleton mirrors the prominent Overall bar + two-column chip grid
        <div className="flex flex-col gap-2">
          <Skeleton className="h-11 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        </div>
      )}
      {!loading && error && <ErrorState message={error} onRetry={refresh} />}
      {!loading && !error && cur && (
        <>
          <div className="flex items-center justify-between gap-2 rounded-xl border border-line2 bg-card2 px-3 py-2.5">
            <span className="text-sm font-semibold">Overall</span>
            <Badge tone={TONES[overall]}>{LEVELS[overall]}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {visibleRows.map((r) => (
              <PollenChip key={r.key} label={r.label} value={r.value} lvl={r.lvl} />
            ))}
          </div>
          {canToggle && (
            <GhostBtn onClick={() => setShowAll((s) => !s)} className="self-start">
              {showAll ? 'Show less' : <>Show all (+<span className="num">{zeroRows.length}</span>)</>}
            </GhostBtn>
          )}
          <p className="text-xs text-mut" aria-live="polite">
            Last updated <span className="num">{lastUpdated?.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span> · zero values out of season are normal
          </p>
        </>
      )}
    </Card>
  )
}
