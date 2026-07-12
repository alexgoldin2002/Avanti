export const TRIP_BRIEF_START = 'TRIP_BRIEF_START'
export const TRIP_BRIEF_END = 'TRIP_BRIEF_END'

export function extractTripBriefBlock(text: string): string | null {
  const start = text.indexOf(TRIP_BRIEF_START)
  const end = text.indexOf(TRIP_BRIEF_END)
  if (start === -1 || end === -1 || end <= start) return null
  return text.slice(start, end + TRIP_BRIEF_END.length).trim()
}

export function isValidTripBrief(brief: string | null | undefined): boolean {
  if (!brief?.trim()) return false
  const required = [
    'STORY_HIGHLIGHTS:',
    'GROUP_PROFILE:',
    'PACE_AND_STOPS:',
    'RECOMMENDED_SHAPE:',
  ]
  return required.every(key => brief.includes(key))
}

export function parseTripBrief(text: string): string | null {
  const block = extractTripBriefBlock(text)
  if (!block || !isValidTripBrief(block)) return null
  return block
}
