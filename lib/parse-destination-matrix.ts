import { isSingleCityPlace } from './matrix-geo-rules'
import { truncateBlurb } from './matrix-display-helpers'
import type { MatrixTabId } from './matrix-trip-shape'
import type { ParsedDestinationCard } from './parse-destination-cards'
import {
  categoryForLegacyIndex,
  normalizePairingCategory,
  PAIRING_CATEGORY_ORDER,
  pairingCardLabel,
  rankForLegacyIndex,
  resolvePairingCardTitle,
  type PairingCategory,
} from './matrix-pairing-categories'
import { resolveConsiderChip, resolveHighlightChip, dedupeConsiderChips, dedupeHighlightChips } from './matrix-chip-fields'

export type DestinationMatrixRow = {
  name: string
  overallScore: number
  budgetFit: string
  weather: string
  activities: string
  logistics: string
  groupFit: string
  vibe: string
  tradeoff: string
  highlight: string
  consider: string
  synopsis: string
}

export type { PairingCategory } from './matrix-pairing-categories'

export type DestinationMatrixCombo = {
  rank: number
  places: string[]
  label: string
  overallScore: number
  /** Set for pairings; omitted for triple-route cards */
  pairingCategory?: PairingCategory
  /** Card headline for pairings — replaces pro/con chips */
  pairingTitle?: string
  synopsis: string
  routing: string
  budgetFit: string
  tradeoff: string
}

export type DestinationMatrixResult = {
  rows: DestinationMatrixRow[]
  pairings: DestinationMatrixCombo[]
  triples: DestinationMatrixCombo[]
  summary: string
  recommendedTab: MatrixTabId | null
  recommendedShape: string
  rawBlock: string
}

function getField(clean: string, field: string): string {
  const regex = new RegExp(`^${field}:\\s*(.*)`, 'm')
  const match = clean.match(regex)
  if (!match) return ''

  const firstLine = match[1].trim()
  const startIdx = clean.indexOf(match[0]) + match[0].length
  const remaining = clean.slice(startIdx)

  const continuationLines: string[] = []
  for (const line of remaining.split('\n')) {
    if (/^[A-Z][A-Z0-9\s]+:/.test(line.trim()) && !line.trim().startsWith('-')) break
    continuationLines.push(line)
  }

  return (firstLine + '\n' + continuationLines.join('\n')).trim()
}

function parseScore(raw: string): number {
  const n = parseInt(raw.replace(/[^\d]/g, ''), 10)
  if (Number.isNaN(n)) return 0
  return Math.min(10, Math.max(0, n))
}

function parsePlaces(raw: string): string[] {
  return raw
    .split('|')
    .map(p => p.trim())
    .filter(Boolean)
}

function parseRank(raw: string, fallback: number): number {
  const n = parseInt(raw.replace(/[^\d]/g, ''), 10)
  return Number.isNaN(n) ? fallback : n
}

function chipContextFromSingleRow(clean: string) {
  return {
    synopsis: getField(clean, 'SYNOPSIS'),
    logistics: getField(clean, 'LOGISTICS'),
    groupFit: getField(clean, 'GROUP FIT'),
    activities: getField(clean, 'ACTIVITIES'),
    vibe: getField(clean, 'VIBE'),
    tradeoff: getField(clean, 'TRADEOFF'),
  }
}

function parseSingleRow(clean: string): DestinationMatrixRow | null {
  const name = getField(clean, 'NAME')
  if (!name || name.length < 2 || !isSingleCityPlace(name)) return null

  const ctx = chipContextFromSingleRow(clean)

  return {
    name,
    overallScore: parseScore(getField(clean, 'SCORE')),
    highlight: resolveHighlightChip(getField(clean, 'HIGHLIGHT'), ctx),
    consider: resolveConsiderChip(getField(clean, 'CONSIDER'), ctx.tradeoff, undefined, ctx),
    synopsis: ctx.synopsis,
    budgetFit: getField(clean, 'BUDGET FIT'),
    weather: getField(clean, 'WEATHER'),
    activities: ctx.activities,
    logistics: ctx.logistics,
    groupFit: ctx.groupFit,
    vibe: ctx.vibe,
    tradeoff: ctx.tradeoff,
  }
}

function parseComboRow(
  clean: string,
  index: number,
  pairingCategory: PairingCategory,
): DestinationMatrixCombo | null {
  const places = parsePlaces(getField(clean, 'PLACES'))
  if (places.length !== 2 || !places.every(isSingleCityPlace)) return null

  const rank = parseRank(getField(clean, 'RANK'), index + 1)
  const rawTitle = getField(clean, 'PAIRING TITLE').trim()
  const pairingTitle = resolvePairingCardTitle(rawTitle, places)

  return {
    rank,
    places,
    label: pairingCardLabel(places),
    overallScore: parseScore(getField(clean, 'SCORE')),
    pairingCategory,
    pairingTitle,
    synopsis: getField(clean, 'SYNOPSIS'),
    routing: getField(clean, 'ROUTING'),
    budgetFit: getField(clean, 'BUDGET FIT'),
    tradeoff: getField(clean, 'TRADEOFF'),
  }
}

function parsePairingCategorySection(
  text: string,
  startMarker: string,
  endMarkers: string[],
  category: PairingCategory,
): DestinationMatrixCombo[] {
  const idx = text.indexOf(startMarker)
  if (idx === -1) return []

  let block = text.slice(idx + startMarker.length)
  for (const end of endMarkers) {
    const endIdx = block.indexOf(end)
    if (endIdx !== -1) block = block.slice(0, endIdx)
  }

  const sections = block
    .split(/\n\s*---+\s*\n/)
    .map(s => s.trim())
    .filter(Boolean)

  const out: DestinationMatrixCombo[] = []
  sections.forEach((section, i) => {
    const clean = section.replace(/^(BUDGET|ACTIVITY VIBE|TRAVEL SIMPLICITY) PAIRINGS:\s*/im, '').trim()
    if (!clean.includes('PLACES:')) return
    const combo = parseComboRow(clean, i, category)
    if (combo) out.push(combo)
  })
  return out
}

function parseLegacyPairings(block: string): DestinationMatrixCombo[] {
  const rows = parseSectionRows(block, 'PAIRINGS:', 'combo') as DestinationMatrixCombo[]
  return rows.map((row, index) => {
    const category =
      row.pairingCategory ||
      normalizePairingCategory(String((row as { pairingFocus?: string }).pairingFocus || '')) ||
      categoryForLegacyIndex(index)
    const rank = row.rank || rankForLegacyIndex(index)
    return {
      ...row,
      rank,
      pairingCategory: category,
      pairingTitle: resolvePairingCardTitle(row.pairingTitle || '', row.places),
    }
  })
}

function parseAllPairings(block: string): DestinationMatrixCombo[] {
  const categorySections: Array<{ marker: string; category: PairingCategory; ends: string[] }> = [
    {
      marker: 'TRAVEL SIMPLICITY PAIRINGS:',
      category: 'travel_simplicity',
      ends: ['BUDGET PAIRINGS:', 'ACTIVITY VIBE PAIRINGS:', 'TRIPLES:', 'AVANTI_MATRIX_END'],
    },
    {
      marker: 'BUDGET PAIRINGS:',
      category: 'budget',
      ends: ['ACTIVITY VIBE PAIRINGS:', 'TRAVEL SIMPLICITY PAIRINGS:', 'TRIPLES:', 'AVANTI_MATRIX_END'],
    },
    {
      marker: 'ACTIVITY VIBE PAIRINGS:',
      category: 'activity_vibe',
      ends: ['TRAVEL SIMPLICITY PAIRINGS:', 'BUDGET PAIRINGS:', 'TRIPLES:', 'AVANTI_MATRIX_END'],
    },
  ]

  const out: DestinationMatrixCombo[] = []
  for (const { marker, category, ends } of categorySections) {
    out.push(...parsePairingCategorySection(block, marker, ends, category))
  }

  if (out.length < 6) {
    const legacy = parseLegacyPairings(block)
    const seen = new Set(out.map(p => `${p.pairingCategory}:${p.label.toLowerCase()}`))
    for (const row of legacy) {
      const key = `${row.pairingCategory}:${row.label.toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(row)
    }
  }

  return finalizePairings(out)
}

function finalizePairings(pairings: DestinationMatrixCombo[]): DestinationMatrixCombo[] {
  for (const p of pairings) {
    p.pairingTitle = resolvePairingCardTitle(p.pairingTitle || '', p.places)
  }
  const limited = limitPairingsPerCategory(pairings)
  for (const p of limited) {
    p.pairingTitle = pairingCardLabel(p.places)
  }
  return limited
}

function limitPairingsPerCategory(pairings: DestinationMatrixCombo[]): DestinationMatrixCombo[] {
  const byCategory = new Map<PairingCategory, DestinationMatrixCombo[]>()
  for (const cat of PAIRING_CATEGORY_ORDER) {
    byCategory.set(cat, [])
  }

  for (const p of pairings) {
    if (!p.pairingCategory) continue
    const list = byCategory.get(p.pairingCategory) || []
    if (list.length < 2) {
      list.push(p)
      byCategory.set(p.pairingCategory, list)
    }
  }

  return PAIRING_CATEGORY_ORDER.flatMap(cat => {
    const list = byCategory.get(cat) || []
    sortMatrixCombosByRank(list)
    list.forEach((p, i) => {
      p.rank = i + 1
      p.pairingCategory = cat
    })
    return list
  })
}

function parseTripleRow(clean: string, index: number): DestinationMatrixCombo | null {
  const places = parsePlaces(getField(clean, 'PLACES'))
  if (places.length !== 3 || !places.every(isSingleCityPlace)) return null

  const rank = parseRank(getField(clean, 'RANK'), index + 1)
  return {
    rank,
    places,
    label: pairingCardLabel(places),
    overallScore: parseScore(getField(clean, 'SCORE')),
    synopsis: getField(clean, 'SYNOPSIS'),
    routing: getField(clean, 'ROUTING'),
    budgetFit: getField(clean, 'BUDGET FIT'),
    tradeoff: getField(clean, 'TRADEOFF'),
  }
}

function parseSectionRows(
  text: string,
  marker: string,
  kind: 'single' | 'combo' | 'triple',
): Array<DestinationMatrixRow | DestinationMatrixCombo> {
  const idx = text.indexOf(marker)
  if (idx === -1) return []

  let block = text.slice(idx + marker.length)
  const endMarkers = [
    'AVANTI_MATRIX_END',
    'BUDGET PAIRINGS:',
    'ACTIVITY VIBE PAIRINGS:',
    'TRAVEL SIMPLICITY PAIRINGS:',
    'PAIRINGS:',
    'TRIPLES:',
    'RECOMMENDED_TAB:',
    'RECOMMENDED_SHAPE:',
  ]
  for (const end of endMarkers) {
    const endIdx = block.indexOf(end)
    if (endIdx !== -1) block = block.slice(0, endIdx)
  }

  const sections = block
    .split(/\n\s*---+\s*\n/)
    .map(s => s.trim())
    .filter(Boolean)

  const out: Array<DestinationMatrixRow | DestinationMatrixCombo> = []
  sections.forEach((section, i) => {
    const clean = section.replace(new RegExp(`^${marker.replace(':', '')}:\\s*`, 'm'), '').trim()
    if (kind === 'single' && clean.includes('NAME:')) {
      const row = parseSingleRow(clean)
      if (row) out.push(row)
    } else if (kind === 'combo' && clean.includes('PLACES:')) {
      const category = normalizePairingCategory(getField(clean, 'CATEGORY')) || 'travel_simplicity'
      const combo = parseComboRow(clean, i, category)
      if (combo) out.push(combo)
    } else if (kind === 'triple' && clean.includes('PLACES:')) {
      const combo = parseTripleRow(clean, i)
      if (combo) out.push(combo)
    }
  })

  return out
}

function parseRecommendedTab(raw: string): MatrixTabId | null {
  const v = raw.trim().toLowerCase()
  if (v.includes('pair')) return 'pairings'
  if (v.includes('triple') || v.includes('three')) return 'triples'
  if (v.includes('single') || v.includes('one')) return 'singles'
  return null
}

/** Parse one pairing category section from a partial AI response. */
export function parsePairingsForCategory(text: string, category: PairingCategory): DestinationMatrixCombo[] {
  const ends = [
    'AVANTI_MATRIX_END',
    'TRAVEL SIMPLICITY PAIRINGS:',
    'BUDGET PAIRINGS:',
    'ACTIVITY VIBE PAIRINGS:',
    'TRIPLES:',
    'RECOMMENDED_TAB:',
    'RECOMMENDED_SHAPE:',
  ]
  const markers: Record<PairingCategory, string> = {
    travel_simplicity: 'TRAVEL SIMPLICITY PAIRINGS:',
    budget: 'BUDGET PAIRINGS:',
    activity_vibe: 'ACTIVITY VIBE PAIRINGS:',
  }
  return parsePairingCategorySection(text, markers[category], ends, category)
}

/** Parse triple-route blocks from a partial AI response. */
export function parseMatrixTriples(text: string): DestinationMatrixCombo[] {
  const endIdx = text.indexOf('AVANTI_MATRIX_END')
  const block = endIdx !== -1 ? text.slice(0, endIdx) : text
  const triples = parseSectionRows(block, 'TRIPLES:', 'triple') as DestinationMatrixCombo[]
  sortMatrixCombosByRank(triples)
  return triples
}

/** Parse summary line and tab/shape recommendations. */
export function parseMatrixRecommendations(text: string): {
  summary: string
  recommendedTab: MatrixTabId | null
  recommendedShape: string
} {
  let summary = ''
  const endIdx = text.indexOf('AVANTI_MATRIX_END')
  if (endIdx !== -1) {
    summary = text.slice(endIdx + 'AVANTI_MATRIX_END'.length).trim()
    const recShapeIdx = summary.search(/^RECOMMENDED_SHAPE:/m)
    if (recShapeIdx !== -1) summary = summary.slice(0, recShapeIdx).trim()
    const recTabIdx = summary.search(/^RECOMMENDED_TAB:/m)
    if (recTabIdx !== -1) summary = summary.slice(0, recTabIdx).trim()
  }
  return {
    summary: truncateBlurb(summary),
    recommendedTab: parseRecommendedTab(getField(text, 'RECOMMENDED_TAB')),
    recommendedShape: truncateBlurb(getField(text, 'RECOMMENDED_SHAPE')),
  }
}

/** Parse only single-destination MATRIX rows from a partial AI response. */
export function parseDestinationMatrixRows(text: string): DestinationMatrixRow[] {
  const endIdx = text.indexOf('AVANTI_MATRIX_END')
  const block = endIdx !== -1 ? text.slice(0, endIdx) : text
  const singles = parseSectionRows(block, 'MATRIX:', 'single') as DestinationMatrixRow[]
  sortMatrixRowsByScore(singles)
  fillMissingConsiderChips({
    rows: singles,
    pairings: [],
    triples: [],
    summary: '',
    recommendedTab: null,
    recommendedShape: '',
    rawBlock: block,
  })
  return singles
}

/** Parse pairings, triples, and recommendations from a routes-only AI response. */
export function parseDestinationMatrixRoutes(text: string): Omit<DestinationMatrixResult, 'rows' | 'rawBlock'> {
  const parsed = parseDestinationMatrix(text)
  return {
    pairings: parsed.pairings,
    triples: parsed.triples,
    summary: parsed.summary,
    recommendedTab: parsed.recommendedTab,
    recommendedShape: parsed.recommendedShape,
  }
}

/** Parse AI matrix output into structured rows and itinerary combos. */
export function parseDestinationMatrix(text: string): DestinationMatrixResult {
  let summary = ''

  const endIdx = text.indexOf('AVANTI_MATRIX_END')
  const block = endIdx !== -1 ? text.slice(0, endIdx) : text
  if (endIdx !== -1) {
    summary = text.slice(endIdx + 'AVANTI_MATRIX_END'.length).trim()
    const recShapeIdx = summary.search(/^RECOMMENDED_SHAPE:/m)
    if (recShapeIdx !== -1) {
      summary = summary.slice(0, recShapeIdx).trim()
    }
    const recTabIdx = summary.search(/^RECOMMENDED_TAB:/m)
    if (recTabIdx !== -1) {
      summary = summary.slice(0, recTabIdx).trim()
    }
  }

  const singles = parseSectionRows(block, 'MATRIX:', 'single') as DestinationMatrixRow[]
  const pairings = parseAllPairings(block)
  const triples = parseSectionRows(block, 'TRIPLES:', 'triple') as DestinationMatrixCombo[]

  sortMatrixCombosByRank(triples)
  sortMatrixRowsByScore(singles)
  sortPairingsByCategory(pairings)

  const recommendedTab = parseRecommendedTab(getField(text, 'RECOMMENDED_TAB'))
  const recommendedShape = truncateBlurb(getField(text, 'RECOMMENDED_SHAPE'))
  summary = truncateBlurb(summary)

  let matrixBlock = block
  const start = matrixBlock.indexOf('MATRIX:')
  if (start !== -1) matrixBlock = matrixBlock.slice(start)

  const result: DestinationMatrixResult = {
    rows: singles,
    pairings,
    triples,
    summary,
    recommendedTab,
    recommendedShape,
    rawBlock: matrixBlock,
  }
  fillMissingConsiderChips(result)
  return result
}

function fillMissingConsiderChips(result: DestinationMatrixResult): void {
  enrichMatrixChipRows(result.rows)
  enrichMatrixChipRows(result.triples)
}

/** Sort single destinations by AI composite score, highest first. */
export function sortMatrixRowsByScore(rows: DestinationMatrixRow[]): void {
  rows.sort(
    (a, b) => b.overallScore - a.overallScore || a.name.localeCompare(b.name),
  )
}

export function sortMatrixCombosByRank(combos: DestinationMatrixCombo[]): void {
  combos.sort(
    (a, b) => a.rank - b.rank || b.overallScore - a.overallScore || a.label.localeCompare(b.label),
  )
}

export function sortPairingsByCategory(pairings: DestinationMatrixCombo[]): void {
  const order = new Map(PAIRING_CATEGORY_ORDER.map((cat, i) => [cat, i]))
  pairings.sort((a, b) => {
    const catA = a.pairingCategory ? order.get(a.pairingCategory) ?? 99 : 99
    const catB = b.pairingCategory ? order.get(b.pairingCategory) ?? 99 : 99
    if (catA !== catB) return catA - catB
    return a.rank - b.rank || b.overallScore - a.overallScore || a.label.localeCompare(b.label)
  })
}

export function enrichMatrixPairings(pairings: DestinationMatrixCombo[]): void {
  pairings.forEach((p, index) => {
    if (!p.pairingCategory) {
      p.pairingCategory = categoryForLegacyIndex(index)
    }
    p.pairingTitle = pairingCardLabel(p.places)
  })
  const finalized = finalizePairings(pairings)
  pairings.splice(0, pairings.length, ...finalized)
}

/** Re-resolve pro/con chips — fixes legacy sentence fragments in saved matrix data. */
export function enrichMatrixChipRows(rows: Array<{
  highlight?: string
  consider?: string
  tradeoff?: string
  synopsis?: string
  logistics?: string
  groupFit?: string
  activities?: string
  vibe?: string
}>): void {
  const isSingles = rows.length > 0 && !('rank' in rows[0])
  if (isSingles) {
    dedupeHighlightChips(rows)
    dedupeConsiderChips(rows)
    sortMatrixRowsByScore(rows as DestinationMatrixRow[])
    return
  }
  if (rows.length > 0) {
    sortMatrixCombosByRank(rows as DestinationMatrixCombo[])
  }
}

/** Convert matrix row to card shape for voting submit pipeline. */
export function matrixRowToCard(row: DestinationMatrixRow) {
  return {
    name: row.name,
    highlight: row.highlight,
    consider: row.consider,
    synopsis: row.synopsis,
    logistics: row.logistics,
    cost: row.budgetFit,
    weather: row.weather,
    activities: row.activities,
    groupFit: row.groupFit,
    vibeCheck: row.vibe,
    tradeoff: row.tradeoff,
    isWildcard: false,
    isPairing: false,
  }
}

/** Convert ranked pairing or triple to a single submit/vote card. */
export function matrixComboToCard(combo: DestinationMatrixCombo) {
  const isTriple = combo.places.length >= 3
  return {
    name: combo.label,
    highlight: combo.pairingTitle || combo.label,
    consider: '',
    synopsis: combo.synopsis,
    logistics: combo.routing,
    cost: combo.budgetFit,
    weather: '',
    activities: '',
    groupFit: '',
    vibeCheck: '',
    tradeoff: combo.tradeoff,
    isWildcard: false,
    isPairing: !isTriple && combo.places.length >= 2,
    isTriple,
    pairingPlaces: combo.places,
    pairingTitle: combo.pairingTitle,
    pairingCategory: combo.pairingCategory,
  }
}

/** Parse a single MATRIX row from a small AI response (regenerate-one flow). */
export function parseSingleMatrixRowFromText(text: string): DestinationMatrixRow | null {
  const sections = text
    .split(/\n\s*---+\s*\n/)
    .map(s => s.trim())
    .filter(Boolean)

  for (const section of sections) {
    const clean = section.replace(/^MATRIX:\s*/im, '').trim()
    if (!clean.includes('NAME:')) continue
    const row = parseSingleRow(clean)
    if (row) return row
  }

  if (text.includes('NAME:')) {
    return parseSingleRow(text.replace(/^MATRIX:\s*/im, '').trim())
  }

  return null
}

/** Singles + multi-stop cards for the considering-path submit pipeline. */
export function buildConsideringPathCards(
  rows: DestinationMatrixRow[],
  pairings: DestinationMatrixCombo[],
  triples: DestinationMatrixCombo[] = [],
) {
  const sortedRows = [...rows]
  sortMatrixRowsByScore(sortedRows)
  const sortedPairings = [...pairings]
  sortPairingsByCategory(sortedPairings)
  const sortedTriples = [...triples]
  sortMatrixCombosByRank(sortedTriples)
  return [
    ...sortedRows.map(matrixRowToCard),
    ...sortedPairings.map(matrixComboToCard),
    ...sortedTriples.map(matrixComboToCard),
  ]
}

/** Submit pipeline cards — prefer rebuilding from matrix when present (handles stale stored cards). */
export function resolveStep2SubmitCards(step2: Record<string, unknown>): ParsedDestinationCard[] {
  const matrix = step2.matrix
  if (Array.isArray(matrix) && matrix.length > 0) {
    const pairings = Array.isArray(step2.matrixPairings)
      ? (step2.matrixPairings as DestinationMatrixCombo[])
      : []
    const triples = Array.isArray(step2.matrixTriples)
      ? (step2.matrixTriples as DestinationMatrixCombo[])
      : []
    return buildConsideringPathCards(matrix as DestinationMatrixRow[], pairings, triples)
  }
  return Array.isArray(step2.cards) ? (step2.cards as ParsedDestinationCard[]) : []
}
