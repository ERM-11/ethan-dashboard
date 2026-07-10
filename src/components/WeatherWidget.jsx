import React, { useState } from 'react'
import { CloudSun } from 'lucide-react'
import useFetchData from '../hooks/useFetchData.js'
import { LOCATION } from '../config.js'
import { Card, Skeleton, ErrorState, focusRing, press } from './ui.jsx'

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
    <Card icon={CloudSun} title={`${LOCATION.name} Weather`}>
      {loading && (
        // skeleton mirrors the 7-day tile grid
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-[74px]" />)}
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
                  className={`flex flex-col items-center gap-0.5 rounded-lg border p-1.5 min-h-[44px] text-center transition-colors ${press} ${focusRing} ${
                    active ? 'border-line2 bg-card2' : 'border-line hover:bg-veil'
                  }`}
                >
                  <span className="text-xs font-medium text-mut">
                    {i === 0 ? 'Today' : day.toLocaleDateString('en-GB', { weekday: 'short' })}
                  </span>
                  <span className="text-xl leading-none" aria-hidden="true">{icon(data.daily.weather_code[i])}</span>
                  <span className="num text-xs">
                    {Math.round(data.daily.temperature_2m_max[i])}° <span className="text-mut">{Math.round(data.daily.temperature_2m_min[i])}°</span>
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
                      <span className="num text-xs text-mut">{t.slice(11, 16)}</span>
                      <span aria-hidden="true">{icon(data.hourly.weather_code[i])}</span>
                      <span className="num text-xs">{Math.round(data.hourly.temperature_2m[i])}°</span>
                      <div className="h-[3px] w-8 rounded bg-card2" aria-hidden="true">
                        {p >= 10 && <div className="h-full rounded bg-mut" style={{ width: `${p}%` }} />}
                      </div>
                      <span className="num text-xs text-mut">{p >= 10 ? `${p}%` : ''}</span>
                    </div>
                  )
                })}
            </div>
          )}
          <p className="text-xs text-mut" aria-live="polite">
            Last updated <span className="num">{lastUpdated?.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
          </p>
        </>
      )}
    </Card>
  )
}
