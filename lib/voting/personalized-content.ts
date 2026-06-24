import type { SupabaseClient } from '@supabase/supabase-js'
import type { RoundTwoPersonalContent } from './types'
import { generateRoundTwoPersonalContent } from './generate-content'
import { PLACEHOLDER_ROUND_TWO_PERSONAL, STALE_PERSONAL_MARKERS } from './constants'
import { buildFallbackRoundTwoPersonalContent } from './step2-preferences'

function destinationShortName(destinationName: string): string {
  return destinationName.split(',')[0]?.trim() || destinationName
}

function destinationContextFromCard(cardSnapshot?: Record<string, unknown> | null): string {
  if (!cardSnapshot) return ''
  const parts = [cardSnapshot.synopsis, cardSnapshot.highlight, cardSnapshot.consider]
    .filter(v => typeof v === 'string' && v.trim())
    .map(v => String(v).trim())
  return parts.join('\n')
}

export function isPlaceholderPersonalContent(content: unknown): boolean {
  if (!content || typeof content !== 'object') return true
  const c = content as RoundTwoPersonalContent
  return (
    c.personal_fit_summary === PLACEHOLDER_ROUND_TWO_PERSONAL.personal_fit_summary ||
    c.top_picks_for_you?.join('|') === PLACEHOLDER_ROUND_TWO_PERSONAL.top_picks_for_you.join('|')
  )
}

/** Detect cached demo copy or AI that ignored the destination. */
export function isStalePersonalContent(content: unknown, destinationName: string): boolean {
  if (isPlaceholderPersonalContent(content)) return true
  const c = content as RoundTwoPersonalContent
  const summary = c.personal_fit_summary || ''
  const picks = (c.top_picks_for_you || []).join(' ')
  const blob = `${summary} ${picks}`
  const short = destinationShortName(destinationName)
  const isSantorini = /santorini/i.test(destinationName)

  if (!isSantorini && STALE_PERSONAL_MARKERS.some(marker => blob.includes(marker))) {
    return true
  }

  if (short.length >= 4 && !blob.toLowerCase().includes(short.toLowerCase())) {
    return true
  }

  return false
}

export function buildInstantPersonalContent(
  destinationName: string,
  step2: Record<string, unknown> | null | undefined,
  cardSnapshot?: Record<string, unknown> | null
): RoundTwoPersonalContent {
  return buildFallbackRoundTwoPersonalContent(destinationName, step2, cardSnapshot)
}

/** Fast path for GET — never blocks on AI. */
export async function resolveRoundTwoPersonalContent(
  db: SupabaseClient,
  input: {
    tripId: string
    travelerId: string
    destinationAnalysisId: string
    destinationName: string
    cardSnapshot?: Record<string, unknown> | null
    step2: Record<string, unknown> | null | undefined
    travelDatesLabel?: string
    existingContent?: unknown
  }
): Promise<RoundTwoPersonalContent> {
  if (input.existingContent && !isStalePersonalContent(input.existingContent, input.destinationName)) {
    return input.existingContent as RoundTwoPersonalContent
  }

  const content = buildInstantPersonalContent(
    input.destinationName,
    input.step2,
    input.cardSnapshot
  )

  await db.from('round_two_personalized_content').upsert(
    {
      trip_id: input.tripId,
      traveler_id: input.travelerId,
      destination_analysis_id: input.destinationAnalysisId,
      content,
    },
    { onConflict: 'trip_id,traveler_id,destination_analysis_id' }
  )

  return content
}

/** Slow path — AI upgrade, called separately so vote page loads fast. */
export async function generateAndSavePersonalContent(
  db: SupabaseClient,
  input: {
    tripId: string
    travelerId: string
    destinationAnalysisId: string
    destinationName: string
    cardSnapshot?: Record<string, unknown> | null
    step2: Record<string, unknown> | null | undefined
    travelDatesLabel?: string
  }
): Promise<RoundTwoPersonalContent> {
  const step2 = input.step2 || {}
  const destinationContext = destinationContextFromCard(input.cardSnapshot)

  let content: RoundTwoPersonalContent
  try {
    content = await generateRoundTwoPersonalContent({
      destinationName: input.destinationName,
      travelerPreferences: step2,
      travelDatesLabel: input.travelDatesLabel,
      destinationContext,
    })
  } catch {
    content = buildInstantPersonalContent(input.destinationName, step2, input.cardSnapshot)
  }

  if (isStalePersonalContent(content, input.destinationName)) {
    content = buildInstantPersonalContent(input.destinationName, step2, input.cardSnapshot)
  }

  await db.from('round_two_personalized_content').upsert(
    {
      trip_id: input.tripId,
      traveler_id: input.travelerId,
      destination_analysis_id: input.destinationAnalysisId,
      content,
    },
    { onConflict: 'trip_id,traveler_id,destination_analysis_id' }
  )

  return content
}
