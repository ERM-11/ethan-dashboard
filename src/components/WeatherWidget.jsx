import React, { useState } from 'react'
import useFetchData from '../hooks/useFetchData.js'
import { LOCATION } from '../config.js'
import { Card, Skeleton, ErrorState, focusRing } from './ui.jsx'

const WMO = [
  [0, '☀️'], [1, '🌤️'], [2, '⛅'], [3, '☁️'], [45, '🌫️'], [48, '🌫️'],
  [51, '🌦️'], [55, '🌧️'], [61, '🌦️'], [63, '🌧️'], [65, '🌧️'], [71, '🌨️'],
  [75, '❄️'], [80, '🌦️'], [82, '⛈️'], [95, '⛈️'], [99, '⛈️']
]
const icon = (code) => {
  let best = '☁️'
  for (const [c, e] of WMO) if (code >= c) best = e
  return best
}

const URL = `https://api.open-meteo.com/v1/forecast?latitude=${LOCATION.latitude}&longitude=${LOCATION.longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&hourly=temperature_2m,precipitation_probability,weather_code&timezone=${encodeURIComponent(LOCATION.timezone)}`

export default function WeatherWidget() {
  const { data, loading, error, lastUpdated, refresh } = useFetchData(URL, 15 * 60 * 1000)
  const [openDay, setOpenDay] = useState(null)

  return (
    <Card icon="🌦️" title={`${LOCATION.name} Weather`}>
      {loading && (
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      )}
      {!loading && error && <ErrorState message={error} onRetry={refresh} />}
      {!loading && !error && data?.daily && (
        <>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
            {data.daily.time.map((d, i) => {
              const day = new Date(d + 'T00:00:00')
              const active = openDay === i
              return (
                <button
                  key={d}
                  onClick={() => setOpenDay(active ? null : i)}
                  aria-expanded={active}
                  className={`flex flex-col items-center gap-0.5 rounded-lg border p-1.5 min-h-[44px] text-center transition-colors ${focusRing} ${
                    active ? 'border-blue-500' : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
                  }`}
                >
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {i === 0 ? 'Today' : day.toLocaleDateString('en-GB', { weekday: 'short' })}
                  </span>
                  <span className="text-lg leading-none" aria-hidden="true">{icon(data.daily.weather_code[i])}</span>
                  <span className="font-mono text-xs tabular-nums">
                    {Math.round(data.daily.temperature_2m_max[i])}° <span className="text-slate-500 dark:text-slate-400">{Math.round(data.daily.temperature_2m_min[i])}°</span>
                  </span>
                </button>
              )
            })}
          </div>
          {openDay !== null && data.hourly && (
            <div className="scroller flex gap-2 pt-1" aria-label="Hourly forecast">
              {data.hourly.time
                .map((t, i) => ({ t, i }))
                .filter(({ t }) => t.startsWith(data.daily.time[openDay]))
                .filter((_, idx) => idx % 3 === 0)
                .map(({ t, i }) => {
                  const p = data.hourly.precipitation_probability[i]
                  return (
                    <div key={t} className="flex flex-col items-center gap-0.5 shrink-0 w-11">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{t.slice(11, 16)}</span>
                      <span aria-hidden="true">{icon(data.hourly.weather_code[i])}</span>
                      <span className="font-mono text-xs tabular-nums">{Math.round(data.hourly.temperature_2m[i])}°</span>
                      <div className="h-[3px] w-8 rounded bg-slate-300 dark:bg-slate-700" aria-hidden="true">
                        {p >= 10 && <div className="h-full rounded bg-blue-400/70" style={{ width: `${p}%` }} />}
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{p >= 10 ? `${p}%` : ''}</span>
                    </div>
                  )
                })}
            </div>
          )}
          <p className="text-[11px] text-slate-500 dark:text-slate-400" aria-live="polite">
            Last updated {lastUpdated?.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </>
      )}
    </Card>
  )
}
