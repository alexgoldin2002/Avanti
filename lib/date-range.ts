// Pure date-range helpers shared by client components AND server routes.
// Keep this file free of 'use client' so it can be imported on the server.

export function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isValidDateRange(start: string, end: string): boolean {
  if (!start || !end) return false
  const today = todayIsoDate()
  if (start < today || end < start) return false
  return end >= start
}
