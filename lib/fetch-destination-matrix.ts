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

function matrixFetchError(res: Response, data: { error?: string }): Error {
  if (res.status === 504) {
    return new Error('Generation timed out — please try again in a moment.')
  }
  if (res.status === 401) {
    return new Error('Your session expired — refresh the page and sign in again.')
  }
  return new Error(data.error || 'Failed to generate comparison')
}

async function postMatrixPhase(
  body: Record<string, unknown>,
): Promise<Response> {
  return fetch('/api/generate-destination-matrix', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
}

export async function fetchDestinationMatrix(opts: {
  tripId: string
  answers: Record<string, unknown>
  consideringList?: string[]
  messages?: ChatMessage[]
  mode?: MatrixGenerationMode
  onStatus?: (message: string) => void
}): Promise<{
  matrix: DestinationMatrixRow[]
  pairings: DestinationMatrixCombo[]
  triples: DestinationMatrixCombo[]
  summary: string
  recommendedTab: MatrixTabId | null
  recommendedShape: string
}> {
  const baseBody = {
    tripId: opts.tripId,
    answers: opts.answers,
    messages: opts.messages ?? [],
    consideringList: opts.consideringList ?? [],
    mode: opts.mode,
  }

  opts.onStatus?.('Scoring destinations against your preferences…')
  const matrixRes = await postMatrixPhase({ ...baseBody, phase: 'matrix' })
  const matrixData = await matrixRes.json().catch(() => ({}))
  if (!matrixRes.ok) {
    throw matrixFetchError(matrixRes, matrixData)
  }

  const matrix = matrixData.matrix as DestinationMatrixRow[]
  if (!matrix?.length) {
    throw new Error('Could not parse destination scores — try again')
  }

  opts.onStatus?.('Building pairings and multi-stop routes…')
  const routesRes = await postMatrixPhase({
    ...baseBody,
    phase: 'routes',
    destinationNames: matrix.map(row => row.name),
  })
  const routesData = await routesRes.json().catch(() => ({}))
  if (!routesRes.ok) {
    throw matrixFetchError(routesRes, routesData)
  }

  return {
    matrix,
    pairings: (routesData.pairings as DestinationMatrixCombo[]) || [],
    triples: (routesData.triples as DestinationMatrixCombo[]) || [],
    summary: routesData.summary || '',
    recommendedTab: routesData.recommendedTab || null,
    recommendedShape: routesData.recommendedShape || '',
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
