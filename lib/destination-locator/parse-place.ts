import { extractCountryFromDestinationName } from '@/lib/destination-country-rules'

export type ParsedPlace = {
  query: string
  city: string
  country: string | null
}

export function parseDestinationPlace(name: string): ParsedPlace {
  const trimmed = name.trim()
  const country = extractCountryFromDestinationName(trimmed)

  if (trimmed.includes(',')) {
    const city = trimmed.split(',')[0]?.trim() || trimmed
    return {
      query: trimmed,
      city,
      country,
    }
  }

  const slashParts = trimmed.split('/').map(p => p.trim()).filter(Boolean)
  const city = slashParts[0] || trimmed

  return {
    query: trimmed,
    city,
    country,
  }
}
