import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const client = new Anthropic()

export async function POST(request: NextRequest) {
  try {
    const { tripId } = await request.json()
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single()
    const { data: travelers } = await supabase.from('travelers').select('*').eq('trip_id', tripId)
    const { data: preferences } = await supabase.from('trip_preferences').select('*').eq('trip_id', tripId)
    const { data: travelerProfiles } = await supabase.from('user_profiles').select('*')

    const tripContext = `
TRIP: ${trip.name}
DESTINATION STATUS: ${trip.destination_type === 'flexible' ? 'UNDECIDED - suggest destinations' : `DECIDED - ${trip.destination}`}
DATES: ${trip.start_date ? `${trip.start_date} to ${trip.end_date} (LOCKED)` : trip.date_range_start ? `Flexible window: ${trip.date_range_start} to ${trip.date_range_end}, ~${trip.date_flexibility_nights} nights` : 'TBD'}
TRIP TYPE: ${trip.trip_type || 'Not specified'}
TOTAL TRAVELERS: ${travelers?.length || 0}

TRAVELER PREFERENCES:
${(preferences || []).map((p: any, i: number) => `
Traveler ${i + 1}:
- Departure city: ${p.departure_city || 'not specified'}
- Available: ${p.available_from || '?'} to ${p.available_to || '?'}
- Budget (accommodation per night): comfortable $${p.budget_accommodation_comfortable}, ideal $${p.budget_accommodation_ideal}, max $${p.budget_accommodation_max}
- Budget (dining per day): comfortable $${p.budget_dining_comfortable}, ideal $${p.budget_dining_ideal}, max $${p.budget_dining_max}
- Budget (experiences): comfortable $${p.budget_experience_comfortable}, ideal $${p.budget_experience_ideal}, max $${p.budget_experience_max}
- Vibe tags: ${(p.vibe_tags || []).join(', ') || 'none'}
- Vibe description: ${p.vibe_freetext || 'not provided'}
- Must-dos: ${JSON.stringify(p.must_dos || {})}
`).join('\n')}

CREDIT CARDS & PERKS:
${(travelerProfiles || []).map((p: any) => `${p.full_name}: ${(p.credit_cards || []).join(', ') || 'none'}`).join('\n')}
`

    const prompt = `You are Avanti, the world's smartest luxury travel agent. Analyze this group trip data and generate exactly 3 distinct travel options.

${tripContext}

IMPORTANT RULES:
- If destination is DECIDED and dates are LOCKED, all 3 options keep the same destination and dates but vary the experience, accommodation style, and itinerary focus
- If destination is DECIDED but dates are flexible, vary the optimal travel dates for cheapest flights/weather
- If destination is UNDECIDED, suggest 3 completely different destinations that fit the group's constraints
- Always calculate TRUE cost (hotel + transport + food + activities + hidden fees)
- Flag the Margaritaville problem: if hotel is cheap but far from where they'll actually go out, flag the hidden transport cost
- Detect sub-groups (different departure cities) and note different routing for each
- Flag credit card benefits (free bags, lounge access, travel credits)
- Flag group fare opportunity if 9+ travelers
- Always show what each traveler would be giving up vs gaining in each option
- Be specific with prices - use real estimates not vague ranges

Return ONLY valid JSON in this exact format:
{
  "options": [
    {
      "title": "Option A title",
      "tagline": "One compelling sentence",
      "destination": "City, Country",
      "dates": "Suggested dates",
      "nights": 7,
      "estimated_cost_per_person": 2400,
      "cost_breakdown": {
        "flights": 800,
        "accommodation": 900,
        "food": 400,
        "activities": 200,
        "transport": 100
      },
      "true_cost_notes": "Note about hidden costs or savings",
      "itinerary_highlights": ["Day 1: ...", "Day 2-3: ...", "Day 4-5: ...", "Day 6-7: ..."],
      "accommodation_suggestion": "Type and neighborhood",
      "sub_group_routing": ["Group 1 (Chicago): fly ORD→...", "Group 2 (NYC): fly JFK→..."],
      "perks_flagged": ["Eliza + Hailey Delta cards cover all 12 bags free", "Group of 9+ qualifies for group fare"],
      "warnings": ["Hotel is 20min from main strip - budget $30/day for transport"],
      "vibe_match": "Why this fits the group vibe",
      "best_for": "Who this option is best for",
      "trade_offs": "What you gain and give up"
    }
  ],
  "group_insights": "2-3 sentences about what Avanti noticed about this group that shaped these options",
  "recommended_option": 0
}`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    })

    const content = message.content[0]
    if (content.type !== 'text') return NextResponse.json({ error: 'No response' })

    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'No JSON found' })

    const result = JSON.parse(jsonMatch[0])

    await supabase.from('trips').update({
      options: result,
      options_generated: true,
      phase: 'voting'
    }).eq('id', tripId)

    return NextResponse.json(result)
  } catch (e: any) {
    console.error('Generate options error:', e)
    return NextResponse.json({ error: e.message })
  }
}
