import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const client = new Anthropic()

export async function POST(request: NextRequest) {
  try {
    const { tripId, optionIndex, adjustment, currentOption } = await request.json()

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `You are Avanti, a luxury travel agent. A traveler wants to adjust one of their trip options.

CURRENT OPTION:
${JSON.stringify(currentOption, null, 2)}

REQUESTED ADJUSTMENT:
${adjustment}

Please update this option to incorporate the requested adjustment. Keep everything the same except what needs to change based on the request. Recalculate costs if needed.

Return ONLY the updated option as valid JSON in exactly the same format as the input. No explanation, no markdown, just the JSON object.`
      }]
    })

    const content = message.content[0]
    if (content.type !== 'text') return NextResponse.json({ error: 'No response' })

    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'No JSON' })

    const updatedOption = JSON.parse(jsonMatch[0])
    return NextResponse.json({ updatedOption })
  } catch (e: any) {
    return NextResponse.json({ error: e.message })
  }
}
