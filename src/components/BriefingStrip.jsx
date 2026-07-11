import React, { useEffect, useState } from 'react'
import { parseISO, todayISO } from '../config.js'
import useFetchData from '../hooks/useFetchData.js'
import { Skeleton, press, focusRing } from './ui.jsx'
import { SUNSET_URL, calcSunsetScore, findHourlyIndex } from './SunsetWidget.jsx'
import { fetchQuote, STOCK_DEFAULTS } from './StockWidget.jsx'
import milestones from '../data/ey-milestones.json'

// One-line morning briefing under the header: compact tappable chips that jump
// to their card. Reads existing localStorage keys and the widgets' own data
// sources only — stores nothing new. Fetches once per page load (no interval);
// chips whose data can't load simply don't render.

const readJSON = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function scrollToWidget(id) {
  const el = document.getElementById(`widget-${id}`)
  if (!el) return
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
}

function BriefChip({ target, label, value, tone }) {
  return (
    <button
      onClick={() => scrollToWidget(target)}
      className={`shrink-0 flex items-center gap-1.5 rounded-full border border-line bg-card px-3 min-h-[44px] hover:bg-veil ${press} ${focusRing}`}
    >
      <span className="text-xs text-mut whitespace-nowrap">{label}</span>
      <span className={`num text-xs font-semibold whitespace-nowrap ${tone ?? 'text-ink'}`}>{value}</span>
    </button>
  )
}

export default function BriefingStrip() {
  // static-per-load reads (localStorage + bundled data) — evaluated once
  const [snapshot] = useState(() => {
    const today = parseISO(todayISO())
    const eyDays = Math.round((parseISO(milestones.startDate) - today) / 86400000)
    return {
      eyDays,
      cimaStreak: readJSON('dashboard_cima_streak', { current: 0 }).current ?? 0,
      germanStreak: readJSON('dashboard_germanStreak', { current: 0 }).current ?? 0,
      tickers: readJSON('dashboard_stockTickers', STOCK_DEFAULTS)
    }
  })

  // best sunset day — same endpoint + verbatim scoring as SunsetWidget
  const { data: sun, loading: sunLoading } = useFetchData(SUNSET_URL, null)
  let bestSunset = null
  if (sun?.daily && sun.hourly) {
    const dd = sun.daily
    let best = null
    for (let i = 1; i < dd.time.length; i++) {
      const hIdx = findHourlyIndex(sun.hourly.time, dd.sunset[i])
      const get = (arr, fb) => (hIdx >= 0 && arr?.[hIdx] != null ? arr[hIdx] : fb)
      const score = calcSunsetScore(
        get(sun.hourly.cloud_cover_mid, 20),
        get(sun.hourly.cloud_cover_high, 10),
        get(sun.hourly.cloud_cover_low, 30),
        get(sun.hourly.relative_humidity_2m, 70),
        get(sun.hourly.precipitation_probability, 0),
        get(sun.hourly.visibility, 10000)
      )
      if (!best || score > best.score) {
        best = {
          score,
          dayName: i === 1 ? 'today' : new Date(dd.time[i] + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' })
        }
      }
    }
    bestSunset = best
  }

  // top watchlist mover — one quote sweep per page load
  const [mover, setMover] = useState(null)
  const [moverLoading, setMoverLoading] = useState(snapshot.tickers.length > 0)
  useEffect(() => {
    let alive = true
    if (!snapshot.tickers.length) return undefined
    Promise.allSettled(snapshot.tickers.map(fetchQuote)).then((results) => {
      if (!alive) return
      let top = null
      results.forEach((r) => {
        if (r.status !== 'fulfilled' || r.value.pct == null) return
        if (!top || Math.abs(r.value.pct) > Math.abs(top.pct)) top = r.value
      })
      setMover(top)
      setMoverLoading(false)
    })
    return () => { alive = false }
  }, [snapshot.tickers])

  const chipSkeleton = <Skeleton className="h-[44px] w-32 rounded-full shrink-0" />

  return (
    <nav aria-label="Daily briefing" className="max-w-grid mx-auto px-4 pb-3">
      <div className="scroller flex gap-2 -mx-4 px-4">
        <BriefChip
          target="ey"
          label={snapshot.eyDays > 0 ? 'EY starts in' : 'EY'}
          value={snapshot.eyDays > 0 ? `${snapshot.eyDays}d` : 'started'}
        />
        <BriefChip target="cima" label="CIMA streak" value={`${snapshot.cimaStreak}d`} />
        <BriefChip target="german" label="German streak" value={`${snapshot.germanStreak}d`} />
        {sunLoading && chipSkeleton}
        {bestSunset && (
          <BriefChip target="sunset" label={`Best sunset ${bestSunset.dayName}`} value={bestSunset.score} />
        )}
        {moverLoading && chipSkeleton}
        {mover && (
          <BriefChip
            target="stocks"
            label={`Top mover ${mover.ticker}`}
            value={`${mover.pct >= 0 ? '▲ +' : '▼ −'}${Math.abs(mover.pct).toFixed(1)}%`}
            tone={mover.pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}
          />
        )}
      </div>
    </nav>
  )
}
