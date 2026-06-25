import { parseDestinationPlace } from '@/lib/destination-locator/parse-place'

export type MustSeeActivity = {
  query: string
  label: string
  /** Typical USD per person when live API unavailable */
  budgetUsd: number
  luxuryUsd: number
}

/** Iconic must-do experiences by city key (lowercase). */
const MUST_SEE_BY_CITY: Record<string, MustSeeActivity[]> = {
  rome: [
    { query: 'Colosseum Rome', label: 'Colosseum', budgetUsd: 28, luxuryUsd: 95 },
    { query: 'Vatican Museums Rome', label: 'Vatican Museums', budgetUsd: 35, luxuryUsd: 120 },
  ],
  paris: [
    { query: 'Eiffel Tower Paris', label: 'Eiffel Tower', budgetUsd: 32, luxuryUsd: 110 },
    { query: 'Louvre Museum Paris', label: 'Louvre', budgetUsd: 22, luxuryUsd: 85 },
  ],
  london: [
    { query: 'Tower of London', label: 'Tower of London', budgetUsd: 38, luxuryUsd: 105 },
    { query: 'Westminster Abbey London', label: 'Westminster Abbey', budgetUsd: 30, luxuryUsd: 90 },
  ],
  barcelona: [
    { query: 'Sagrada Familia Barcelona', label: 'Sagrada Familia', budgetUsd: 32, luxuryUsd: 95 },
    { query: 'Park Guell Barcelona', label: 'Park Güell', budgetUsd: 14, luxuryUsd: 55 },
  ],
  athens: [
    { query: 'Acropolis Athens', label: 'Acropolis', budgetUsd: 25, luxuryUsd: 85 },
    { query: 'Acropolis Museum Athens', label: 'Acropolis Museum', budgetUsd: 15, luxuryUsd: 45 },
  ],
  santorini: [
    { query: 'Santorini caldera cruise', label: 'Caldera cruise', budgetUsd: 45, luxuryUsd: 140 },
    { query: 'Oia Santorini sunset', label: 'Oia & villages', budgetUsd: 20, luxuryUsd: 75 },
  ],
  tokyo: [
    { query: 'Senso-ji Temple Tokyo', label: 'Senso-ji & Asakusa', budgetUsd: 15, luxuryUsd: 65 },
    { query: 'teamLab Tokyo', label: 'Immersive museums', budgetUsd: 35, luxuryUsd: 90 },
  ],
  'new york': [
    { query: 'Statue of Liberty New York', label: 'Statue of Liberty', budgetUsd: 30, luxuryUsd: 95 },
    { query: 'Empire State Building', label: 'Empire State', budgetUsd: 38, luxuryUsd: 110 },
  ],
  cairo: [
    { query: 'Pyramids of Giza', label: 'Pyramids of Giza', budgetUsd: 35, luxuryUsd: 120 },
    { query: 'Egyptian Museum Cairo', label: 'Egyptian Museum', budgetUsd: 18, luxuryUsd: 60 },
  ],
  marrakech: [
    { query: 'Medina Marrakech guided tour', label: 'Medina & souks', budgetUsd: 25, luxuryUsd: 85 },
    { query: 'Majorelle Garden Marrakech', label: 'Majorelle Garden', budgetUsd: 15, luxuryUsd: 45 },
  ],
  lisbon: [
    { query: 'Belém Tower Lisbon', label: 'Belém & Jerónimos', budgetUsd: 18, luxuryUsd: 65 },
    { query: 'Alfama Lisbon walking tour', label: 'Alfama', budgetUsd: 22, luxuryUsd: 75 },
  ],
  amsterdam: [
    { query: 'Anne Frank House Amsterdam', label: 'Anne Frank House', budgetUsd: 18, luxuryUsd: 55 },
    { query: 'Van Gogh Museum Amsterdam', label: 'Van Gogh Museum', budgetUsd: 22, luxuryUsd: 70 },
  ],
  dubai: [
    { query: 'Burj Khalifa Dubai', label: 'Burj Khalifa', budgetUsd: 45, luxuryUsd: 150 },
    { query: 'Desert safari Dubai', label: 'Desert safari', budgetUsd: 55, luxuryUsd: 180 },
  ],
  cancun: [
    { query: 'Chichen Itza day trip', label: 'Chichen Itza', budgetUsd: 65, luxuryUsd: 180 },
    { query: 'Tulum ruins tour', label: 'Tulum', budgetUsd: 45, luxuryUsd: 130 },
  ],
}

const GENERIC_MUST_SEE: MustSeeActivity[] = [
  { query: 'city highlights walking tour', label: 'City highlights', budgetUsd: 28, luxuryUsd: 90 },
  { query: 'top museum ticket', label: 'Main museum or site', budgetUsd: 22, luxuryUsd: 75 },
]

const PREFERENCE_ACTIVITY_PRICE: Record<string, { budgetUsd: number; luxuryUsd: number }> = {
  'physical / outdoor': { budgetUsd: 55, luxuryUsd: 165 },
  'cultural / historical': { budgetUsd: 35, luxuryUsd: 110 },
  'entertainment & nightlife': { budgetUsd: 45, luxuryUsd: 140 },
  'food & dining': { budgetUsd: 50, luxuryUsd: 175 },
  'relaxation & wellness': { budgetUsd: 60, luxuryUsd: 200 },
  'water activities': { budgetUsd: 65, luxuryUsd: 195 },
  shopping: { budgetUsd: 0, luxuryUsd: 0 },
  'arts & music': { budgetUsd: 40, luxuryUsd: 130 },
  'adventure sports': { budgetUsd: 75, luxuryUsd: 220 },
}

export function resolveMustSeeActivities(destinationName: string): MustSeeActivity[] {
  const city = parseDestinationPlace(destinationName).city.toLowerCase()
  if (MUST_SEE_BY_CITY[city]?.length) return MUST_SEE_BY_CITY[city]
  return GENERIC_MUST_SEE
}

export function preferenceActivityQueries(
  travelers: Array<{ step2?: Record<string, unknown> | null }>,
  destinationName: string
): string[] {
  const short = destinationName.split(',')[0]?.trim() || destinationName
  const queries = new Set<string>()

  for (const t of travelers) {
    const activities = (t.step2?.activities as string[] | undefined) || []
    for (const a of activities) {
      if (/shopping/i.test(a)) continue
      queries.add(`${a} ${short}`)
    }
  }

  return [...queries].slice(0, 5)
}

export function heuristicPreferenceActivities(
  travelers: Array<{ step2?: Record<string, unknown> | null }>
): { min: number; max: number } {
  const picked = new Set<string>()
  let min = 0
  let max = 0

  for (const t of travelers) {
    const activities = (t.step2?.activities as string[] | undefined) || []
    for (const a of activities) {
      const key = a.toLowerCase()
      if (picked.has(key) || /shopping/i.test(key)) continue
      picked.add(key)
      const prices = PREFERENCE_ACTIVITY_PRICE[key] || { budgetUsd: 40, luxuryUsd: 120 }
      min += prices.budgetUsd
      max += prices.luxuryUsd
    }
  }

  return { min, max }
}

export function heuristicMustSeeTotal(mustSee: MustSeeActivity[]): { min: number; max: number } {
  const min = mustSee.reduce((sum, a) => sum + a.budgetUsd, 0)
  const max = mustSee.reduce((sum, a) => sum + a.luxuryUsd, 0)
  return { min, max }
}

export function activitySearchQueries(
  destinationName: string,
  travelers: Array<{ step2?: Record<string, unknown> | null }>,
  cardActivityLines: string[]
): { mustSee: MustSeeActivity[]; preferenceQueries: string[] } {
  const mustSee = resolveMustSeeActivities(destinationName)
  const preferenceQueries = preferenceActivityQueries(travelers, destinationName)

  const short = destinationName.split(',')[0]?.trim() || destinationName
  for (const line of cardActivityLines.slice(0, 2)) {
    if (line.length > 4 && line.length < 80) {
      preferenceQueries.push(`${line} ${short}`)
    }
  }

  return {
    mustSee,
    preferenceQueries: [...new Set(preferenceQueries)].slice(0, 6),
  }
}
