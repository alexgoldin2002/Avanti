import type { ParsedDestinationCard } from '@/lib/parse-destination-cards'
import { PLACEHOLDER_ROUND_ONE, PLACEHOLDER_ROUND_TWO_PERSONAL } from '@/lib/voting/constants'
import BaseDestinationCard from '@/app/components/DestinationCard'

export { PLACEHOLDER_ROUND_TWO_PERSONAL, PLACEHOLDER_ROUND_ONE }

export const PLACEHOLDER_GROUP_BUDGET = {
  min: 900,
  max: 2100,
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
}

/** Full detailed card for group viewing (Round 2 and Learn more). */
export function GroupDestinationCard({ card = PLACEHOLDER_DESTINATION, tripId }: GroupCardProps) {
  return (
    <BaseDestinationCard
      card={card}
      tripId={tripId}
      previewMode
    />
  )
}

export { BaseDestinationCard as DestinationCard }
