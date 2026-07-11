import { supabase } from '@/lib/supabase'
import {
  sortMatrixRowsByScore,
  type DestinationMatrixCombo,
  type DestinationMatrixRow,
} from '@/lib/parse-destination-matrix'
import {
  BRAINSTORM_MATRIX_DESTINATION_COUNT,
  type MatrixGenerationMode,
} from '@/lib/generate-destination-matrix'
import {
  PAIRING_CATEGORY_ORDER,
  PAIRING_CATEGORY_SECTION_LABELS,
} from '@/lib/matrix-pairing-categories'
import { coerceMatrixRecommendedTab, shouldIncludeTripleRoutes, type MatrixTabId } from '@/lib/matrix-trip-shape'
import type { ChatMessage } from '@/lib/infer-trip-context'

export const MATRIX_GENERATION_TIME_HINT =
  'This usually takes 2–3 minutes to build your destination options.'

function formatMatrixProgress(completed: number, total: number, label: string): string {
  const percent = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0
  return `${percent}% done — ${label}`
}

export function parseMatrixProgressStatus(status: string | null): {
  percent: number | null
  label: string
} {
  if (!status) {
    return {
      percent: null,
      label: 'Weighing destinations against your vibe, budget, and deal breakers…',
    }
  }
  const match = status.match(/^(\d+)% done — (.+)$/)
  if (match) {
    return { percent: Number(match[1]), label: match[2] }
  }
  return { percent: null, label: status }
}

function matrixGenerationStepCount(
  mode: MatrixGenerationMode,
  answers: Record<string, unknown>,
  consideringCount: number,
): number {
  const rowCount =
    mode === 'considering' ? consideringCount : BRAINSTORM_MATRIX_DESTINATION_COUNT
  const includeTriples = shouldIncludeTripleRoutes(answers) && rowCount >= 3
  return rowCount + PAIRING_CATEGORY_ORDER.length + (includeTriples ? 1 : 0) + 1
}

type MatrixFetchOpts = {
  tripId?: string
  preview?: boolean
  planningPath?: 'considering' | 'brainstorm'
  answers: Record<string, unknown>
  consideringList?: string[]
  messages?: ChatMessage[]
  mode?: MatrixGenerationMode
  onStatus?: (message: string) => void
}

type MatrixFetchResult = {
  matrix: DestinationMatrixRow[]
  pairings: DestinationMatrixCombo[]
  triples: DestinationMatrixCombo[]
  summary: string
  recommendedTab: MatrixTabId | null
  recommendedShape: string
}

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

async function postMatrixPhase(body: Record<string, unknown>): Promise<Response> {
  return fetch('/api/generate-destination-matrix', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
}

async function postMatrixPhaseWithRetry(
  body: Record<string, unknown>,
  retries = 2,
): Promise<{ res: Response; data: Record<string, unknown> }> {
  let lastRes: Response | null = null
  let lastData: Record<string, unknown> = {}

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await postMatrixPhase(body)
    const data = await res.json().catch(() => ({}))
    if (res.ok) return { res, data }
    lastRes = res
    lastData = data
    const retryable = res.status === 504 || res.status === 502 || res.status === 500
    if (!retryable || attempt === retries) break
    await new Promise(resolve => setTimeout(resolve, 1200 * (attempt + 1)))
  }

  return { res: lastRes!, data: lastData }
}

const MATRIX_ROW_ATTEMPTS = 3

async function fetchBrainstormMatrixRow(
  baseBody: Record<string, unknown>,
  existingNames: string[],
  onProgress?: (label: string) => void,
  slot = 1,
  total = BRAINSTORM_MATRIX_DESTINATION_COUNT,
): Promise<DestinationMatrixRow> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < MATRIX_ROW_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      onProgress?.(`Retrying destination ${slot} of ${total}…`)
      await new Promise(resolve => setTimeout(resolve, 1200 * attempt))
    }

    const { res, data } = await postMatrixPhaseWithRetry({
      ...baseBody,
      phase: 'matrix-row',
      existingNames,
    })

    if (!res.ok) {
      lastError = matrixFetchError(res, data)
      continue
    }

    const row = data.row as DestinationMatrixRow | undefined
    if (row?.name) return row
    lastError = new Error('Could not parse destination — try again')
  }

  throw lastError ?? new Error('Could not parse destination — try again')
}

async function fetchMatrixBatched(opts: MatrixFetchOpts): Promise<MatrixFetchResult> {
  const isPreview = opts.preview || !opts.tripId
  const baseBody: Record<string, unknown> = {
    answers: opts.answers,
    messages: opts.messages ?? [],
    consideringList: opts.consideringList ?? [],
    mode: opts.mode,
  }
  if (isPreview) {
    baseBody.preview = true
    baseBody.planningPath = opts.planningPath
  } else {
    baseBody.tripId = opts.tripId
  }

  const mode =
    opts.mode ??
    (opts.planningPath === 'considering' || (opts.consideringList?.length ?? 0) > 0
      ? 'considering'
      : 'brainstorm')
  const matrix: DestinationMatrixRow[] = []
  const totalSteps = matrixGenerationStepCount(
    mode,
    opts.answers,
    opts.consideringList?.length ?? 0,
  )
  let completedSteps = 0

  const report = (label: string) => {
    opts.onStatus?.(formatMatrixProgress(completedSteps, totalSteps, label))
  }

  const finishStep = (label: string) => {
    completedSteps += 1
    opts.onStatus?.(formatMatrixProgress(completedSteps, totalSteps, label))
  }

  if (mode === 'considering') {
    const list = opts.consideringList ?? []
    for (let i = 0; i < list.length; i++) {
      const destinationName = list[i]
      let lastError: Error | null = null
      for (let attempt = 0; attempt < MATRIX_ROW_ATTEMPTS; attempt++) {
        report(
          attempt > 0
            ? `Retrying ${destinationName.split(',')[0]?.trim() || destinationName}…`
            : `Scoring ${destinationName.split(',')[0]?.trim() || destinationName}…`,
        )
        const { res, data } = await postMatrixPhaseWithRetry({
          ...baseBody,
          phase: 'matrix-row',
          destinationName,
        })
        if (!res.ok) {
          lastError = matrixFetchError(res, data)
          continue
        }
        const row = data.row as DestinationMatrixRow | undefined
        if (row?.name) {
          matrix.push(row)
          lastError = null
          finishStep(`Scored ${row.name.split(',')[0]?.trim() || row.name}`)
          break
        }
        lastError = new Error('Could not parse destination — try again')
      }
      if (lastError) throw lastError
    }
  } else {
    const existingNames: string[] = []
    for (let i = 0; i < BRAINSTORM_MATRIX_DESTINATION_COUNT; i++) {
      report(`Researching destination ${i + 1} of ${BRAINSTORM_MATRIX_DESTINATION_COUNT}…`)
      const row = await fetchBrainstormMatrixRow(
        baseBody,
        existingNames,
        label => report(label),
        i + 1,
        BRAINSTORM_MATRIX_DESTINATION_COUNT,
      )
      matrix.push(row)
      existingNames.push(row.name)
      finishStep(`Researched ${row.name.split(',')[0]?.trim() || row.name}`)
    }
  }

  sortMatrixRowsByScore(matrix)
  if (matrix.length === 0) {
    throw new Error('Could not parse destination scores — try again')
  }

  const destinationNames = matrix.map(row => row.name)
  const pairings: DestinationMatrixCombo[] = []

  for (const category of PAIRING_CATEGORY_ORDER) {
    report(`Building ${PAIRING_CATEGORY_SECTION_LABELS[category].toLowerCase()}…`)
    const { res, data } = await postMatrixPhaseWithRetry({
      ...baseBody,
      phase: 'pairing-category',
      destinationNames,
      pairingCategory: category,
    })
    if (!res.ok) throw matrixFetchError(res, data)
    pairings.push(...((data.pairings as DestinationMatrixCombo[]) || []))
    finishStep(`Built ${PAIRING_CATEGORY_SECTION_LABELS[category].toLowerCase()}`)
  }

  let triples: DestinationMatrixCombo[] = []
  if (shouldIncludeTripleRoutes(opts.answers) && destinationNames.length >= 3) {
    report('Building three-stop routes…')
    const { res, data } = await postMatrixPhaseWithRetry({
      ...baseBody,
      phase: 'triples',
      destinationNames,
    })
    if (!res.ok) throw matrixFetchError(res, data)
    triples = (data.triples as DestinationMatrixCombo[]) || []
    finishStep('Built three-stop routes')
  }

  report('Finalizing recommendations…')
  const { res: recRes, data: recData } = await postMatrixPhaseWithRetry({
    ...baseBody,
    phase: 'recommendations',
    destinationNames,
  })
  if (!recRes.ok) throw matrixFetchError(recRes, recData)
  finishStep('Recommendations ready')

  return {
    matrix,
    pairings,
    triples,
    summary: (recData.summary as string) || '',
    recommendedTab: coerceMatrixRecommendedTab(
      (recData.recommendedTab as MatrixTabId | null) || null,
      opts.answers,
    ),
    recommendedShape: (recData.recommendedShape as string) || '',
  }
}

export async function fetchDestinationMatrix(opts: MatrixFetchOpts & { tripId: string }) {
  return fetchMatrixBatched(opts)
}

export async function fetchPreviewDestinationMatrix(
  opts: Omit<MatrixFetchOpts, 'tripId' | 'preview'> & {
    planningPath: 'considering' | 'brainstorm'
  },
) {
  return fetchMatrixBatched({ ...opts, preview: true })
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
