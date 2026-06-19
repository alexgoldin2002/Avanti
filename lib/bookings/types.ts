export const BOOKING_CATEGORIES = [
  'hotel',
  'restaurant',
  'tour',
  'flight',
  'activity',
  'transport',
  'other',
] as const

export type BookingCategory = (typeof BOOKING_CATEGORIES)[number]

export type ParsedBooking = {
  category: BookingCategory
  display_title: string
  vendor_name: string | null
  confirmation_number: string | null
  starts_at: string | null
  ends_at: string | null
  location: string | null
  party_size: number | null
  total_amount: number | null
  currency: string | null
  booker_contact_email: string | null
  booker_contact_phone: string | null
  qr_payload: string | null
  notes: string | null
  confidence: 'high' | 'medium' | 'low'
}

export type TripBooking = ParsedBooking & {
  id: string
  trip_id: string
  booked_by_user_id: string | null
  booked_by_traveler_id: string | null
  status: string
  source: string
  parsed_json: Record<string, unknown>
  created_at: string
  updated_at: string
  files?: Array<{
    id: string
    file_type: string
    storage_path: string
    display_name: string | null
    mime_type: string | null
  }>
  booker?: {
    name: string | null
    email: string | null
    phone: string | null
  } | null
}

export type ItineraryItem = {
  time: string
  name: string
  detail: string
  type: string
  booking_id?: string
  inspiration_id?: string
}

export type ItineraryDay = {
  date: string
  title: string
  items: ItineraryItem[]
  morning_briefing?: string
  evening_note?: string
}

export type ItineraryData = {
  summary: string
  days: ItineraryDay[]
}
