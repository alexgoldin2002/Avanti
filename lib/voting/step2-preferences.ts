import type { RoundTwoPersonalContent } from './types'

function asString(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (value == null) return ''
  return String(value).trim()
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(v => asString(v)).filter(Boolean)
}

/** Human-readable Step 2 answers for AI prompts and fallbacks. */
export function summarizeStep2ForPrompt(step2: Record<string, unknown> | null | undefined): string {
  const s2 = step2 || {}
  const lines: string[] = []

  const q1 = asString(s2.q1)
  if (q1) lines.push(`Trip context: ${q1}`)

  const departure = asString(s2.departureCity)
  if (departure) lines.push(`Departing from: ${departure}`)

  const dates = asString(s2.dates)
  const fixed = s2.fixedDates as { start?: string; end?: string } | undefined
  if (dates) {
    if (dates === 'Fixed dates' && fixed?.start && fixed?.end) {
      lines.push(`Dates: ${fixed.start} to ${fixed.end}`)
    } else if (fixed?.start && fixed?.end) {
      lines.push(`Date range: ${fixed.start} to ${fixed.end}`)
    } else {
      lines.push(`Dates: ${dates}`)
    }
  }

  const flexLength = asString(s2.flexLength)
  if (flexLength) lines.push(`Trip length preference: ${flexLength}`)

  const domestic = asString(s2.domestic)
  if (domestic) lines.push(`Domestic vs international: ${domestic}`)

  const regions = asStringList(s2.regions)
  if (regions.length) lines.push(`Regions of interest: ${regions.join(', ')}`)

  const stops = asString(s2.stops)
  if (stops) lines.push(`Multi-stop preference: ${stops}`)

  const activities = asStringList(s2.activities)
  if (activities.length) lines.push(`Activities they want: ${activities.join(', ')}`)

  const vibe = asStringList(s2.vibe)
  if (vibe.length) lines.push(`Vibe: ${vibe.join(', ')}`)

  const accommodation = asString(s2.accommodation)
  if (accommodation) lines.push(`Accommodation style: ${accommodation}`)

  const budget = asString(s2.budget)
  if (budget) lines.push(`Budget comfort: ${budget}`)

  const popularity = asString(s2.popularity)
  if (popularity) lines.push(`Crowd preference: ${popularity}`)

  const q3 = asString(s2.q3)
  if (q3) lines.push(`Anything else: ${q3}`)

  return lines.length ? lines.join('\n') : 'No Step 2 preferences saved yet.'
}

export function hasStep2Preferences(step2: Record<string, unknown> | null | undefined): boolean {
  const summary = summarizeStep2ForPrompt(step2)
  return summary !== 'No Step 2 preferences saved yet.'
}

function destinationShortName(destinationName: string): string {
  return destinationName.split(',')[0]?.trim() || destinationName
}

/** Rule-based panel when AI is unavailable — still destination- and preference-specific. */
export function buildFallbackRoundTwoPersonalContent(
  destinationName: string,
  step2: Record<string, unknown> | null | undefined,
  cardSnapshot?: Record<string, unknown> | null
): RoundTwoPersonalContent {
  const short = destinationShortName(destinationName)
  const s2 = step2 || {}
  const activities = asStringList(s2.activities)
  const vibe = asStringList(s2.vibe)
  const budget = asString(s2.budget)
  const accommodation = asString(s2.accommodation)
  const synopsis = asString(cardSnapshot?.synopsis)
  const consider = asString(cardSnapshot?.consider)

  const prefBits = [
    vibe.length ? `${vibe.join(' & ')} vibe` : '',
    activities.length ? activities.slice(0, 3).join(', ') : '',
    accommodation ? `${accommodation.toLowerCase()} stays` : '',
  ].filter(Boolean)

  const prefPhrase = prefBits.length
    ? prefBits.join('; ')
    : 'your Step 2 trip preferences'

  let summary = `For ${destinationName}, mapped to ${prefPhrase}.`
  if (synopsis) {
    summary += ` ${synopsis}`
  } else {
    summary += ` This is how ${short} could fit what you told us in Brainstorm.`
  }

  const topPicks = activities.length
    ? activities.slice(0, 3).map(a => `${a} in ${short}`)
    : [
        `Explore ${short} with your group`,
        vibe[0] ? `${vibe[0]} experiences in ${short}` : `Local highlights in ${short}`,
        accommodation ? `${accommodation} base for day trips` : `A relaxed day in ${short}`,
      ]

  let watchOut = consider || 'Confirm flight time and seasonality for your travel dates.'
  if (budget) {
    watchOut += ` Your stated budget (${budget}) may feel tight or comfortable depending on flights and lodging.`
  }

  return {
    personal_fit_summary: summary,
    top_picks_for_you: topPicks,
    watch_out_for: watchOut,
    fit_score: prefBits.length >= 2 ? 7 : 6,
  }
}
