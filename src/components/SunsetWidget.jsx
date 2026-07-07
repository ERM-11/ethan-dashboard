import React, { useEffect, useState } from 'react'
import useFetchData from '../hooks/useFetchData.js'
import { LOCATION } from '../config.js'
import { Card, Skeleton, ErrorState } from './ui.jsx'

const URL = `https://api.open-meteo.com/v1/forecast?latitude=${LOCATION.latitude}&longitude=${LOCATION.longitude}&daily=sunrise,sunset,daylight_duration&timezone=${encodeURIComponent(LOCATION.timezone)}&past_days=1&forecast_days=2`

const hm = (iso) => iso.slice(11, 16)
const mins = (s) => `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m`

export default function SunsetWidget() {
  const { data, loading, error, refresh } = useFetchData(URL, 60 * 60 * 1000)
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60000)
    return () => clearInterval(id)
  }, [])

  let body = null
  if (data?.daily && data.daily.time.length >= 2) {
    const d = data.daily
    // with past_days=1: index 0 = yesterday, 1 = today, 2 = tomorrow
    const yd = 0, td = 1, tm = d.time.length > 2 ? 2 : null
    const rise = new Date(d.sunrise[td])
    const set = new Date(d.sunset[td])
    const now = new Date()
    const frac = Math.max(0, Math.min(1, (now - rise) / (set - rise)))
    const up = now >= rise && now <= set
    // semicircle arc from (20,80) to (180,80), radius 80
    const angle = Math.PI * (1 - frac)
    const sunX = 100 + 80 * Math.cos(angle)
    const sunY = 80 - 70 * Math.sin(angle)
    const delta = Math.round((d.daylight_duration[td] - d.daylight_duration[yd]) / 60)

    body = (
      <>
        <svg viewBox="0 0 200 92" width="100%" role="img" aria-label={`Sun position: sunrise ${hm(d.sunrise[td])}, sunset ${hm(d.sunset[td])}`}>
          <path d="M 20 80 A 80 70 0 0 1 180 80" fill="none" strokeDasharray="4 4" strokeWidth="1.5"
            className={up ? 'stroke-amber-400/60' : 'stroke-slate-400 dark:stroke-slate-600'} />
          <line x1="8" y1="80" x2="192" y2="80" strokeWidth="1" className="stroke-slate-300 dark:stroke-slate-700" />
          <circle cx={up ? sunX : frac === 0 ? 20 : 180} cy={up ? sunY : 86} r="7" fill="#fbbf24" opacity={up ? 1 : 0.4} />
          <text x="20" y="91" textAnchor="middle" className="fill-slate-500 dark:fill-slate-400" style={{ font: '600 8px "JetBrains Mono", monospace' }}>{hm(d.sunrise[td])}</text>
          <text x="180" y="91" textAnchor="middle" className="fill-slate-500 dark:fill-slate-400" style={{ font: '600 8px "JetBrains Mono", monospace' }}>{hm(d.sunset[td])}</text>
        </svg>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="font-mono text-sm font-bold tabular-nums">{mins(d.daylight_duration[td])}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Daylight</p>
          </div>
          <div>
            <p className={`font-mono text-sm font-bold tabular-nums ${delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {delta >= 0 ? '▲ +' : '▼ −'}{Math.abs(delta)}m
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">vs yesterday</p>
          </div>
          <div>
            <p className="font-mono text-sm font-bold tabular-nums">
              {new Date(set.getTime() - 3600000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Golden hr</p>
          </div>
        </div>
        {tm !== null && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono text-center">
            Tomorrow: ↑ {hm(d.sunrise[tm])} ↓ {hm(d.sunset[tm])}
          </p>
        )}
      </>
    )
  }

  return (
    <Card icon="🌇" title="Sunset">
      {loading && <Skeleton className="h-32" />}
      {!loading && error && <ErrorState message={error} onRetry={refresh} />}
      {!loading && !error && body}
    </Card>
  )
}
