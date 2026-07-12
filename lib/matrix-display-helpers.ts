/** One-line trip takeaway — shape only; summary lives in the page header. */
export function compactMatrixBlurb(recommendedShape?: string, summary?: string): string {
  const shape = stripMarkdown(recommendedShape || '').trim()
  if (shape) return truncateBlurb(shape, 100)
  const body = stripMarkdown(summary || '').trim()
  return truncateBlurb(body, 100)
}

export function truncateBlurb(text: string, max = 140): string {
  const oneLine = stripMarkdown(text).replace(/\s+/g, ' ').trim()
  if (!oneLine) return ''
  if (oneLine.length <= max) return oneLine
  return `${oneLine.slice(0, max - 1).trim()}…`
}

function stripMarkdown(text: string): string {
  return text.replace(/\*\*/g, '').replace(/\*/g, '').trim()
}
