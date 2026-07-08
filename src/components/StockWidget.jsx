import React, { useState, useCallback } from 'react'
import useLocalStorage from '../hooks/useLocalStorage.js'
import { fetchViaProxy } from '../config.js'
import { Card, Skeleton, ErrorState, Empty, focusRing, GhostBtn } from './ui.jsx'
import { useEffect, useRef } from 'react'

const DEFAULTS = ['NVDA', 'GOOGL', 'AMZN', 'AVGO', 'AMD', 'SOFI', 'PLTR', 'NVO']
const RANGES = { '1D': ['1d', '5m'], '5D': ['5d', '15m'], '1M': ['1mo', '1d'], '3M': ['3mo', '1d'], '6M': ['6mo', '1d'], '1Y': ['1y', '1wk'] }

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

function Spark({ closes, prev, up }) {
  if (!closes || closes.length < 2) return null
  const min = Math.min(...closes, prev), max = Math.max(...closes, prev)
  const pad = (max - min) * 0.1 || 1
  const y = (v) => 22 - ((v - (min - pad)) / (max - min + 2 * pad)) * 20
  const pts = closes.map((c, i) => `${(i / (closes.length - 1)) * 80},${y(c).toFixed(1)}`).join(' ')
  return (
    <svg viewBox="0 0 80 24" className="w-16 h-6 shrink-0" preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" x2="80" y1={y(prev)} y2={y(prev)} strokeDasharray="2 2" strokeWidth="0.75" className="stroke-slate-400 dark:stroke-slate-600" />
      <polyline points={pts} fill="none" strokeWidth="1.5" className={up ? 'stroke-emerald-400' : 'stroke-rose-400'} />
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
  const fmt = (t) => {
    const dt = new Date(t * 1000)
    return range === '1D' || range === '5D'
      ? dt.toLocaleString('en-GB', { weekday: range === '5D' ? 'short' : undefined, hour: '2-digit', minute: '2-digit' })
      : dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="pt-2 pb-1">
      <div className="flex gap-1 mb-2">
        {Object.keys(RANGES).map((rg) => (
          <button key={rg} onClick={() => setRange(rg)}
            className={`px-2 py-1.5 min-h-[36px] rounded text-[11px] font-mono ${focusRing} ${range === rg ? 'bg-blue-500 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'}`}>
            {rg}
          </button>
        ))}
      </div>
      {state.loading && <Skeleton className="h-32" />}
      {state.error && <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">Couldn't load {range} data ({state.error})</p>}
      {d && !state.loading && (
        <>
          <svg viewBox="0 0 400 160" width="100%" role="img" aria-label={`${ticker} price chart, ${range}`}>
            {[0, 1, 2, 3].map((g) => (
              <g key={g}>
                <line x1="0" x2="400" y1={20 + g * 40} y2={20 + g * 40} strokeWidth="1" className="stroke-slate-300 dark:stroke-slate-700" />
                <text x="398" y={17 + g * 40} textAnchor="end" className="fill-slate-500 dark:fill-slate-400" style={{ font: '500 9px "JetBrains Mono", monospace' }}>
                  {(d.high - (g / 3) * (d.high - d.low)).toFixed(2)}
                </text>
              </g>
            ))}
            <polyline
              fill="none" strokeWidth="1.75" className={up ? 'stroke-emerald-400' : 'stroke-rose-400'}
              points={d.pts.map((p, i) => {
                const x = (i / (d.pts.length - 1)) * 400
                const y = 140 - ((p.c - d.low) / (d.high - d.low || 1)) * 120
                return `${x.toFixed(1)},${y.toFixed(1)}`
              }).join(' ')}
            />
          </svg>
          <div className="flex justify-between font-mono text-[10px] text-slate-500 dark:text-slate-400">
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

  const add = () => {
    const t = input.trim().toUpperCase()
    if (t && !tickers.includes(t)) setTickers([...tickers, t])
    setInput('')
  }
  const remove = (t) => setTickers(tickers.filter((x) => x !== t))

  const sorted = [...tickers].sort((a, b) =>
    sortAZ ? a.localeCompare(b) : (quotes[b]?.pct ?? -999) - (quotes[a]?.pct ?? -999)
  )

  return (
    <Card icon="📈" title="Stocks" right={
      <GhostBtn onClick={() => setSortAZ(!sortAZ)}>{sortAZ ? 'A–Z' : '% ▼'}</GhostBtn>
    }>
      {loading && <div className="flex flex-col gap-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-7" />)}</div>}
      {!loading && failed && <ErrorState message="Yahoo/proxy unavailable" onRetry={() => load(tickers)} />}
      {!loading && !failed && tickers.length === 0 && <Empty>Add a ticker to get started</Empty>}
      {!loading && !failed && tickers.length > 0 && (
        <ul className="flex flex-col divide-y divide-slate-300 dark:divide-slate-700">
          {sorted.map((t) => {
            const q = quotes[t]
            const up = q ? q.change >= 0 : true
            const isOpen = expanded === t
            return (
              <li key={t}>
                <div className="flex items-center gap-2">
                  <button onClick={() => setExpanded(isOpen ? null : t)} aria-expanded={isOpen}
                    className={`flex flex-1 items-center gap-2 py-1.5 min-h-[44px] text-left ${focusRing}`}>
                    <span className="font-mono font-bold text-sm w-14">{t}</span>
                    {q ? (
                      <>
                        <Spark closes={q.closes} prev={q.prev} up={up} />
                        <span className="font-mono text-sm tabular-nums ml-auto">${q.price?.toFixed(2)}</span>
                        <span className={`font-mono text-xs tabular-nums w-24 text-right ${up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {up ? '▲ +' : '▼ −'}{Math.abs(q.pct).toFixed(2)}%
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-slate-400 ml-auto">no data</span>
                    )}
                    <span aria-hidden="true" className={`text-slate-500 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}>▸</span>
                  </button>
                  <button onClick={() => remove(t)} aria-label={`Remove ${t}`}
                    className={`min-w-[32px] min-h-[44px] text-slate-500 hover:text-rose-400 ${focusRing}`}>✕</button>
                </div>
                {isOpen && <DetailChart ticker={t} />}
              </li>
            )
          })}
        </ul>
      )}
      <form onSubmit={(e) => { e.preventDefault(); add() }} className="flex gap-2">
        <input
          value={input} onChange={(e) => setInput(e.target.value)} placeholder="Add ticker…" aria-label="Add ticker"
          className={`flex-1 min-w-0 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-2 text-sm font-mono uppercase ${focusRing}`}
        />
        <button type="submit" className={`bg-blue-500 hover:bg-blue-400 text-white rounded-lg px-3 py-2 text-sm font-medium ${focusRing}`}>Add</button>
      </form>
    </Card>
  )
}
