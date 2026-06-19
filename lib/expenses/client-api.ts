import { supabase } from '@/lib/supabase'
import type { ExpenseInput, ExpenseRecord } from './types'

async function authHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }
  return headers
}

export async function fetchTripExpenses(tripId: string): Promise<ExpenseRecord[]> {
  const res = await fetch(`/api/expenses/${tripId}`, { headers: await authHeaders() })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to load expenses')
  return data.expenses as ExpenseRecord[]
}

export async function createTripExpenses(tripId: string, expenses: ExpenseInput[]): Promise<ExpenseRecord[]> {
  const res = await fetch(`/api/expenses/${tripId}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ expenses }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to save expenses')
  return data.expenses as ExpenseRecord[]
}

export async function updateTripExpense(
  tripId: string,
  id: string,
  patch: { settled?: boolean }
): Promise<ExpenseRecord> {
  const res = await fetch(`/api/expenses/${tripId}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify({ id, ...patch }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to update expense')
  return data.expense as ExpenseRecord
}

export async function deleteTripExpense(tripId: string, id: string): Promise<void> {
  const res = await fetch(`/api/expenses/${tripId}`, {
    method: 'DELETE',
    headers: await authHeaders(),
    body: JSON.stringify({ id }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to delete expense')
}
