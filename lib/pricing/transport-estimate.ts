import { extractCountryFromDestinationName } from '@/lib/destination-country-rules'
import { normalizeCountryKey } from '@/lib/destination-country-rules'
import { parseDestinationPlace } from '@/lib/destination-locator/parse-place'

/** Airport ↔ city round-trip + optional inter-city legs (USD per person). */
export function estimateTransportCost(input: {
  destinationName: string
  country?: string | null
  nights: number
  travelers: Array<{ step2?: Record<string, unknown> | null }>
}): { min: number; max: number; legs: number } {
  const country =
    input.country ||
    extractCountryFromDestinationName(input.destinationName) ||
    ''
  const countryKey = normalizeCountryKey(country)
  const place = parseDestinationPlace(input.destinationName)
  const cityKey = place.city.toLowerCase()

  const regionMult = transportRegionMultiplier(countryKey, cityKey)
  const interCityLegs = countInterCityLegs(input.destinationName, input.travelers)

  // Round-trip airport transfer per person
  const airportMinOneWay = Math.round(18 * regionMult)
  const airportMaxOneWay = Math.round(55 * regionMult)
  const airportRoundTripMin = airportMinOneWay * 2
  const airportRoundTripMax = Math.max(airportMaxOneWay * 2, airportRoundTripMin + 20)

  // In-destination daily getting around (transit / occasional rides)
  const days = Math.max(1, input.nights)
  const localDailyMin = Math.round(8 * regionMult)
  const localDailyMax = Math.round(28 * regionMult)
  const localMin = localDailyMin * days
  const localMax = localDailyMax * days

  // Extra leg between cities (train/bus budget vs private transfer luxury)
  const interCityMin = interCityLegs * Math.round(45 * regionMult)
  const interCityMax = interCityLegs * Math.round(160 * regionMult)

  return {
    legs: interCityLegs,
    min: airportRoundTripMin + localMin + interCityMin,
    max: airportRoundTripMax + localMax + interCityMax,
  }
}

function transportRegionMultiplier(countryKey: string, cityKey: string): number {
  const expensive = new Set([
    'norway',
    'switzerland',
    'iceland',
    'denmark',
    'japan',
    'united kingdom',
    'france',
    'united arab emirates',
  ])
  const moderate = new Set(['italy', 'spain', 'greece', 'united states', 'canada', 'australia'])
  const budget = new Set(['thailand', 'vietnam', 'indonesia', 'india', 'mexico', 'colombia', 'morocco'])

  if (expensive.has(countryKey)) return 1.35
  if (budget.has(countryKey)) return 0.72
  if (moderate.has(countryKey)) return 1.05

  if (/santorini|mykonos|zurich|geneva|tokyo|singapore|dubai|reykjavik/.test(cityKey)) return 1.3
  if (/bali|bangkok|hanoi|marrakech|cartagena/.test(cityKey)) return 0.75
  return 1
}

/** Count extra inter-city legs from destination name or group multi-stop preference. */
export function countInterCityLegs(
  destinationName: string,
  travelers: Array<{ step2?: Record<string, unknown> | null }>
): number {
  const fromName = destinationCitySegments(destinationName)
  const fromStops = groupStopLegs(travelers)
  return Math.max(fromName, fromStops)
}

function destinationCitySegments(destinationName: string): number {
  const trimmed = destinationName.trim()
  if (!trimmed) return 0

  const slashParts = trimmed.split('/').map(p => p.split(',')[0]?.trim()).filter(Boolean)
  if (slashParts.length > 1) return slashParts.length - 1

  const plusParts = trimmed.split('+').map(p => p.split(',')[0]?.trim()).filter(Boolean)
  if (plusParts.length > 1) return plusParts.length - 1

  if (/\band\b/i.test(trimmed.split(',')[0] || '')) {
    const andParts = (trimmed.split(',')[0] || '')
      .split(/\band\b/i)
      .map(p => p.trim())
      .filter(Boolean)
    if (andParts.length > 1) return andParts.length - 1
  }

  return 0
}

function groupStopLegs(travelers: Array<{ step2?: Record<string, unknown> | null }>): number {
  let maxLegs = 0
  for (const t of travelers) {
    const stops = String(t.step2?.stops || '').toLowerCase()
    if (stops.includes('3 stop')) maxLegs = Math.max(maxLegs, 2)
    else if (stops.includes('2 stop')) maxLegs = Math.max(maxLegs, 1)
    else if (stops.includes('open')) maxLegs = Math.max(maxLegs, 1)
  }
  return maxLegs
}
