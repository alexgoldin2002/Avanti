import { supabase } from '@/lib/supabase'
import type {
  DestinationMatrixCombo,
  DestinationMatrixRow,
} from '@/lib/parse-destination-matrix'
import type { MatrixGenerationMode } from '@/lib/generate-destination-matrix'
import type { MatrixTabId } from '@/lib/matrix-trip-shape'
import type { ChatMessage } from '@/lib/infer-trip-context'

async function authHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }
  return headers
}

export async function fetchDestinationMatrix(opts: {
  tripId: string
  answers: Record<string, unknown>
  consideringList?: string[]
  messages?: ChatMessage[]
  mode?: MatrixGenerationMode
}): Promise<{
  matrix: DestinationMatrixRow[]
  pairings: DestinationMatrixCombo[]
  triples: DestinationMatrixCombo[]
  summary: string
  recommendedTab: MatrixTabId | null
  recommendedShape: string
}> {
  const res = await fetch('/api/generate-destination-matrix', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      tripId: opts.tripId,
      answers: opts.answers,
      messages: opts.messages ?? [],
      consideringList: opts.consideringList ?? [],
      mode: opts.mode,
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || 'Failed to generate comparison')
  }

  return {
    matrix: data.matrix as DestinationMatrixRow[],
    pairings: (data.pairings as DestinationMatrixCombo[]) || [],
    triples: (data.triples as DestinationMatrixCombo[]) || [],
    summary: data.summary || '',
    recommendedTab: data.recommendedTab || null,
    recommendedShape: data.recommendedShape || '',
  }
}

export async function fetchRegenerateMatrixRow(opts: {
  tripId: string
  answers: Record<string, unknown>
  replaceName: string
  keepNames: string[]
  messages?: ChatMessage[]
  mode?: MatrixGenerationMode
}): Promise<DestinationMatrixRow> {
  const res = await fetch('/api/generate-destination-matrix/regenerate-row', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      tripId: opts.tripId,
      answers: opts.answers,
      messages: opts.messages ?? [],
      replaceName: opts.replaceName,
      keepNames: opts.keepNames,
      mode: opts.mode,
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || 'Failed to regenerate destination')
  }

  return data.row as DestinationMatrixRow
}
