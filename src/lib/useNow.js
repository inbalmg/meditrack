import { useEffect, useState } from 'react'

// A shared "current time" that updates on an interval (default 60s) so time-derived
// state — the unresolved-past queue, overdue tasks — advances on its own instead of
// waiting for an unrelated re-render. Stable between ticks, so useMemo actually memoizes.
export function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
