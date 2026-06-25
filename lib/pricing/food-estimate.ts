import { extractCountryFromDestinationName } from '@/lib/destination-country-rules'
import { normalizeCountryKey } from '@/lib/destination-country-rules'

/** Base daily food allowance (USD) before destination multiplier. */
export const BASE_FOOD_MIN_PER_DAY = 42
export const BASE_FOOD_MAX_PER_DAY = 135

/** Relative cost of eating out vs. a mid-range US city. */
const COUNTRY_FOOD_MULTIPLIER: Record<string, number> = {
  norway: 1.55,
  switzerland: 1.5,
  iceland: 1.45,
  denmark: 1.4,
  sweden: 1.35,
  'united kingdom': 1.3,
  france: 1.28,
  italy: 1.22,
  spain: 1.12,
  greece: 1.05,
  japan: 1.2,
  'south korea': 1.05,
  australia: 1.25,
  'new zealand': 1.2,
  singapore: 1.15,
  'united arab emirates': 1.2,
  'united states': 1.05,
  canada: 1.08,
  mexico: 0.72,
  colombia: 0.65,
  brazil: 0.75,
  argentina: 0.7,
  portugal: 0.88,
  morocco: 0.62,
  thailand: 0.55,
  vietnam: 0.5,
  indonesia: 0.58,
  india: 0.45,
  'south africa': 0.68,
  egypt: 0.55,
  turkey: 0.65,
  croatia: 0.95,
  'costa rica': 0.78,
  jamaica: 0.82,
  'dominican republic': 0.75,
}

const CITY_FOOD_MULTIPLIER: Record<string, number> = {
  paris: 1.35,
  rome: 1.2,
  london: 1.32,
  tokyo: 1.25,
  'new york': 1.35,
  'san francisco': 1.38,
  'los angeles': 1.22,
  miami: 1.18,
  honolulu: 1.3,
  santorini: 1.25,
  mykonos: 1.3,
  dubai: 1.28,
  bali: 0.62,
  bangkok: 0.52,
  lisbon: 0.92,
  barcelona: 1.15,
  amsterdam: 1.22,
  reykjavik: 1.48,
}

export function resolveFoodCostMultiplier(input: {
  destinationName: string
  country?: string | null
}): number {
  const country =
    input.country ||
    extractCountryFromDestinationName(input.destinationName) ||
    ''
  const countryKey = normalizeCountryKey(country)
  const cityKey = input.destinationName.split(',')[0]?.trim().toLowerCase() || ''

  const cityMult = CITY_FOOD_MULTIPLIER[cityKey]
  const countryMult = countryKey ? COUNTRY_FOOD_MULTIPLIER[countryKey] : undefined

  if (cityMult != null && countryMult != null) {
    return Math.round((cityMult * 0.6 + countryMult * 0.4) * 100) / 100
  }
  if (cityMult != null) return cityMult
  if (countryMult != null) return countryMult
  return 1
}

export function estimateFoodCost(input: {
  destinationName: string
  country?: string | null
  nights: number
}): { min: number; max: number; multiplier: number } {
  const nights = Math.max(1, input.nights)
  const multiplier = resolveFoodCostMultiplier(input)
  return {
    multiplier,
    min: Math.round(BASE_FOOD_MIN_PER_DAY * multiplier * nights),
    max: Math.round(BASE_FOOD_MAX_PER_DAY * multiplier * nights),
  }
}
