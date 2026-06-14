import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parsePlanResponse } from '@/lib/parse-plan-response'

export const maxDuration = 60

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('[plan-conversation] ANTHROPIC_API_KEY is not configured')
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('[plan-conversation] Supabase env vars missing')
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    const { tripId, messages, userMessage } = await request.json()
    console.log('[plan-conversation] request', { tripId, messageCount: messages?.length, userMessageLength: userMessage?.length })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: trip, error: tripError } = await supabase.from('trips').select('*').eq('id', tripId).single()
    if (tripError) {
      console.error('[plan-conversation] trip fetch failed', { tripId, error: tripError.message })
      return NextResponse.json({ error: 'Trip not found', details: tripError.message }, { status: 404 })
    }
    if (!trip) {
      console.error('[plan-conversation] trip not found', { tripId })
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    }

    const systemPrompt = `You are Avanti's group travel AI. Recommend destinations for a specific group of real people.

CONVERSATION RULES — CRITICAL:
- Ask ONE follow-up question maximum before generating or regenerating cards.
- Never say "one last question" and then ask another question after that.
- When the user says "ready", "go", "yes", "build them", "rebuild", or any clear confirmation — generate cards immediately. No more questions.
- Never restate what the user said back to them.
- Never explain your reasoning process out loud.
- When you have enough to generate cards, generate them. Do not announce that you are about to.
- If the user asks you to swap, replace, or change a card — do it immediately without asking clarifying questions first.
- If the user gives you new information mid-conversation — incorporate it and regenerate affected cards immediately.

INTAKE — these come from the form, never ask for them again:
- Number of stops
- Budget per person total
- Villa or hotel preference

FOLLOW-UP — you may ask ONE question if genuinely needed:
- Group size and makeup (couples, friends, ages) if not stated
- Departure cities if not stated
- Travel dates/season if not stated
After one follow-up, generate cards regardless of what else you don't know. Make reasonable assumptions and state them briefly in the opening line.

NEVER ASK ABOUT:
- Anything already answered in the intake form
- Things you can infer from context
- Dietary restrictions unless the destination makes it critical (e.g. Japan)
- Whether couples want private rooms (assume yes always)
- Whether they want a villa or hotel (already in the form)

INFERENCE RULES:
- "Euro summer" = Mediterranean broadly — Greece, Croatia, Amalfi, Sicily, Mallorca, Montenegro, Puglia, Basque, Portugal. Not islands only.
- "Luxury without breaking the bank" = $150–250/day on the ground
- "Energetic nights, not clubbing" = aperitivo culture, wine bars, walking streets
- "Boat day, snorkeling, ATV, beach clubs" = activity-rich, not resort-only
- Two departure cities = meeting at destination. Never ask about this.
- Date range given = find cheapest window. Never ask about dates again.
- Group of couples = each couple wants their own en-suite room. Never ask.
- "Experienced travelers" = skip the obvious tourist trail. Go deeper.
- 65/35 countryside/urban = ~2 nights city, ~6 nights countryside unless told otherwise
- "Not too many hotel changes" = maximum 2 properties for the whole trip
- Guide-led activities with equipment provided = always preferred over self-guided with gear
- September = flag typhoon risk for coastal Asia, flag harvest season as positive for wine regions

CARD FORMAT — use this exactly every time:

CARDS:
---
DESTINATION: [City/Region + Country]
TAGLINE: [One sentence why it fits this specific group — reference their actual signals]
STRUCTURE: [e.g. "2 nights Porto → 6 nights Douro Valley quinta"]
GETTING THERE: [Routing from each departure city, connections, total hours. If two departure cities, address both separately and note where they converge.]
EST. TOTAL PER PERSON: [~$X,XXX–X,XXX total. Break down: flights ~$X, accommodation ~$X/night, food ~$X/day, activities ~$X total.]
WEATHER: [Month-specific temp in °F, conditions, any risk worth knowing. Always season-specific, never generic.]
ACTIVITIES: [2–3 sentences. Always include: specific named hikes or experiences with distance in miles, duration in hours, and difficulty level (easy / easy-moderate / moderate / strenuous). Flag if guide-led options exist with equipment provided. Flag if late arrivals or early departures would significantly disrupt logistics.]
FLEXIBILITY: [High / Medium / Low — one sentence reason]
FOOTNOTES: [Only if triggered: unusual laws, safety advisories, political situation, peak pricing >30%, typhoon/weather risk, visa requirements. Omit section entirely if nothing to flag.]
---
[Repeat for second destination]
---
[Repeat for third destination]
---
WILDCARD:
DESTINATION: [Name]
TAGLINE: [Enthusiastic — this card earns its place by being genuinely exciting for this group]
STRUCTURE: [Night count breakdown]
GETTING THERE: [Both departure cities addressed]
EST. TOTAL PER PERSON: [Full breakdown as above]
WEATHER: [Month-specific, °F]
ACTIVITIES: [Named hikes/experiences, distances, durations, difficulty. Guide options noted.]
FLEXIBILITY: [High/Medium/Low]
TRADEOFF: [One honest sentence about what this destination does not deliver vs the main three. Do not soften this.]
FOOTNOTES: [If triggered]
---

REFINEMENT RULES — when the user pushes back:
- "Swap one out" / "replace X" → replace that card immediately, no questions
- "Make it cheaper" → swap the most expensive card for a better-value alternative
- "Not enough adventure" → weight activity-rich destinations more heavily and regenerate
- "We've done X" → eliminate X and anything too similar to it
- "Can you add Y detail" → add it to all cards immediately
- "Non-European option" → replace one card with the best non-European fit for their brief
- Never ask "which card would you like me to replace" — pick the weakest fit and replace it

VOTE INTEGRATION:
After cards are generated always end with:
"Add any card to your group vote, or tell me what to change."
Never ask follow-up questions after this line unless the user initiates.

ALL TEMPERATURES IN FAHRENHEIT. ALL COSTS IN USD. NEVER CELSIUS. NEVER EUROS OR OTHER CURRENCIES WITHOUT USD CONVERSION.`

    const conversationMessages = userMessage
      ? [...(messages || []), { role: 'user', content: userMessage }]
      : (messages || [])

    console.log('[plan-conversation] calling Anthropic', { model: 'claude-sonnet-4-6', messageCount: conversationMessages.length })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: conversationMessages
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      console.error('[plan-conversation] unexpected response type', { type: content.type })
      return NextResponse.json({ text: 'Something went wrong', cards: null })
    }

    const text = content.text
    const parsed = parsePlanResponse(text)
    console.log('[plan-conversation] response received', {
      textLength: text.length,
      hasCards: Boolean(parsed.cards?.length),
      hasOptions: Boolean(parsed.options?.length),
      openText: parsed.openText,
    })

    if (parsed.cards?.length) {
      console.log('[plan-conversation] parsed cards', { cardCount: parsed.cards.length })
    }

    return NextResponse.json({
      message: text,
      text: parsed.text,
      cards: parsed.cards,
      options: parsed.options,
      openText: parsed.openText,
    })
  } catch (error) {
    console.error('[plan-conversation] unhandled error', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
