// Node-environment tests for the Study Activity heatmap helpers.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { parseISO } from '../config.js'
import { readActivity, activityTotal, intensityLevel, LEVEL_OPACITY, buildGrid } from './studyActivity.js'

// getItem-only stub is all readActivity needs
const stub = (map = {}) => ({ getItem: (k) => (k in map ? map[k] : null) })

describe('readActivity', () => {
  it('empty storage -> {}', () => {
    expect(readActivity(stub())).toEqual({})
  })

  it('ignores corrupt JSON per source key (others still read)', () => {
    const a = readActivity(
      stub({
        dashboard_cima_dailyCompleted: '{broken',
        dashboard_germanDates: '["2026-07-01"]',
        dashboard_wordVoteDate: '"2026-07-02"'
      })
    )
    expect(a).toEqual({
      '2026-07-01': { cima: 0, german: true, word: false },
      '2026-07-02': { cima: 0, german: false, word: true }
    })
  })

  it('ignores wrong-typed values: array cima map, object germanDates, number voteDate', () => {
    const a = readActivity(
      stub({
        dashboard_cima_dailyCompleted: '["2026-07-01"]',
        dashboard_germanDates: '{"2026-07-01": true}',
        dashboard_wordVoteDate: '20260701'
      })
    )
    expect(a).toEqual({})
  })

  it('counts only truthy cima module flags', () => {
    const a = readActivity(
      stub({
        dashboard_cima_dailyCompleted: JSON.stringify({
          '2026-07-01': { BA1: true, BA2: false, BA3: true, BA4: 0 }
        })
      })
    )
    expect(a['2026-07-01'].cima).toBe(2)
  })

  it('merges cima + german + word on the same day', () => {
    const a = readActivity(
      stub({
        dashboard_cima_dailyCompleted: JSON.stringify({ '2026-07-01': { BA1: true } }),
        dashboard_germanDates: '["2026-07-01"]',
        dashboard_wordVoteDate: '"2026-07-01"'
      })
    )
    expect(a['2026-07-01']).toEqual({ cima: 1, german: true, word: true })
    expect(activityTotal(a['2026-07-01'])).toBe(3)
  })
})

describe('activityTotal', () => {
  it('is null-safe', () => {
    expect(activityTotal(null)).toBe(0)
    expect(activityTotal(undefined)).toBe(0)
  })
  it('sums cima count plus german/word booleans', () => {
    expect(activityTotal({ cima: 3, german: true, word: false })).toBe(4)
    expect(activityTotal({ cima: 0, german: false, word: false })).toBe(0)
    expect(activityTotal({ cima: 2, german: true, word: true })).toBe(4)
  })
})

describe('intensityLevel', () => {
  it('maps totals to 0..4 with clamping', () => {
    expect(intensityLevel(0)).toBe(0)
    expect(intensityLevel(1)).toBe(1)
    expect(intensityLevel(4)).toBe(4)
    expect(intensityLevel(7)).toBe(4)
    expect(intensityLevel(-1)).toBe(0)
  })
})

describe('LEVEL_OPACITY', () => {
  it('has five entries and index 0 is fully transparent', () => {
    expect(LEVEL_OPACITY).toHaveLength(5)
    expect(LEVEL_OPACITY[0]).toBe(0)
  })
})

describe('buildGrid', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('is 12 columns of 7 days', () => {
    const grid = buildGrid(new Date(2026, 6, 11))
    expect(grid).toHaveLength(12)
    for (const week of grid) expect(week).toHaveLength(7)
  })

  it('every column starts on a Monday with consecutive days', () => {
    const grid = buildGrid(new Date(2026, 6, 11))
    for (const week of grid) {
      expect(parseISO(week[0].iso).getDay()).toBe(1) // Monday
      for (let d = 1; d < 7; d++) {
        const prev = parseISO(week[d - 1].iso)
        const next = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 1)
        expect(parseISO(week[d].iso).getTime()).toBe(next.getTime()) // consecutive
      }
    }
  })

  it('puts today in the last column; later cells are future, today itself is not', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 8)) // Wed 8 Jul 2026 — uses the default arg
    const grid = buildGrid()
    const last = grid[11]
    const todayCell = last.find((c) => c.iso === '2026-07-08')
    expect(todayCell).toBeDefined()
    expect(todayCell.future).toBe(false)
    const idx = last.indexOf(todayCell)
    for (let d = 0; d < 7; d++) {
      expect(last[d].future).toBe(d > idx)
    }
  })

  it('spans month and year boundaries: 2026-01-07 -> 2025-10-20 .. 2026-01-11', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 7))
    const grid = buildGrid()
    expect(grid[0][0].iso).toBe('2025-10-20')
    expect(grid[11][6].iso).toBe('2026-01-11')
    expect(grid[11][6].future).toBe(true)
  })
})
