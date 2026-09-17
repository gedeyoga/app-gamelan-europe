import { useEffect, useState } from 'react'

// Debounce nilai search agar tidak membanjiri list API server-side.
// Dipakai semua page CRUD: const debouncedSearch = useDebouncedValue(search, 400)
export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
