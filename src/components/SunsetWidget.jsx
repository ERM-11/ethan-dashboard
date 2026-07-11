import React, { useEffect, useState } from 'react'
import { Sunset } from 'lucide-react'
import useFetchData from '../hooks/useFetchData.js'
import { LOCATION } from '../config.js'
import { Card, Skeleton, ErrorState } from './ui.jsx'

// Gold — reserved for the best-scoring sunset day (ring + badge), this widget only.
const GOLD = '#f0b429'

// One fetch feeds both sections: daily sun times (arc, with past_days=1 for the
// vs-yesterday delta) and hourly cloud/humidity for the 5-day quality forecast.
// Exported (as SUNSET_URL, with calcSunsetScore/findHourlyIndex below) for the
// header BriefingStrip's best-sunset chip — keep these exports intact.
const URL = `https://api.open-meteo.com/v1/forecast?latitude=${LOCATION.latitude}&longitude=${LOCATION.longitude}&daily=sunrise,sunset,daylight_duration&hourly=cloud_cover_low,cloud_cover_mid,cloud_cover_high,relative_humidity_2m,precipitation_probability,visibility&timezone=${encodeURIComponent(LOCATION.timezone)}&past_days=1&forecast_days=5`
export { URL as SUNSET_URL }

const hm = (iso) => iso.slice(11, 16)
const mins = (s) => `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m`

/**
 * Sunset-quality score, 0–100. Algorithm ported verbatim from the original
 * dashboard's sunset tracker (sunset_notifier.py → SunsetWidget), which was
 * lost in the 8 July merge.
 *
 *   Positive contributions (max +55):
 *     +35  mid-level cloud — Gaussian peaked at 40%, σ=20% (catches the colour)
 *     +20  high cloud      — linear (thin cirrus lights up)
 *   Penalties (down to −45):
 *     −20  low cloud                 — linear (blocks the horizon)
 *     −10  humidity above 70%        — linear, full at 100% (haze)
 *     −10  precip probability > 30%  — hard penalty
 *     −5   visibility below 10 km    — linear
 *
 * Raw range [−45, +55] shifted by +45 → [0, 100], clamped. Clear skies land
 * mid-scale; heavy low cloud or near-total overcast kill the score.
 */
export function calcSunsetScore(cloudMid, cloudHigh, cloudLow, humidity, precipProb, visibilityM) {
  const midScore = Math.exp(-Math.pow(cloudMid - 40, 2) / (2 * Math.pow(20, 2)))
  let raw = 35.0 * midScore
  raw += 20.0 * (cloudHigh / 100.0)
  raw -= 20.0 * (cloudLow / 100.0)
  if (humidity > 70) raw -= 10.0 * Math.min((humidity - 70.0) / 30.0, 1.0)
  if (precipProb > 30) raw -= 10.0
  const visKm = visibilityM / 1000.0
  if (visKm < 10.0) raw -= 5.0 * (1.0 - visKm / 10.0)
  return Math.max(0, Math.min(100, Math.round(raw + 45.0)))
}

// Label bands, ported verbatim from the original.
function scoreLabel(score) {
  if (score >= 85) return 'Spectacular'
  if (score >= 70) return 'Great'
  if (score >= 55) return 'Good'
  if (score >= 40) return 'Decent'
  if (score >= 25) return 'Fair'
  return 'Poor'
}

// Index of the hourly sample at the day's sunset hour (matched by date + hour).
export function findHourlyIndex(hourlyTimes, sunsetISO) {
  if (!sunsetISO || !hourlyTimes?.length) return -1
  const sunsetHour = parseInt(sunsetISO.slice(11, 13), 10)
  const sunsetDate = sunsetISO.slice(0, 10)
  return hourlyTimes.findIndex((t) => t.startsWith(sunsetDate) && parseInt(t.slice(11, 13), 10) === sunsetHour)
}

// SVG ring gauge: faint full-circle track + a score-proportional arc. All colours
// from tokens (track = line2, arc = ink) except the best day, which renders in gold.
function ScoreRing({ score, best }) {
  const size = 46
  const cx = size / 2
  const r = cx - 4
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - score / 100)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cx} r={r} fill="none" strokeWidth="3.5" stroke="var(--line2)" />
      <circle
        cx={cx} cy={cx} r={r} fill="none" strokeWidth="3.5" strokeLinecap="round"
        stroke={best ? GOLD : 'var(--ink)'}
        strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset .9s ease' }}
      />
    </svg>
  )
}

function DayTile({ day, best }) {
  const label = scoreLabel(day.score)
  return (
    <div className="flex flex-col items-center gap-1 text-center min-w-0">
      <div className="h-4 flex items-center justify-center">
        {best && (
          <span className="text-xs font-bold leading-none rounded px-1 py-0.5" style={{ background: GOLD, color: 'var(--bg)' }}>
            best
          </span>
        )}
      </div>
      <span className="text-xs text-mut font-medium">{day.dayName}</span>
      <div className="relative flex items-center justify-center" style={{ width: 46, height: 46 }}>
        <ScoreRing score={day.score} best={best} />
        <span className="num text-sm font-bold absolute" style={best ? { color: GOLD } : undefined}>{day.score}</span>
      </div>
      <span className="text-xs leading-none" style={best ? { color: GOLD } : { color: 'var(--mut)' }} title={`${label} conditions`}>
        {label}
      </span>
      <span className="num text-xs text-mut">{day.sunsetTime}</span>
    </div>
  )
}

export default function SunsetWidget() {
  const { data, loading, error, refresh } = useFetchData(URL, 60 * 60 * 1000)
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60000)
    return () => clearInterval(id)
  }, [])

  let arc = null
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

    arc = (
      <div className="flex flex-col gap-1.5">
        <svg viewBox="0 0 200 92" width="100%" role="img" aria-label={`Sun position: sunrise ${hm(d.sunrise[td])}, sunset ${hm(d.sunset[td])}`}>
          <path d="M 20 80 A 80 70 0 0 1 180 80" fill="none" strokeDasharray="4 4" strokeWidth="1.5"
            className={up ? 'stroke-amber-400/60' : 'stroke-line2'} />
          <line x1="8" y1="80" x2="192" y2="80" strokeWidth="1" className="stroke-line2" />
          <circle cx={up ? sunX : frac === 0 ? 20 : 180} cy={up ? sunY : 86} r="7" fill="#fbbf24" opacity={up ? 1 : 0.4} />
          <text x="20" y="91" textAnchor="middle" className="fill-mut" style={{ font: '600 8px "JetBrains Mono", monospace' }}>{hm(d.sunrise[td])}</text>
          <text x="180" y="91" textAnchor="middle" className="fill-mut" style={{ font: '600 8px "JetBrains Mono", monospace' }}>{hm(d.sunset[td])}</text>
        </svg>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="num text-sm font-bold">{mins(d.daylight_duration[td])}</p>
            <p className="text-xs text-mut">Daylight</p>
          </div>
          <div>
            <p className="num text-sm font-bold">
              {delta >= 0 ? '▲ +' : '▼ −'}{Math.abs(delta)}m
            </p>
            <p className="text-xs text-mut">vs yesterday</p>
          </div>
          <div>
            <p className="num text-sm font-bold">
              {new Date(set.getTime() - 3600000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-xs text-mut">Golden hr</p>
          </div>
        </div>
        {tm !== null && (
          <p className="num text-xs text-mut text-center">
            Tomorrow: ↑ {hm(d.sunrise[tm])} ↓ {hm(d.sunset[tm])}
          </p>
        )}
      </div>
    )
  }

  // 5-day quality forecast: today + next four (daily indices 1..end; index 0 is
  // yesterday, present only for the arc's delta).
  let quality = []
  if (data?.daily && data.hourly) {
    const dd = data.daily
    for (let i = 1; i < dd.time.length; i++) {
      const sunsetISO = dd.sunset[i]
      const hIdx = findHourlyIndex(data.hourly.time, sunsetISO)
      const get = (arr, fb) => (hIdx >= 0 && arr?.[hIdx] != null ? arr[hIdx] : fb)
      const score = calcSunsetScore(
        get(data.hourly.cloud_cover_mid, 20),
        get(data.hourly.cloud_cover_high, 10),
        get(data.hourly.cloud_cover_low, 30),
        get(data.hourly.relative_humidity_2m, 70),
        get(data.hourly.precipitation_probability, 0),
        get(data.hourly.visibility, 10000)
      )
      const dayName = i === 1 ? 'Today' : new Date(dd.time[i] + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' })
      quality.push({ date: dd.time[i], dayName, sunsetTime: sunsetISO ? hm(sunsetISO) : '--:--', score })
    }
  }
  const bestIdx = quality.length ? quality.reduce((b, d, i) => (d.score > quality[b].score ? i : b), 0) : -1

  return (
    <Card icon={Sunset} title="Sunset">
      {loading && (
        // skeleton mirrors the arc + three stat columns + the 5-ring forecast row
        <>
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-[92px] rounded-xl" />
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-line pt-2 grid grid-cols-5 gap-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <Skeleton className="h-[46px] w-[46px] rounded-full" />
                <Skeleton className="h-3 w-10" />
              </div>
            ))}
          </div>
        </>
      )}
      {!loading && error && <ErrorState message={error} onRetry={refresh} />}
      {!loading && !error && (
        <>
          {arc}
          {quality.length > 0 && (
            <div className="border-t border-line pt-2 flex flex-col gap-1.5">
              <p className="text-xs text-mut">Sunset quality · next <span className="num">5</span> days</p>
              <div className="grid grid-cols-5 gap-1.5">
                {quality.map((day, i) => (
                  <DayTile key={day.date} day={day} best={i === bestIdx} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
