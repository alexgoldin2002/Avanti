import type { RoundTwoPersonalContent, RoundOneContent } from './types'

/** Sentinel Round 1 card — Santorini demo copy. Keep in sync with UI fallback. */
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

/** Sentinel text — do not import from UI components (keeps server bundles clean). */
export const PLACEHOLDER_ROUND_TWO_PERSONAL: RoundTwoPersonalContent = {
  personal_fit_summary:
    'You said you wanted beaches, nightlife, and a celebratory vibe with friends — Santorini delivers on all three without feeling like a generic resort strip. The tradeoff is peak-season crowds in the main towns.',
  top_picks_for_you: [
    'Sunset catamaran with onboard dinner',
    'Beach club day in Perissa',
    'Late-night bars in Fira',
  ],
  watch_out_for:
    'July prices run high — your stated budget is workable but tight if the group wants private boat days.',
  fit_score: 8,
}

export const STALE_PERSONAL_MARKERS = ['Santorini', 'Perissa', 'Fira', 'Oia'] as const
