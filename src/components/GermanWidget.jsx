import React, { useMemo, useState } from 'react'
import useLocalStorage from '../hooks/useLocalStorage.js'
import { todayISO, parseISO, mondayOf } from '../config.js'
import { Card, PrimaryBtn, SecondaryBtn, GhostBtn, ProgressBar, focusRing } from './ui.jsx'
import exercises from '../data/german-exercises.json'

const LEVELS = ['All', 'A2', 'B1', 'B2']

export default function GermanWidget() {
  const [level, setLevel] = useLocalStorage('dashboard_germanLevel', 'All')
  const [completed, setCompleted] = useLocalStorage('dashboard_germanCompleted', [])
  const [mistakes, setMistakes] = useLocalStorage('dashboard_germanMistakes', [])
  const [dates, setDates] = useLocalStorage('dashboard_germanDates', [])
  const [stats, setStats] = useLocalStorage('dashboard_germanStats', { done: 0, correct: 0 })
  const [streak, setStreak] = useLocalStorage('dashboard_germanStreak', { current: 0, best: 0, lastDate: '' })

  const pool = useMemo(() => exercises.filter((e) => level === 'All' || e.level === level), [level])
  const completedInPool = pool.filter((e) => completed.includes(e.id)).length

  const pickNext = (fromMistakes = false) => {
    const source = fromMistakes
      ? pool.filter((e) => mistakes.includes(e.id))
      : pool.filter((e) => !completed.includes(e.id))
    const fallback = fromMistakes ? [] : pool
    const candidates = source.length ? source : fallback
    return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null
  }

  const [current, setCurrent] = useState(() => pickNext())
  const [answers, setAnswers] = useState({})
  const [checked, setChecked] = useState(false)
  const [showTrans, setShowTrans] = useState({})

  const startNew = (fromMistakes = false) => {
    setCurrent(pickNext(fromMistakes))
    setAnswers({}); setChecked(false); setShowTrans({})
  }
  const switchLevel = (l) => {
    setLevel(l)
    const p = exercises.filter((e) => l === 'All' || e.level === l)
    const un = p.filter((e) => !completed.includes(e.id))
    setCurrent((un.length ? un : p)[Math.floor(Math.random() * (un.length ? un : p).length)] ?? null)
    setAnswers({}); setChecked(false); setShowTrans({})
  }

  const check = () => {
    if (!current || checked) return
    setChecked(true)
    const allRight = current.dialogue.every((d, i) => (answers[i] ?? '').trim().toLowerCase() === d.answer.toLowerCase())
    if (!completed.includes(current.id)) setCompleted([...completed, current.id])
    if (allRight) setMistakes(mistakes.filter((id) => id !== current.id))
    else if (!mistakes.includes(current.id)) setMistakes([...mistakes, current.id])
    setStats({ done: stats.done + 1, correct: stats.correct + (allRight ? 1 : 0) })
    const today = todayISO()
    if (!dates.includes(today)) setDates([...dates.slice(-60), today])
    if (streak.lastDate !== today) {
      const y = new Date(); y.setDate(y.getDate() - 1)
      const next = streak.lastDate === todayISO(y) ? streak.current + 1 : 1
      setStreak({ current: next, best: Math.max(streak.best, next), lastDate: today })
    }
  }

  // Mon-first week, local time: index = (getDay()+6)%7
  const monday = mondayOf()
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i)
    return todayISO(d)
  })
  const todayIdx = (new Date().getDay() + 6) % 7

  return (
    <Card icon="🇩🇪" title="German Practice" right={
      <div className="flex rounded-full border border-slate-300 dark:border-slate-600 overflow-hidden text-xs">
        {LEVELS.map((l) => (
          <button key={l} onClick={() => switchLevel(l)}
            className={`px-2 py-1.5 min-h-[32px] ${focusRing} ${level === l ? 'bg-blue-500 text-white' : 'text-slate-500 dark:text-slate-400'}`}>
            {l}
          </button>
        ))}
      </div>
    }>
      {!current ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">No exercises at this level yet</p>
      ) : (
        <>
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
            #{current.id} · {current.theme} · {current.level}
          </p>
          <div className="flex flex-col gap-2">
            {current.dialogue.map((d, i) => {
              const right = checked && (answers[i] ?? '').trim().toLowerCase() === d.answer.toLowerCase()
              return (
                <div key={i} className="text-sm">
                  <p>
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400 mr-1">{d.speaker}:</span>
                    {checked ? d.german : d.blank}
                  </p>
                  {!checked ? (
                    <input value={answers[i] ?? ''} onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })}
                      placeholder="missing word…" aria-label={`Answer for line ${i + 1}`}
                      className={`mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-2 text-sm ${focusRing}`} />
                  ) : (
                    <p className={`text-xs font-medium ${right ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {right ? '✓ Correct' : `✗ You wrote "${answers[i] ?? ''}" — answer: "${d.answer}"`}
                    </p>
                  )}
                  <button onClick={() => setShowTrans({ ...showTrans, [i]: !showTrans[i] })}
                    className={`text-[11px] text-slate-500 dark:text-slate-400 hover:text-blue-500 min-h-[24px] ${focusRing}`}>
                    {showTrans[i] ? d.english : 'Show translation'}
                  </button>
                </div>
              )
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {!checked ? <PrimaryBtn onClick={check}>Check</PrimaryBtn> : <PrimaryBtn onClick={() => startNew()}>Next →</PrimaryBtn>}
            <SecondaryBtn onClick={() => startNew(true)} ariaDisabled={!pool.some((e) => mistakes.includes(e.id))}>
              Review Mistakes
            </SecondaryBtn>
            {!checked && <GhostBtn onClick={() => startNew()}>Skip</GhostBtn>}
          </div>
          {!pool.some((e) => mistakes.includes(e.id)) && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-1">No mistakes to review yet</p>
          )}
        </>
      )}
      <div className="border-t border-slate-300 dark:border-slate-700 pt-2 flex flex-col gap-2">
        <ProgressBar pct={pool.length ? (completedInPool / pool.length) * 100 : 0} label={`${completedInPool}/${pool.length}`} />
        <div className="flex items-center justify-between">
          <div className="flex gap-1" aria-label="This week's practice days">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((lbl, i) => (
              <div key={i} title={week[i]}
                className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-mono ${
                  dates.includes(week[i])
                    ? 'bg-emerald-400/20 border border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                } ${i === todayIdx ? 'ring-2 ring-blue-500' : ''}`}>
                {lbl}
              </div>
            ))}
          </div>
          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {streak.current >= 7 ? '🔥 ' : ''}{streak.current} day streak · {stats.done ? Math.round((stats.correct / stats.done) * 100) : 0}% correct
          </span>
        </div>
      </div>
    </Card>
  )
}
