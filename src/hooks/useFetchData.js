import { useState, useEffect, useCallback, useRef } from 'react'

// Shared fetch hook: one attempt per refresh cycle, interval refresh, cleanup on unmount.
// Pass transform to parse non-JSON responses (e.g. RSS XML text).
export default function useFetchData(url, refreshInterval, { transform, enabled = true } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const alive = useRef(true)

  const load = useCallback(async () => {
    if (!enabled) return
    setError(null)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = transform ? await transform(res) : await res.json()
      if (!alive.current) return
      setData(body)
      setLastUpdated(new Date())
    } catch (e) {
      console.error('fetch failed:', url, e)
      if (alive.current) setError(e.message || 'fetch failed')
    } finally {
      if (alive.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, enabled])

  useEffect(() => {
    alive.current = true
    setLoading(true)
    load()
    const id = refreshInterval ? setInterval(load, refreshInterval) : null
    return () => {
      alive.current = false
      if (id) clearInterval(id)
    }
  }, [load, refreshInterval])

  const refresh = useCallback(() => {
    setLoading(true)
    load()
  }, [load])

  return { data, loading, error, lastUpdated, refresh }
}
