// @vitest-environment jsdom
// CimaWidget behaviour tests — spaced repetition, review-mode selection, and
// the deterministic Daily Challenge. Expectations are computed from the real
// question bank JSON, never hardcoded.
//
// Date is pinned with vi.useFakeTimers({ toFake: ['Date'] }) ONLY, so real
// timers keep working for user-event. Math.random is pinned to 0 so "random"
// picks always take the first candidate, making the current question knowable.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CimaWidget from './CimaWidget.jsx'
import bank from '../data/cima-questions.json'
import { dayOfYear } from '../config.js'

const TODAY_ISO = '2026-07-11'

// noon local: '<iso>' parsed as UTC midnight by the widget's due check is
// unambiguously in the past/present regardless of the pinned TZ offset
const NOW = new Date(2026, 6, 11, 12, 0, 0)

const wrongLetterOf = (question) => ['A', 'B', 'C', 'D'].find((L) => L !== question.correct)
const optionButton = (question, letter) =>
  screen.getByRole('button', { name: `${letter} ${question.options[letter]}` })
const readQueue = () => JSON.parse(localStorage.getItem('dashboard_cima_reviewQueue') ?? '[]')
const seedQueue = (entries) => localStorage.setItem('dashboard_cima_reviewQueue', JSON.stringify(entries))

// with Math.random pinned to 0 and no attempts stored, practice mode shows
// the first BA1 question in bank order
const FIRST = bank.BA1[0]

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  vi.spyOn(Math, 'random').mockReturnValue(0)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('CimaWidget spaced repetition', () => {
  it('first wrong answer creates a queue entry {interval: 1, timesWrong: 1, lastAttempted: today}', async () => {
    const user = userEvent.setup()
    render(<CimaWidget />)
    expect(screen.getByText(FIRST.question)).toBeInTheDocument()

    await user.click(optionButton(FIRST, wrongLetterOf(FIRST)))

    expect(readQueue()).toEqual([
      { questionId: FIRST.id, lastAttempted: TODAY_ISO, interval: 1, timesWrong: 1 }
    ])
    // the attempt is also recorded
    expect(JSON.parse(localStorage.getItem('dashboard_cima_attempts'))).toEqual({
      [FIRST.id]: { attempts: 1, correct: 0, lastAttempted: TODAY_ISO }
    })
  })

  it('wrong answer on an existing entry resets interval to 1 and increments timesWrong', async () => {
    seedQueue([{ questionId: FIRST.id, lastAttempted: '2026-07-01', interval: 8, timesWrong: 2 }])
    const user = userEvent.setup()
    render(<CimaWidget />)

    await user.click(optionButton(FIRST, wrongLetterOf(FIRST)))

    expect(readQueue()).toEqual([
      { questionId: FIRST.id, lastAttempted: TODAY_ISO, interval: 1, timesWrong: 3 }
    ])
  })

  it('correct answer on an existing entry doubles the interval (4 -> 8)', async () => {
    seedQueue([{ questionId: FIRST.id, lastAttempted: '2026-07-01', interval: 4, timesWrong: 1 }])
    const user = userEvent.setup()
    render(<CimaWidget />)

    await user.click(optionButton(FIRST, FIRST.correct))

    expect(readQueue()).toEqual([
      { questionId: FIRST.id, lastAttempted: TODAY_ISO, interval: 8, timesWrong: 1 }
    ])
  })

  it('interval growth caps at 30 (20 -> 30, not 40)', async () => {
    seedQueue([{ questionId: FIRST.id, lastAttempted: '2026-07-01', interval: 20, timesWrong: 1 }])
    const user = userEvent.setup()
    render(<CimaWidget />)

    await user.click(optionButton(FIRST, FIRST.correct))

    expect(readQueue()).toEqual([
      { questionId: FIRST.id, lastAttempted: TODAY_ISO, interval: 30, timesWrong: 1 }
    ])
  })

  it('correct answer with no existing entry creates none', async () => {
    const user = userEvent.setup()
    render(<CimaWidget />)

    await user.click(optionButton(FIRST, FIRST.correct))

    expect(readQueue()).toEqual([])
    expect(JSON.parse(localStorage.getItem('dashboard_cima_attempts'))).toEqual({
      [FIRST.id]: { attempts: 1, correct: 1, lastAttempted: TODAY_ISO }
    })
  })

  it('review mode prefers due entries over not-yet-due ones', async () => {
    const notDue = bank.BA1[1] // BA1-002: lastAttempted today, interval 30 -> not due
    const due = bank.BA1[2] // BA1-003: 40 days ago, interval 1 -> due
    seedQueue([
      { questionId: notDue.id, lastAttempted: TODAY_ISO, interval: 30, timesWrong: 1 },
      { questionId: due.id, lastAttempted: '2026-06-01', interval: 1, timesWrong: 1 }
    ])
    const user = userEvent.setup()
    render(<CimaWidget />)
    expect(screen.getByText(FIRST.question)).toBeInTheDocument() // practice question first

    await user.click(screen.getByRole('button', { name: 'Review Mistakes' }))

    expect(screen.getByText(due.question)).toBeInTheDocument()
    expect(screen.queryByText(notDue.question)).not.toBeInTheDocument()
    expect(screen.queryByText(FIRST.question)).not.toBeInTheDocument()
  })
})

describe('CimaWidget daily challenge', () => {
  // same rule as the widget: unattempted questions sorted by id, indexed by day-of-year
  const expectedDaily = () => {
    const pool = [...bank.BA1].sort((a, b) => a.id.localeCompare(b.id))
    return pool[dayOfYear() % pool.length]
  }

  it('is deterministic: unattempted pool sorted by id, dayOfYear() % pool size', async () => {
    const user = userEvent.setup()
    render(<CimaWidget />)

    await user.click(screen.getByRole('button', { name: /Daily Challenge/ }))

    const expected = expectedDaily()
    expect(screen.getByText(expected.question)).toBeInTheDocument()
    expect(screen.getByText(/Daily Challenge —/)).toBeInTheDocument() // in-card daily label
  })

  it('answering the daily marks it completed for today and disables the button', async () => {
    const user = userEvent.setup()
    render(<CimaWidget />)

    const dailyBtn = screen.getByRole('button', { name: /Daily Challenge/ })
    expect(dailyBtn).toHaveAttribute('aria-disabled', 'false')
    await user.click(dailyBtn)

    const expected = expectedDaily()
    await user.click(optionButton(expected, expected.correct))

    expect(JSON.parse(localStorage.getItem('dashboard_cima_dailyCompleted'))).toEqual({
      [TODAY_ISO]: { BA1: true }
    })
    const btnAfter = screen.getByRole('button', { name: /Daily Challenge/ })
    expect(btnAfter).toHaveAttribute('aria-disabled', 'true')
    expect(btnAfter.textContent).toContain('✓') // distinct completed state
  })
})
