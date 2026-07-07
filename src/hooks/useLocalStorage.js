import { useState, useCallback } from 'react'

export default function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw !== null ? JSON.parse(raw) : initial
    } catch {
      return initial
    }
  })
  const set = useCallback(
    (next) => {
      setValue((prev) => {
        const v = typeof next === 'function' ? next(prev) : next
        try {
          localStorage.setItem(key, JSON.stringify(v))
        } catch (e) {
          console.error('localStorage write failed', key, e)
        }
        return v
      })
    },
    [key]
  )
  return [value, set]
}
