import Anthropic from '@anthropic-ai/sdk'
import type { ItineraryData } from '@/lib/bookings/types'
import type { ParsedInspiration } from './types'
import { detectPlatform, fetchUrlMeta } from './fetch-url-meta'

const client = new Anthropic()

const OUTPUT_SCHEMA = `{
  "place_name": "Exact business or place name",
  "place_category": "restaurant|store|cafe|bar|hotel|activity|market|museum|other",
  "place_address": "street address if identifiable or null",
  "place_city": "city/neighborhood or null",
  "place_description": "One sentence on what this place is",
  "source_platform": "tiktok|instagram|pinterest|article|youtube|other",
  "confidence": "high|medium|low",
  "suggested_day_date": "YYYY-MM-DD from trip dates or null",
  "suggested_time": "e.g. 7:30pm or Lunch or null",
  "suggestion_reason": "Why this slot fits location, itinerary flow, and time of day",
  "nearby_landmark": "nearest known hotel/activity from itinerary or null"
}`

function defaultParsed(): ParsedInspiration {
  return {
    place_name: 'Unknown place',
    place_category: 'other',
    place_address: null,
    place_city: null,
    place_description: 'Could not identify the place.',
    source_platform: 'other',
    confidence: 'low',
    suggested_day_date: null,
    suggested_time: null,
    suggestion_reason: 'Add more detail or a clearer screenshot.',
    nearby_landmark: null,
  }
}

function itinerarySummary(itinerary: ItineraryData | null): string {
  if (!itinerary?.days?.length) return 'No itinerary yet.'
  return itinerary.days
    .map(d => `${d.date} (${d.title}): ${d.items.map(i => `${i.time} ${i.name}`).join('; ')}`)
    .join('\n')
}

export async function parseInspiration(input: {
  url?: string
  caption?: string
  imageBase64?: string
  mimeType?: string
  tripDestination: string
  tripStart: string
  tripEnd: string
  itinerary: ItineraryData | null
}): Promise<ParsedInspiration> {
  try {
    let urlContext = ''
    let platform = 'other'

    if (input.url) {
      platform = detectPlatform(input.url)
      const meta = await fetchUrlMeta(input.url)
      urlContext = [
        `URL: ${input.url}`,
        meta.title ? `Page title: ${meta.title}` : '',
        meta.description ? `Description: ${meta.description}` : '',
        meta.text ? `Page excerpt: ${meta.text.slice(0, 2000)}` : '',
      ].filter(Boolean).join('\n')
    }

    const textBlock = [
      `TRIP DESTINATION: ${input.tripDestination}`,
      `TRIP DATES: ${input.tripStart} to ${input.tripEnd}`,
      `CURRENT ITINERARY:\n${itinerarySummary(input.itinerary)}`,
      input.caption ? `USER CAPTION: ${input.caption}` : '',
      urlContext,
      'Identify the specific restaurant, store, or place shown or referenced.',
      'Suggest the best day and time during the trip to visit based on geography, existing plans, and typical hours.',
      `Return ONLY JSON matching:\n${OUTPUT_SCHEMA}`,
    ].join('\n\n')

    const content: Anthropic.MessageCreateParams['messages'][0]['content'] = []

    if (input.imageBase64) {
      const base64 = input.imageBase64.replace(/^data:[^;]+;base64,/, '')
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: (input.mimeType?.startsWith('image/') ? input.mimeType : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: base64,
        },
      })
    }

    content.push({ type: 'text', text: textBlock })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: 'You identify places from travel inspiration (TikTok, Instagram, Pinterest, articles, screenshots). Return only valid JSON.',
      messages: [{ role: 'user', content }],
    })

    const text = response.content.find(c => c.type === 'text')?.text || '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch?.[0] || '{}')

    return {
      place_name: String(parsed.place_name || 'Unknown place'),
      place_category: String(parsed.place_category || 'other'),
      place_address: parsed.place_address || null,
      place_city: parsed.place_city || null,
      place_description: String(parsed.place_description || ''),
      source_platform: parsed.source_platform || platform,
      confidence: parsed.confidence === 'high' || parsed.confidence === 'medium' ? parsed.confidence : 'low',
      suggested_day_date: parsed.suggested_day_date || null,
      suggested_time: parsed.suggested_time || null,
      suggestion_reason: String(parsed.suggestion_reason || ''),
      nearby_landmark: parsed.nearby_landmark || null,
    }
  } catch (e) {
    console.error('parseInspiration:', e)
    return defaultParsed()
  }
}
