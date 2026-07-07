import React, { useState } from 'react'
import useFetchData from '../hooks/useFetchData.js'
import { PROXY } from '../config.js'
import { Card, Skeleton, ErrorState, Chip, Empty, focusRing } from './ui.jsx'

const FEED = 'https://feeds.bbci.co.uk/news/business/rss.xml'
const FILTERS = {
  All: null,
  'EY / Big Four': ['ey', 'ernst young', 'ernst & young', 'deloitte', 'pwc', 'kpmg', 'big four', 'audit'],
  'UK Banking': ['bank', 'banking', 'hsbc', 'barclays', 'lloyds', 'natwest', 'nationwide', 'mortgage', 'lending'],
  Fintech: ['fintech', 'digital banking', 'neobank', 'payments', 'revolut', 'monzo', 'starling', 'klarna'],
  Consulting: ['consulting', 'advisory', 'management consulting', 'strategy']
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
  const { data, loading, error, refresh } = useFetchData(PROXY(FEED), 30 * 60 * 1000, { transform: parseRss })
  const [filter, setFilter] = useState('All')
  const [open, setOpen] = useState(null)

  const keywords = FILTERS[filter]
  const items = (data ?? [])
    .filter((it) => !keywords || keywords.some((k) => (it.title + ' ' + it.desc).toLowerCase().includes(k)))
    .slice(0, 5)

  return (
    <Card icon="📰" title="FS News">
      <div className="scroller flex gap-1.5" role="tablist" aria-label="News filters">
        {Object.keys(FILTERS).map((f) => (
          <Chip key={f} active={filter === f} onClick={() => { setFilter(f); setOpen(null) }}>{f}</Chip>
        ))}
      </div>
      {loading && <div className="flex flex-col gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>}
      {!loading && error && <ErrorState message={error} onRetry={refresh} />}
      {!loading && !error && items.length === 0 && <Empty>No matching headlines right now</Empty>}
      {!loading && !error && items.length > 0 && (
        <ul className="flex flex-col divide-y divide-slate-300 dark:divide-slate-700">
          {items.map((it, i) => (
            <li key={it.link + i}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                className={`w-full text-left py-2 min-h-[44px] ${focusRing}`}
              >
                <span className="text-sm leading-snug">{it.title}</span>
                <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  BBC Business · {it.date ? new Date(it.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                </span>
              </button>
              {open === i && (
                <div className="pb-2 text-sm text-slate-600 dark:text-slate-300">
                  {it.desc && <p className="mb-1">{it.desc}</p>}
                  <a href={it.link} target="_blank" rel="noreferrer" className={`text-blue-500 hover:underline ${focusRing}`}>
                    Read more →
                  </a>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
