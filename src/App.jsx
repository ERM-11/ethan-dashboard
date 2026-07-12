import React, { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { ChevronUp, ChevronDown, Moon, Eclipse, Download, Upload, TriangleAlert, GraduationCap, Languages } from 'lucide-react'
import useLocalStorage from './hooks/useLocalStorage.js'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import BriefingStrip from './components/BriefingStrip.jsx'
import { focusRing, press, GhostBtn, SecondaryBtn, PrimaryBtn, Card, Skeleton } from './components/ui.jsx'
import { collectBackup, backupFilename, validateBackup, applyBackup } from './lib/backup.js'
import WeatherWidget from './components/WeatherWidget.jsx'
import PollenWidget from './components/PollenWidget.jsx'
import SunsetWidget from './components/SunsetWidget.jsx'
import NewsWidget from './components/NewsWidget.jsx'
import StockWidget from './components/StockWidget.jsx'
import WordWidget from './components/WordWidget.jsx'
import EyWidget from './components/EyWidget.jsx'
import StudyActivityWidget from './components/StudyActivityWidget.jsx'
import ReadinessWidget from './components/ReadinessWidget.jsx'

// The two heaviest widgets (each carries a large exercise/question JSON bank)
// load in their own chunks; content-shaped Suspense fallbacks below.
const CimaWidget = lazy(() => import('./components/CimaWidget.jsx'))
const GermanWidget = lazy(() => import('./components/GermanWidget.jsx'))

// skeletons mirror the real card layout (h-11 rows = 44px controls)
function CimaFallback() {
  return (
    <Card icon={GraduationCap} title="CIMA Study Tracker">
      <div className="flex gap-1">{[0,1,2,3].map(i => <Skeleton key={i} className="h-11 flex-1" />)}</div>
      <div className="grid grid-cols-2 gap-2">{[0,1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>
      <Skeleton className="h-2 w-full" />
      <Skeleton className="h-48 rounded-xl" />
      <div className="flex flex-wrap gap-2">{[0,1,2].map(i => <Skeleton key={i} className="h-11 w-28" />)}</div>
    </Card>
  )
}
function GermanFallback() {
  return (
    <Card icon={Languages} title="German Practice">
      <Skeleton className="h-3 w-32" />
      {[0,1,2].map(i => (
        <div key={i} className="flex flex-col gap-1">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
      <div className="flex gap-2"><Skeleton className="h-11 w-24" /><Skeleton className="h-11 w-40" /></div>
    </Card>
  )
}

const WIDGETS = {
  readiness: { name: "Today's Focus", el: ReadinessWidget, span: false },
  weather: { name: 'Weather', el: WeatherWidget, span: false },
  pollen: { name: 'Pollen', el: PollenWidget, span: false },
  sunset: { name: 'Sunset', el: SunsetWidget, span: false },
  stocks: { name: 'Stocks', el: StockWidget, span: false },
  news: { name: 'News', el: NewsWidget, span: false },
  word: { name: 'Word of the Day', el: WordWidget, span: false },
  cima: { name: 'CIMA Study', el: CimaWidget, span: true, fallback: CimaFallback },
  german: { name: 'German Practice', el: GermanWidget, span: false, fallback: GermanFallback },
  ey: { name: 'EY Tracker', el: EyWidget, span: false },
  study: { name: 'Study Activity', el: StudyActivityWidget, span: false }
}
const DEFAULT_ORDER = ['readiness', 'weather', 'pollen', 'sunset', 'stocks', 'news', 'word', 'cima', 'german', 'ey', 'study']

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
  const [pendingImport, setPendingImport] = useState(null)
  const [importError, setImportError] = useState(null)
  const fileRef = useRef(null)

  const toggleEditing = () => {
    setEditing(!editing)
    setPendingImport(null)
    setImportError(null)
  }

  // download every dashboard_ key as a dated JSON backup
  const exportData = () => {
    const backup = collectBackup(window.localStorage)
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = backupFilename(backup)
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const onImportFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    setImportError(null)
    setPendingImport(null)
    if (!file) return
    let text
    try {
      text = await file.text()
    } catch {
      setImportError("couldn't read the file")
      return
    }
    const result = validateBackup(text)
    if (!result.ok) {
      setImportError(result.error)
      return
    }
    setPendingImport(result)
  }

  const confirmImport = () => {
    try {
      applyBackup(window.localStorage, pendingImport.data)
      window.location.reload() // every widget re-reads its keys
    } catch {
      setPendingImport(null)
      setImportError('import failed — nothing was changed')
    }
  }

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
          <GhostBtn onClick={toggleEditing}>{editing ? 'Done' : 'Edit layout'}</GhostBtn>
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

      {editing && (
        <div className="max-w-grid mx-auto px-4 pb-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <SecondaryBtn onClick={exportData}>
              <span className="inline-flex items-center gap-1.5">
                <Download size={16} aria-hidden="true" /> Export data
              </span>
            </SecondaryBtn>
            <SecondaryBtn onClick={() => fileRef.current?.click()}>
              <span className="inline-flex items-center gap-1.5">
                <Upload size={16} aria-hidden="true" /> Import data
              </span>
            </SecondaryBtn>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
              onChange={onImportFile}
            />
          </div>
          {importError && (
            <p className="text-xs text-amber-400 flex items-center gap-1.5" role="alert">
              <TriangleAlert size={14} aria-hidden="true" /> Import failed: {importError}
            </p>
          )}
          {pendingImport && (
            <div className="bg-card2 rounded-xl border border-line p-3 flex flex-col gap-2 max-w-md">
              <p className="text-sm">
                Import <span className="num font-semibold">{pendingImport.keys.length}</span>{' '}
                {pendingImport.keys.length === 1 ? 'key' : 'keys'}
                {pendingImport.exportedAt && (
                  <>
                    {' '}from backup dated <span className="num font-semibold">{pendingImport.exportedAt}</span>
                  </>
                )}
                ? This replaces the matching dashboard data and reloads the page.
              </p>
              <div className="flex items-center gap-2">
                <PrimaryBtn onClick={confirmImport}>Import</PrimaryBtn>
                <GhostBtn onClick={() => setPendingImport(null)}>Cancel</GhostBtn>
              </div>
            </div>
          )}
        </div>
      )}

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
                <Suspense fallback={w.fallback ? <w.fallback /> : null}>
                  <W />
                </Suspense>
              </ErrorBoundary>
            </div>
          )
        })}
      </main>
    </div>
  )
}
