// Node-environment tests for the readiness scoring library.
// All scoring runs against a fixed local "today" so results are deterministic.
import { describe, it, expect } from 'vitest'
import { readTrackInputs, recency, scoreTracks } from './readiness.js'

const TODAY = new Date(2026, 6, 11) // Sat 11 Jul 2026, local

const store = (map = {}) => ({ getItem: (k) => map[k] ?? null })

const emptyInputs = () => ({
  cimaAttempts: {},
  cimaReviewQueue: [],
  germanStats: { done: 0, correct: 0 },
  germanDates: [],
  germanStreak: { current: 0, lastDate: null },
  germanMistakes: 0,
  eyStatus: {}
})
const inputs = (over = {}) => ({ ...emptyInputs(), ...over })

const ms = (id, deadline, category = 'communication', title = id) => ({
  id,
  title,
  description: '',
  deadline,
  category
})

describe('readTrackInputs', () => {
  it('missing keys -> defaults', () => {
    expect(readTrackInputs(store({}))).toEqual(emptyInputs())
  })

  const validSeed = {
    dashboard_cima_attempts: JSON.stringify({
      'BA1-001': { attempts: 2, correct: 1, lastAttempted: '2026-07-01' }
    }),
    dashboard_cima_reviewQueue: JSON.stringify([
      { questionId: 'BA1-001', lastAttempted: '2026-07-01', interval: 2 }
    ]),
    dashboard_germanStats: JSON.stringify({ done: 5, correct: 4 }),
    dashboard_germanDates: JSON.stringify(['2026-07-01']),
    dashboard_germanStreak: JSON.stringify({ current: 3, lastDate: '2026-07-01' }),
    dashboard_germanMistakes: JSON.stringify(['g1', 'g2']),
    dashboard_ey_milestoneStatus: JSON.stringify({ '3stmt': { completed: true } })
  }
  const validExpected = {
    cimaAttempts: { 'BA1-001': { attempts: 2, correct: 1, lastAttempted: '2026-07-01' } },
    cimaReviewQueue: [{ questionId: 'BA1-001', lastAttempted: '2026-07-01', interval: 2 }],
    germanStats: { done: 5, correct: 4 },
    germanDates: ['2026-07-01'],
    germanStreak: { current: 3, lastDate: '2026-07-01' },
    germanMistakes: 2,
    eyStatus: { '3stmt': { completed: true } }
  }
  const fieldDefaults = {
    dashboard_cima_attempts: ['cimaAttempts', {}],
    dashboard_cima_reviewQueue: ['cimaReviewQueue', []],
    dashboard_germanStats: ['germanStats', { done: 0, correct: 0 }],
    dashboard_germanDates: ['germanDates', []],
    dashboard_germanStreak: ['germanStreak', { current: 0, lastDate: null }],
    dashboard_germanMistakes: ['germanMistakes', 0],
    dashboard_ey_milestoneStatus: ['eyStatus', {}]
  }

  it('reads a fully valid seed', () => {
    expect(readTrackInputs(store(validSeed))).toEqual(validExpected)
  })

  for (const [key, [field, fallback]] of Object.entries(fieldDefaults)) {
    it(`corrupt ${key} -> only ${field} falls back to its default`, () => {
      const r = readTrackInputs(store({ ...validSeed, [key]: '{not json' }))
      expect(r).toEqual({ ...validExpected, [field]: fallback })
    })
  }

  it('sanitises attempt entries', () => {
    const r = readTrackInputs(
      store({
        dashboard_cima_attempts: JSON.stringify({
          'BA1-001': { attempts: '5', correct: 1 }, // non-numeric attempts -> skipped
          'BA1-002': { attempts: 0, correct: 0 }, // <= 0 attempts -> skipped
          'BA1-003': { attempts: 3, correct: 9, lastAttempted: '2026-07-01' }, // correct clamps to attempts
          'BA1-004': { attempts: 2, correct: 1, lastAttempted: 'July 4th' }, // malformed date -> null
          'BA1-005': 'junk', // non-object -> skipped
          'BA1-006': { attempts: 2, correct: 'x', lastAttempted: '2026-07-02' } // non-numeric correct -> 0
        })
      })
    )
    expect(r.cimaAttempts).toEqual({
      'BA1-003': { attempts: 3, correct: 3, lastAttempted: '2026-07-01' },
      'BA1-004': { attempts: 2, correct: 1, lastAttempted: null },
      'BA1-006': { attempts: 2, correct: 0, lastAttempted: '2026-07-02' }
    })
  })

  it('sanitises review-queue entries', () => {
    const r = readTrackInputs(
      store({
        dashboard_cima_reviewQueue: JSON.stringify([
          { questionId: 'BA1-001', lastAttempted: '2026-07-01', interval: 2, timesWrong: 4 }, // kept (extras stripped)
          { questionId: 123, lastAttempted: '2026-07-01', interval: 2 }, // non-string id
          { questionId: 'BA1-002', lastAttempted: 'yesterday', interval: 2 }, // bad date
          { questionId: 'BA1-003', lastAttempted: '2026-07-01', interval: 0 }, // interval < 1
          { questionId: 'BA1-004', lastAttempted: '2026-07-01', interval: '2' }, // non-numeric interval
          'junk'
        ])
      })
    )
    expect(r.cimaReviewQueue).toEqual([{ questionId: 'BA1-001', lastAttempted: '2026-07-01', interval: 2 }])
  })

  it('germanMistakes is a count; non-array -> 0', () => {
    expect(readTrackInputs(store({ dashboard_germanMistakes: '["a","b","c"]' })).germanMistakes).toBe(3)
    expect(readTrackInputs(store({ dashboard_germanMistakes: '{}' })).germanMistakes).toBe(0)
    expect(readTrackInputs(store({ dashboard_germanMistakes: '5' })).germanMistakes).toBe(0)
  })
})

describe('recency', () => {
  it('null (never active) saturates to 1', () => {
    expect(recency(null)).toBe(1)
  })
  it('0 days -> 0', () => {
    expect(recency(0)).toBe(0)
  })
  it('4 days -> ~0.632 (1 - 1/e)', () => {
    expect(Math.abs(recency(4) - 0.632)).toBeLessThan(1e-3)
  })
  it('is strictly monotonic over 0..14 days', () => {
    for (let d = 1; d <= 14; d++) {
      expect(recency(d)).toBeGreaterThan(recency(d - 1))
    }
  })
})

describe('scoreTracks — CIMA', () => {
  it('canonical BA3 case: 11/18 correct, last studied 4 days ago', () => {
    const rows = scoreTracks(
      inputs({
        cimaAttempts: {
          'BA3-001': { attempts: 10, correct: 6, lastAttempted: '2026-07-05' },
          'BA3-002': { attempts: 8, correct: 5, lastAttempted: '2026-07-07' }
        }
      }),
      { today: TODAY }
    )
    const ba3 = rows.find((r) => r.id === 'BA3')
    // acc 61.1% -> 45*(18.89/40)=21.25; recency(4) -> 35*0.6321=22.12; round(43.37)=43
    expect(ba3.score).toBe(43)
    expect(ba3.reason).toBe('Accuracy 61%, last studied 4 days ago')
    expect(ba3.warn).toBe(false)
    expect(ba3.track).toBe('CIMA BA3')
    expect(ba3.target).toBe('cima')

    // any CIMA attempt -> all four BA rows; unstarted siblings are exactly 80
    for (const mod of ['BA1', 'BA2', 'BA4']) {
      const row = rows.find((r) => r.id === mod)
      expect(row.score).toBe(80)
      expect(row.reason).toBe('Not started yet')
    }
    // untouched German -> no german row; EY row always present once anything has data
    expect(rows.find((r) => r.id === 'german')).toBeUndefined()
    expect(rows.find((r) => r.id === 'ey')).toBeDefined()
    // sorted desc with fixed tiebreak BA1 < BA2 < BA4
    expect(rows.map((r) => r.id)).toEqual(['BA1', 'BA2', 'BA4', 'BA3', 'ey'])
  })

  it('accuracy at or above 80% contributes nothing', () => {
    const rows = scoreTracks(
      inputs({ cimaAttempts: { 'BA1-001': { attempts: 10, correct: 8, lastAttempted: '2026-07-07' } } }),
      { today: TODAY }
    )
    const ba1 = rows.find((r) => r.id === 'BA1')
    expect(ba1.score).toBe(22) // recency(4) only: round(22.12)
    expect(ba1.reason).toBe('last studied 4 days ago') // no accuracy clause
  })

  it('review due boundary is inclusive: daysSince === interval is due, interval - 1 is not', () => {
    const base = {
      cimaAttempts: { 'BA1-001': { attempts: 4, correct: 4, lastAttempted: '2026-07-11' } } // acc 100, today -> 0 base pts
    }
    const due = scoreTracks(
      inputs({ ...base, cimaReviewQueue: [{ questionId: 'BA1-001', lastAttempted: '2026-07-07', interval: 4 }] }),
      { today: TODAY }
    ).find((r) => r.id === 'BA1')
    expect(due.score).toBe(2)
    expect(due.reason).toBe('1 review due')

    const notDue = scoreTracks(
      inputs({ ...base, cimaReviewQueue: [{ questionId: 'BA1-001', lastAttempted: '2026-07-07', interval: 5 }] }),
      { today: TODAY }
    ).find((r) => r.id === 'BA1')
    expect(notDue.score).toBe(0)
    expect(notDue.reason).toBe('On track')
  })

  it('backlog caps at 10 items (20 pts) but the reason reports the true count', () => {
    const queue = Array.from({ length: 12 }, (_, i) => ({
      questionId: `BA1-${String(i + 1).padStart(3, '0')}`,
      lastAttempted: '2026-06-01',
      interval: 1
    }))
    const ba1 = scoreTracks(
      inputs({
        cimaAttempts: { 'BA1-001': { attempts: 4, correct: 4, lastAttempted: '2026-07-11' } },
        cimaReviewQueue: queue
      }),
      { today: TODAY }
    ).find((r) => r.id === 'BA1')
    expect(ba1.score).toBe(20)
    expect(ba1.reason).toBe('12 reviews due')
  })

  it('future lastAttempted clamps to today (recency 0)', () => {
    const ba1 = scoreTracks(
      inputs({ cimaAttempts: { 'BA1-001': { attempts: 10, correct: 6, lastAttempted: '2026-08-01' } } }),
      { today: TODAY }
    ).find((r) => r.id === 'BA1')
    expect(ba1.score).toBe(23) // accuracy 60% -> 22.5 pts only, round -> 23
    expect(ba1.reason).toBe('Accuracy 60%')
  })
})

describe('scoreTracks — German', () => {
  it('gates on stats.done alone', () => {
    const rows = scoreTracks(inputs({ germanStats: { done: 1, correct: 1 } }), { today: TODAY })
    const g = rows.find((r) => r.id === 'german')
    expect(g).toBeDefined()
    expect(g.track).toBe('German')
    expect(g.target).toBe('german')
    expect(g.score).toBe(35) // no dates -> recency saturates to full 35; acc 100 -> 0
    expect(g.reason).toBe('On track') // recency clause omitted when no date exists
  })

  it('gates on practice dates alone', () => {
    const g = scoreTracks(inputs({ germanDates: ['2026-07-09'] }), { today: TODAY }).find((r) => r.id === 'german')
    expect(g.score).toBe(14) // recency(2): 35*0.3935 = 13.77
    expect(g.reason).toBe('last practised 2 days ago') // done===0 -> no accuracy clause
  })

  it('gates on streak alone (streak lastDate feeds recency)', () => {
    const g = scoreTracks(inputs({ germanStreak: { current: 2, lastDate: '2026-07-10' } }), { today: TODAY }).find(
      (r) => r.id === 'german'
    )
    expect(g.score).toBe(8) // recency(1): 35*0.2212 = 7.74
    expect(g.reason).toBe('last practised yesterday')
  })

  it('logged mistakes are the German backlog, with singular/plural copy', () => {
    const base = { germanStats: { done: 4, correct: 4 }, germanDates: ['2026-07-11'] } // acc + recency both 0
    const three = scoreTracks(inputs({ ...base, germanMistakes: 3 }), { today: TODAY }).find((r) => r.id === 'german')
    expect(three.score).toBe(6)
    expect(three.reason).toBe('3 mistakes to review')

    const one = scoreTracks(inputs({ ...base, germanMistakes: 1 }), { today: TODAY }).find((r) => r.id === 'german')
    expect(one.score).toBe(2)
    expect(one.reason).toBe('1 mistake to review')
  })

  it('future practice dates clamp to today', () => {
    const g = scoreTracks(inputs({ germanDates: ['2026-09-01'] }), { today: TODAY }).find((r) => r.id === 'german')
    expect(g.score).toBe(0)
    expect(g.reason).toBe('On track')
  })
})

describe('scoreTracks — EY milestones', () => {
  it('overdue uses ISO string comparison and skips completed-late milestones', () => {
    const rows = scoreTracks(
      inputs({ eyStatus: { m1: { completed: true }, m2: { completed: false } } }),
      {
        milestones: [ms('m1', '2026-07-01'), ms('m2', '2026-07-05')],
        today: TODAY
      }
    )
    const ey = rows.find((r) => r.id === 'ey')
    expect(ey.score).toBe(52) // 12*1 overdue + 40 proximity (earliest already past)
    expect(ey.warn).toBe(true)
    expect(ey.reason).toBe('1 communication milestone overdue') // uniform category is named
  })

  it('deadline exactly today is NOT overdue', () => {
    const ey = scoreTracks(inputs({ eyStatus: { memo: { completed: false } } }), {
      milestones: [ms('memo', '2026-07-11', 'communication', 'Memo')],
      today: TODAY
    }).find((r) => r.id === 'ey')
    expect(ey.warn).toBe(false)
    expect(ey.score).toBe(40) // proximity d=0 -> full 40, no overdue points
    expect(ey.reason).toBe('Memo due today')
  })

  it('proximity term: d=0 -> 40, d=1 -> 37 "tomorrow", d=7 -> 20, d=14 -> 0', () => {
    const at = (deadline) =>
      scoreTracks(inputs({ eyStatus: { memo: { completed: false } } }), {
        milestones: [ms('memo', deadline, 'communication', 'Memo')],
        today: TODAY
      }).find((r) => r.id === 'ey')

    expect(at('2026-07-11').score).toBe(40)
    const tomorrow = at('2026-07-12')
    expect(tomorrow.score).toBe(37) // 40 * 13/14
    expect(tomorrow.reason).toBe('Memo due tomorrow')
    const week = at('2026-07-18')
    expect(week.score).toBe(20) // 40 * 7/14
    expect(week.reason).toBe('Memo due in 7 days')
    const fortnight = at('2026-07-25')
    expect(fortnight.score).toBe(0)
    expect(fortnight.reason).toBe('Memo due in 14 days')
  })

  it('5+ overdue with the earliest already past scores exactly 100', () => {
    const cats = ['modelling', 'tools', 'communication', 'modelling', 'tools', 'communication']
    const milestones = cats.map((c, i) => ms(`m${i}`, `2026-06-0${i + 1}`, c))
    const ey = scoreTracks(inputs({ eyStatus: { m0: { completed: false } } }), { milestones, today: TODAY }).find(
      (r) => r.id === 'ey'
    )
    expect(ey.score).toBe(100) // 12*5 (cap) + 40
    expect(ey.warn).toBe(true)
    expect(ey.reason).toBe('6 milestones overdue') // mixed categories -> plain count
  })

  it('mixed-category pair reads "2 milestones overdue"', () => {
    const ey = scoreTracks(inputs({ eyStatus: { a: { completed: false } } }), {
      milestones: [ms('a', '2026-07-01', 'modelling'), ms('b', '2026-07-05', 'communication')],
      today: TODAY
    }).find((r) => r.id === 'ey')
    expect(ey.score).toBe(64) // 24 + 40
    expect(ey.warn).toBe(true)
    expect(ey.reason).toBe('2 milestones overdue')
  })

  it('all milestones complete -> score 0, no warning', () => {
    const ey = scoreTracks(
      inputs({ eyStatus: { a: { completed: true }, b: { completed: true } } }),
      { milestones: [ms('a', '2026-07-01'), ms('b', '2026-08-01')], today: TODAY }
    ).find((r) => r.id === 'ey')
    expect(ey.score).toBe(0)
    expect(ey.warn).toBe(false)
    expect(ey.reason).toBe('All milestones complete')
  })
})

describe('scoreTracks — gating, ordering, invariants', () => {
  it('fresh install (no data at all) -> []', () => {
    expect(scoreTracks(emptyInputs(), { milestones: [ms('a', '2026-07-01')], today: TODAY })).toEqual([])
    expect(scoreTracks(emptyInputs(), { today: TODAY })).toEqual([])
  })

  it('ties break ey < BA1 (fixed track rank)', () => {
    const queue = Array.from({ length: 10 }, (_, i) => ({
      questionId: `BA1-${String(i + 1).padStart(3, '0')}`,
      lastAttempted: '2026-06-01',
      interval: 1
    }))
    const rows = scoreTracks(
      inputs({
        cimaAttempts: { 'BA1-001': { attempts: 4, correct: 4, lastAttempted: '2026-07-11' } }, // BA1 = backlog 20 only
        cimaReviewQueue: queue
      }),
      { milestones: [ms('memo', '2026-07-18', 'communication', 'Memo')], today: TODAY } // ey = 20
    )
    const ey = rows.find((r) => r.id === 'ey')
    const ba1 = rows.find((r) => r.id === 'BA1')
    expect(ey.score).toBe(20)
    expect(ba1.score).toBe(20)
    expect(rows.map((r) => r.id)).toEqual(['BA2', 'BA3', 'BA4', 'ey', 'BA1'])
  })

  it('ties break BA4 < german (German at the formula-limit 80 sorts after the 80-point modules)', () => {
    const rows = scoreTracks(
      inputs({
        cimaAttempts: {
          'BA3-001': { attempts: 10, correct: 6, lastAttempted: '2026-07-05' },
          'BA3-002': { attempts: 8, correct: 5, lastAttempted: '2026-07-07' }
        },
        germanStats: { done: 1, correct: 0 } // acc 0 -> 45, no dates -> 35 => exactly 80
      }),
      { today: TODAY }
    )
    expect(rows.find((r) => r.id === 'german').score).toBe(80)
    expect(rows.map((r) => r.id)).toEqual(['BA1', 'BA2', 'BA4', 'german', 'BA3', 'ey'])
  })

  it('is deterministic: two identical calls deep-equal', () => {
    const build = () =>
      scoreTracks(
        inputs({
          cimaAttempts: { 'BA2-004': { attempts: 6, correct: 3, lastAttempted: '2026-07-03' } },
          cimaReviewQueue: [{ questionId: 'BA2-004', lastAttempted: '2026-07-03', interval: 2 }],
          germanStats: { done: 10, correct: 5 },
          germanDates: ['2026-07-06', '2026-07-08'],
          germanMistakes: 4,
          eyStatus: { a: { completed: false } }
        }),
        { milestones: [ms('a', '2026-07-09', 'tools'), ms('b', '2026-07-20', 'modelling')], today: TODAY }
      )
    expect(build()).toEqual(build())
  })

  it('every score is an integer in [0, 100]', () => {
    const rows = scoreTracks(
      inputs({
        cimaAttempts: {
          'BA1-001': { attempts: 20, correct: 2, lastAttempted: '2026-05-01' },
          'BA2-001': { attempts: 1, correct: 1, lastAttempted: '2026-07-11' },
          'BA4-050': { attempts: 9, correct: 4, lastAttempted: null }
        },
        cimaReviewQueue: Array.from({ length: 15 }, (_, i) => ({
          questionId: `BA1-${i}`,
          lastAttempted: '2026-04-01',
          interval: 1
        })),
        germanStats: { done: 30, correct: 3 },
        germanDates: ['2026-06-01'],
        germanMistakes: 25,
        eyStatus: { x: { completed: false } }
      }),
      {
        milestones: [
          ms('x', '2026-06-01', 'modelling'),
          ms('y', '2026-06-15', 'tools'),
          ms('z', '2026-07-02', 'communication'),
          ms('w', '2026-07-04', 'communication'),
          ms('v', '2026-07-06', 'tools'),
          ms('u', '2026-07-08', 'modelling')
        ],
        today: TODAY
      }
    )
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(Number.isInteger(row.score)).toBe(true)
      expect(row.score).toBeGreaterThanOrEqual(0)
      expect(row.score).toBeLessThanOrEqual(100)
      expect(typeof row.reason).toBe('string')
      expect(row.reason.length).toBeGreaterThan(0)
    }
    // sorted descending
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].score).toBeGreaterThanOrEqual(rows[i].score)
    }
  })
})
