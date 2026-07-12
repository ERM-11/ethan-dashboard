// Node-environment tests for the calendar helpers in src/config.js.
// vitest.config.js pins TZ=Pacific/Auckland (non-UTC, DST-observing) so any
// accidental toISOString()/bare new Date(iso) calendar logic fails loudly.
import { describe, it, expect } from 'vitest'
import { todayISO, parseISO, dayOfYear, mondayOf } from './config.js'

// Did the TZ pin take on this OS/Node combo? NZ July (winter) is NZST = UTC+12.
const tzPinned = new Date(2026, 6, 11).getTimezoneOffset() === -720

describe('todayISO', () => {
  it('zero-pads month and day', () => {
    expect(todayISO(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('uses the LOCAL calendar date, not the UTC one', () => {
    // 00:30 local on 11 July — in a TZ ahead of UTC this is still 10 July in UTC
    const d = new Date(2026, 6, 11, 0, 30)
    if (tzPinned) {
      // precondition: the UTC date really is the previous day, so a
      // toISOString()-based implementation would return '2026-07-10'
      expect(d.toISOString().slice(0, 10)).toBe('2026-07-10')
    }
    // local components are what todayISO must reflect, in any TZ
    expect(todayISO(d)).toBe('2026-07-11')
  })
})

describe('parseISO', () => {
  it('parses to LOCAL midnight (not UTC midnight)', () => {
    const d = parseISO('2026-07-11')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(6)
    expect(d.getDate()).toBe(11)
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
  })

  it('round-trips with todayISO', () => {
    for (const iso of ['2026-01-01', '2026-07-11', '2024-02-29', '2025-12-31']) {
      expect(todayISO(parseISO(iso))).toBe(iso)
    }
  })
})

describe('dayOfYear', () => {
  // NOTE: dayOfYear's floor((d - start) / 86400000) is DST-sensitive by design;
  // these dates are pinned where the maths is exact (transitions cancel out or
  // none occur in the interval).
  it('Jan 1 is day 1', () => {
    expect(dayOfYear(new Date(2026, 0, 1))).toBe(1)
  })
  it('Dec 31 2026 is day 365 (non-leap)', () => {
    expect(dayOfYear(new Date(2026, 11, 31))).toBe(365)
  })
  it('Dec 31 2024 is day 366 (leap)', () => {
    expect(dayOfYear(new Date(2024, 11, 31))).toBe(366)
  })
  it('Mar 1 differs between leap and non-leap years', () => {
    expect(dayOfYear(new Date(2024, 2, 1))).toBe(61) // after Feb 29
    expect(dayOfYear(new Date(2026, 2, 1))).toBe(60)
  })
})

describe('mondayOf', () => {
  const ymd = (d) => [d.getFullYear(), d.getMonth(), d.getDate()]

  it('Wednesday maps to that Monday at local midnight', () => {
    const m = mondayOf(new Date(2026, 6, 8)) // Wed 8 Jul 2026
    expect(ymd(m)).toEqual([2026, 6, 6]) // Mon 6 Jul
    expect(m.getDay()).toBe(1)
    expect(m.getHours()).toBe(0)
  })

  it('Sunday maps to the PREVIOUS Monday (weeks start Monday)', () => {
    const m = mondayOf(new Date(2026, 6, 12)) // Sun 12 Jul 2026
    expect(ymd(m)).toEqual([2026, 6, 6])
    expect(m.getDay()).toBe(1)
  })

  it('Monday maps to itself', () => {
    const m = mondayOf(new Date(2026, 6, 6))
    expect(ymd(m)).toEqual([2026, 6, 6])
    expect(m.getDay()).toBe(1)
  })

  it('crosses a DST transition correctly (NZ DST ends Sun 5 Apr 2026)', () => {
    const m = mondayOf(new Date(2026, 3, 5)) // Sunday of the transition week
    expect(ymd(m)).toEqual([2026, 2, 30]) // Mon 30 Mar 2026
    expect(m.getDay()).toBe(1)
    expect(m.getHours()).toBe(0)
  })

  it('crosses a year boundary (Thu 1 Jan 2026 -> Mon 29 Dec 2025)', () => {
    const m = mondayOf(new Date(2026, 0, 1))
    expect(ymd(m)).toEqual([2025, 11, 29])
    expect(m.getDay()).toBe(1)
    expect(m.getHours()).toBe(0)
  })
})
