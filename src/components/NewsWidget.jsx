import React, { useState } from 'react'
import { Newspaper } from 'lucide-react'
import useFetchData from '../hooks/useFetchData.js'
import { fetchViaProxy, todayISO } from '../config.js'
import { Card, Skeleton, ErrorState, Chip, Empty, focusRing } from './ui.jsx'

const FEED = 'https://feeds.bbci.co.uk/news/business/rss.xml'
const FILTERS = {
  All: null,
  'EY / Big Four': ['ey', 'ernst young', 'ernst & young', 'deloitte', 'pwc', 'kpmg', 'big four', 'audit'],
  'UK Banking': ['bank', 'banking', 'hsbc', 'barclays', 'lloyds', 'natwest', 'nationwide', 'mortgage', 'lending'],
  Fintech: ['fintech', 'digital banking', 'neobank', 'payments', 'revolut', 'monzo', 'starling', 'klarna'],
  Consulting: ['consulting', 'advisory', 'management consulting', 'strategy']
}

// relative label for a headline's pubDate, compared against local "today" —
// {text} for "today"/"yesterday" (no digits, plain text-mut), {num: true} for
// the short-date fallback so its digits render in .num.
function relativeDate(pubDate) {
  if (!pubDate) return null
  const d = new Date(pubDate) // pubDate is a full RSS timestamp — safe to parse directly
  if (Number.isNaN(d.getTime())) return null
  const itemISO = todayISO(d)
  if (itemISO === todayISO()) return { text: 'today', num: false }
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (itemISO === todayISO(yesterday)) return { text: 'yesterday', num: false }
  return { text: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), num: true }
}

async function parseRss(res) {
  const text = await res.text()
  const doc = new DOMParser().parseFromString(text, 'text/xml')
  if (doc.querySelector('parsererror')) throw new Error('feed returned non-XML')
  return [...doc.querySelectorAll('item')].slice(0, 30).map((it) => ({
    title: it.querySelector('title')?.textContent ?? '',
    link: it.querySelector('link')?.textContent ?? '#',
    desc: it.querySelector('description')?.textContent ?? '',
    date: it.querySelector('pubDate')?.textContent ?? ''
  }))
}

export default function NewsWidget() {
  const { data, loading, error, refresh } = useFetchData(FEED, 30 * 60 * 1000, { transform: parseRss, fetcher: fetchViaProxy })
  const [filter, setFilter] = useState('All')
  const [open, setOpen] = useState(null)

  const keywords = FILTERS[filter]
  const items = (data ?? [])
    .filter((it) => !keywords || keywords.some((k) => (it.title + ' ' + it.desc).toLowerCase().includes(k)))
    .slice(0, 5)

  return (
    <Card icon={Newspaper} title="FS News">
      <div className="scroller flex gap-1.5" role="tablist" aria-label="News filters">
        {Object.keys(FILTERS).map((f) => (
          <Chip key={f} active={filter === f} onClick={() => { setFilter(f); setOpen(null) }}>{f}</Chip>
        ))}
      </div>
      {loading && (
        // skeleton mirrors headline + meta rows
        <div className="flex flex-col gap-3 py-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className={`h-4 ${i % 2 ? 'w-5/6' : 'w-full'}`} />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      )}
      {!loading && error && <ErrorState message={error} onRetry={refresh} />}
      {!loading && !error && items.length === 0 && <Empty>No matching headlines right now</Empty>}
      {!loading && !error && items.length > 0 && (
        <ul className="flex flex-col divide-y divide-line">
          {items.map((it, i) => {
            const rel = relativeDate(it.date)
            return (
              <li key={it.link + i}>
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  aria-expanded={open === i}
                  className={`w-full text-left py-1.5 min-h-[44px] press ${focusRing}`}
                >
                  <span className="text-sm leading-snug">{it.title}</span>
                  <span className="block text-xs text-mut mt-0.5">
                    BBC Business{rel && (
                      <> · {rel.num ? <span className="num">{rel.text}</span> : rel.text}</>
                    )}
                  </span>
                </button>
                {open === i && (
                  <div className="pb-1.5 text-sm text-mut">
                    {it.desc && <p className="mb-1">{it.desc}</p>}
                    <a href={it.link} target="_blank" rel="noreferrer" className={`text-ink underline underline-offset-2 hover:text-mut ${focusRing}`}>
                      Read more →
                    </a>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
