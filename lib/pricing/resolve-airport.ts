import { extractIata } from '@/lib/booking/search-links'
import { getDuffelClient } from '@/lib/duffel/client'
import { parseDestinationPlace } from '@/lib/destination-locator/parse-place'

/** Common city labels → primary airport IATA (fallback when Duffel suggestions unavailable). */
const CITY_IATA: Record<string, string> = {
  'new york': 'JFK',
  'new york, ny': 'JFK',
  'nyc': 'JFK',
  'los angeles': 'LAX',
  'san francisco': 'SFO',
  'chicago': 'ORD',
  'boston': 'BOS',
  'miami': 'MIA',
  'seattle': 'SEA',
  'denver': 'DEN',
  'atlanta': 'ATL',
  'dallas': 'DFW',
  'houston': 'IAH',
  'washington': 'IAD',
  'washington, dc': 'IAD',
  'philadelphia': 'PHL',
  'phoenix': 'PHX',
  'austin': 'AUS',
  'portland': 'PDX',
  'rome': 'FCO',
  'paris': 'CDG',
  'london': 'LHR',
  'barcelona': 'BCN',
  'madrid': 'MAD',
  'lisbon': 'LIS',
  'athens': 'ATH',
  'santorini': 'JTR',
  'amsterdam': 'AMS',
  'berlin': 'BER',
  'munich': 'MUC',
  'prague': 'PRG',
  'vienna': 'VIE',
  'zurich': 'ZRH',
  'dublin': 'DUB',
  'edinburgh': 'EDI',
  'reykjavik': 'KEF',
  'tokyo': 'NRT',
  'bangkok': 'BKK',
  'bali': 'DPS',
  'sydney': 'SYD',
  'melbourne': 'MEL',
  'dubai': 'DXB',
  'cairo': 'CAI',
  'marrakech': 'RAK',
  'cancun': 'CUN',
  'mexico city': 'MEX',
  'cartagena': 'CTG',
  'buenos aires': 'EZE',
  'rio de janeiro': 'GIG',
  'cape town': 'CPT',
  'nairobi': 'NBO',
  'honolulu': 'HNL',
  'montreal': 'YUL',
  'toronto': 'YYZ',
  'vancouver': 'YVR',
}

const airportCache = new Map<string, { expires: number; value: string | null }>()
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

function normalizeCityKey(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ')
}

function lookupStaticIata(label: string): string | null {
  const key = normalizeCityKey(label)
  if (CITY_IATA[key]) return CITY_IATA[key]
  const city = normalizeCityKey(parseDestinationPlace(label).city)
  if (CITY_IATA[city]) return CITY_IATA[city]
  const firstPart = key.split(',')[0]?.trim()
  if (firstPart && CITY_IATA[firstPart]) return CITY_IATA[firstPart]
  return null
}

async function duffelSuggestIata(query: string): Promise<string | null> {
  const duffel = getDuffelClient()
  if (!duffel) return null

  try {
    const response = await duffel.suggestions.list({ query: query.trim(), name: query.trim() })
    const hit = response.data?.find(item => item.type === 'airport' && item.iata_code?.length === 3)
    return hit?.iata_code?.toUpperCase() ?? null
  } catch {
    return null
  }
}

/** Resolve a departure city or destination label to a 3-letter IATA airport code. */
export async function resolveAirportIata(label: string): Promise<string | null> {
  if (!label?.trim()) return null

  const fromLabel = extractIata(label)
  if (fromLabel) return fromLabel

  const cacheKey = normalizeCityKey(label)
  const cached = airportCache.get(cacheKey)
  if (cached && Date.now() < cached.expires) return cached.value

  const staticHit = lookupStaticIata(label)
  if (staticHit) {
    airportCache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, value: staticHit })
    return staticHit
  }

  const place = parseDestinationPlace(label)
  const queries = [place.city, `${place.city} airport`, label.split(',')[0]?.trim()].filter(
    Boolean
  ) as string[]

  for (const q of queries) {
    const iata = await duffelSuggestIata(q)
    if (iata) {
      airportCache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, value: iata })
      return iata
    }
  }

  airportCache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, value: null })
  return null
}
