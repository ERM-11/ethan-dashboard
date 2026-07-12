import React, { useMemo, useState } from 'react'
import { Languages, Flame } from 'lucide-react'
import useLocalStorage from '../hooks/useLocalStorage.js'
import { todayISO, mondayOf } from '../config.js'
import { Card, PrimaryBtn, SecondaryBtn, GhostBtn, ProgressBar, Segmented, focusRing, buzz, inputCls } from './ui.jsx'
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
    buzz()
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
    <Card icon={Languages} title="German Practice" right={
      <Segmented options={LEVELS} value={level} onChange={switchLevel} label="German level" />
    }>
      {!current ? (
        <p className="text-sm text-mut py-4 text-center">No exercises at this level yet</p>
      ) : (
        <>
          <p className="num text-xs text-mut">
            #{current.id} · {current.theme} · {current.level}
          </p>
          <div className="flex flex-col gap-2">
            {current.dialogue.map((d, i) => {
              const right = checked && (answers[i] ?? '').trim().toLowerCase() === d.answer.toLowerCase()
              return (
                <div key={i} className="text-sm">
                  <p>
                    <span className="num text-xs text-mut mr-1">{d.speaker}:</span>
                    {checked ? d.german : d.blank}
                  </p>
                  {!checked ? (
                    <input value={answers[i] ?? ''} onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })}
                      placeholder="missing word…" aria-label={`Answer for line ${i + 1}`}
                      className={`mt-1 w-full ${inputCls()}`} />
                  ) : (
                    <p className={`text-xs font-medium ${right ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {right ? '✓ Correct' : `✗ You wrote "${answers[i] ?? ''}" — answer: "${d.answer}"`}
                    </p>
                  )}
                  <button onClick={() => setShowTrans({ ...showTrans, [i]: !showTrans[i] })}
                    className={`relative text-xs text-mut hover:text-ink min-h-[24px] after:absolute after:content-[''] after:-inset-x-2 after:-top-1 after:-bottom-4 ${focusRing}`}>
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
            <p className="text-xs text-mut -mt-1">No mistakes to review yet</p>
          )}
        </>
      )}
      <div className="border-t border-line pt-2 flex flex-col gap-3">
        <ProgressBar pct={pool.length ? (completedInPool / pool.length) * 100 : 0} label={`${completedInPool}/${pool.length}`} />
        <div className="flex items-center gap-5">
          <div className="flex flex-col">
            <span className="num text-base font-bold flex items-center gap-1">
              {streak.current >= 7 && <Flame size={14} strokeWidth={2} aria-hidden="true" className="text-ink" />}
              {streak.current}
            </span>
            <span className="text-xs text-mut">day streak</span>
          </div>
          <div className="flex flex-col">
            <span className="num text-base font-bold">
              {stats.done ? Math.round((stats.correct / stats.done) * 100) : 0}%
            </span>
            <span className="text-xs text-mut">accuracy</span>
          </div>
        </div>
        <div className="flex gap-1" aria-label="This week's practice days">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((lbl, i) => (
            <div key={i} title={week[i]}
              className={`num w-5 h-5 rounded flex items-center justify-center text-xs ${
                dates.includes(week[i])
                  ? 'bg-emerald-400/20 border border-emerald-500 text-emerald-400'
                  : 'bg-card2 text-mut'
              } ${i === todayIdx ? 'ring-2 ring-focus' : ''}`}>
              {lbl}
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
