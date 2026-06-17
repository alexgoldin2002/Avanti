export type ChatMessage = { role: 'user' | 'assistant'; content: string }

/** Pull explicit group sizes from free text (Q1, Q3, chat). */
export function inferGroupSizeFromText(...texts: (string | undefined)[]): number | null {
  const combined = texts.filter(Boolean).join('\n')
  if (!combined.trim()) return null

  let max = 0

  for (const m of combined.matchAll(/(\d{1,2})\s*(?:people|travelers|travellers|guests|adults|ppl)\b/gi)) {
    max = Math.max(max, parseInt(m[1], 10))
  }

  for (const m of combined.matchAll(/(\d{1,2})\s+(?:people\s+)?from\s+[A-Z]{3}\b/g)) {
    max = Math.max(max, parseInt(m[1], 10))
  }

  const cityCounts = [...combined.matchAll(/(\d{1,2})\s+(?:people\s+)?from\s+[A-Z]{3}\b/g)]
  if (cityCounts.length >= 2) {
    const sum = cityCounts.reduce((s, m) => s + parseInt(m[1], 10), 0)
    max = Math.max(max, sum)
  }

  for (const m of combined.matchAll(/\bgroup\s+of\s+(\d{1,2})\b/gi)) {
    max = Math.max(max, parseInt(m[1], 10))
  }

  return max >= 2 ? max : null
}

export function resolveGroupSize(options: {
  dbCount: number
  answers?: Record<string, unknown>
  chatMessages?: ChatMessage[]
}): number {
  const q1 = String(options.answers?.q1 || '')
  const q3 = String(options.answers?.q3 || '')
  const chatText = (options.chatMessages || []).map(m => m.content).join('\n')
  const explicitAnswer = typeof options.answers?.groupSize === 'number'
    ? options.answers.groupSize
    : null
  const inferred = inferGroupSizeFromText(q1, q3, chatText)

  const candidates = [
    options.dbCount,
    explicitAnswer ?? 0,
    inferred ?? 0,
  ].filter(n => n > 0)

  if (candidates.length === 0) return 6
  return Math.max(...candidates)
}

/** Last few chat turns — included in the generation prompt. */
export function formatChatContextForGeneration(messages: ChatMessage[] | undefined): string {
  if (!messages?.length) return ''
  const recent = messages.slice(-10)
  return recent
    .map(m => `${m.role === 'user' ? 'User' : 'Avanti'}: ${m.content.trim()}`)
    .join('\n\n')
}

export function sanitizeChatMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) return []
  return messages
    .filter(
      (m): m is ChatMessage =>
        m != null &&
        typeof m === 'object' &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        m.content.trim().length > 0,
    )
    .slice(-12)
}

function truncate(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

export function truncateForPrompt(text: string, max = 1200): string {
  return truncate(text, max)
}

export function buildChatSupplementBlock(chatMessages: ChatMessage[] | undefined): string {
  const formatted = formatChatContextForGeneration(chatMessages)
  if (!formatted) return ''
  return `\n\nADDITIONAL CONTEXT FROM CHAT (factor this into routing, group size, and trip length):\n${truncate(formatted, 2000)}`
}
