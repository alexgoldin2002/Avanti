/** Prompt rules + validation for one-stop vs pairing vs triple granularity. */

export const MATRIX_SHAPE_RULES = `ITINERARY SHAPE RULES (critical — each section has a different granularity):
- ONE STOP (MATRIX rows): Each row is exactly **one city in one country**. NAME format: "City, Country" (e.g. "Lisbon, Portugal"). Never put multi-city routes here — no "+", "·", slashes between cities, or multiple cities in one NAME.
- PAIRINGS: Exactly **two stops** — PLACES has exactly two segments separated by |. Each segment is **one city + country** (e.g. "Lisbon, Portugal | Barcelona, Spain"). A pairing may be two cities in the **same country** (e.g. "Lisbon, Portugal | Porto, Portugal") or two cities in **different countries** — but never more than one city per side.
- TRIPLES: Exactly **three stops** — PLACES has exactly three segments separated by |. Each segment is **one city + country** (e.g. "Bangkok, Thailand | Chiang Mai, Thailand | Bali, Indonesia"). Prefer three cities in one country or one region when routing is easy; cross-country triples only when practical.
- Multi-city routes belong in PAIRINGS (2 cities) or TRIPLES (3 cities), never in MATRIX.`

export const MATRIX_UNIQUENESS_RULES = `UNIQUENESS RULES (critical — duplicates are forbidden):
- MATRIX: Every row must be a **different city**. Never list the same city twice (e.g. do not output Queenstown three times with different blurbs).
- PAIRINGS: Each **unordered city pair** may appear only once across ALL categories. "Lisbon · Medellín" and "Medellín · Lisbon" are the same pairing — include it once total, not twice.
- TRIPLES: Each route must use a **different set of three cities**. Reordering the same three cities (e.g. Medellín·Cape Town·Lisbon vs Lisbon·Cape Town·Medellín) is forbidden — that is one route, not three.`

export const MATRIX_ROUTING_RULES = `ROUTING REALISM (critical — respect geography and the group's departure city):
- Minimize backtracking and redundant ocean crossings. A 2-week trip should not bounce US → Europe → South America → US, or US → Europe → Africa → Oceania.
- PAIRINGS: Prefer **one region** or a **logical travel corridor** — e.g. Spain + Portugal, Colombia + Costa Rica, Thailand + Vietnam, Italy + Greece. Cross-ocean pairings (Europe + South America, Europe + Oceania, Americas + Africa) waste days on flights — **do not suggest them** for typical vacation lengths unless the group explicitly wants a round-the-world trip.
- TRIPLES: Prefer three cities in one country/region, or a sensible overland loop (e.g. Bangkok → Chiang Mai → Bali). Never stitch three random continents together.
- In ROUTING and LOGISTICS fields, describe a **realistic flight path** from their departure city — no "fly to Europe then backtrack to South America."`

/** @deprecated Use MATRIX_SHAPE_RULES — kept for imports that expect the old name. */
export const MATRIX_GEO_RULES = `${MATRIX_SHAPE_RULES}

${MATRIX_UNIQUENESS_RULES}

${MATRIX_ROUTING_RULES}`

/** Normalize a city or "City, Country" string for deduplication. */
export function normalizeCityKey(place: string): string {
  return place.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Unordered key for pairings/triples — A·B equals B·A. */
export function comboUnorderedKey(places: string[]): string {
  return [...places].map(normalizeCityKey).sort().join('|')
}

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

export type DestinationMatrixRowLike = { name: string; overallScore: number }

/** Keep the highest-scoring row per unique city. */
export function dedupeMatrixRows<T extends DestinationMatrixRowLike>(rows: T[]): T[] {
  const seen = new Map<string, T>()
  for (const row of rows) {
    const key = normalizeCityKey(row.name)
    const existing = seen.get(key)
    if (!existing || row.overallScore > existing.overallScore) {
      seen.set(key, row)
    }
  }
  return Array.from(seen.values())
}

export type DestinationMatrixComboLike = {
  places: string[]
  rank: number
  overallScore: number
  label: string
}

/** Drop pairings/triples that repeat the same unordered city set. */
export function dedupeMatrixCombos<T extends DestinationMatrixComboLike>(combos: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const combo of combos) {
    const key = comboUnorderedKey(combo.places)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(combo)
  }
  return out
}

/** Hint injected into user prompts based on departure city. */
export function describeRoutingRealismHint(departure: string): string {
  const dep = departure.trim() || 'their departure city'
  return `Routing from ${dep}: no US→Europe→South America backtracking; no Europe+Oceania or Europe+South America pairings for a ~2-week trip; triples must be three different city sets (not reorderings).`
}
