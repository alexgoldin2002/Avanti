export type ParsedDestinationCard = {
  name: string
  highlight?: string
  consider?: string
  synopsis: string
  logistics: string
  cost: string
  weather: string
  activities: string
  groupFit: string
  vibeCheck?: string
  footnotes?: string
  tradeoff?: string
  isWildcard: boolean
}

export type ParseDestinationCardsResult = {
  cards: ParsedDestinationCard[]
  closing: string
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
    if (/^[A-Z][A-Z\s]+:/.test(line.trim()) && !line.trim().startsWith('-')) break
    continuationLines.push(line)
  }

  return (firstLine + '\n' + continuationLines.join('\n')).trim()
}

/** Parse AI destination output into structured cards. */
export function parseDestinationCards(text: string): ParseDestinationCardsResult {
  const cards: ParsedDestinationCard[] = []
  let closing = ''

  const endIdx = text.indexOf('AVANTI_CARDS_END')
  const cardsBlock = endIdx !== -1 ? text.slice(0, endIdx) : text
  if (endIdx !== -1) {
    closing = text.slice(endIdx + 'AVANTI_CARDS_END'.length).trim()
  }

  let block = cardsBlock
  const destStart = block.indexOf('DESTINATIONS:')
  if (destStart !== -1) block = block.slice(destStart)
  if (!block.includes('NAME:')) {
    return { cards, closing, rawBlock: block }
  }

  // Accept --- separators with or without surrounding newlines (model output varies).
  const sections = block
    .split(/\n\s*---+\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0)

  for (const section of sections) {
    if (!section.includes('NAME:')) continue
    if (section.trim() === 'DESTINATIONS:') continue

    const isWildcard = /WILDCARD:/i.test(section)
    const clean = section
      .replace(/^WILDCARD:\s*/m, '')
      .replace(/^DESTINATIONS:\s*/m, '')
      .trim()

    const name = getField(clean, 'NAME')
    if (!name || name.length < 2) continue

    cards.push({
      name,
      highlight: getField(clean, 'HIGHLIGHT') || undefined,
      consider: getField(clean, 'CONSIDER') || undefined,
      synopsis: getField(clean, 'SYNOPSIS'),
      logistics: getField(clean, 'LOGISTICS'),
      cost: getField(clean, 'COST'),
      weather: getField(clean, 'WEATHER'),
      activities: getField(clean, 'ACTIVITIES'),
      groupFit: getField(clean, 'GROUP FIT'),
      vibeCheck: getField(clean, 'VIBE CHECK') || undefined,
      footnotes: getField(clean, 'FOOTNOTES') || undefined,
      tradeoff: getField(clean, 'TRADEOFF') || undefined,
      isWildcard,
    })
  }

  return { cards, closing, rawBlock: block }
}
