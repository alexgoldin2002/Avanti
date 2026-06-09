import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
const client = new Anthropic()
export async function POST(request: NextRequest) {
  const { description } = await request.json()
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `Generate 5 creative, fun, memorable trip name suggestions for this trip: "${description}". 
      Make them playful, evocative, and unique. Think of names like "Mama Mia Summer", "La Dolce Vita", "Aegean Dreams".
      Return ONLY a JSON array of 5 strings, nothing else. Example: ["Name 1", "Name 2", "Name 3", "Name 4", "Name 5"]`
    }]
  })
  const content = message.content[0]
  if (content.type !== 'text') return NextResponse.json({ names: [] })
  const clean = content.text.replace(/```json|```/g, '').trim()
  const names = JSON.parse(clean)
  return NextResponse.json({ names })
}
