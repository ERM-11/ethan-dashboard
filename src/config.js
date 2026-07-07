export const LOCATION = {
  latitude: 55.9533,
  longitude: -3.1883,
  timezone: 'Europe/London',
  name: 'Edinburgh'
}

export const PROXY = (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`

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
