// Pure helpers for the Study Activity heatmap — no React/JSX so they can be
// exercised in node. Reads existing study data only; owns no localStorage keys.
import { todayISO, mondayOf } from '../config.js'

// Combined per-day activity from the keys other widgets already maintain:
// dashboard_cima_dailyCompleted ({iso: {module: true}}), dashboard_germanDates
// (iso[]), dashboard_wordVoteDate (single iso — no history is stored for it).
export function readActivity(storage) {
  const read = (key, fallback) => {
    try {
      const raw = storage.getItem(key)
      return raw === null ? fallback : JSON.parse(raw)
    } catch {
      return fallback
    }
  }
  const byDay = {}
  const day = (iso) => {
    if (!byDay[iso]) byDay[iso] = { cima: 0, german: false, word: false }
    return byDay[iso]
  }

  const cimaDaily = read('dashboard_cima_dailyCompleted', {})
  if (cimaDaily && typeof cimaDaily === 'object' && !Array.isArray(cimaDaily)) {
    for (const [iso, modules] of Object.entries(cimaDaily)) {
      if (modules && typeof modules === 'object') {
        day(iso).cima = Object.values(modules).filter(Boolean).length
      }
    }
  }

  const germanDates = read('dashboard_germanDates', [])
  if (Array.isArray(germanDates)) {
    for (const iso of germanDates) {
      if (typeof iso === 'string') day(iso).german = true
    }
  }

  const voteDate = read('dashboard_wordVoteDate', null)
  if (typeof voteDate === 'string') day(voteDate).word = true

  return byDay
}

export function activityTotal(a) {
  return a ? a.cima + (a.german ? 1 : 0) + (a.word ? 1 : 0) : 0
}

// 0 = no activity; four intensity steps above it, capped
export function intensityLevel(total) {
  return Math.min(4, Math.max(0, total))
}
// opacity of the neutral ink token per level (index 0 unused — empty cells
// render on card2 instead so "nothing" reads as surface, not faint activity)
export const LEVEL_OPACITY = [0, 0.22, 0.45, 0.7, 1]

// 12 Mon-first week columns (GitHub-style: column = week, row = Mon..Sun),
// ending with the current week. Local-time date maths only.
export function buildGrid(today = new Date()) {
  const first = mondayOf(today)
  first.setDate(first.getDate() - 7 * 11)
  const todayIso = todayISO(today)
  return Array.from({ length: 12 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = new Date(first.getFullYear(), first.getMonth(), first.getDate() + w * 7 + d)
      const iso = todayISO(date)
      return { iso, future: iso > todayIso }
    })
  )
}
