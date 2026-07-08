export const LOCATION = {
  latitude: 55.9533,
  longitude: -3.1883,
  timezone: 'Europe/London',
  name: 'Edinburgh'
}

// CORS proxies tried in order. Our own same-origin Vercel function (/api/proxy)
// comes first — it has no CORS and no third-party dependency, so it's the reliable
// path (the public proxies below are just belt-and-suspenders fallbacks).
const PROXIES = [
  (url) => `/api/proxy?url=${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`
]

// Fetch a URL through the proxy chain, returning the first OK Response.
// Each attempt has its own timeout so a hung proxy can't stall the whole chain.
export async function fetchViaProxy(targetUrl, { timeout = 8000 } = {}) {
  let lastErr
  for (const build of PROXIES) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeout)
    try {
      const res = await fetch(build(targetUrl), { signal: ctrl.signal, headers: { Accept: '*/*' } })
      clearTimeout(timer)
      if (res.ok) return res
      lastErr = new Error(`HTTP ${res.status}`)
    } catch (e) {
      clearTimeout(timer)
      lastErr = e
    }
  }
  throw lastErr ?? new Error('all proxies failed')
}

// kept for compatibility — first proxy in the chain
export const PROXY = PROXIES[0]

// today's date as a local-time ISO string (YYYY-MM-DD) — never toISOString(), which is UTC
export function todayISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// parse a stored ISO date as LOCAL midnight (bare new Date(iso) is UTC in browsers)
export function parseISO(iso) {
  return new Date(iso + 'T00:00:00')
}

export function dayOfYear(d = new Date()) {
  const start = new Date(d.getFullYear(), 0, 0)
  return Math.floor((d - start) / 86400000)
}

// Monday of the week containing d, local time
export function mondayOf(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const shift = (x.getDay() + 6) % 7 // Mon=0 … Sun=6
  x.setDate(x.getDate() - shift)
  return x
}
