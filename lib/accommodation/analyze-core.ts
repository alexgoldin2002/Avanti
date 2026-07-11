import Anthropic from '@anthropic-ai/sdk'
import type { StayAnalysisInput } from './traveler-context'
import { fetchLiveStaysForAnalysis } from './live-offers'
import type { StayAnalysis, StayOption } from './types'
import type { StayCoordinationMode } from './types'
import { DRIFT_THRESHOLD } from './types'
import { ensureStayBookLinks } from './book-links'

const client = new Anthropic()

const STAY_AGENT_SYSTEM = `You are a group travel agent specializing in accommodation. Given trip context, traveler preferences, and optional LIVE hotel offers with real prices, produce a JSON stay analysis.

Rules:
- If live_offers are provided (3+), enrich those options only — keep id, name, prices, stars, rating, address, book_links intact. Add group_fit, pros, cons, badges, recommended.
- If fewer than 3 live offers, invent 6-8 realistic options for the destination, tier, dates, and group size. Mark source as "estimate".
- Match locked_tier: budget = 3-star/value, mid = 4-star, luxury = 5-star/boutique.
- Respect coordination_mode: together favors villas/large rentals/suite blocks; split favors hotels with multiple rooms; mix includes both.
- Include a mix of hotels and rentals when coordination allows.
- book_links must stay as provided for live offers; for estimates, use placeholder paths like "/book".
- Only one option should have recommended: true.
- Return ONLY valid JSON matching the schema.`

const OUTPUT_SCHEMA = {
  generated_at: 'ISO datetime',
  coordination_mode: 'together|split|mix',
  destination: 'string',
  date_range: { check_in: 'YYYY-MM-DD', check_out: 'YYYY-MM-DD' },
  nights: 'number',
  guest_count: 'number',
  vote_estimate_per_night: 'number|null',
  price_drift_warning: 'string|null',
  summary: '2-3 sentences — recommended pick and trade-offs',
  booking_reminder: 'string',
  data_disclaimer: 'string',
  stay_tips: ['string — neighborhood or booking tips'],
  stay_options: [{
    id: 'stay-1',
    name: 'string',
    type: 'hotel|resort|rental|boutique|hostel|apartment',
    area: 'string|null — neighborhood',
    stars: 'number|null',
    rating: 'number|null — out of 10',
    price_per_night_usd: 'number',
    total_usd: 'number',
    nights: 'number',
    room_summary: 'string|null',
    refundable: 'boolean|null',
    group_fit: 'string — why this works for the group',
    pros: ['string'],
    cons: ['string'],
    badges: ['best|cheapest|group_fit|top_rated'],
    recommended: 'boolean',
    address: 'string|null',
    source: 'liteapi|estimate|rental',
    book_links: { booking: 'url', expedia: 'url', vrbo: 'url', google: 'url', airbnb: 'url' },
  }],
}

function safeParseAnalysis(raw: string): StayAnalysis {
  try {
    return JSON.parse(raw) as StayAnalysis
  } catch {
    return { stay_options: [] } as unknown as StayAnalysis
  }
}

function mergeEnrichedStays(live: StayOption[], enriched: StayOption[]): StayOption[] {
  const liveById = new Map(live.map(o => [o.id, o]))
  const merged = enriched
    .filter(e => liveById.has(e.id))
    .map(e => {
      const base = liveById.get(e.id)!
      return {
        ...base,
        area: e.area ?? base.area,
        group_fit: e.group_fit || base.group_fit,
        pros: e.pros?.length ? e.pros : base.pros,
        cons: e.cons?.length ? e.cons : base.cons,
        badges: e.badges?.length ? e.badges : base.badges,
        recommended: e.recommended ?? base.recommended,
        room_summary: e.room_summary ?? base.room_summary,
      }
    })

  if (merged.length >= 3) return merged

  const mergedIds = new Set(merged.map(o => o.id))
  for (const option of live) {
    if (!mergedIds.has(option.id)) merged.push(option)
  }
  return merged.slice(0, 8)
}

function applyPriceDrift(parsed: StayAnalysis, voteEstimate: number | null): void {
  if (parsed.price_drift_warning || !voteEstimate) return
  const recPrice =
    parsed.stay_options?.find(o => o.recommended)?.price_per_night_usd ??
    parsed.stay_options?.[0]?.price_per_night_usd ??
    null
  if (recPrice == null) return
  const pct = (recPrice - voteEstimate) / voteEstimate
  if (pct > DRIFT_THRESHOLD) {
    const label = parsed.rate_source === 'live' ? 'Live hotel rates' : 'Stay estimates'
    parsed.price_drift_warning = `${label} are ~${Math.round(pct * 100)}% above what the group budgeted during destination voting. Consider adjusting tier or dates.`
  }
}

function finalizeAnalysis(
  parsed: StayAnalysis,
  input: StayAnalysisInput,
  checkIn: string,
  checkOut: string,
  nights: number,
  rateSource: 'live' | 'estimate' | 'mixed',
  liveSources?: StayAnalysis['live_sources']
): StayAnalysis {
  parsed.generated_at = parsed.generated_at || new Date().toISOString()
  parsed.coordination_mode = (parsed.coordination_mode || input.coordination_mode) as StayCoordinationMode
  parsed.destination = parsed.destination || input.trip.destination
  parsed.date_range = parsed.date_range || { check_in: checkIn, check_out: checkOut }
  parsed.nights = parsed.nights || nights
  parsed.guest_count = parsed.guest_count || input.guest_count
  parsed.vote_estimate_per_night = input.vote_estimate_per_night
  parsed.stay_options = parsed.stay_options || []
  parsed.rate_source = rateSource
  parsed.live_sources = liveSources

  if (rateSource === 'mixed' && !parsed.data_disclaimer) {
    parsed.data_disclaimer =
      'Prices combine live hotel rates (LiteAPI) with AI suggestions. Totals change quickly — confirm on Booking.com or Expedia before booking.'
  } else if (rateSource === 'live' && !parsed.data_disclaimer) {
    parsed.data_disclaimer =
      'Prices are live search results and can change quickly. Confirm the total, dates, and cancellation policy before booking.'
  } else if (rateSource === 'estimate' && !parsed.data_disclaimer) {
    parsed.data_disclaimer =
      'Prices are AI estimates for planning. Search Booking.com, Expedia, or VRBO for live rates before booking.'
  }

  applyPriceDrift(parsed, input.vote_estimate_per_night)

  parsed.stay_options = ensureStayBookLinks(parsed.stay_options, {
    tripId: input.trip_id,
    destination: input.trip.destination,
    checkIn,
    checkOut,
    adults: input.guest_count,
  })

  return parsed
}

async function callStayAgent(
  system: string,
  payload: Record<string, unknown>,
  maxTokens = 12000
): Promise<StayAnalysis> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: JSON.stringify({ schema: OUTPUT_SCHEMA, input: payload }, null, 2) }],
  })
  const text = response.content.find(c => c.type === 'text')?.text || '{}'
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  return safeParseAnalysis(jsonMatch?.[0] || '{}')
}

export async function analyzeStayOptions(input: StayAnalysisInput): Promise<StayAnalysis> {
  const checkIn =
    input.trip.locked_date_start ||
    input.trip.start_date ||
    ''
  const checkOut =
    input.trip.locked_date_end ||
    input.trip.end_date ||
    ''

  const nights = Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000))

  const liveResult = await fetchLiveStaysForAnalysis(input)
  const liveOffers = liveResult.offers

  const payload = {
    trip: input.trip,
    coordination_mode: input.coordination_mode,
    mix_notes: input.mix_notes,
    guest_count: input.guest_count,
    vote_estimate_per_night: input.vote_estimate_per_night,
    travelers: input.travelers.map(t => ({
      id: t.id,
      name: t.name,
      step2: t.step2_summary,
      accommodation_pref: t.step2_accommodation,
      budget: t.step2_budget,
    })),
    member_prefs: input.member_prefs,
    live_offers: liveOffers,
    connected_sources: liveResult.sources,
  }

  if (liveOffers.length >= 3) {
    const enriched = await callStayAgent(
      `${STAY_AGENT_SYSTEM}\n\nEnrich the live_offers only. Do not change prices, ids, or book_links.`,
      payload,
      8000
    )
    const merged = mergeEnrichedStays(liveOffers, enriched.stay_options || [])
    return finalizeAnalysis(
      { ...enriched, stay_options: merged },
      input,
      checkIn,
      checkOut,
      nights,
      'live',
      liveResult.sources
    )
  }

  if (liveOffers.length > 0) {
    const enriched = await callStayAgent(STAY_AGENT_SYSTEM, payload)
    const merged = mergeEnrichedStays(liveOffers, enriched.stay_options || [])
    const aiExtras = (enriched.stay_options || []).filter(o => !liveOffers.some(l => l.id === o.id))
    const combined = [...merged, ...aiExtras].slice(0, 8)
    return finalizeAnalysis(
      { ...enriched, stay_options: combined },
      input,
      checkIn,
      checkOut,
      nights,
      'mixed',
      liveResult.sources
    )
  }

  const estimated = await callStayAgent(STAY_AGENT_SYSTEM, payload)
  return finalizeAnalysis(
    estimated,
    input,
    checkIn,
    checkOut,
    nights,
    liveResult.configured ? 'estimate' : 'estimate',
    liveResult.sources
  )
}
