import React, { useState } from 'react'
import { CloudSun } from 'lucide-react'
import useFetchData from '../hooks/useFetchData.js'
import { LOCATION } from '../config.js'
import { Card, Skeleton, ErrorState, WeatherIcon, weatherLabel, focusRing, press } from './ui.jsx'

const URL = `https://api.open-meteo.com/v1/forecast?latitude=${LOCATION.latitude}&longitude=${LOCATION.longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code&hourly=temperature_2m,precipitation_probability,weather_code&timezone=${encodeURIComponent(LOCATION.timezone)}`

export default function WeatherWidget() {
  const { data, loading, error, lastUpdated, refresh } = useFetchData(URL, 15 * 60 * 1000)
  const [openDay, setOpenDay] = useState(null)

  return (
    <Card icon={CloudSun} title={`${LOCATION.name} Weather`}>
      {loading && (
        // skeleton mirrors the 7-across scrollable day strip
        <div className="scroller flex gap-1.5 -mx-4 px-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-[96px] w-16 shrink-0 rounded-lg" />
          ))}
        </div>
      )}
      {!loading && error && <ErrorState message={error} onRetry={refresh} />}
      {!loading && !error && data?.daily && (
        <>
          <div className="scroller flex gap-1.5 -mx-4 px-4" aria-label="7-day forecast">
            {data.daily.time.map((d, i) => {
              const day = new Date(d + 'T00:00:00')
              const active = openDay === i
              const code = data.daily.weather_code[i]
              const hi = Math.round(data.daily.temperature_2m_max[i])
              const lo = Math.round(data.daily.temperature_2m_min[i])
              const precip = data.daily.precipitation_probability_max?.[i]
              const dayLabel = i === 0 ? 'Today' : day.toLocaleDateString('en-GB', { weekday: 'long' })
              return (
                <button
                  key={d}
                  onClick={() => setOpenDay(active ? null : i)}
                  aria-expanded={active}
                  aria-label={`${dayLabel}, ${weatherLabel(code)}, high ${hi}°, low ${lo}°${precip != null ? `, ${precip}% chance of rain` : ''}`}
                  className={`flex flex-col items-center gap-1 shrink-0 w-16 rounded-lg border p-2 min-h-[44px] text-center transition-colors ${press} ${focusRing} ${
                    active ? 'border-line2 bg-card2' : 'border-line hover:bg-veil'
                  }`}
                >
                  <span className="text-xs font-medium text-mut">
                    {i === 0 ? 'Today' : day.toLocaleDateString('en-GB', { weekday: 'short' })}
                  </span>
                  <WeatherIcon code={code} size={20} className="text-ink" />
                  <span className="num text-xs">
                    {hi}° <span className="text-mut">{lo}°</span>
                  </span>
                  <div className="h-[3px] w-full rounded bg-card2" aria-hidden="true">
                    {precip != null && precip >= 10 && (
                      <div className="h-full rounded bg-mut" style={{ width: `${precip}%` }} />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
          {openDay !== null && data.hourly && (
            <div className="scroller flex gap-2 -mx-4 px-4 pt-1" aria-label="Hourly forecast">
              {data.hourly.time
                .map((t, i) => ({ t, i }))
                .filter(({ t }) => t.startsWith(data.daily.time[openDay]))
                .filter((_, idx) => idx % 3 === 0)
                .map(({ t, i }) => {
                  const p = data.hourly.precipitation_probability[i]
                  return (
                    <div key={t} className="flex flex-col items-center gap-0.5 shrink-0 w-11">
                      <span className="num text-xs text-mut">{t.slice(11, 16)}</span>
                      <WeatherIcon code={data.hourly.weather_code[i]} size={16} className="text-ink" />
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
