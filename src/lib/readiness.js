// Pure readiness scoring for the Today's Focus widget — no React/JSX so it
// can be exercised in node. Reads the study data other widgets already store;
// owns no localStorage keys and is strictly READ-ONLY (never setItem/removeItem).
import { todayISO, parseISO } from '../config.js'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const isIso = (v) => typeof v === 'string' && ISO_RE.test(v)
const isMap = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

// Sanitised snapshot of the study-track keys. `storage` is anything with
// getItem() — window.localStorage in the app, a stub map in tests. Every key
// is parsed defensively (bad JSON or wrong shape falls back), and individual
// entries are dropped rather than trusted when malformed.
export function readTrackInputs(storage) {
  const read = (key, fallback) => {
    try {
      const raw = storage.getItem(key)
      return raw === null ? fallback : JSON.parse(raw)
    } catch {
      return fallback
    }
  }

  // dashboard_cima_attempts — {qid: {attempts, correct, lastAttempted}}
  const cimaAttempts = {}
  const rawAttempts = read('dashboard_cima_attempts', {})
  if (isMap(rawAttempts)) {
    for (const [qid, v] of Object.entries(rawAttempts)) {
      if (!isMap(v) || !Number.isFinite(v.attempts) || v.attempts <= 0) continue
      cimaAttempts[qid] = {
        attempts: v.attempts,
        correct: clamp(Number.isFinite(v.correct) ? v.correct : 0, 0, v.attempts),
        lastAttempted: isIso(v.lastAttempted) ? v.lastAttempted : null
      }
    }
  }

  // dashboard_cima_reviewQueue — [{questionId, lastAttempted, interval}]
  const cimaReviewQueue = []
  const rawQueue = read('dashboard_cima_reviewQueue', [])
  if (Array.isArray(rawQueue)) {
    for (const e of rawQueue) {
      if (!isMap(e)) continue
      if (typeof e.questionId !== 'string') continue
      if (!Number.isFinite(e.interval) || e.interval < 1) continue
      if (!isIso(e.lastAttempted)) continue
      cimaReviewQueue.push({ questionId: e.questionId, lastAttempted: e.lastAttempted, interval: e.interval })
    }
  }

  // dashboard_germanStats — {done, correct}
  const rawStats = read('dashboard_germanStats', {})
  const germanStats = {
    done: isMap(rawStats) && Number.isFinite(rawStats.done) ? rawStats.done : 0,
    correct: isMap(rawStats) && Number.isFinite(rawStats.correct) ? rawStats.correct : 0
  }

  // dashboard_germanDates — iso[]
  const rawDates = read('dashboard_germanDates', [])
  const germanDates = Array.isArray(rawDates) ? rawDates.filter(isIso) : []

  // dashboard_germanStreak — {current, lastDate}
  const rawStreak = read('dashboard_germanStreak', {})
  const germanStreak = {
    current: isMap(rawStreak) && Number.isFinite(rawStreak.current) ? rawStreak.current : 0,
    lastDate: isMap(rawStreak) && isIso(rawStreak.lastDate) ? rawStreak.lastDate : null
  }

  // dashboard_germanMistakes — stored as an array; only the count matters here
  const rawMistakes = read('dashboard_germanMistakes', [])
  const germanMistakes = Array.isArray(rawMistakes) ? rawMistakes.length : 0

  // dashboard_ey_milestoneStatus — {id: {completed}}
  const eyStatus = {}
  const rawEy = read('dashboard_ey_milestoneStatus', {})
  if (isMap(rawEy)) {
    for (const [id, v] of Object.entries(rawEy)) eyStatus[id] = { completed: !!v?.completed }
  }

  return { cimaAttempts, cimaReviewQueue, germanStats, germanDates, germanStreak, germanMistakes, eyStatus }
}

// 0..1 staleness factor from days since last activity — saturating exponential.
// null (no activity ever recorded) saturates to 1.
export function recency(days) {
  return days == null ? 1 : 1 - Math.exp(-days / 4)
}

/**
 * Readiness score, 0-100 per study track — higher = more urgent today.
 * Deterministic: same inputs + same `today` always give the same output.
 *
 *   CIMA modules (BA1-BA4) and German — three bounded terms, max 100:
 *     +45  accuracy pressure — linear distance below the 80% goal:
 *          45 * clamp((80 - acc%) / 40, 0, 1); 80%+ -> 0, <=40% -> full 45
 *          (80% is the EY "confident" bar in ey-milestones.json)
 *     +35  recency decay — 35 * (1 - e^(-days/4)) since last activity:
 *          today 0 · yesterday ~8 · 4 days ~22 · 2 weeks ~34 (saturates)
 *     +20  backlog — 2 pts per item, cap 10: due spaced-repetition reviews
 *          (CIMA, due when daysSince(lastAttempted) >= interval, mirroring
 *          CimaWidget) or logged mistakes (German)
 *   A never-started module in an otherwise-active CIMA takes the formula's
 *   limits (acc 0, days -> inf) -> a flat 80: a gap in an adopted track
 *   outranks a weak-but-active one.
 *
 *   EY milestones — two terms, max 100:
 *     +60  overdue pressure — 12 pts per overdue incomplete milestone
 *          (incomplete && deadline < today, EyWidget's rule), cap 5
 *     +40  deadline proximity — 40 * clamp((14 - d) / 14, 0, 1), d = days
 *          until the earliest incomplete deadline (<=0 -> 40, >=14 -> 0)
 *
 * Scores round to integers and clamp to [0, 100]. Ties break on a fixed
 * track rank (ey, BA1-BA4, german) so ordering is stable. All date maths
 * is local-time via config.js helpers; future dates clamp to "today".
 */
const MODULES = ['BA1', 'BA2', 'BA3', 'BA4']
const RANK = { ey: 0, BA1: 1, BA2: 2, BA3: 3, BA4: 4, german: 5 }

// days 0 -> "studied today" / 1 -> "last studied yesterday" / n -> "... n days ago"
function recencyText(days, verb) {
  if (days === 0) return `${verb} today`
  if (days === 1) return `last ${verb} yesterday`
  return `last ${verb} ${days} days ago`
}

// Two largest contributions (>= 1 pt each), rendered in the candidates' fixed
// order (accuracy -> recency -> backlog) joined ", ". text === null omits a
// clause regardless of points.
function pickClauses(candidates) {
  const eligible = candidates
    .map((c, i) => ({ ...c, i }))
    .filter((c) => c.text !== null && c.pts >= 1)
  eligible.sort((a, b) => b.pts - a.pts || a.i - b.i)
  return eligible
    .slice(0, 2)
    .sort((a, b) => a.i - b.i)
    .map((c) => c.text)
    .join(', ')
}

export function scoreTracks(inputs, { milestones = [], today = new Date() } = {}) {
  const todayIso = todayISO(today)
  const t0 = parseISO(todayIso)
  // whole local days since a stored ISO date; future dates clamp to "today"
  const daysSince = (iso) => Math.max(0, Math.round((t0 - parseISO(iso)) / 86400000))

  const rows = []

  // --- CIMA: one row per module once any module has attempts ---------------
  const cimaHasData = Object.keys(inputs.cimaAttempts).length > 0
  if (cimaHasData) {
    for (const mod of MODULES) {
      const qids = Object.keys(inputs.cimaAttempts).filter((q) => q.startsWith(mod))
      let sumAttempts = 0
      let sumCorrect = 0
      let last = null
      for (const q of qids) {
        const a = inputs.cimaAttempts[q]
        sumAttempts += a.attempts
        sumCorrect += a.correct
        if (a.lastAttempted && (last === null || a.lastAttempted > last)) last = a.lastAttempted
      }
      if (sumAttempts === 0) {
        // formula limits: accuracy 0 -> 45, days -> inf -> 35, backlog 0 = 80
        rows.push({ id: mod, track: `CIMA ${mod}`, target: 'cima', score: 80, warn: false, reason: 'Not started yet' })
        continue
      }
      const acc = sumCorrect / sumAttempts
      const accPts = 45 * clamp((80 - acc * 100) / 40, 0, 1)
      // attempts exist but no valid date: recency saturates (null -> 1), yet
      // the recency clause is omitted — "last studied N days ago" would be a lie
      const days = last === null ? null : daysSince(last)
      const recPts = 35 * recency(days)
      const due = inputs.cimaReviewQueue.filter(
        (e) => e.questionId.startsWith(mod) && daysSince(e.lastAttempted) >= e.interval
      ).length
      const backlogPts = 2 * Math.min(due, 10)
      const score = Math.round(clamp(accPts + recPts + backlogPts, 0, 100))
      const reason =
        score === 0
          ? 'On track'
          : pickClauses([
              { pts: accPts, text: `Accuracy ${Math.round(acc * 100)}%` },
              { pts: recPts, text: days === null ? null : recencyText(days, 'studied') },
              { pts: backlogPts, text: due === 1 ? '1 review due' : `${due} reviews due` }
            ]) || 'On track'
      rows.push({ id: mod, track: `CIMA ${mod}`, target: 'cima', score, warn: false, reason })
    }
  }

  // --- German ---------------------------------------------------------------
  const germanHasData =
    inputs.germanStats.done > 0 || inputs.germanDates.length > 0 || inputs.germanStreak.current > 0
  if (germanHasData) {
    const { done, correct } = inputs.germanStats
    // no answers yet -> unknown accuracy, not bad accuracy: no term, no clause
    let accPts = 0
    let accText = null
    if (done > 0) {
      const acc = correct / done
      accPts = 45 * clamp((80 - acc * 100) / 40, 0, 1)
      accText = `Accuracy ${Math.round(acc * 100)}%`
    }
    let last = null
    for (const d of inputs.germanDates) if (last === null || d > last) last = d
    if (inputs.germanStreak.lastDate && (last === null || inputs.germanStreak.lastDate > last)) {
      last = inputs.germanStreak.lastDate
    }
    const days = last === null ? null : daysSince(last)
    const recPts = 35 * recency(days)
    const mistakes = inputs.germanMistakes
    const backlogPts = 2 * Math.min(mistakes, 10)
    const score = Math.round(clamp(accPts + recPts + backlogPts, 0, 100))
    const reason =
      score === 0
        ? 'On track'
        : pickClauses([
            { pts: accPts, text: accText },
            { pts: recPts, text: days === null ? null : recencyText(days, 'practised') },
            { pts: backlogPts, text: mistakes === 1 ? '1 mistake to review' : `${mistakes} mistakes to review` }
          ]) || 'On track'
    rows.push({ id: 'german', track: 'German', target: 'german', score, warn: false, reason })
  }

  // --- EY milestones ----------------------------------------------------------
  const eyHasData = Object.keys(inputs.eyStatus).length > 0
  if (!cimaHasData && !germanHasData && !eyHasData) return []

  // once anything has data the EY row always shows — deadlines are objective facts
  const ms = Array.isArray(milestones) ? milestones : []
  const incomplete = ms.filter((m) => isMap(m) && isIso(m.deadline) && !inputs.eyStatus[m.id]?.completed)
  const overdue = incomplete.filter((m) => m.deadline < todayIso) // string compare — EyWidget's rule
  let earliest = null
  for (const m of incomplete) if (earliest === null || m.deadline < earliest.deadline) earliest = m

  const overduePts = 12 * Math.min(overdue.length, 5)
  let proxPts = 0
  let dUntil = null
  if (earliest) {
    // days UNTIL the deadline — may be negative (already overdue -> full 40)
    dUntil = Math.round((parseISO(earliest.deadline) - t0) / 86400000)
    proxPts = 40 * clamp((14 - dUntil) / 14, 0, 1)
  }
  const eyScore = Math.round(clamp(overduePts + proxPts, 0, 100))

  let eyReason
  if (overdue.length > 0) {
    const cats = [...new Set(overdue.map((m) => m.category))]
    const n = overdue.length
    if (cats.length === 1 && typeof cats[0] === 'string' && cats[0]) {
      eyReason = n === 1 ? `1 ${cats[0]} milestone overdue` : `${n} ${cats[0]} milestones overdue`
    } else {
      eyReason = `${n} milestones overdue`
    }
  } else if (earliest) {
    eyReason = `${earliest.title} due ${dUntil === 0 ? 'today' : dUntil === 1 ? 'tomorrow' : `in ${dUntil} days`}`
  } else {
    eyReason = 'All milestones complete'
  }
  rows.push({ id: 'ey', track: 'EY milestones', target: 'ey', score: eyScore, warn: overdue.length > 0, reason: eyReason })

  rows.sort((a, b) => b.score - a.score || RANK[a.id] - RANK[b.id])
  return rows
}
