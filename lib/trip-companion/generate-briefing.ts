import Anthropic from '@anthropic-ai/sdk'
import type { ItineraryData, TripBooking } from '@/lib/bookings/types'
import type { CompanionContext, DayBriefings } from './types'

const client = new Anthropic()

function bookingsForDate(bookings: TripBooking[], date: string): TripBooking[] {
  return bookings.filter(b => {
    if (!b.starts_at) return false
    return b.starts_at.startsWith(date)
  })
}

function dayFromItinerary(itinerary: ItineraryData | null, date: string) {
  return itinerary?.days?.find(d => d.date === date) || null
}

export async function generateDayBriefings(
  ctx: CompanionContext,
  targetDate: string,
  mode: 'evening' | 'morning' | 'both'
): Promise<DayBriefings> {
  const tomorrow = new Date(`${targetDate}T12:00:00`)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().slice(0, 10)

  const todayDay = dayFromItinerary(ctx.itinerary, targetDate)
  const tomorrowDay = dayFromItinerary(ctx.itinerary, tomorrowStr)
  const tomorrowBookings = bookingsForDate(ctx.bookings, tomorrowStr)

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    system: 'You write concise, actionable travel briefings. Return only valid JSON.',
    messages: [{
      role: 'user',
      content: `Generate travel briefings for ${ctx.trip.destination}.

TRIP: ${ctx.trip.name}
TODAY DATE: ${targetDate}
TOMORROW DATE: ${tomorrowStr}
MODE: ${mode}

TODAY ITINERARY: ${JSON.stringify(todayDay)}
TOMORROW ITINERARY: ${JSON.stringify(tomorrowDay)}
TOMORROW BOOKINGS: ${JSON.stringify(tomorrowBookings.map(b => ({
  title: b.display_title,
  category: b.category,
  time: b.starts_at,
  location: b.location,
  conf: b.confirmation_number,
})))}

Return JSON:
{
  "evening": {
    "date": "${targetDate}",
    "preview_title": "Tomorrow: short title",
    "tomorrow_summary": "2-3 sentences preview",
    "wake_up_time": "7:00 AM",
    "pack_list": ["items to prep tonight"],
    "prep_notes": ["reservations, tickets, etc."],
    "weather_note": null
  },
  "morning": {
    "date": "${tomorrowStr}",
    "greeting": "Good morning...",
    "day_overview": "One paragraph",
    "schedule": [{"time":"","activity":"","leave_by":null,"return_by":null,"tip":null}],
    "hotel_return_time": "approx time back at hotel or null",
    "reminders": ["important reminders"]
  }
}

Evening briefing = sent night before tomorrow. Morning briefing = sent morning of tomorrow.
Include leave_by times and return_to_hotel estimates. Reference confirmation numbers when relevant.`,
    }],
  })

  const text = response.content.find(c => c.type === 'text')?.text || '{}'
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  const parsed = JSON.parse(jsonMatch?.[0] || '{}')

  const result: DayBriefings = {}
  if (mode === 'evening' || mode === 'both') {
    result.evening = parsed.evening
  }
  if (mode === 'morning' || mode === 'both') {
    result.morning = parsed.morning
  }
  return result
}

export function formatEveningSms(b: DayBriefings['evening'], tripName: string): string {
  if (!b) return ''
  const pack = b.pack_list?.length ? `\nPack: ${b.pack_list.slice(0, 4).join(', ')}` : ''
  return `🌙 ${tripName} — ${b.preview_title}\n${b.tomorrow_summary}\nWake: ${b.wake_up_time}${pack}`
}

export function formatMorningSms(b: DayBriefings['morning'], tripName: string): string {
  if (!b) return ''
  const first = b.schedule?.[0]
  const leave = first?.leave_by ? `\nLeave by ${first.leave_by} for ${first.activity}` : ''
  return `☀️ ${tripName}\n${b.day_overview?.slice(0, 200)}${leave}`
}
