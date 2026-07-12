/** Prompt rules + validation for one-stop vs pairing vs triple granularity. */

export const MATRIX_GEO_RULES = `ITINERARY SHAPE RULES (critical — each section has a different granularity):
- ONE STOP (MATRIX rows): Each row is exactly **one city in one country**. NAME format: "City, Country" (e.g. "Lisbon, Portugal"). Never put multi-city routes here — no "+", "·", slashes between cities, or multiple cities in one NAME.
- PAIRINGS: Exactly **two stops** — PLACES has exactly two segments separated by |. Each segment is **one city + country** (e.g. "Lisbon, Portugal | Barcelona, Spain"). A pairing may be two cities in the **same country** (e.g. "Lisbon, Portugal | Porto, Portugal") or two cities in **different countries** — but never more than one city per side.
- TRIPLES: Exactly **three stops** — PLACES has exactly three segments separated by |. Each segment is **one city + country** (e.g. "Bangkok, Thailand | Chiang Mai, Thailand | Bali, Indonesia"). Prefer three cities in one country or one region when routing is easy; cross-country triples only when practical.
- Multi-city routes belong in PAIRINGS (2 cities) or TRIPLES (3 cities), never in MATRIX.`

/** True when a place string looks like a single city (not a multi-stop route). */
export function isSingleCityPlace(place: string): boolean {
  const p = place.trim()
  if (!p || p.length < 2) return false
  if (/[·+]/.test(p)) return false
  if (/\s+and\s+/i.test(p)) return false
  if (/\//.test(p)) return false
  return true
}

/** Card headline from validated single-city place strings. */
export function comboLabelFromPlaces(places: string[]): string {
  return places
    .map(place => place.split(',')[0]?.trim() || place.trim())
    .join(' · ')
}
