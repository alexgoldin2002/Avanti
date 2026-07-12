import type Anthropic from '@anthropic-ai/sdk'
import type { MatrixGenerationMode } from '@/lib/step2c/trip-generation-context'
import { assembleTripGenerationContext } from './trip-generation-context'
import {
  SYNTHESIS_SYSTEM_PROMPT,
  buildSynthesisUserMessage,
} from './trip-synthesis-prompt'
import { parseTripBrief } from './parse-trip-brief'
import type { OrganizerDestinationProfile } from './trip-generation-context'

export type TripSynthesisOpts = {
  trip: Record<string, unknown> | null
  travelerCount: number
  answers: Record<string, unknown>
  chatSupplement?: string
  mode?: MatrixGenerationMode
  consideringList?: string[]
  organizerProfile?: OrganizerDestinationProfile | null
}

async function callSynthesisClaude(
  client: Anthropic,
  userMessage: string,
  maxTokens: number,
): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    temperature: 0,
    system: SYNTHESIS_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })
  return response.content
    .filter(b => b.type === 'text')
    .map(b => (b.type === 'text' ? b.text : ''))
    .join('\n')
}

export async function generateTripSynthesis(
  client: Anthropic,
  opts: TripSynthesisOpts,
): Promise<string | null> {
  const mode = opts.mode ?? (opts.consideringList?.length ? 'considering' : 'brainstorm')
  const assembled = assembleTripGenerationContext({
    trip: opts.trip,
    travelerCount: opts.travelerCount,
    answers: opts.answers,
    chatSupplement: opts.chatSupplement,
    mode,
    consideringList: opts.consideringList,
    organizerProfile: opts.organizerProfile,
  })
  const userMessage = buildSynthesisUserMessage(assembled, mode)

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    const text = await callSynthesisClaude(client, userMessage, 6000)
    const brief = parseTripBrief(text)
    if (brief) return brief
    console.warn('generate-trip-synthesis: TRIP_BRIEF parse failed', {
      attempt: attempt + 1,
      preview: text.slice(0, 400),
    })
  }

  return null
}
