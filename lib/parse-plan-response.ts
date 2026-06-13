export interface PlanCardBullet {
  text: string
  type: 'positive' | 'warning'
}

export interface PlanCardDetails {
  avanti_take?: string
  pros?: string[]
  cons?: string[]
  weather?: string
  getting_there?: string
}

export interface PlanDestinationCard {
  title: string
  price: number
  priceRange: string
  priceNote?: string
  tagline: string
  bullets: PlanCardBullet[]
  details?: PlanCardDetails
  bottomLine: string
}

const CARD_FIELD_PATTERN =
  /^(DESTINATION|TAGLINE|GETTING THERE|COST|WEATHER|ACTIVITIES|FLEXIBILITY|FOOTNOTES|TRADEOFF|WILDCARD):\s*(.*)$/

function parseBlock(block: string): Record<string, string> {
  const fields: Record<string, string> = {}
  let currentKey: string | null = null

  for (const line of block.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed === '[same format]') continue

    const match = trimmed.match(CARD_FIELD_PATTERN)
    if (match) {
      currentKey = match[1]
      fields[currentKey] = match[2]
    } else if (currentKey) {
      fields[currentKey] = fields[currentKey] ? `${fields[currentKey]} ${trimmed}` : trimmed
    }
  }

  return fields
}

function parseCost(costStr: string): { price: number; priceRange: string; priceNote?: string } {
  const rangeMatch = costStr.match(/\$?\s*([\d,]+)\s*[–-]\s*\$?\s*([\d,]+)/)
  if (rangeMatch) {
    const low = parseInt(rangeMatch[1].replace(/,/g, ''), 10)
    const high = parseInt(rangeMatch[2].replace(/,/g, ''), 10)
    const perDay = /\/\s*day/i.test(costStr)
    return {
      price: Math.round((low + high) / 2),
      priceRange: perDay ? `${low}–${high}/day` : `${low}–${high}`,
      priceNote: perDay ? 'per person per day' : undefined,
    }
  }

  const singleMatch = costStr.match(/\$?\s*([\d,]+)/)
  if (singleMatch) {
    const value = parseInt(singleMatch[1].replace(/,/g, ''), 10)
    return { price: value, priceRange: String(value) }
  }

  return { price: 0, priceRange: 'TBD' }
}

function fieldsToCard(fields: Record<string, string>, isWildcard: boolean): PlanDestinationCard | null {
  const title = fields.DESTINATION?.trim()
  if (!title) return null

  const { price, priceRange, priceNote } = parseCost(fields.COST || '')
  const bullets: PlanCardBullet[] = []

  if (fields.FLEXIBILITY) {
    bullets.push({ text: fields.FLEXIBILITY, type: 'positive' })
  }
  if (fields.FOOTNOTES) {
    bullets.push({ text: fields.FOOTNOTES, type: 'warning' })
  }
  if (isWildcard && fields.TRADEOFF) {
    bullets.push({ text: fields.TRADEOFF, type: 'warning' })
  }

  const details: PlanCardDetails = {}
  if (fields.ACTIVITIES) details.avanti_take = fields.ACTIVITIES
  if (fields['GETTING THERE']) details.getting_there = fields['GETTING THERE']
  if (fields.WEATHER) details.weather = fields.WEATHER
  if (isWildcard && fields.TRADEOFF) details.cons = [fields.TRADEOFF]

  return {
    title,
    price,
    priceRange,
    priceNote: isWildcard ? 'Another angle' : priceNote,
    tagline: fields.TAGLINE || '',
    bullets,
    details: Object.keys(details).length > 0 ? details : undefined,
    bottomLine: isWildcard
      ? fields.TRADEOFF || fields.TAGLINE || ''
      : fields.ACTIVITIES?.split('.')[0] || fields.TAGLINE || '',
  }
}

export function parsePlanCardsSection(section: string): PlanDestinationCard[] {
  const cards: PlanDestinationCard[] = []

  for (const block of section.split(/^---$/m)) {
    const trimmed = block.trim()
    if (!trimmed) continue

    const isWildcard = /^WILDCARD:/m.test(trimmed)
    const fields = parseBlock(trimmed)
    const card = fieldsToCard(fields, isWildcard)
    if (card) cards.push(card)
  }

  return cards
}

export function parsePlanCards(text: string): PlanDestinationCard[] | null {
  const cardsIndex = text.search(/^CARDS:\s*$/m)
  if (cardsIndex === -1 && !text.includes('CARDS:')) return null

  const start = text.indexOf('CARDS:')
  if (start === -1) return null

  const section = text.slice(start + 'CARDS:'.length)
  const cards = parsePlanCardsSection(section)
  return cards.length > 0 ? cards : null
}

export function parsePlanQuestion(text: string): { question: string; options: string[] } | null {
  const questionMatch = text.match(/^QUESTION:\s*(.+)$/m)
  if (!questionMatch) return null

  const question = questionMatch[1].trim()
  const optionsMatch = text.match(/^OPTIONS:\s*(.+)$/m)
  if (!optionsMatch) return { question, options: [] }

  const options = optionsMatch[1]
    .split('|')
    .map(option => option.trim().replace(/^\[|\]$/g, ''))
    .filter(Boolean)

  return { question, options }
}

export function parseLegacyJsonCards(text: string): PlanDestinationCard[] | null {
  const match = text.match(/<<<CARDS>>>([\s\S]*?)<<<END_CARDS>>>/)
  if (!match) return null

  try {
    return JSON.parse(match[1].trim()) as PlanDestinationCard[]
  } catch {
    return null
  }
}

export function stripPlanCardsBlock(text: string): string {
  let clean = text

  if (clean.includes('CARDS:')) {
    clean = clean.slice(0, clean.indexOf('CARDS:')).trim()
  }

  clean = clean.replace(/<<<CARDS>>>[\s\S]*?<<<END_CARDS>>>/, '').trim()
  return clean
}

export function parsePlanResponse(text: string): {
  text: string
  cards: PlanDestinationCard[] | null
  options: string[] | null
  openText: boolean
} {
  const newCards = parsePlanCards(text)
  if (newCards) {
    return {
      text: stripPlanCardsBlock(text),
      cards: newCards,
      options: null,
      openText: false,
    }
  }

  const legacyCards = parseLegacyJsonCards(text)
  if (legacyCards) {
    return {
      text: stripPlanCardsBlock(text),
      cards: legacyCards,
      options: null,
      openText: false,
    }
  }

  const question = parsePlanQuestion(text)
  if (question) {
    const openText =
      question.options.length === 1 && question.options[0].toLowerCase() === 'open text'
    return {
      text: question.question,
      cards: null,
      options: openText ? null : question.options.length > 0 ? question.options : null,
      openText,
    }
  }

  return { text, cards: null, options: null, openText: false }
}
