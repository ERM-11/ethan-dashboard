// Export/import of every dashboard_ localStorage key — no React so the
// round-trip can be exercised in node. Values travel as the raw JSON strings
// already in localStorage, so a backup restores byte-for-byte.
import { todayISO } from '../config.js'

const PREFIX = 'dashboard_'
const FORMAT = 'dashboard-backup'

export function collectBackup(storage, now = new Date()) {
  const data = {}
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key && key.startsWith(PREFIX)) data[key] = storage.getItem(key)
  }
  return { format: FORMAT, version: 1, exportedAt: todayISO(now), data }
}

export function backupFilename(backup) {
  return `dashboard-backup-${backup.exportedAt}.json`
}

// Validates the whole file before anything is written: must be a backup
// object whose data holds ONLY dashboard_-prefixed keys with JSON-parseable
// string values. Returns {ok, error} or {ok, data, keys, exportedAt}.
export function validateBackup(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'file is not valid JSON' }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'not a dashboard backup file' }
  }
  const data = parsed.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: 'no "data" object in the file' }
  }
  const keys = Object.keys(data)
  if (keys.length === 0) return { ok: false, error: 'backup contains no keys' }
  for (const key of keys) {
    if (!key.startsWith(PREFIX)) return { ok: false, error: `"${key}" is not a dashboard_ key` }
    const value = data[key]
    if (typeof value !== 'string') return { ok: false, error: `value of "${key}" is not a string` }
    try {
      JSON.parse(value)
    } catch {
      return { ok: false, error: `value of "${key}" is not parseable JSON` }
    }
  }
  return {
    ok: true,
    data,
    keys,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null
  }
}

// All-or-nothing write: snapshot the current dashboard_ keys first and put
// them back if any setItem throws (e.g. quota), so a failed import never
// leaves mixed state. Only ever touches dashboard_-prefixed keys.
export function applyBackup(storage, data) {
  const snapshot = {}
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key && key.startsWith(PREFIX)) snapshot[key] = storage.getItem(key)
  }
  try {
    for (const [key, value] of Object.entries(data)) storage.setItem(key, value)
  } catch (err) {
    for (const key of Object.keys(data)) {
      try {
        if (key in snapshot) storage.setItem(key, snapshot[key])
        else storage.removeItem(key)
      } catch {
        /* best effort restore */
      }
    }
    throw err
  }
}
