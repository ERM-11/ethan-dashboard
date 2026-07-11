import React, { useEffect, useState } from 'react'
import { ChevronUp, ChevronDown, Moon, Eclipse } from 'lucide-react'
import useLocalStorage from './hooks/useLocalStorage.js'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import BriefingStrip from './components/BriefingStrip.jsx'
import { focusRing, press, GhostBtn } from './components/ui.jsx'
import WeatherWidget from './components/WeatherWidget.jsx'
import PollenWidget from './components/PollenWidget.jsx'
import SunsetWidget from './components/SunsetWidget.jsx'
import NewsWidget from './components/NewsWidget.jsx'
import StockWidget from './components/StockWidget.jsx'
import WordWidget from './components/WordWidget.jsx'
import GermanWidget from './components/GermanWidget.jsx'
import CimaWidget from './components/CimaWidget.jsx'
import EyWidget from './components/EyWidget.jsx'
import StudyActivityWidget from './components/StudyActivityWidget.jsx'

const WIDGETS = {
  weather: { name: 'Weather', el: WeatherWidget, span: false },
  pollen: { name: 'Pollen', el: PollenWidget, span: false },
  sunset: { name: 'Sunset', el: SunsetWidget, span: false },
  stocks: { name: 'Stocks', el: StockWidget, span: false },
  news: { name: 'News', el: NewsWidget, span: false },
  word: { name: 'Word of the Day', el: WordWidget, span: false },
  cima: { name: 'CIMA Study', el: CimaWidget, span: true },
  german: { name: 'German Practice', el: GermanWidget, span: false },
  ey: { name: 'EY Tracker', el: EyWidget, span: false },
  study: { name: 'Study Activity', el: StudyActivityWidget, span: false }
}
const DEFAULT_ORDER = ['weather', 'pollen', 'sunset', 'stocks', 'news', 'word', 'cima', 'german', 'ey', 'study']

const THEME_COLOR = { slate: '#0f172a', amoled: '#000000' }

function Clock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="num text-xs text-mut">
      {now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}{' '}
      {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
    </span>
  )
}

export default function App() {
  const [theme, setTheme] = useLocalStorage('dashboard_theme', 'slate')
  const [order, setOrder] = useLocalStorage('dashboard_widgetOrder', DEFAULT_ORDER)
  const [editing, setEditing] = useState(false)

  // apply theme to <html> and keep the PWA chrome colour in sync
  useEffect(() => {
    const t = theme === 'amoled' ? 'amoled' : 'slate'
    document.documentElement.dataset.theme = t
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[t])
  }, [theme])

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

  const amoled = theme === 'amoled'
  return (
    <div className="min-h-screen bg-bg text-ink font-sans transition-colors">
      <header className="max-w-grid mx-auto flex items-center justify-between gap-3 px-4 pt-5 pb-3">
        <h1 className="font-display font-bold text-xl">Ethan's Dashboard</h1>
        <div className="flex items-center gap-2 sm:gap-3">
          <Clock />
          <GhostBtn onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'Edit layout'}</GhostBtn>
          <button
            onClick={() => setTheme(amoled ? 'slate' : 'amoled')}
            aria-label={amoled ? 'Switch to slate theme' : 'Switch to pure-black theme'}
            title={amoled ? 'Slate theme' : 'Pure-black theme'}
            className={`min-w-[44px] min-h-[44px] rounded-lg border border-line2 text-mut hover:text-ink hover:bg-veil inline-flex items-center justify-center ${press} ${focusRing}`}
          >
            {amoled ? <Moon size={18} aria-hidden="true" /> : <Eclipse size={18} aria-hidden="true" />}
          </button>
        </div>
      </header>

      {/* 1px gradient hairline accent under the header */}
      <div className="max-w-grid mx-auto px-4 pb-3" aria-hidden="true">
        <div className="h-px bg-gradient-to-r from-transparent via-line2 to-transparent" />
      </div>

      <ErrorBoundary name="Briefing">
        <div className="card-enter" style={{ '--enter-i': 0 }}>
          <BriefingStrip />
        </div>
      </ErrorBoundary>

      <main className="max-w-grid mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 px-4 pb-10">
        {ids.map((id, i) => {
          const w = WIDGETS[id]
          const W = w.el
          return (
            <div
              key={id}
              id={`widget-${id}`}
              style={{ '--enter-i': i + 1 }}
              className={`relative min-w-0 scroll-mt-4 card-enter ${w.span ? 'sm:col-span-2 lg:col-span-2' : ''}`}
            >
              {editing && (
                <div className="absolute -top-2 right-2 z-10 flex gap-1 bg-card2 border border-line2 rounded-lg px-1">
                  <button aria-label={`Move ${w.name} earlier`} onClick={() => move(id, -1)}
                    className={`min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-mut hover:text-ink ${press} ${focusRing}`}>
                    <ChevronUp size={18} aria-hidden="true" />
                  </button>
                  <button aria-label={`Move ${w.name} later`} onClick={() => move(id, 1)}
                    className={`min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-mut hover:text-ink ${press} ${focusRing}`}>
                    <ChevronDown size={18} aria-hidden="true" />
                  </button>
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
