import type { SupabaseClient } from '@supabase/supabase-js'
import type { RoundTwoPersonalContent } from './types'
import { generateRoundTwoPersonalContent } from './generate-content'
import {
  buildFallbackRoundTwoPersonalContent,
  isPlaceholderPersonalContent,
} from './step2-preferences'

function destinationContextFromCard(cardSnapshot?: Record<string, unknown> | null): string {
  if (!cardSnapshot) return ''
  const parts = [
    cardSnapshot.synopsis,
    cardSnapshot.highlight,
    cardSnapshot.consider,
  ]
    .filter(v => typeof v === 'string' && v.trim())
    .map(v => String(v).trim())
  return parts.join('\n')
}

export async function ensureRoundTwoPersonalContent(
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
  if (input.existingContent && !isPlaceholderPersonalContent(input.existingContent)) {
    return input.existingContent as RoundTwoPersonalContent
  }

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
    content = buildFallbackRoundTwoPersonalContent(
      input.destinationName,
      step2,
      input.cardSnapshot
    )
  }

  if (isPlaceholderPersonalContent(content)) {
    content = buildFallbackRoundTwoPersonalContent(
      input.destinationName,
      step2,
      input.cardSnapshot
    )
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
