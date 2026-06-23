import type { ParsedDestinationCard } from '@/lib/parse-destination-cards'
import type { RoundOneContent, RoundTwoPersonalContent } from '@/lib/voting/types'
import BaseDestinationCard from '@/app/components/DestinationCard'

export const PLACEHOLDER_GROUP_BUDGET = {
  min: 900,
  max: 2100,
}

export const PLACEHOLDER_ROUND_ONE: RoundOneContent = {
  overview:
    'A sun-drenched Mediterranean island chain known for whitewashed villages, volcanic beaches, and a relaxed pace that suits both celebration trips and slow cultural wandering. Appeals to groups who want scenery, food, and nightlife without a packed sightseeing schedule.',
  best_known_for: [
    'Caldera sunsets',
    'Island hopping',
    'Fresh seafood tavernas',
    'Volcanic beaches',
    'Vibrant summer nightlife',
  ],
  activities: [
    'Boat days to hidden coves',
    'Wine tasting in hillside villages',
    'Sunset dinner in Oia',
    'Hiking coastal trails',
    'Old town market mornings',
    'Beach club afternoons',
  ],
  weather: 'Late June: ~82°F, virtually no rain, strong afternoon winds off the sea.',
}

export const PLACEHOLDER_ROUND_TWO_PERSONAL: RoundTwoPersonalContent = {
  personal_fit_summary:
    'You said you wanted beaches, nightlife, and a celebratory vibe with friends — Santorini delivers on all three without feeling like a generic resort strip. The tradeoff is peak-season crowds in the main towns.',
  top_picks_for_you: [
    'Sunset catamaran with onboard dinner',
    'Beach club day in Perissa',
    'Late-night bars in Fira',
  ],
  watch_out_for: 'July prices run high — your stated budget is workable but tight if the group wants private boat days.',
  fit_score: 8,
}

export const PLACEHOLDER_DESTINATION: ParsedDestinationCard = {
  name: 'Santorini, Greece',
  highlight: 'Iconic caldera views',
  consider: 'Peak-season crowds',
  synopsis:
    'Whitewashed cliffs, volcanic beaches, and long golden-hour dinners — a classic group celebration destination with easy island-hopping nearby.',
  logistics: 'Most groups fly into Athens then ferry or short-hop flight to JTR. Direct seasonal flights from major US hubs in summer.',
  cost: '$1,200–$2,400 / person all-in\nFlights: $600–900 · Stay: $120–220/night · Food & fun: $50–80/day',
  weather: 'June–August: 78–85°F, dry, windy afternoons',
  activities: 'Boat tours · Wine villages · Beach clubs · Hiking · Old town exploring',
  groupFit: 'Strong for friend groups who want a mix of relaxation and nightlife',
  vibeCheck: 'Upscale-casual — dress up for dinner, sandals by day',
  isWildcard: false,
}

export function formatBudgetLine(floor: number | null, ceiling: number | null): string {
  const min = floor ?? PLACEHOLDER_GROUP_BUDGET.min
  const max = ceiling ?? PLACEHOLDER_GROUP_BUDGET.max
  return `$${min.toLocaleString()} — $${max.toLocaleString()} / person`
}

type GroupCardProps = {
  card?: ParsedDestinationCard
  tripId?: string
  hideMap?: boolean
}

/** Full detailed card for group viewing (Round 2 and Learn more). */
export function GroupDestinationCard({ card = PLACEHOLDER_DESTINATION, tripId, hideMap = false }: GroupCardProps) {
  return (
    <BaseDestinationCard
      card={card}
      tripId={tripId}
      previewMode
      hideMap={hideMap}
    />
  )
}

export { BaseDestinationCard as DestinationCard }
