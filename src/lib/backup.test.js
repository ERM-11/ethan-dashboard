// Node-environment tests for src/lib/backup.js against an in-memory Storage stub.
import { describe, it, expect } from 'vitest'
import { collectBackup, backupFilename, validateBackup, applyBackup } from './backup.js'

// Minimal localStorage-compatible stub: length/key/getItem/setItem/removeItem.
class MemStorage {
  constructor(entries = {}) {
    this.map = new Map(Object.entries(entries))
  }
  get length() {
    return this.map.size
  }
  key(i) {
    return [...this.map.keys()][i] ?? null
  }
  getItem(k) {
    return this.map.has(k) ? this.map.get(k) : null
  }
  setItem(k, v) {
    this.map.set(k, String(v))
  }
  removeItem(k) {
    this.map.delete(k)
  }
}

// stub whose Nth setItem call throws (1-based), for the rollback test
class ThrowingStorage extends MemStorage {
  constructor(entries, throwOnCall) {
    super(entries)
    this.throwOnCall = throwOnCall
    this.setCalls = 0
  }
  setItem(k, v) {
    this.setCalls += 1
    if (this.setCalls === this.throwOnCall) throw new Error('quota exceeded')
    super.setItem(k, v)
  }
}

describe('collectBackup', () => {
  it('empty storage -> empty data with format/version/exportedAt', () => {
    const b = collectBackup(new MemStorage(), new Date(2026, 0, 5))
    expect(b).toEqual({ format: 'dashboard-backup', version: 1, exportedAt: '2026-01-05', data: {} })
  })

  it('ignores non-dashboard_ keys', () => {
    const s = new MemStorage({
      dashboard_theme: '"amoled"',
      other_app: '"nope"',
      loglevel: '"debug"'
    })
    const b = collectBackup(s, new Date(2026, 6, 11))
    expect(Object.keys(b.data)).toEqual(['dashboard_theme'])
  })

  it('keeps values as the raw stored strings', () => {
    const raw = '{"a": 1 }' // odd whitespace must survive untouched
    const s = new MemStorage({ dashboard_x: raw, dashboard_n: '42' })
    const b = collectBackup(s, new Date(2026, 6, 11))
    expect(b.data.dashboard_x).toBe(raw)
    expect(b.data.dashboard_n).toBe('42')
  })
})

describe('backupFilename', () => {
  it('derives the filename from exportedAt', () => {
    const b = collectBackup(new MemStorage(), new Date(2026, 1, 3))
    expect(backupFilename(b)).toBe('dashboard-backup-2026-02-03.json')
  })
})

describe('validateBackup', () => {
  it('rejects non-JSON text', () => {
    const r = validateBackup('not json at all {')
    expect(r.ok).toBe(false)
    expect(r.error).toBe('file is not valid JSON')
  })

  it('rejects an array root', () => {
    const r = validateBackup('[1,2,3]')
    expect(r.ok).toBe(false)
    expect(r.error).toBe('not a dashboard backup file')
  })

  it('rejects a null root', () => {
    const r = validateBackup('null')
    expect(r.ok).toBe(false)
    expect(r.error).toBe('not a dashboard backup file')
  })

  it('rejects a missing data object', () => {
    const r = validateBackup(JSON.stringify({ format: 'dashboard-backup', version: 1 }))
    expect(r.ok).toBe(false)
    expect(r.error).toBe('no "data" object in the file')
  })

  it('rejects an empty data object', () => {
    const r = validateBackup(JSON.stringify({ data: {} }))
    expect(r.ok).toBe(false)
    expect(r.error).toBe('backup contains no keys')
  })

  it('rejects a non-dashboard_ key and names it', () => {
    const r = validateBackup(JSON.stringify({ data: { evil_key: '1' } }))
    expect(r.ok).toBe(false)
    expect(r.error).toBe('"evil_key" is not a dashboard_ key')
  })

  it('rejects a non-string value and names the key', () => {
    const r = validateBackup(JSON.stringify({ data: { dashboard_x: 42 } }))
    expect(r.ok).toBe(false)
    expect(r.error).toBe('value of "dashboard_x" is not a string')
  })

  it('rejects a non-parseable value and names the key', () => {
    const r = validateBackup(JSON.stringify({ data: { dashboard_x: '{broken' } }))
    expect(r.ok).toBe(false)
    expect(r.error).toBe('value of "dashboard_x" is not parseable JSON')
  })

  it('accepts a valid backup and surfaces data/keys/exportedAt', () => {
    const r = validateBackup(
      JSON.stringify({ exportedAt: '2026-07-11', data: { dashboard_a: '1', dashboard_b: '"two"' } })
    )
    expect(r.ok).toBe(true)
    expect(r.keys).toEqual(['dashboard_a', 'dashboard_b'])
    expect(r.exportedAt).toBe('2026-07-11')
    expect(r.data).toEqual({ dashboard_a: '1', dashboard_b: '"two"' })
  })

  it('normalises a non-string exportedAt to null', () => {
    const r = validateBackup(JSON.stringify({ exportedAt: 12345, data: { dashboard_a: '1' } }))
    expect(r.ok).toBe(true)
    expect(r.exportedAt).toBeNull()
  })
})

describe('applyBackup', () => {
  it('writes every key from data', () => {
    const s = new MemStorage()
    applyBackup(s, { dashboard_a: '1', dashboard_b: '{"x":2}' })
    expect(s.getItem('dashboard_a')).toBe('1')
    expect(s.getItem('dashboard_b')).toBe('{"x":2}')
  })

  it('rolls back on a mid-write failure: old keys restored, new keys removed, error rethrown', () => {
    const s = new ThrowingStorage(
      { dashboard_a: 'old-a', dashboard_keep: 'untouched' },
      2 // first setItem (dashboard_a) succeeds, second (dashboard_new) throws
    )
    expect(() => applyBackup(s, { dashboard_a: 'new-a', dashboard_new: '"v"', dashboard_more: '3' })).toThrow(
      'quota exceeded'
    )
    expect(s.getItem('dashboard_a')).toBe('old-a') // restored to snapshot
    expect(s.getItem('dashboard_new')).toBeNull() // newly-added key removed
    expect(s.getItem('dashboard_more')).toBeNull() // never written
    expect(s.getItem('dashboard_keep')).toBe('untouched')
  })
})

describe('round-trip', () => {
  it('collect -> stringify -> validate -> apply restores byte-for-byte', () => {
    const values = {
      dashboard_theme: '"amoled"',
      dashboard_odd: '{"a": 1 }', // odd internal whitespace must survive
      dashboard_arr: '[1, 2,3]',
      dashboard_num: ' 7 ' // parseable JSON with padding
    }
    const src = new MemStorage({ ...values, foreign_key: 'left alone' })
    const text = JSON.stringify(collectBackup(src, new Date(2026, 6, 11)))
    const result = validateBackup(text)
    expect(result.ok).toBe(true)

    const dest = new MemStorage({ foreign_key: 'left alone' })
    applyBackup(dest, result.data)
    for (const [k, v] of Object.entries(values)) {
      expect(dest.getItem(k)).toBe(v) // byte-for-byte
    }
    expect(dest.getItem('foreign_key')).toBe('left alone')
    expect(dest.length).toBe(Object.keys(values).length + 1)
  })
})
