import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'AI service is not configured', names: [] }, { status: 500 })
    }

    const { description } = await request.json()
    if (!description || typeof description !== 'string' || !description.trim()) {
      return NextResponse.json({ error: 'Description is required', names: [] }, { status: 400 })
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Generate 5 creative, fun, memorable trip name suggestions for this trip: "${description.trim()}".
Make them playful, evocative, and unique — funny or clever when it fits. Think of names like "Mama Mia Summer", "La Dolce Vita", "Aegean Dreams".
Return ONLY a JSON array of 5 strings, nothing else. Example: ["Name 1", "Name 2", "Name 3", "Name 4", "Name 5"]`,
      }],
    })

    const content = message.content[0]
    if (content.type !== 'text') return NextResponse.json({ names: [] })

    const clean = content.text.replace(/```json|```/g, '').trim()
    const names = JSON.parse(clean)
    if (!Array.isArray(names)) return NextResponse.json({ names: [] })

    return NextResponse.json({ names: names.filter((n): n is string => typeof n === 'string').slice(0, 5) })
  } catch (e) {
    console.error('suggest-names failed:', e)
    return NextResponse.json({ error: 'Failed to generate names', names: [] }, { status: 500 })
  }
}
