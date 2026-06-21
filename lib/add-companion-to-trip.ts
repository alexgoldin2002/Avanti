import { supabase } from '@/lib/supabase'
import type { CompanionInput } from '@/lib/account-companions'

function errorMessage(e: unknown) {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: string }).message)
  return 'Could not add traveler'
}

/** Add a saved or new companion to a trip under the current user's invite. */
export async function addCompanionToTrip(
  tripId: string,
  input: { companion?: CompanionInput & { id?: string }; savedCompanionId?: string }
) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in')

  const res = await fetch(`/api/trips/${tripId}/add-companion`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(input),
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Could not add traveler')
  return body
}

export { errorMessage as companionErrorMessage }
