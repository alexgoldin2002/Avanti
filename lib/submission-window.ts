export type SubmissionWindowInput = {
  days?: number
  hours?: number
  minutes?: number
}

export function submissionWindowToMinutes(input: SubmissionWindowInput): number {
  const days = Math.max(0, Math.floor(input.days ?? 0))
  const hours = Math.max(0, Math.floor(input.hours ?? 0))
  const minutes = Math.max(0, Math.floor(input.minutes ?? 0))
  const total = days * 24 * 60 + hours * 60 + minutes
  return total > 0 ? total : 48 * 60 // default 48h
}

export function minutesToSubmissionWindow(totalMinutes: number): { days: number; hours: number; minutes: number } {
  const m = Math.max(0, Math.floor(totalMinutes))
  const days = Math.floor(m / (24 * 60))
  const rem = m % (24 * 60)
  const hours = Math.floor(rem / 60)
  const minutes = rem % 60
  return { days, hours, minutes }
}

export function formatSubmissionWindow(totalMinutes: number): string {
  const { days, hours, minutes } = minutesToSubmissionWindow(totalMinutes)
  const parts: string[] = []
  if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`)
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`)
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes} min`)
  return parts.join(', ')
}

export function countdownParts(deadline: string | null): {
  label: string
  done: boolean
  days: number
  hours: number
  minutes: number
  seconds: number
} {
  if (!deadline) {
    return { label: 'No deadline set', done: true, days: 0, hours: 0, minutes: 0, seconds: 0 }
  }
  const diff = new Date(deadline).getTime() - Date.now()
  if (diff <= 0) {
    return { label: 'Window closed', done: true, days: 0, hours: 0, minutes: 0, seconds: 0 }
  }
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)
  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  parts.push(`${hours}h`)
  parts.push(`${minutes}m`)
  parts.push(`${seconds}s`)
  return { label: parts.join(' '), done: false, days, hours, minutes, seconds }
}
