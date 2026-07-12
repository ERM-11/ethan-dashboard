import React, { useState } from 'react'
import { Crosshair } from 'lucide-react'
import { Card, Empty, press, focusRing } from './ui.jsx'
import { readTrackInputs, scoreTracks } from '../lib/readiness.js'
import data from '../data/ey-milestones.json'

// Mirrors BriefingStrip's scrollToWidget (module-private there; BriefingStrip must not be touched).
function scrollToWidget(id) {
  const el = document.getElementById(`widget-${id}`)
  if (!el) return
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
}

// Wrap digit runs (incl. % suffix) in .num — hard rule: no digit outside JetBrains Mono.
const numify = (s) => s.split(/(\d[\d.,]*%?)/).map((part, i) => /^\d/.test(part) ? <span key={i} className="num">{part}</span> : part)

export default function ReadinessWidget() {
  // static per-load snapshot (BriefingStrip precedent) — synchronous localStorage read, no fetch, no skeleton
  const [rows] = useState(() => scoreTracks(readTrackInputs(window.localStorage), { milestones: data.milestones }))
  const focus = rows.filter((r) => r.score > 0).slice(0, 2)
  return (
    <Card icon={Crosshair} title="Today's Focus">
      {rows.length === 0 ? (
        <Empty>No study data yet — answer a CIMA or German question, or tick a milestone</Empty>
      ) : focus.length === 0 ? (
        <Empty>All caught up — nothing urgent today ✓</Empty>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {focus.map((r, i) => (
              <li key={r.id}>
                <button onClick={() => scrollToWidget(r.target)}
                  className={`w-full flex items-center gap-3 text-left rounded-xl bg-card2 border border-line px-3 py-2 min-h-[44px] hover:bg-veil ${press} ${focusRing}`}
                  aria-label={`${r.track}: ${r.reason}. Jump to widget`}>
                  <span className="num text-xl font-bold text-mut shrink-0" aria-hidden="true">{i + 1}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium">{r.track}</span>
                    <span className="block text-xs text-mut">{numify(r.reason)}</span>
                  </span>
                  <span className={`num text-xl font-bold shrink-0 ${r.warn ? 'text-amber-400' : ''}`}>{r.score}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-mut">Higher score = more urgent · tap to jump</p>
        </>
      )}
    </Card>
  )
}
