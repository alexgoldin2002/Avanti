import Anthropic from '@anthropic-ai/sdk'
import type { RoundOneContent, RoundTwoPersonalContent } from '@/lib/voting/types'

const client = new Anthropic()

export const VOTING_SYSTEM_PROMPT = `You are a knowledgeable travel concierge with deep expertise in global destinations. You write clearly, specifically, and honestly. You never use generic filler phrases like "something for everyone" or "a destination not to be missed." Every sentence should contain specific, useful information. When asked to be brief, be brief. When asked to be personal, be personal. Always return valid JSON and nothing else — no preamble, no explanation, no markdown.`

export async function generateRoundOneContent(input: {
  destinationName: string
  country?: string | null
  travelDatesLabel?: string
}): Promise<RoundOneContent> {
  const res = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: VOTING_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Generate Round 1 neutral voting card content for "${input.destinationName}"${input.country ? ` (${input.country})` : ''}.
Travel dates context: ${input.travelDatesLabel || 'Summer, flexible'}.

Return JSON with exactly these fields:
{
  "overview": "2 to 3 neutral sentences",
  "best_known_for": ["3 to 5 short phrases under 5 words each"],
  "activities": ["4 to 6 short activity phrases, full breadth, not filtered by preferences"],
  "weather": "One line with temperature, rain, and one practical note for the travel dates"
}`,
      },
    ],
  })

  const text = res.content.find(c => c.type === 'text')?.text || '{}'
  return JSON.parse(text) as RoundOneContent
}

export async function generateRoundTwoPersonalContent(input: {
  destinationName: string
  travelerPreferences: Record<string, unknown>
  travelDatesLabel?: string
}): Promise<RoundTwoPersonalContent> {
  const prefs = JSON.stringify(input.travelerPreferences, null, 2)
  const res = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: VOTING_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Generate personalized Round 2 panel for destination "${input.destinationName}".
Travel dates: ${input.travelDatesLabel || 'Summer'}.
Traveler preferences from Step 2:
${prefs}

Return JSON:
{
  "personal_fit_summary": "2-3 sentences referencing their stated preferences",
  "top_picks_for_you": ["3 personalized activities"],
  "watch_out_for": "One honest practical flag",
  "fit_score": 7
}
fit_score is integer 1-10.`,
      },
    ],
  })

  const text = res.content.find(c => c.type === 'text')?.text || '{}'
  const parsed = JSON.parse(text) as RoundTwoPersonalContent
  return {
    ...parsed,
    fit_score: Math.max(1, Math.min(10, Math.round(Number(parsed.fit_score) || 5))),
  }
}
