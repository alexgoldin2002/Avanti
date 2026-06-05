import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
const client = new Anthropic()
export async function POST(request: NextRequest) {
  const { trip, travelers } = await request.json()
  const travelerSummary = travelers.map((t: any) => `${t.full_name}: departs ${t.departure_city}, budget €${t.budget_per_day}/day, likes: ${t.vibes?.join(', ')}, dietary: ${t.dietary_restrictions || 'none'}`).join('\n')
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: `You are Avanti, an expert travel planner. Create a day-by-day itinerary. TRIP: ${trip.name}. DESTINATION: ${trip.destination}. DATES: ${trip.start_date} to ${trip.end_date}. TRAVELERS: ${travelerSummary}. Return ONLY valid complete JSON, no extra text, no markdown. Use this exact structure: {"summary":"one sentence","days":[{"date":"YYYY-MM-DD","title":"short title","items":[{"time":"9:00am","name":"place","detail":"brief tip","type":"activity"}],"morning_briefing":"one sentence","evening_note":"one sentence"}]}. Maximum 4 items per day. Keep all text very short.` }]
  })
  const content = message.content[0]
  if (content.type !== 'text') return NextResponse.json({ error: 'No response' }, { status: 500 })
  const clean = content.text.replace(/```json|```/g, '').trim()
  try {
    const itinerary = JSON.parse(clean)
    return NextResponse.json({ itinerary })
  } catch (e) {
    console.error('JSON parse error:', clean.substring(0, 500))
    return NextResponse.json({ error: 'Failed to parse itinerary' }, { status: 500 })
  }
}
