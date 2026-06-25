import Anthropic from '@anthropic-ai/sdk'
import type { RoundOneContent, RoundTwoPersonalContent } from '@/lib/voting/types'
import { summarizeStep2ForPrompt } from '@/lib/voting/step2-preferences'

const client = new Anthropic()
const VOTING_MODEL = 'claude-sonnet-4-6'

function parseJsonFromModel(text: string): Record<string, unknown> {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = fenced ? fenced[1].trim() : trimmed
  return JSON.parse(raw) as Record<string, unknown>
}

export const VOTING_SYSTEM_PROMPT = `You are a knowledgeable travel concierge with deep expertise in global destinations. You write clearly, specifically, and honestly. You never use generic filler phrases like "something for everyone" or "a destination not to be missed." Recommend specific establishments, neighborhoods, and landmarks — not "try local street food" without naming where. Every sentence should contain specific, useful information. When asked to be brief, be brief. When asked to be personal, be personal. Always return valid JSON and nothing else — no preamble, no explanation, no markdown.`

export async function generateRoundOneContent(input: {
  destinationName: string
  country?: string | null
  travelDatesLabel?: string
}): Promise<RoundOneContent> {
  const res = await client.messages.create({
    model: VOTING_MODEL,
    max_tokens: 1024,
    system: VOTING_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `<context>
Destination: "${input.destinationName}"${input.country ? ` (${input.country})` : ''}
Travel dates: ${input.travelDatesLabel || 'Summer, flexible'}
Note: live weather and pricing are resolved separately — weather line is a climate fallback only.
</context>

<task>
Generate Round 1 neutral voting card content for this destination.
Use named landmarks and neighborhoods in activities and best_known_for — no generic filler.

Return JSON with exactly these fields:
{
  "overview": "2 to 3 neutral sentences",
  "best_known_for": ["3 to 5 short phrases under 5 words each"],
  "activities": ["4 to 6 short activity phrases with named places, full breadth, not filtered by preferences"],
  "weather": "One line with temperature, rain, and one practical note for the travel dates"
}
</task>`,
      },
    ],
  })

  const text = res.content.find(c => c.type === 'text')?.text || '{}'
  return parseJsonFromModel(text) as RoundOneContent
}

export async function generateRoundTwoPersonalContent(input: {
  destinationName: string
  travelerPreferences: Record<string, unknown>
  travelDatesLabel?: string
  destinationContext?: string
}): Promise<RoundTwoPersonalContent> {
  const prefs = summarizeStep2ForPrompt(input.travelerPreferences)
  const res = await client.messages.create({
    model: VOTING_MODEL,
    max_tokens: 1024,
    system: VOTING_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `<context>
Destination: "${input.destinationName}"
Travel dates: ${input.travelDatesLabel || 'Summer'}
${input.destinationContext ? `Card context:\n${input.destinationContext}\n` : ''}
Traveler preferences from Step 2 Brainstorm:
${prefs}
</context>

<task>
Write a personalized Round 2 voting panel for "${input.destinationName}" ONLY.

Rules:
- Every sentence must reference "${input.destinationName}" or a specific place within it
- Map their stated activities, vibe, budget, and accommodation to what they would enjoy HERE
- top_picks_for_you must name specific experiences or places IN this destination — not generic activity labels
- Never copy generic Mediterranean or Santorini examples unless the destination is Santorini

Return JSON only:
{
  "personal_fit_summary": "2-3 sentences mapping their stated preferences to ${input.destinationName}",
  "top_picks_for_you": ["3 specific named activities or experiences in ${input.destinationName}"],
  "watch_out_for": "One honest practical flag for this destination and their preferences",
  "fit_score": 7
}
fit_score is integer 1-10.
</task>`,
      },
    ],
  })

  const text = res.content.find(c => c.type === 'text')?.text || '{}'
  const parsed = parseJsonFromModel(text) as RoundTwoPersonalContent
  return {
    ...parsed,
    fit_score: Math.max(1, Math.min(10, Math.round(Number(parsed.fit_score) || 5))),
  }
}
