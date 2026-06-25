import { parseDepartureCitiesFromStep2 } from '@/lib/departure-cities'
import { searchDuffelOffers } from '@/lib/duffel/search-offers'
import { isGetYourGuideConfigured } from '@/lib/getyourguide/client'
import { searchActivities } from '@/lib/getyourguide/search-tours'
import { searchLiveStays } from '@/lib/liteapi/search-stays'
import { parseDestinationCostRange } from '@/lib/voting/round-one-budget'
import { splitListField } from '@/lib/voting/round-one-content'
import type { TravelWindow } from '@/lib/weather/types'
import {
  activitySearchQueries,
  heuristicMustSeeTotal,
  heuristicPreferenceActivities,
  type MustSeeActivity,
} from './activity-estimate'
import { assessBudgetFit, memberBudgetsFromTravelers, type MemberBudget } from './budget-fit'
import { estimateFoodCost } from './food-estimate'
import { resolveAirportIata } from './resolve-airport'
import { estimateTransportCost } from './transport-estimate'
import type { DestinationPriceEstimate, PriceBreakdown } from './types'

export type EstimateDestinationPriceInput = {
  destinationName: string
  country?: string | null
  travelWindow: TravelWindow | null
  /** All trip travelers — used for budget fit and departure cities */
  travelers: Array<{
    nickname?: string | null
    full_name?: string | null
    step2?: Record<string, unknown> | null
  }>
  cardSnapshot?: Record<string, unknown> | null
  adults?: number
}

const estimateCache = new Map<string, { expires: number; value: DestinationPriceEstimate }>()
const ESTIMATE_CACHE_TTL_MS = 6 * 60 * 60 * 1000

function nightsBetween(start: string, end: string): number {
  const a = new Date(start).getTime()
  const b = new Date(end).getTime()
  if (!a || !b || b <= a) return 7
  return Math.max(1, Math.round((b - a) / (1000 * 60 * 60 * 24)))
}

function uniqueDepartureCities(
  travelers: EstimateDestinationPriceInput['travelers']
): string[] {
  const set = new Set<string>()
  for (const t of travelers) {
    for (const city of parseDepartureCitiesFromStep2(t.step2)) {
      set.add(city)
    }
  }
  return [...set]
}

function groupHasLuxuryVibe(travelers: EstimateDestinationPriceInput['travelers']): boolean {
  for (const t of travelers) {
    const vibe = (t.step2?.vibe as string[] | undefined) || []
    if (vibe.some(v => /luxury/i.test(v))) return true
  }
  return false
}

function sumOfferPrices(
  offers: { priceFromUsd: number | null; bestseller: boolean }[]
): { min: number; max: number } | null {
  const priced = offers
    .filter(o => o.priceFromUsd != null && o.priceFromUsd > 0)
    .map(o => ({ price: o.priceFromUsd as number, bestseller: o.bestseller }))
  if (!priced.length) return null

  const sorted = [...priced].sort((a, b) => a.price - b.price)
  const popular = sorted.filter(o => o.bestseller)
  const pool = popular.length >= 2 ? popular : sorted
  const cheapest = pool.slice(0, 2).reduce((sum, o) => sum + o.price, 0)
  const luxury = sorted.slice(-Math.min(5, sorted.length)).reduce((sum, o) => sum + o.price, 0)
  return { min: cheapest, max: Math.max(luxury, cheapest) }
}

function parseOfferAmount(amount: string | undefined): number | null {
  if (!amount) return null
  const n = Number.parseFloat(amount)
  return Number.isFinite(n) ? Math.round(n) : null
}

async function estimateFlights(input: {
  origins: string[]
  destinationName: string
  departDate: string
  returnDate: string
  adults: number
}): Promise<{ min: number; max: number; configured: boolean } | null> {
  const destIata = await resolveAirportIata(input.destinationName)
  if (!destIata || !input.origins.length) return null

  const originIatas: string[] = []
  for (const origin of input.origins) {
    const iata = await resolveAirportIata(origin)
    if (iata) originIatas.push(iata)
  }
  if (!originIatas.length) return null

  const allAmounts: number[] = []
  const cheapestByOrigin: number[] = []
  let anyConfigured = false

  for (const origin of [...new Set(originIatas)]) {
    const result = await searchDuffelOffers({
      origin,
      destination: destIata,
      departDate: input.departDate,
      returnDate: input.returnDate,
      adults: input.adults,
    })
    if (result.configured) anyConfigured = true
    const amounts = result.offers
      .map(o => parseOfferAmount(o.totalAmount))
      .filter((n): n is number => n != null)
    if (amounts.length) {
      cheapestByOrigin.push(Math.min(...amounts))
      allAmounts.push(...amounts)
    }
  }

  if (!cheapestByOrigin.length) return null

  const min = Math.min(...cheapestByOrigin)
  const max = allAmounts.length ? Math.max(...allAmounts) : min
  return { min, max: Math.max(max, min), configured: anyConfigured }
}

async function estimateStays(input: {
  destinationName: string
  checkIn: string
  checkOut: string
  adults: number
  luxury: boolean
}): Promise<{ min: number; max: number; configured: boolean } | null> {
  const [budgetResult, luxuryResult] = await Promise.all([
    searchLiveStays({
      destination: input.destinationName,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      adults: input.adults,
      tier: 'budget',
    }),
    searchLiveStays({
      destination: input.destinationName,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      adults: input.adults,
      tier: 'luxury',
    }),
  ])

  const budgetTotals = budgetResult.offers
    .map(o => o.minTotalUsd)
    .filter((n): n is number => n != null && n > 0)
  const luxuryTotals = luxuryResult.offers
    .map(o => o.minTotalUsd)
    .filter((n): n is number => n != null && n > 0)

  const configured = budgetResult.configured || luxuryResult.configured
  if (!budgetTotals.length && !luxuryTotals.length) {
    return configured ? null : null
  }

  const min = budgetTotals.length ? Math.min(...budgetTotals) : Math.min(...luxuryTotals)
  let max = luxuryTotals.length ? Math.max(...luxuryTotals) : Math.max(...budgetTotals)
  if (input.luxury && luxuryTotals.length) {
    max = Math.max(...luxuryTotals)
  }
  return { min, max: Math.max(max, min), configured }
}

async function fetchActivityOffers(
  destinationName: string,
  query: string,
  startDate: string,
  endDate: string
): Promise<{ priceFromUsd: number | null; bestseller: boolean }[]> {
  const result = await searchActivities({
    destination: destinationName,
    query,
    startDate,
    endDate,
    limit: 8,
  })
  return result.offers.map(o => ({
    priceFromUsd: o.priceFromUsd,
    bestseller: o.bestseller,
  }))
}

async function estimateActivities(input: {
  destinationName: string
  travelers: EstimateDestinationPriceInput['travelers']
  cardActivityLines: string[]
  startDate: string
  endDate: string
  mustSee: MustSeeActivity[]
  preferenceQueries: string[]
}): Promise<{ min: number; max: number; configured: boolean }> {
  const gygConfigured = isGetYourGuideConfigured()
  let mustSeeMin = 0
  let mustSeeMax = 0
  let prefMin = 0
  let prefMax = 0
  let usedLive = false

  if (gygConfigured) {
    for (const item of input.mustSee) {
      const offers = await fetchActivityOffers(
        input.destinationName,
        item.query,
        input.startDate,
        input.endDate
      )
      const summed = sumOfferPrices(offers)
      if (summed) {
        usedLive = true
        mustSeeMin += summed.min
        mustSeeMax += summed.max
      } else {
        mustSeeMin += item.budgetUsd
        mustSeeMax += item.luxuryUsd
      }
    }

    for (const query of input.preferenceQueries) {
      const offers = await fetchActivityOffers(
        input.destinationName,
        query,
        input.startDate,
        input.endDate
      )
      const summed = sumOfferPrices(offers)
      if (summed) {
        usedLive = true
        prefMin += summed.min
        prefMax += summed.max
      }
    }
  }

  if (!gygConfigured || mustSeeMin === 0) {
    const fallbackMust = heuristicMustSeeTotal(input.mustSee)
    if (!gygConfigured || mustSeeMin === 0) {
      mustSeeMin = fallbackMust.min
      mustSeeMax = Math.max(mustSeeMax, fallbackMust.max)
    }
  }

  if (!gygConfigured || prefMin === 0) {
    const fallbackPref = heuristicPreferenceActivities(input.travelers)
    if (fallbackPref.min > 0) {
      prefMin = fallbackPref.min
      prefMax = Math.max(prefMax, fallbackPref.max)
    }
  }

  const min = mustSeeMin + prefMin
  const max = Math.max(mustSeeMax + prefMax, min)

  if (min <= 0) return { min: 0, max: 0, configured: gygConfigured && usedLive }

  return {
    min,
    max,
    configured: gygConfigured && usedLive,
  }
}

function estimateFromAiCost(
  input: {
    cardSnapshot: Record<string, unknown> | null | undefined
    destinationName: string
    country?: string | null
    nights: number
    travelers: EstimateDestinationPriceInput['travelers']
  },
  members: MemberBudget[]
): DestinationPriceEstimate {
  const { cardSnapshot, destinationName, country, nights, travelers } = input
  const costField = typeof cardSnapshot?.cost === 'string' ? cardSnapshot.cost : null
  const parsed = parseDestinationCostRange(costField)

  const cardActivities = splitListField(
    typeof cardSnapshot?.activities === 'string' ? cardSnapshot.activities : null
  )
  const { mustSee, preferenceQueries } = activitySearchQueries(
    destinationName,
    travelers,
    cardActivities
  )
  const mustSeeTotals = heuristicMustSeeTotal(mustSee)
  const prefTotals = heuristicPreferenceActivities(travelers)
  const food = estimateFoodCost({ destinationName, country, nights })
  const transport = estimateTransportCost({
    destinationName,
    country,
    nights,
    travelers,
  })

  let minPerPerson: number
  let maxPerPerson: number

  if (parsed) {
    minPerPerson = Math.round(parsed.min * 0.88)
    maxPerPerson = parsed.openEnded
      ? Math.round(parsed.min * 1.55)
      : Math.round(Math.max(parsed.max * 1.25, minPerPerson + 400))
  } else {
    minPerPerson =
      transport.min +
      food.min +
      mustSeeTotals.min +
      prefTotals.min +
      Math.round(600 + nights * 40)
    maxPerPerson =
      transport.max +
      food.max +
      mustSeeTotals.max +
      prefTotals.max +
      Math.round(1400 + nights * 120)
  }

  const breakdown: PriceBreakdown = {
    food: { min: food.min, max: food.max },
    transport: { min: transport.min, max: transport.max },
    activities: {
      min: mustSeeTotals.min + prefTotals.min,
      max: mustSeeTotals.max + prefTotals.max,
    },
  }
  const fit = assessBudgetFit(minPerPerson, members)

  return {
    minPerPerson,
    maxPerPerson,
    budgetFit: fit.budgetFit,
    budgetFitMessage: fit.message,
    source: 'ai',
    breakdown,
    computedAt: new Date().toISOString(),
    notes: 'Estimated from destination card — live flight, hotel, and activity pricing will refine this after you lock dates.',
  }
}

function cacheKey(input: EstimateDestinationPriceInput): string {
  const deps = uniqueDepartureCities(input.travelers).join(';')
  const window = input.travelWindow
    ? `${input.travelWindow.start}|${input.travelWindow.end}`
    : 'no-dates'
  return `${input.destinationName}|${window}|${deps}|${input.adults ?? 1}`
}

export async function estimateDestinationPrice(
  input: EstimateDestinationPriceInput
): Promise<DestinationPriceEstimate> {
  const key = cacheKey(input)
  const cached = estimateCache.get(key)
  if (cached && Date.now() < cached.expires) {
    return cached.value
  }

  const members = memberBudgetsFromTravelers(input.travelers)
  const adults = Math.max(1, input.adults ?? (input.travelers.length || 1))
  const nights = input.travelWindow
    ? nightsBetween(input.travelWindow.start, input.travelWindow.end)
    : 7

  if (!input.travelWindow) {
    const fallback = estimateFromAiCost(
      {
        cardSnapshot: input.cardSnapshot,
        destinationName: input.destinationName,
        country: input.country,
        nights,
        travelers: input.travelers,
      },
      members
    )
    estimateCache.set(key, { expires: Date.now() + ESTIMATE_CACHE_TTL_MS, value: fallback })
    return fallback
  }

  const { start, end } = input.travelWindow
  const origins = uniqueDepartureCities(input.travelers)
  const cardActivities = splitListField(
    typeof input.cardSnapshot?.activities === 'string' ? input.cardSnapshot.activities : null
  )
  const { mustSee, preferenceQueries } = activitySearchQueries(
    input.destinationName,
    input.travelers,
    cardActivities
  )

  const food = estimateFoodCost({
    destinationName: input.destinationName,
    country: input.country,
    nights,
  })
  const transport = estimateTransportCost({
    destinationName: input.destinationName,
    country: input.country,
    nights,
    travelers: input.travelers,
  })

  const [flights, stays, activities] = await Promise.all([
    estimateFlights({
      origins,
      destinationName: input.destinationName,
      departDate: start,
      returnDate: end,
      adults,
    }),
    estimateStays({
      destinationName: input.destinationName,
      checkIn: start,
      checkOut: end,
      adults,
      luxury: groupHasLuxuryVibe(input.travelers),
    }),
    estimateActivities({
      destinationName: input.destinationName,
      travelers: input.travelers,
      cardActivityLines: cardActivities,
      startDate: start,
      endDate: end,
      mustSee,
      preferenceQueries,
    }),
  ])

  const apiParts = [flights, stays].filter(Boolean)
  const anyApi = apiParts.some(p => p?.configured)

  if (!anyApi || apiParts.every(p => !p)) {
    const fallback = estimateFromAiCost(
      {
        cardSnapshot: input.cardSnapshot,
        destinationName: input.destinationName,
        country: input.country,
        nights,
        travelers: input.travelers,
      },
      members
    )
    estimateCache.set(key, { expires: Date.now() + ESTIMATE_CACHE_TTL_MS, value: fallback })
    return fallback
  }

  const breakdown: PriceBreakdown = {
    flights: flights ? { min: flights.min, max: flights.max } : undefined,
    stays: stays ? { min: stays.min, max: stays.max } : undefined,
    activities:
      activities.min > 0 ? { min: activities.min, max: activities.max } : undefined,
    food: { min: food.min, max: food.max },
    transport: { min: transport.min, max: transport.max },
  }

  const minParts = [
    flights?.min,
    stays?.min,
    activities.min > 0 ? activities.min : undefined,
    food.min,
    transport.min,
  ].filter((n): n is number => n != null)
  const maxParts = [
    flights?.max,
    stays?.max,
    activities.max > 0 ? activities.max : undefined,
    food.max,
    transport.max,
  ].filter((n): n is number => n != null)

  let minPerPerson = minParts.reduce((a, b) => a + b, 0)
  let maxPerPerson = maxParts.reduce((a, b) => a + b, 0)

  if (minPerPerson <= 0 || maxPerPerson <= 0) {
    const fallback = estimateFromAiCost(
      {
        cardSnapshot: input.cardSnapshot,
        destinationName: input.destinationName,
        country: input.country,
        nights,
        travelers: input.travelers,
      },
      members
    )
    estimateCache.set(key, { expires: Date.now() + ESTIMATE_CACHE_TTL_MS, value: fallback })
    return fallback
  }

  if (maxPerPerson < minPerPerson) {
    maxPerPerson = minPerPerson + Math.round(minPerPerson * 0.45)
  }

  const aiParsed = parseDestinationCostRange(
    typeof input.cardSnapshot?.cost === 'string' ? input.cardSnapshot.cost : null
  )
  const sources = new Set<'api' | 'ai'>()
  if (flights?.configured || stays?.configured || activities.configured) sources.add('api')
  if (!flights || !stays) {
    if (aiParsed) {
      sources.add('ai')
      if (!flights && aiParsed.min) {
        const flightShare = Math.round(aiParsed.min * 0.35)
        minPerPerson += flightShare
        maxPerPerson += Math.round((aiParsed.max || aiParsed.min) * 0.4)
        breakdown.flights = { min: flightShare, max: Math.round((aiParsed.max || aiParsed.min) * 0.4) }
      }
    }
  }

  const fit = assessBudgetFit(minPerPerson, members)
  const result: DestinationPriceEstimate = {
    minPerPerson,
    maxPerPerson,
    budgetFit: fit.budgetFit,
    budgetFitMessage: fit.message,
    source: sources.size > 1 ? 'mixed' : sources.has('api') ? 'api' : 'ai',
    breakdown,
    computedAt: new Date().toISOString(),
    notes:
      sources.size > 1
        ? 'Some components use live pricing; others are estimated from your destination card.'
        : undefined,
  }

  estimateCache.set(key, { expires: Date.now() + ESTIMATE_CACHE_TTL_MS, value: result })
  return result
}
