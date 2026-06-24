import type { RoundTwoPersonalContent } from './types'

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
