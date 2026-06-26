import type { ParsedDestinationCard } from '@/lib/parse-destination-cards'
import type { DestinationMatrixCombo, DestinationMatrixRow } from '@/lib/parse-destination-matrix'
import type { MatrixTabId } from '@/lib/matrix-trip-shape'

export type Step2GenerationSnapshot = {
  answers: Record<string, unknown>
  cards: ParsedDestinationCard[]
  votes: Record<string, boolean>
  stage: 1 | 2 | 3 | 'generate' | 'done'
  consideringList: string[]
  matrixRows: DestinationMatrixRow[]
  matrixPairings: DestinationMatrixCombo[]
  matrixTriples: DestinationMatrixCombo[]
  matrixSummary: string
  matrixRecommendedTab: MatrixTabId | null
  matrixRecommendedShape: string
  savedAt: string
}

export function createGenerationSnapshot(input: {
  answers: Record<string, unknown>
  cards: ParsedDestinationCard[]
  votes: Record<string, boolean>
  stage: Step2GenerationSnapshot['stage']
  consideringList?: string[]
  matrixRows?: DestinationMatrixRow[]
  matrixPairings?: DestinationMatrixCombo[]
  matrixTriples?: DestinationMatrixCombo[]
  matrixSummary?: string
  matrixRecommendedTab?: MatrixTabId | null
  matrixRecommendedShape?: string
}): Step2GenerationSnapshot {
  return {
    answers: { ...input.answers },
    cards: input.cards.map(c => ({ ...c })),
    votes: { ...input.votes },
    stage: input.stage,
    consideringList: [...(input.consideringList ?? [])],
    matrixRows: (input.matrixRows ?? []).map(r => ({ ...r })),
    matrixPairings: (input.matrixPairings ?? []).map(p => ({ ...p })),
    matrixTriples: (input.matrixTriples ?? []).map(t => ({ ...t })),
    matrixSummary: input.matrixSummary ?? '',
    matrixRecommendedTab: input.matrixRecommendedTab ?? null,
    matrixRecommendedShape: input.matrixRecommendedShape ?? '',
    savedAt: new Date().toISOString(),
  }
}

export function snapshotHasContent(snapshot: Step2GenerationSnapshot | null | undefined): boolean {
  if (!snapshot) return false
  return snapshot.cards.length > 0 || snapshot.matrixRows.length > 0
}
