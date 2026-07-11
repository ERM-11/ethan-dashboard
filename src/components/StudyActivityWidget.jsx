import React, { useMemo, useState } from 'react'
import { Activity } from 'lucide-react'
import { Card, focusRing } from './ui.jsx'
import { parseISO } from '../config.js'
import { readActivity, activityTotal, intensityLevel, LEVEL_OPACITY, buildGrid } from '../lib/studyActivity.js'

// Layout units in viewBox space: 10px cells on a 12px pitch, Mon-first rows,
// a small left gutter for the M/W/F row labels.
const CELL = 10
const PITCH = 12
const GUTTER = 14
const VB_W = GUTTER + 12 * PITCH - (PITCH - CELL)
const VB_H = 7 * PITCH - (PITCH - CELL)
const DAY_LABELS = [
  ['M', 0],
  ['W', 2],
  ['F', 4]
]

// GitHub-style contribution grid of the last 12 weeks. Individual day cells
// are far below the 44px touch minimum, so the grid is ONE interactive
// surface (well over 44px in both axes): taps are delegated from the <svg>
// to the cell rects via data attributes, and arrow keys move the selection
// for keyboard users. Selection details render as an inline line below the
// grid — never a tooltip.
export default function StudyActivityWidget() {
  const weeks = useMemo(() => buildGrid(), [])
  const byDay = useMemo(() => readActivity(window.localStorage), [])
  const [selected, setSelected] = useState(null)

  const past = useMemo(() => weeks.flat().filter((d) => !d.future), [weeks])
  const activeDays = past.filter((d) => activityTotal(byDay[d.iso]) > 0).length

  const onTap = (e) => {
    const iso = e.target?.dataset?.iso
    if (iso) setSelected(iso)
  }
  const moveSelection = (delta) => {
    const idx = selected ? past.findIndex((d) => d.iso === selected) : -1
    const from = idx === -1 ? past.length - 1 : idx
    const next = past[Math.min(past.length - 1, Math.max(0, from + delta))]
    if (next) setSelected(next.iso)
  }
  const onKeyDown = (e) => {
    const deltas = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }
    if (deltas[e.key] !== undefined) {
      e.preventDefault()
      moveSelection(deltas[e.key])
    }
  }

  const a = selected ? byDay[selected] : null
  const parts = []
  if (a?.cima) {
    parts.push(
      <span key="cima">
        <span className="num">{a.cima}</span> CIMA {a.cima > 1 ? 'modules' : 'module'}
      </span>
    )
  }
  if (a?.german) parts.push(<span key="german">German ✓</span>)
  if (a?.word) parts.push(<span key="word">Word vote ✓</span>)

  return (
    <Card icon={Activity} title="Study Activity">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width="100%"
        role="group"
        aria-label="Study activity for the last 12 weeks. Tap a day, or focus and use the arrow keys, to see its summary below."
        tabIndex={0}
        onClick={onTap}
        onKeyDown={onKeyDown}
        className={`rounded-lg ${focusRing}`}
      >
        {DAY_LABELS.map(([label, row]) => (
          <text
            key={label}
            x={GUTTER - 6}
            y={row * PITCH + CELL - 2}
            textAnchor="middle"
            className="fill-mut"
            style={{ font: '500 7px "JetBrains Mono", monospace' }}
          >
            {label}
          </text>
        ))}
        {weeks.map((week, w) =>
          week.map(({ iso, future }, d) => {
            if (future) return null
            const level = intensityLevel(activityTotal(byDay[iso]))
            const sel = iso === selected
            return (
              <rect
                key={iso}
                data-iso={iso}
                x={GUTTER + w * PITCH}
                y={d * PITCH}
                width={CELL}
                height={CELL}
                rx="2"
                className={level === 0 ? 'fill-card2' : 'fill-ink'}
                fillOpacity={level === 0 ? 1 : LEVEL_OPACITY[level]}
                stroke={sel ? 'var(--focus)' : 'none'}
                strokeWidth={sel ? 1.5 : 0}
              />
            )
          })
        )}
      </svg>

      {selected ? (
        <p className="text-xs text-mut" aria-live="polite">
          <span className="num text-ink">
            {parseISO(selected).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
          {' · '}
          {parts.length
            ? parts.map((p, i) => (
                <React.Fragment key={i}>
                  {i > 0 && ' · '}
                  {p}
                </React.Fragment>
              ))
            : 'No activity'}
        </p>
      ) : (
        <p className="text-xs text-mut" aria-live="polite">
          <span className="num">{activeDays}</span> active {activeDays === 1 ? 'day' : 'days'} in the last{' '}
          <span className="num">12</span> weeks · tap a day for details
        </p>
      )}

      <div className="flex items-center gap-1.5 text-xs text-mut" aria-hidden="true">
        <span>Less</span>
        {LEVEL_OPACITY.map((opacity, level) => (
          <span
            key={level}
            className={`w-2.5 h-2.5 rounded ${level === 0 ? 'bg-card2' : 'bg-ink'}`}
            style={level === 0 ? undefined : { opacity }}
          />
        ))}
        <span>More</span>
      </div>
    </Card>
  )
}
