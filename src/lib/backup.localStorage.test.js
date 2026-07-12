// @vitest-environment jsdom
// Round-trip through the REAL window.localStorage (jsdom) — proves the pure
// helpers compose with an actual Storage object, not just the test stub.
import { describe, it, expect, beforeEach } from 'vitest'
import { collectBackup, validateBackup, applyBackup } from './backup.js'

describe('backup round-trip via window.localStorage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('dashboard_ values restore byte-identical; foreign keys untouched', () => {
    window.localStorage.setItem('dashboard_theme', '"amoled"')
    window.localStorage.setItem('dashboard_odd', '{"a": 1 }')
    window.localStorage.setItem('dashboard_stockTickers', '["NVDA","GOOGL"]')
    window.localStorage.setItem('someOther_key', 'not ours')

    const text = JSON.stringify(collectBackup(window.localStorage, new Date(2026, 6, 11)))
    expect(text).not.toContain('someOther_key')

    // simulate a fresh device with unrelated state present
    window.localStorage.clear()
    window.localStorage.setItem('someOther_key', 'still not ours')

    const result = validateBackup(text)
    expect(result.ok).toBe(true)
    expect(result.exportedAt).toBe('2026-07-11')
    applyBackup(window.localStorage, result.data)

    expect(window.localStorage.getItem('dashboard_theme')).toBe('"amoled"')
    expect(window.localStorage.getItem('dashboard_odd')).toBe('{"a": 1 }') // byte-identical
    expect(window.localStorage.getItem('dashboard_stockTickers')).toBe('["NVDA","GOOGL"]')
    expect(window.localStorage.getItem('someOther_key')).toBe('still not ours')
  })
})
