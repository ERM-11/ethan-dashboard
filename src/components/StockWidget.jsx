import React, { useState, useCallback } from 'react'
import { TrendingUp, ChevronRight, X } from 'lucide-react'
import useLocalStorage from '../hooks/useLocalStorage.js'
import { fetchViaProxy } from '../config.js'
import { Card, Skeleton, ErrorState, Empty, focusRing, press, GhostBtn, inputCls } from './ui.jsx'
import { useEffect, useRef } from 'react'

const DEFAULTS = ['NVDA', 'GOOGL', 'AMZN', 'AVGO', 'AMD', 'SOFI', 'PLTR', 'NVO']
const RANGES = { '1D': ['1d', '5m'], '5D': ['5d', '15m'], '1M': ['1mo', '1d'], '3M': ['3mo', '1d'], '6M': ['6mo', '1d'], '1Y': ['1y', '1wk'] }

// semantic day-change colours (the only green/red on this widget)
const UP = '#34d399'
const DOWN = '#fb7185'

const yahooUrl = (t, range = '5d', interval = '1d') =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${t}?range=${range}&interval=${interval}`

async function fetchQuote(ticker) {
  const res = await fetchViaProxy(yahooUrl(ticker))
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const j = await res.json()
  const r = j?.chart?.result?.[0]
  if (!r) throw new Error('no data')
  const closes = (r.indicators?.quote?.[0]?.close ?? []).filter((c) => c != null)
  const price = r.meta?.regularMarketPrice ?? closes[closes.length - 1]
  const prev = r.meta?.chartPreviousClose ?? closes[closes.length - 2] ?? price
  return { ticker, price, change: price - prev, pct: prev ? ((price - prev) / prev) * 100 : 0, closes, prev }
}

// Validate a ticker before committing it to the list: fetch one quote and decide
// whether Yahoo actually knows the symbol. Returns a tagged result so the UI can
// tell "no such ticker" apart from "the network/proxy is unreachable".
async function validateTicker(ticker) {
  try {
    const quote = await fetchQuote(ticker)
    if (quote.price == null || Number.isNaN(quote.price)) return { ok: false, reason: 'invalid' }
    return { ok: true, quote }
  } catch (e) {
    const msg = e?.message || ''
    // Yahoo answers an unknown symbol with 404 / an empty result; anything else
    // (timeout, 5xx, offline) is a transport problem, not a bad ticker.
    if (/HTTP 4\d\d/.test(msg) || msg === 'no data') return { ok: false, reason: 'invalid' }
    return { ok: false, reason: 'network' }
  }
}

function Spinner() {
  return <span className="inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent opacity-70 animate-spin" aria-hidden="true" />
}

function Spark({ closes, prev, up, ticker }) {
  if (!closes || closes.length < 2) return null
  const min = Math.min(...closes, prev), max = Math.max(...closes, prev)
  const pad = (max - min) * 0.1 || 1
  const y = (v) => 22 - ((v - (min - pad)) / (max - min + 2 * pad)) * 20
  const pts = closes.map((c, i) => `${((i / (closes.length - 1)) * 80).toFixed(1)},${y(c).toFixed(1)}`)
  const gid = `spark-${ticker}`
  const color = up ? UP : DOWN
  return (
    <svg viewBox="0 0 80 24" className="w-16 h-6 shrink-0" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,24 ${pts.join(' ')} 80,24`} fill={`url(#${gid})`} />
      <line x1="0" x2="80" y1={y(prev)} y2={y(prev)} strokeDasharray="2 2" strokeWidth="0.75" className="stroke-line2" />
      <polyline points={pts.join(' ')} fill="none" strokeWidth="1.5" stroke={color} />
    </svg>
  )
}

function DetailChart({ ticker }) {
  const [range, setRange] = useState('1M')
  const [state, setState] = useState({ loading: true })
  const cache = useRef({})

  const load = useCallback(async (rg) => {
    if (cache.current[rg]) { setState({ loading: false, data: cache.current[rg] }); return }
    setState({ loading: true })
    try {
      const [r, iv] = RANGES[rg]
      const res = await fetchViaProxy(yahooUrl(ticker, r, iv))
      const j = await res.json()
      const result = j?.chart?.result?.[0]
      const ts = result?.timestamp ?? []
      const q = result?.indicators?.quote?.[0] ?? {}
      const pts = ts.map((t, i) => ({ t, c: q.close?.[i] })).filter((p) => p.c != null)
      if (!pts.length) throw new Error('no data')
      const data = { pts, high: Math.max(...pts.map((p) => p.c)), low: Math.min(...pts.map((p) => p.c)) }
      cache.current[rg] = data
      setState({ loading: false, data })
    } catch (e) {
      setState({ loading: false, error: e.message })
    }
  }, [ticker])

  useEffect(() => { load(range) }, [range, load])

  const d = state.data
  const up = d && d.pts[d.pts.length - 1].c >= d.pts[0].c
  const color = up ? UP : DOWN
  const gid = `chart-${ticker}`
  const fmt = (t) => {
    const dt = new Date(t * 1000)
    return range === '1D' || range === '5D'
      ? dt.toLocaleString('en-GB', { weekday: range === '5D' ? 'short' : undefined, hour: '2-digit', minute: '2-digit' })
      : dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }
  const linePts = d?.pts.map((p, i) => {
    const x = (i / (d.pts.length - 1)) * 400
    const y = 140 - ((p.c - d.low) / (d.high - d.low || 1)) * 120
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  return (
    <div className="pt-2 pb-1">
      <div className="flex gap-1 mb-2">
        {Object.keys(RANGES).map((rg) => (
          <button key={rg} onClick={() => setRange(rg)}
            className={`num px-2 py-1.5 min-h-[36px] rounded-lg text-xs ${press} ${focusRing} ${range === rg ? 'bg-ink text-bg font-bold' : 'text-mut hover:bg-veil'}`}>
            {rg}
          </button>
        ))}
      </div>
      {state.loading && (
        // skeleton mirrors the chart area + axis labels
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-32 rounded-xl" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
      )}
      {state.error && <p className="text-xs text-mut py-4 text-center">Couldn't load <span className="num">{range}</span> data ({state.error})</p>}
      {d && !state.loading && (
        <>
          <svg viewBox="0 0 400 160" width="100%" role="img" aria-label={`${ticker} price chart, ${range}`}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 1, 2, 3].map((g) => (
              <g key={g}>
                <line x1="0" x2="400" y1={20 + g * 40} y2={20 + g * 40} strokeWidth="1" className="stroke-line" />
                <text x="398" y={17 + g * 40} textAnchor="end" className="fill-mut" style={{ font: '500 9px "JetBrains Mono", monospace' }}>
                  {(d.high - (g / 3) * (d.high - d.low)).toFixed(2)}
                </text>
              </g>
            ))}
            <polygon points={`0,140 ${linePts.join(' ')} 400,140`} fill={`url(#${gid})`} />
            <polyline fill="none" strokeWidth="1.75" stroke={color} points={linePts.join(' ')} />
          </svg>
          <div className="num flex justify-between text-xs text-mut">
            <span>{fmt(d.pts[0].t)}</span>
            <span>{fmt(d.pts[d.pts.length - 1].t)}</span>
          </div>
        </>
      )}
    </div>
  )
}

export default function StockWidget() {
  const [tickers, setTickers] = useLocalStorage('dashboard_stockTickers', DEFAULTS)
  const [quotes, setQuotes] = useState({})
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [input, setInput] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [sortAZ, setSortAZ] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState(null)

  const load = useCallback(async (list) => {
    setLoading(true)
    setFailed(false)
    const results = await Promise.allSettled(list.map(fetchQuote))
    const q = {}
    results.forEach((r, i) => { if (r.status === 'fulfilled') q[list[i]] = r.value })
    setQuotes(q)
    setFailed(Object.keys(q).length === 0 && list.length > 0)
    setLoading(false)
  }, [])

  useEffect(() => {
    load(tickers)
    const id = setInterval(() => load(tickers), 15 * 60 * 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickers.join(',')])

  // Validate against Yahoo before committing to localStorage. Reads live `input`
  // state (no stale closure) and uses a functional setTickers update so a fresh
  // add can't clobber a concurrent one.
  const add = useCallback(async () => {
    const t = input.trim().toUpperCase()
    if (!t) return
    if (tickers.includes(t)) { setAddError(`${t} is already on the list`); return }
    setAdding(true)
    setAddError(null)
    const result = await validateTicker(t)
    if (result.ok) {
      setQuotes((q) => ({ ...q, [t]: result.quote }))
      setTickers((prev) => (prev.includes(t) ? prev : [...prev, t]))
      setInput('')
    } else {
      setAddError(result.reason === 'invalid'
        ? `"${t}" not found — check the symbol`
        : "Network error — couldn't reach Yahoo, try again")
    }
    setAdding(false)
  }, [input, tickers, setTickers])
  const remove = (t) => setTickers(tickers.filter((x) => x !== t))

  const sorted = [...tickers].sort((a, b) =>
    sortAZ ? a.localeCompare(b) : (quotes[b]?.pct ?? -999) - (quotes[a]?.pct ?? -999)
  )

  return (
    <Card icon={TrendingUp} title="Stocks" right={
      <GhostBtn onClick={() => setSortAZ(!sortAZ)}><span className="num text-xs">{sortAZ ? 'A–Z' : '% ▼'}</span></GhostBtn>
    }>
      {loading && (
        // skeleton mirrors ticker / sparkline / price / change rows
        <div className="flex flex-col gap-3 py-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-4 w-16 ml-auto" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      )}
      {!loading && failed && <ErrorState message="Yahoo/proxy unavailable" onRetry={() => load(tickers)} />}
      {!loading && !failed && tickers.length === 0 && <Empty>Add a ticker to get started</Empty>}
      {!loading && !failed && tickers.length > 0 && (
        <ul className="flex flex-col divide-y divide-line">
          {sorted.map((t) => {
            const q = quotes[t]
            const up = q ? q.change >= 0 : true
            const isOpen = expanded === t
            return (
              <li key={t}>
                <div className="flex items-center gap-2">
                  <button onClick={() => setExpanded(isOpen ? null : t)} aria-expanded={isOpen}
                    className={`flex flex-1 items-center gap-2 py-1.5 min-h-[44px] text-left ${press} ${focusRing}`}>
                    <span className="num font-bold text-sm w-14">{t}</span>
                    {q ? (
                      <>
                        <Spark closes={q.closes} prev={q.prev} up={up} ticker={t} />
                        <span className="num text-sm ml-auto">${q.price?.toFixed(2)}</span>
                        <span className={`num text-xs w-24 text-right ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {up ? '▲ +' : '▼ −'}{Math.abs(q.pct).toFixed(2)}%
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-mut ml-auto">no data</span>
                    )}
                    <ChevronRight size={16} aria-hidden="true" className={`text-mut shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`} />
                  </button>
                  <button onClick={() => remove(t)} aria-label={`Remove ${t}`}
                    className={`min-w-[32px] min-h-[44px] inline-flex items-center justify-center text-mut hover:text-rose-400 ${press} ${focusRing}`}>
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
                {isOpen && <DetailChart ticker={t} />}
              </li>
            )
          })}
        </ul>
      )}
      <form onSubmit={(e) => { e.preventDefault(); add() }} className="flex flex-col gap-1.5">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => { setInput(e.target.value); if (addError) setAddError(null) }}
            placeholder="Add ticker…" aria-label="Add ticker"
            autoCapitalize="characters" autoCorrect="off" autoComplete="off" spellCheck={false} enterKeyHint="done"
            disabled={adding}
            aria-invalid={addError ? true : undefined}
            aria-describedby={addError ? 'stock-add-error' : undefined}
            className={`num flex-1 min-w-0 uppercase disabled:opacity-50 ${inputCls(!!addError)}`}
          />
          <button
            type="submit" disabled={adding || !input.trim()}
            aria-label={adding ? 'Checking ticker' : undefined}
            className={`bg-ink text-bg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-3 py-2 min-h-[44px] min-w-[60px] text-sm font-semibold inline-flex items-center justify-center ${press} ${focusRing}`}
          >
            {adding ? <Spinner /> : 'Add'}
          </button>
        </div>
        {addError && (
          <p id="stock-add-error" role="alert" className="text-xs text-rose-400 px-1">
            {addError}
          </p>
        )}
      </form>
    </Card>
  )
}
