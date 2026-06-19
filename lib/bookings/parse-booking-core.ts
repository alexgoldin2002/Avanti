import Anthropic from '@anthropic-ai/sdk'
import type { BookingCategory, ParsedBooking } from './types'

const client = new Anthropic()

export const BOOKING_PARSE_SYSTEM = `You extract travel booking confirmations from emails, PDFs, and screenshots.
Return ONLY valid JSON. Be accurate with dates/times and confirmation numbers.`

const OUTPUT_SCHEMA = `{
  "category": "hotel|restaurant|tour|flight|activity|transport|other",
  "display_title": "Short human title e.g. Carbone — dinner reservation",
  "vendor_name": "string or null",
  "confirmation_number": "string or null",
  "starts_at": "ISO 8601 datetime or null",
  "ends_at": "ISO 8601 datetime or null",
  "location": "address or city or null",
  "party_size": "number or null",
  "total_amount": "number or null",
  "currency": "USD|EUR|etc or null",
  "booker_contact_email": "from confirmation or null",
  "booker_contact_phone": "from confirmation or null",
  "qr_payload": "decoded QR/barcode text if visible in image, else null",
  "notes": "cancellation policy or special instructions, brief, or null",
  "confidence": "high|medium|low"
}`

function defaultParsed(): ParsedBooking {
  return {
    category: 'other',
    display_title: 'Booking confirmation',
    vendor_name: null,
    confirmation_number: null,
    starts_at: null,
    ends_at: null,
    location: null,
    party_size: null,
    total_amount: null,
    currency: 'USD',
    booker_contact_email: null,
    booker_contact_phone: null,
    qr_payload: null,
    notes: null,
    confidence: 'low',
  }
}

export async function parseBookingFromText(input: {
  subject?: string
  body: string
  tripDestination?: string
  tripName?: string
}): Promise<ParsedBooking> {
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: BOOKING_PARSE_SYSTEM,
      messages: [{
        role: 'user',
        content: `Extract booking details.

TRIP: ${input.tripName || 'Group trip'}
DESTINATION: ${input.tripDestination || 'unknown'}
SUBJECT: ${input.subject || '(none)'}

CONTENT:
${input.body.slice(0, 12000)}

Return JSON matching:
${OUTPUT_SCHEMA}`,
      }],
    })
    const text = response.content.find(c => c.type === 'text')?.text || '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch?.[0] || '{}')
    return normalizeParsed(parsed)
  } catch (e) {
    console.error('parseBookingFromText:', e)
    return defaultParsed()
  }
}

export async function parseBookingFromImage(input: {
  base64Data: string
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
  tripDestination?: string
  tripName?: string
}): Promise<ParsedBooking> {
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: BOOKING_PARSE_SYSTEM,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: input.mediaType, data: input.base64Data },
          },
          {
            type: 'text',
            text: `This is a screenshot or photo of a travel booking confirmation (hotel, restaurant, tour, flight, etc.).

TRIP: ${input.tripName || 'Group trip'}
DESTINATION: ${input.tripDestination || 'unknown'}

Extract all visible booking details. If a QR code is visible, include decoded content in qr_payload if readable.

Return JSON matching:
${OUTPUT_SCHEMA}`,
          },
        ],
      }],
    })
    const text = response.content.find(c => c.type === 'text')?.text || '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch?.[0] || '{}')
    return normalizeParsed(parsed)
  } catch (e) {
    console.error('parseBookingFromImage:', e)
    return defaultParsed()
  }
}

function normalizeParsed(raw: Record<string, unknown>): ParsedBooking {
  const cats: BookingCategory[] = ['hotel', 'restaurant', 'tour', 'flight', 'activity', 'transport', 'other']
  const category = cats.includes(raw.category as BookingCategory)
    ? (raw.category as BookingCategory)
    : 'other'

  return {
    category,
    display_title: String(raw.display_title || raw.vendor_name || 'Booking confirmation'),
    vendor_name: raw.vendor_name ? String(raw.vendor_name) : null,
    confirmation_number: raw.confirmation_number ? String(raw.confirmation_number) : null,
    starts_at: raw.starts_at ? String(raw.starts_at) : null,
    ends_at: raw.ends_at ? String(raw.ends_at) : null,
    location: raw.location ? String(raw.location) : null,
    party_size: typeof raw.party_size === 'number' ? raw.party_size : null,
    total_amount: typeof raw.total_amount === 'number' ? raw.total_amount : null,
    currency: raw.currency ? String(raw.currency) : 'USD',
    booker_contact_email: raw.booker_contact_email ? String(raw.booker_contact_email) : null,
    booker_contact_phone: raw.booker_contact_phone ? String(raw.booker_contact_phone) : null,
    qr_payload: raw.qr_payload ? String(raw.qr_payload) : null,
    notes: raw.notes ? String(raw.notes) : null,
    confidence: raw.confidence === 'high' || raw.confidence === 'low' ? raw.confidence : 'medium',
  }
}

export function detectMediaType(fileName: string, mimeType?: string): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf' | null {
  if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) return 'application/pdf'
  if (mimeType === 'image/png' || fileName.toLowerCase().endsWith('.png')) return 'image/png'
  if (mimeType === 'image/webp' || fileName.toLowerCase().endsWith('.webp')) return 'image/webp'
  if (mimeType === 'image/gif' || fileName.toLowerCase().endsWith('.gif')) return 'image/gif'
  if (mimeType?.startsWith('image/') || /\.(jpe?g|heic)$/i.test(fileName)) return 'image/jpeg'
  return null
}
