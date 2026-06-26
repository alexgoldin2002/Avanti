export type PairingCategory = 'travel_simplicity' | 'budget' | 'activity_vibe'

/** Display order in the Pairings tab */
export const PAIRING_CATEGORY_ORDER: PairingCategory[] = [
  'travel_simplicity',
  'budget',
  'activity_vibe',
]

export const PAIRING_CATEGORY_SECTION_LABELS: Record<PairingCategory, string> = {
  travel_simplicity: 'Easiest Travel Itinerary',
  budget: 'Best Mix of Budget',
  activity_vibe: 'Best Activity & Vibe Mix',
}

export function normalizePairingCategory(raw: string): PairingCategory | null {
  const t = raw.trim().toLowerCase()
  if (!t) return null
  if (t.includes('budget')) return 'budget'
  if (t.includes('activity') || t.includes('vibe')) return 'activity_vibe'
  if (t.includes('travel') || t.includes('simplic') || t.includes('easiest')) return 'travel_simplicity'
  return null
}

export function pairingCardLabel(places: string[]): string {
  return places.map(p => p.split(',')[0]?.trim() || p).join(' · ')
}

/** AI sometimes repeats the section name instead of naming the pair. */
export function isGenericPairingTitle(title: string): boolean {
  const t = title.trim().toLowerCase()
  if (!t) return true
  if (/^(easiest travel|best mix of budget|best budget|best activity|runner-up|pairing)/i.test(t)) return true
  if (/itinerary|travel simplicity|activity.*vibe mix|budget pairing/i.test(t) && !/[·|]/.test(t)) return true
  return false
}

export function resolvePairingCardTitle(rawTitle: string, places: string[]): string {
  const label = pairingCardLabel(places)
  const trimmed = rawTitle.trim()
  if (!trimmed || isGenericPairingTitle(trimmed)) return label
  if (trimmed.toLowerCase() === label.toLowerCase()) return label
  return label
}

export function categoryForLegacyIndex(index: number): PairingCategory {
  return PAIRING_CATEGORY_ORDER[Math.floor(index / 2)] ?? 'travel_simplicity'
}

export function rankForLegacyIndex(index: number): number {
  return (index % 2) + 1
}
