import type { ItineraryData, TripBooking } from '@/lib/bookings/types'

export type InspirationPlatform =
  | 'tiktok'
  | 'instagram'
  | 'pinterest'
  | 'article'
  | 'youtube'
  | 'other'

export type ParsedInspiration = {
  place_name: string
  place_category: string
  place_address: string | null
  place_city: string | null
  place_description: string
  source_platform: InspirationPlatform
  confidence: 'high' | 'medium' | 'low'
  suggested_day_date: string | null
  suggested_time: string | null
  suggestion_reason: string
  nearby_landmark: string | null
}

export type TripInspiration = ParsedInspiration & {
  id: string
  trip_id: string
  source_type: 'url' | 'screenshot' | 'paste'
  source_url: string | null
  status: string
  created_at: string
}

export type EmbassyInfo = {
  nationality: string
  name: string
  address: string
  phone: string
  hours: string
  emergency_line: string | null
}

export type HospitalInfo = {
  name: string
  address: string
  phone: string
  distance_from_hotel: string
  notes: string | null
}

export type DestinationEssentials = {
  destination: string
  emergency_number: string
  police_number: string | null
  ambulance_number: string | null
  general_tips: string[]
  hospitals: HospitalInfo[]
  embassies: EmbassyInfo[]
  generated_at: string
}

export type LocalApp = {
  name: string
  category: 'rideshare' | 'transit' | 'food_delivery' | 'maps' | 'payments' | 'translation' | 'other'
  description: string
  platforms: string[]
  download_note: string | null
}

export type CountryAppsGuide = {
  destination: string
  country: string
  apps: LocalApp[]
  transit_numbers: string[]
  tips: string[]
  generated_at: string
}

export type EveningBriefing = {
  date: string
  preview_title: string
  tomorrow_summary: string
  wake_up_time: string
  pack_list: string[]
  prep_notes: string[]
  weather_note: string | null
}

export type MorningBriefing = {
  date: string
  greeting: string
  day_overview: string
  schedule: Array<{
    time: string
    activity: string
    leave_by: string | null
    return_by: string | null
    tip: string | null
  }>
  hotel_return_time: string | null
  reminders: string[]
}

export type DayBriefings = {
  evening?: EveningBriefing
  morning?: MorningBriefing
}

export type VisaRequirement = {
  nationality: string
  visa_required: boolean
  visa_type: string | null
  how_to_apply: string | null
  processing_time: string | null
  cost: string | null
  passport_validity: string | null
  notes: string | null
}

export type RequiredDocument = {
  name: string
  required: boolean
  details: string
}

export type VaccineRequirement = {
  name: string
  status: 'required' | 'recommended'
  details: string | null
}

export type MedicationAdvisory = {
  name: string
  who: string | null
  status: 'ok' | 'restricted' | 'banned' | 'bring_supply' | 'unknown'
  guidance: string
  documents_needed: string[]
}

export type EntryRequirements = {
  destination: string
  country: string
  summary: string | null
  visas: VisaRequirement[]
  documents: RequiredDocument[]
  vaccines: VaccineRequirement[]
  medications: MedicationAdvisory[]
  bring_from_home: string[]
  disclaimer: string | null
  generated_at: string
}

export type EntryRequirementsMed = {
  name: string
  dosage?: string
  unit?: string
  who?: string
}

export type EntryRequirementsInput = {
  trip: { name: string; destination: string; start_date: string; end_date: string }
  nationalities: string[]
  medications: EntryRequirementsMed[]
}

export type TripCompanionOptions = {
  essentials?: DestinationEssentials
  country_apps?: CountryAppsGuide
  briefings?: Record<string, DayBriefings>
  entry_requirements?: EntryRequirements
}

export type CompanionContext = {
  trip: {
    id: string
    name: string
    destination: string
    start_date: string
    end_date: string
  }
  itinerary: ItineraryData | null
  bookings: TripBooking[]
  travelerNationalities: string[]
  hotelAddress: string | null
}
