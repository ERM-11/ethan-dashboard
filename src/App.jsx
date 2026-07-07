import React, { useEffect, useState } from 'react'
import useLocalStorage from './hooks/useLocalStorage.js'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { focusRing, GhostBtn } from './components/ui.jsx'
import WeatherWidget from './components/WeatherWidget.jsx'
import PollenWidget from './components/PollenWidget.jsx'
import SunsetWidget from './components/SunsetWidget.jsx'
import NewsWidget from './components/NewsWidget.jsx'
import StockWidget from './components/StockWidget.jsx'
import WordWidget from './components/WordWidget.jsx'
import GermanWidget from './components/GermanWidget.jsx'
import CimaWidget from './components/CimaWidget.jsx'
import EyWidget from './components/EyWidget.jsx'

const WIDGETS = {
  weather: { name: 'Weather', el: WeatherWidget, span: false },
  pollen: { name: 'Pollen', el: PollenWidget, span: false },
  sunset: { name: 'Sunset', el: SunsetWidget, span: false },
  stocks: { name: 'Stocks', el: StockWidget, span: false },
  news: { name: 'News', el: NewsWidget, span: false },
  word: { name: 'Word of the Day', el: WordWidget, span: false },
  cima: { name: 'CIMA Study', el: CimaWidget, span: true },
  german: { name: 'German Practice', el: GermanWidget, span: false },
  ey: { name: 'EY Tracker', el: EyWidget, span: false }
}
const DEFAULT_ORDER = ['weather', 'pollen', 'sunset', 'stocks', 'news', 'word', 'cima', 'german', 'ey']

function Clock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="font-mono text-xs sm:text-sm text-slate-500 dark:text-slate-400 tabular-nums">
      {now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}{' '}
      {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
    </span>
  )
}

export default function App() {
  const [dark, setDark] = useLocalStorage('dashboard_darkMode', true)
  const [order, setOrder] = useLocalStorage('dashboard_widgetOrder', DEFAULT_ORDER)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  // heal saved order: drop unknown ids, append any new widgets
  const ids = order.filter((id) => WIDGETS[id]).concat(DEFAULT_ORDER.filter((id) => !order.includes(id)))

  const move = (id, dir) => {
    const i = ids.indexOf(id)
    const j = i + dir
    if (j < 0 || j >= ids.length) return
    const next = [...ids]
    ;[next[i], next[j]] = [next[j], next[i]]
    setOrder(next)
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans transition-colors">
      <header className="max-w-grid mx-auto flex items-center justify-between gap-3 px-4 pt-5 pb-3">
        <h1 className="font-display font-bold text-xl sm:text-2xl">Ethan's Dashboard</h1>
        <div className="flex items-center gap-2 sm:gap-3">
          <Clock />
          <GhostBtn onClick={() => setEditing(!editing)} className="min-h-[44px]">
            {editing ? 'Done' : 'Edit layout'}
          </GhostBtn>
          <button
            onClick={() => setDark(!dark)}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className={`min-w-[44px] min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-600 text-lg hover:bg-slate-200/60 dark:hover:bg-slate-700/60 ${focusRing}`}
          >
            {dark ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <main className="max-w-grid mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 px-4 pb-10">
        {ids.map((id) => {
          const w = WIDGETS[id]
          const W = w.el
          return (
            <div key={id} className={`relative min-w-0 ${w.span ? 'sm:col-span-2 lg:col-span-2' : ''}`}>
              {editing && (
                <div className="absolute -top-2 right-2 z-10 flex gap-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow px-1">
                  <button aria-label={`Move ${w.name} earlier`} onClick={() => move(id, -1)} className={`min-w-[44px] min-h-[44px] ${focusRing}`}>↑</button>
                  <button aria-label={`Move ${w.name} later`} onClick={() => move(id, 1)} className={`min-w-[44px] min-h-[44px] ${focusRing}`}>↓</button>
                </div>
              )}
              <ErrorBoundary name={w.name}>
                <W />
              </ErrorBoundary>
            </div>
          )
        })}
      </main>
    </div>
  )
}
