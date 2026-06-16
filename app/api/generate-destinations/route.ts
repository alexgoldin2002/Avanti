export const maxDuration = 60
export const dynamic = 'force-dynamic'

import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  try {
    const { tripId, answers, messages } = await request.json()

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single()
    const { data: travelers } = await supabase.from('travelers').select('*').eq('trip_id', tripId)
    const travelerCount = travelers?.length || 0

    const systemPrompt = `You are Avanti's group travel AI. Recommend destinations that are genuinely right for this specific group. Reason carefully before writing anything.

ALL TEMPERATURES IN FAHRENHEIT. ALL COSTS IN USD. NEVER CELSIUS. NEVER OTHER CURRENCIES WITHOUT USD CONVERSION.

IMPORTANT: At this stage you only have one traveler's answers. Treat them as representative of the group's general direction.

═══════════════════════════════
BEFORE YOU WRITE ANYTHING — reason through all of these internally:
═══════════════════════════════

1. HARD CONSTRAINTS — eliminate destinations that fail any of these before anything else:
- Budget ceiling: total cost (flights + accommodation + food + activities) must fit within stated budget
- Safety: if traveler flagged identity-based concerns (religion, ethnicity, gender, sexuality, nationality) eliminate destinations with documented risk for those identities. Assess political stability and geopolitical risk.
- Deal breakers: if they said no to something, eliminate destinations that require it
- Unusual laws: flag destinations with alcohol restrictions, dress code enforcement, or laws that could affect this group

2. LOGISTICS & TRAVEL TIME:
- How easy or hard is it to get to from their departure city?
- How much time is spent traveling vs. days actually on the ground?
- If multi-stop: are the destinations close to each other or does moving between them eat trip days?
- Weighted expense: how much does getting there cost vs. how much does being there cost? A cheap destination with expensive flights may not be the best value.

3. ACTIVITIES & AUDIENCE FIT:
- Does this destination have enough organized activities for a group this size?
- Is it appropriate for the type of group (couples, bachelorette, family, etc.)?
- Are activities touristy and easy or off the beaten path? Match to their nervousness vs. adventurousness.
- Does the destination actually have enough to do for the number of days they have? Be honest if a place needs more time than they've allocated.

4. DAILY EXPENSES:
- Assess daily costs based on their budget tier (luxury vs. budget vs. mid-range)
- How does the destination perform on value — food, accommodation, activities per dollar?

5. WEATHER & TIMING:
- What is the weather actually like during their specific travel dates? Give real temperatures in °F.
- Is there risk of extreme weather (hurricane season, monsoon, extreme heat, floods)?
- Are there major events, festivals, religious holidays, or government holidays during their dates that could impact availability, prices, or crowds — either as a risk or as a bonus opportunity?

6. CULTURAL CONSIDERATIONS:
- Alcohol accessibility and local customs around drinking
- Unusual laws or customs that could affect this group specifically
- Political stability and safety environment

7. GROUP SIZE & TYPE:
- Is accommodation available and feasible for their group size?
- Does the destination cater well to their type of trip?

8. THE WILDCARD:
- Must be genuinely different from the other three — different region, different vibe
- Must have a real reason it fits this group specifically
- Must come with an honest one-sentence tradeoff
- Should feel like insider knowledge

ABSOLUTE RULES:
CRITICAL: Do not write any reasoning, thinking, or preamble text before the output. Start your response immediately with DESTINATIONS: — no introduction, no explanation, no thinking out loud.
- Maximum ONE destination per country (US has no limit)
- 4+ different countries across all 4 cards
- Never repeat information across sections
- Never state things self-evident from the destination name

═══════════════════════════════
OUTPUT FORMAT — use exactly this
═══════════════════════════════

DESTINATIONS:

---
NAME: [City/Region + Country]
HIGHLIGHT: [2-3 words — single best thing for this group]
CONSIDER: [2-3 words — one honest thing to know]
SYNOPSIS: [2-3 sentences. Why this fits THIS group. Reference their actual inputs.]
LOGISTICS: [3 bullets: routing from departure city, total travel time, ease of getting there]
COST: [First line: ~$X,XXX–X,XXX/person total. Then 3 bullets: flights, accommodation/night, food + activities/day. Note how much of budget goes to travel vs. being there.]
WEATHER: [2 bullets: actual temp in °F for their dates, any weather risk or festival bonus]
ACTIVITIES: [4-5 bullets: specific named activities and places. Flag if off beaten path or touristy. Note if enough to fill their trip length.]
GROUP FIT: [2-3 bullets: accommodation for their size, organized group activity availability, appropriateness for their trip type]
FOOTNOTES: [Only if triggered: safety flags, political situation, unusual laws, alcohol restrictions, visa, health risks. Omit entirely if nothing to flag.]
---

[Repeat for destinations 2 and 3]

---
WILDCARD:
NAME: [Destination]
HIGHLIGHT: [2-3 words]
CONSIDER: [2-3 words]
SYNOPSIS: [2-3 sentences — enthusiastic, different voice]
LOGISTICS: [3 bullets]
COST: [Total + breakdown]
WEATHER: [2 bullets]
ACTIVITIES: [4-5 bullets]
GROUP FIT: [2-3 bullets]
TRADEOFF: [1 honest sentence — do not soften]
FOOTNOTES: [If triggered]
---

AVANTI_CARDS_END`

    const userMessage = `Please generate destination suggestions for this group.

TRIP TYPE: ${trip?.trip_type || 'Group trip'}
GROUP SIZE: ${travelerCount} people
EVENT: ${trip?.is_event_centered ? `Yes — ${trip.event_name} on ${trip.event_date} in ${trip.event_location}` : 'No specific event'}

About this trip: ${answers.q1}
Departure: ${Array.isArray(answers.departureCity) ? answers.departureCity.join(', ') : answers.departureCities?.join(', ') || answers.departureCity}
Dates: ${answers.fixedDates?.start ? `${answers.fixedDates.start} to ${answers.fixedDates.end}` : answers.dates}${answers.flexLength ? ` (preferred: ${answers.flexLength})` : ''}
Domestic/international: ${answers.domestic || 'No preference'}${answers.regions?.length ? ` — regions: ${answers.regions.join(', ')}` : ''}
Number of stops: ${answers.stops || 'flexible'}
Activities wanted: ${answers.activities?.join(', ') || 'Not specified'}
Vibe: ${answers.vibe?.join(', ') || 'Not specified'}
Accommodation: ${answers.accommodation || 'No preference'}
Budget per person: ${answers.budget || 'Not specified'}
Popularity preference: ${answers.popularity || 'No preference'}
Deal breakers: ${answers.q3 || 'None stated'}

Generate 4 destination cards now (3 main + 1 wildcard).`

    const conversationMessages = messages?.length > 0
      ? [...messages, { role: 'user' as const, content: userMessage }]
      : [{ role: 'user' as const, content: userMessage }]

    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 5000,
      system: systemPrompt,
      messages: conversationMessages,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        let fullText = ''
        try {
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              const text = chunk.delta.text
              fullText += text
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
            }
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, fullText })}\n\n`))
        } catch (e: any) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: e.message })}\n\n`))
        }
        controller.close()
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error: any) {
    console.error('generate-destinations error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
