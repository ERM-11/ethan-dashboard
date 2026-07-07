import React, { useMemo, useState } from 'react'
import useLocalStorage from '../hooks/useLocalStorage.js'
import { todayISO, dayOfYear } from '../config.js'
import { Card, ProgressBar, Accordion, PrimaryBtn, SecondaryBtn, GhostBtn, focusRing } from './ui.jsx'
import bank from '../data/cima-questions.json'

const MODULES = ['BA1', 'BA2', 'BA3', 'BA4']
const MODULE_COLOR = { BA1: 'bg-blue-500', BA2: 'bg-emerald-500', BA3: 'bg-violet-500', BA4: 'bg-amber-500' }
const MODULE_TEXT = { BA1: 'text-blue-500', BA2: 'text-emerald-500', BA3: 'text-violet-500', BA4: 'text-amber-500' }
const DIFF = { easy: ['bg-emerald-400', 'Easy'], medium: ['bg-amber-400', 'Medium'], hard: ['bg-rose-400', 'Hard'] }
const byId = {}
MODULES.forEach((m) => bank[m].forEach((q) => { byId[q.id] = q }))

export default function CimaWidget() {
  const [module_, setModule] = useLocalStorage('dashboard_cima_activeModule', 'BA1')
  const [attempts, setAttempts] = useLocalStorage('dashboard_cima_attempts', {})
  const [queue, setQueue] = useLocalStorage('dashboard_cima_reviewQueue', [])
  const [streak, setStreak] = useLocalStorage('dashboard_cima_streak', { current: 0, best: 0, lastStudyDate: '' })
  const [history, setHistory] = useLocalStorage('dashboard_cima_history', [])
  const [daily, setDaily] = useLocalStorage('dashboard_cima_dailyCompleted', {})

  const questions = bank[module_]
  const today = todayISO()

  // deterministic daily: pool = unattempted (fallback lowest-accuracy topic), sorted by id, dayOfYear % length
  const dailyQuestion = useMemo(() => {
    const un = questions.filter((q) => !attempts[q.id]).sort((a, b) => a.id.localeCompare(b.id))
    const pool = un.length ? un : [...questions].sort((a, b) => a.id.localeCompare(b.id))
    return pool[dayOfYear() % pool.length]
  }, [questions, attempts])
  const dailyDone = !!daily[today]?.[module_]

  const pick = (mode) => {
    if (mode === 'daily') return dailyQuestion
    if (mode === 'review') {
      const due = queue
        .filter((r) => byId[r.questionId] && byId[r.questionId].id.startsWith(module_))
        .filter((r) => (Date.now() - new Date(r.lastAttempted).getTime()) / 86400000 >= r.interval)
      const src = due.length ? due : queue.filter((r) => byId[r.questionId]?.id.startsWith(module_))
      return src.length ? byId[src[Math.floor(Math.random() * src.length)].questionId] : null
    }
    if (mode === 'weak') {
      const acc = {}
      questions.forEach((q) => {
        const a = attempts[q.id]
        if (!a) return
        acc[q.topic] = acc[q.topic] || { c: 0, n: 0 }
        acc[q.topic].c += a.correct; acc[q.topic].n += a.attempts
      })
      const topics = Object.entries(acc).filter(([, v]) => v.n > 0)
      if (!topics.length) return pick('practice')
      const weakest = topics.sort((a, b) => a[1].c / a[1].n - b[1].c / b[1].n)[0][0]
      const tq = questions.filter((q) => q.topic === weakest)
      return tq[Math.floor(Math.random() * tq.length)]
    }
    const un = questions.filter((q) => !attempts[q.id])
    const pool = un.length ? un : questions
    return pool[Math.floor(Math.random() * pool.length)]
  }

  const [mode, setMode] = useState('practice')
  const [current, setCurrent] = useState(() => pick('practice'))
  const [selected, setSelected] = useState(null)

  const start = (m) => { setMode(m); setSelected(null); setCurrent(pickFor(m)) }
  function pickFor(m) { return pick(m) }
  const switchModule = (m) => {
    setModule(m); setSelected(null); setMode('practice')
    const qs = bank[m]
    const un = qs.filter((q) => !attempts[q.id])
    setCurrent((un.length ? un : qs)[Math.floor(Math.random() * (un.length ? un : qs).length)])
  }

  const answer = (letter) => {
    if (selected || !current) return
    setSelected(letter)
    const right = letter === current.correct
    const prev = attempts[current.id] ?? { attempts: 0, correct: 0 }
    setAttempts({ ...attempts, [current.id]: { attempts: prev.attempts + 1, correct: prev.correct + (right ? 1 : 0), lastAttempted: today } })
    setHistory([{ questionId: current.id, module: module_, topic: current.topic, correct: right, date: today }, ...history].slice(0, 50))
    // spaced repetition
    const entry = queue.find((r) => r.questionId === current.id)
    if (!right) {
      const next = entry ? { ...entry, lastAttempted: today, interval: 1, timesWrong: entry.timesWrong + 1 }
        : { questionId: current.id, lastAttempted: today, interval: 1, timesWrong: 1 }
      setQueue([...queue.filter((r) => r.questionId !== current.id), next])
    } else if (entry) {
      const grown = Math.min(30, entry.interval * 2)
      setQueue(queue.map((r) => (r.questionId === current.id ? { ...r, lastAttempted: today, interval: grown } : r)))
    }
    // daily + streak
    if (mode === 'daily' && current.id === dailyQuestion?.id) {
      setDaily({ ...daily, [today]: { ...(daily[today] ?? {}), [module_]: true } })
    }
    if (streak.lastStudyDate !== today) {
      const y = new Date(); y.setDate(y.getDate() - 1)
      const next = streak.lastStudyDate === todayISO(y) ? streak.current + 1 : 1
      setStreak({ current: next, best: Math.max(streak.best, next), lastStudyDate: today })
    }
  }

  const [confirmReset, setConfirmReset] = useState(false)
  const resetModule = () => {
    const keep = Object.fromEntries(Object.entries(attempts).filter(([id]) => !id.startsWith(module_)))
    setAttempts(keep)
    setQueue(queue.filter((r) => !r.questionId.startsWith(module_)))
    setHistory(history.filter((h) => h.module !== module_))
    setConfirmReset(false)
  }

  const modStats = (m) => {
    const qs = bank[m]
    const done = qs.filter((q) => attempts[q.id])
    const tot = done.reduce((s, q) => s + attempts[q.id].attempts, 0)
    const cor = done.reduce((s, q) => s + attempts[q.id].correct, 0)
    return { done: done.length, total: qs.length, acc: tot ? Math.round((cor / tot) * 100) : 0 }
  }
  const s = modStats(module_)
  const reviewAvailable = queue.some((r) => r.questionId.startsWith(module_))
  const overallDone = MODULES.reduce((n, m) => n + modStats(m).done, 0)

  return (
    <Card icon="🎓" title="CIMA Study Tracker">
      {/* module tabs */}
      <div className="flex gap-1" role="tablist" aria-label="CIMA modules">
        {MODULES.map((m) => (
          <button key={m} role="tab" aria-selected={module_ === m} onClick={() => switchModule(m)}
            className={`flex-1 rounded-lg py-2 min-h-[40px] text-sm font-mono font-bold ${focusRing} ${
              module_ === m ? `${MODULE_COLOR[m]} text-white` : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
            }`}>
            {m}
          </button>
        ))}
      </div>
      {/* stats */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
        <span>Attempted <b className="text-slate-800 dark:text-slate-200">{s.done}/{s.total}</b></span>
        <span>Accuracy <b className="text-slate-800 dark:text-slate-200">{s.acc}%</b></span>
        <span>Streak <b className="text-slate-800 dark:text-slate-200">{streak.current >= 7 ? '🔥' : ''}{streak.current}d</b> (best {streak.best})</span>
        <span>Overall <b className="text-slate-800 dark:text-slate-200">{overallDone}/200</b></span>
      </div>
      <ProgressBar pct={(s.done / s.total) * 100} colorClass={MODULE_COLOR[module_]} label={`${Math.round((s.done / s.total) * 100)}%`} />
      <div className="flex gap-1.5">
        {MODULES.map((m) => {
          const ms = modStats(m)
          return <div key={m} className="flex-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700 overflow-hidden" title={`${m}: ${ms.done}/${ms.total}`}>
            <div className={`h-full ${MODULE_COLOR[m]}`} style={{ width: `${(ms.done / ms.total) * 100}%` }} />
          </div>
        })}
      </div>

      {/* question card */}
      {mode === 'daily' && dailyDone && (!current || current.id === dailyQuestion?.id) && selected === null ? (
        <p className="text-sm text-center py-6 text-slate-500 dark:text-slate-400">
          ⭐ Today's {module_} Daily Challenge completed ✓ — come back tomorrow
        </p>
      ) : current ? (
        <div className="rounded-lg border border-slate-300 dark:border-slate-700 p-3 flex flex-col gap-2.5">
          <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono">
            <span className={`px-2 py-0.5 rounded-full text-white ${MODULE_COLOR[module_]}`}>{module_}</span>
            <span className="text-slate-500 dark:text-slate-400">{current.topic}</span>
            <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
              <span className={`w-2 h-2 rounded-full ${DIFF[current.difficulty][0]}`} aria-hidden="true" /> {DIFF[current.difficulty][1]}
            </span>
            {mode === 'daily' && current.id === dailyQuestion?.id && (
              <span className="text-amber-500">⭐ Daily Challenge — {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
            )}
          </div>
          <p className="text-sm font-semibold">{current.question}</p>
          <div className="flex flex-col gap-1.5">
            {['A', 'B', 'C', 'D'].map((L) => {
              const isSel = selected === L
              const isRight = selected && L === current.correct
              const isWrong = isSel && L !== current.correct
              return (
                <button key={L} onClick={() => answer(L)} disabled={!!selected}
                  className={`text-left rounded-lg border px-3 py-2 min-h-[44px] text-sm transition-colors ${focusRing} ${
                    isRight ? 'border-emerald-500 bg-emerald-400/15'
                    : isWrong ? 'border-rose-500 bg-rose-400/15'
                    : selected ? 'border-slate-300 dark:border-slate-700 opacity-60'
                    : 'border-slate-300 dark:border-slate-600 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                  }`}>
                  <span className="font-mono font-bold mr-2">{L}</span>{current.options[L]}
                  {isRight && <span className="ml-1 text-emerald-600 dark:text-emerald-400">✓</span>}
                  {isWrong && <span className="ml-1 text-rose-600 dark:text-rose-400">✗</span>}
                </button>
              )
            })}
          </div>
          {selected && (
            <>
              <p className={`text-sm font-medium ${selected === current.correct ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} role="status">
                {selected === current.correct ? '✓ Correct' : '✗ Incorrect — saved for review'}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{current.explanation}</p>
              <PrimaryBtn onClick={() => start(mode === 'daily' ? 'practice' : mode)} className="self-start">Next →</PrimaryBtn>
            </>
          )}
          {!selected && <GhostBtn onClick={() => start(mode)} className="self-start -my-1">Skip</GhostBtn>}
        </div>
      ) : (
        <p className="text-sm text-center py-4 text-slate-500 dark:text-slate-400">No questions available for this mode</p>
      )}

      {/* controls */}
      <div className="flex flex-wrap gap-2">
        <SecondaryBtn onClick={() => start('practice')}>Practice</SecondaryBtn>
        <SecondaryBtn onClick={() => start('review')} ariaDisabled={!reviewAvailable}>Review Mistakes</SecondaryBtn>
        <SecondaryBtn onClick={() => start('weak')}>Weak Topics</SecondaryBtn>
        <SecondaryBtn onClick={() => start('daily')} ariaDisabled={dailyDone}>
          ⭐ Daily Challenge{dailyDone ? ' ✓' : ''}
        </SecondaryBtn>
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-1">
        {!reviewAvailable && 'No mistakes to review yet · '}Daily Challenge: one new question per day per module
      </p>

      {/* history + reset */}
      <div className="border-t border-slate-300 dark:border-slate-700">
        <Accordion label={`Study history (${history.length})`}>
          {history.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 pb-2">No attempts yet — answer a question to start your history</p>
          ) : (
            <ul className="flex flex-col gap-1 pb-2">
              {history.slice(0, 10).map((h, i) => (
                <li key={i}>
                  <button onClick={() => { setModule(h.module); setMode('practice'); setSelected(null); setCurrent(byId[h.questionId]) }}
                    className={`w-full flex items-center gap-2 text-left text-xs py-1.5 min-h-[36px] ${focusRing}`}>
                    <span className={h.correct ? 'text-emerald-500' : 'text-rose-500'}>{h.correct ? '✓' : '✗'}</span>
                    <span className={`font-mono font-bold ${MODULE_TEXT[h.module]}`}>{h.module}</span>
                    <span className="text-slate-600 dark:text-slate-300 truncate">{h.topic}</span>
                    <span className="ml-auto font-mono text-slate-500 dark:text-slate-400">{h.date.slice(5)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Accordion>
        {!confirmReset ? (
          <GhostBtn danger onClick={() => { setConfirmReset(true); setTimeout(() => setConfirmReset(false), 5000) }}>
            Reset {module_} progress
          </GhostBtn>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-rose-500">Really reset {module_}? This clears {s.done} attempts.</span>
            <button onClick={resetModule} className={`text-rose-500 font-semibold px-2 py-2 ${focusRing}`}>Confirm</button>
            <GhostBtn onClick={() => setConfirmReset(false)}>Cancel</GhostBtn>
          </div>
        )}
      </div>
    </Card>
  )
}
