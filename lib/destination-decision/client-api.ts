import { supabase } from '@/lib/supabase'

async function authHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }
  return headers
}

export async function fetchDecision(tripId: string) {
  const res = await fetch(`/api/destinations/decision/${tripId}`, {
    headers: await authHeaders(),
  })
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to load')
  return res.json()
}

export async function beginStep2(
  tripId: string,
  window: { days?: number; hours?: number; minutes?: number }
) {
  const res = await fetch(`/api/trips/${tripId}/begin-step-2`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(window),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to start Step 2')
  return data
}

export async function submitTripCards(tripId: string, selectedCardNames: string[]) {
  const res = await fetch('/api/destinations/decision/submit-cards', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ tripId, selectedCardNames }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to submit cards')
  return data
}

export async function startDecision(tripId: string, submissionHours = 48) {
  const res = await fetch('/api/destinations/decision/start', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ tripId, submissionHours }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to start')
  return data
}

export async function suggestDestination(decisionId: string, name: string, note?: string) {
  const res = await fetch('/api/destinations/decision/suggest', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ decisionId, name, note }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to suggest')
  return data
}

export async function closeSubmissions(decisionId: string) {
  const res = await fetch('/api/destinations/decision/close-submissions', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ decisionId }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to close')
  return data
}

export async function extendSubmissionWindow(
  tripId: string,
  window: { days?: number; hours?: number; minutes?: number }
) {
  const res = await fetch('/api/destinations/decision/extend-submission', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ tripId, ...window }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to extend window')
  return data as {
    ok: boolean
    submissionDeadline: string
    status: string
    reopened?: boolean
  }
}

export async function retryAnalysis(decisionId: string) {
  const res = await fetch('/api/destinations/decision/retry-analysis', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ decisionId }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to start analysis')
  return data
}

export async function submitMetaVote(decisionId: string, priority: 'budget' | 'experience' | 'balance') {
  const res = await fetch('/api/destinations/decision/meta-vote', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ decisionId, priority }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed')
  return data
}

export async function submitOptionVote(payload: {
  optionId: string
  desireScore?: number
  approved?: boolean
  toggles?: { flight?: string; dates?: string }
  privateMax?: boolean
}) {
  const res = await fetch('/api/destinations/decision/vote', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed')
  return data
}

export async function submitConfirmation(decisionId: string, confirmed: boolean, statedMaxCost?: number) {
  const res = await fetch('/api/destinations/decision/confirm', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ decisionId, confirmed, statedMaxCost }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed')
  return data
}

export async function lockDestination(decisionId: string, optionId: string) {
  const res = await fetch('/api/destinations/decision/lock', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ decisionId, optionId }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to lock')
  return data
}

export async function openVotingNow(decisionId: string) {
  const res = await fetch('/api/destinations/decision/open-voting', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ decisionId }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed')
  return data
}

export async function tickDecision(tripId: string) {
  const res = await fetch('/api/destinations/decision/tick', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ tripId }),
  })
  return res.json()
}

export function timeLeft(deadline: string | null): string | null {
  if (!deadline) return null
  const diff = new Date(deadline).getTime() - Date.now()
  if (diff <= 0) return 'Closed'
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h left`
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 0) return `${hours}h ${mins}m left`
  return `${mins}m left`
}

export function formatCost(n: number | null | undefined): string {
  if (n == null || n <= 0) return '—'
  return `$${Math.round(n).toLocaleString()}`
}

export const TIER_LABELS: Record<string, string> = {
  budget: 'Budget',
  mid: 'Mid',
  luxury: 'Luxury',
}

export const WORKS_LABELS: Record<string, string> = {
  yes: 'Yes',
  tight: 'Tight',
  no: 'No',
}

export const STATUS_HEADINGS: Record<string, string> = {
  suggestions_open: 'Submission window open',
  analyzing: 'Avanti is analyzing your options',
  meta_vote: 'Set your group priority',
  voting: 'Vote on destinations',
  results: 'Group results',
  confirming: 'Confirm your spot',
  locked: 'Destination locked',
  draft: 'Waiting for trip cards',
}
