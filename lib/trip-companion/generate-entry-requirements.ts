import Anthropic from '@anthropic-ai/sdk'
import type { EntryRequirements, EntryRequirementsInput } from './types'

const client = new Anthropic()

const ALLOWED_MED_STATUS = ['ok', 'restricted', 'banned', 'bring_supply', 'unknown'] as const

export async function generateEntryRequirements(input: EntryRequirementsInput): Promise<EntryRequirements> {
  const nationalities = input.nationalities.length ? input.nationalities.join(', ') : 'United States'

  const medsBlock = input.medications.length
    ? input.medications
        .map(m => `- ${m.name}${m.dosage ? ` ${m.dosage}${m.unit || ''}` : ''}${m.who ? ` (${m.who})` : ''}`)
        .join('\n')
    : '(none saved — give general guidance only)'

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system:
      'You are a travel entry-requirements and travel-health expert. Return ONLY valid JSON. ' +
      'Be accurate and current; when rules vary or you are unsure, say so in the relevant notes and lean conservative. ' +
      'Never invent specific fees or processing times you are not confident about — use null instead.',
    messages: [
      {
        role: 'user',
        content: `Produce entry requirements for a trip.

DESTINATION: ${input.trip.destination}
TRIP: ${input.trip.name}
DATES: ${input.trip.start_date || 'TBD'} to ${input.trip.end_date || 'TBD'}
TRAVELER NATIONALITIES (passport / country of residence): ${nationalities}

TRAVELER MEDICATIONS (assess each against the destination's import rules; flag anything restricted, banned, quantity-limited, or that requires documentation; also note if a medication may be hard to find locally so they should bring enough):
${medsBlock}

Return JSON with this exact shape:
{
  "destination": "${input.trip.destination}",
  "country": "the country name",
  "summary": "1-2 sentence plain-language overview of what this group most needs to prepare",
  "visas": [
    {
      "nationality": "one entry per listed nationality",
      "visa_required": true/false,
      "visa_type": "e-Visa | Visa on arrival | ETA/eTA | Visa-free (X days) | Embassy visa | null",
      "how_to_apply": "short instructions or official site type, or null",
      "processing_time": "string or null",
      "cost": "string or null",
      "passport_validity": "e.g. '6 months beyond departure' or null",
      "notes": "string or null"
    }
  ],
  "documents": [
    { "name": "e.g. Return/onward ticket", "required": true/false, "details": "why / when needed" }
  ],
  "vaccines": [
    { "name": "e.g. Yellow fever", "status": "required" | "recommended", "details": "e.g. required if arriving from an endemic country, or null" }
  ],
  "medications": [
    {
      "name": "the medication name (use the traveler's name if provided)",
      "who": "the traveler it belongs to, or null",
      "status": "ok" | "restricted" | "banned" | "bring_supply" | "unknown",
      "guidance": "what to do (carry prescription, limit quantity, declare at customs, bring enough because unavailable locally, etc.)",
      "documents_needed": ["e.g. Doctor's letter", "Prescription copy"]
    }
  ],
  "bring_from_home": ["over-the-counter or common medications/items that are commonly unavailable or restricted at this destination and worth bringing"],
  "disclaimer": "one short line reminding travelers to confirm with official government/embassy sources before departure",
  "generated_at": "${new Date().toISOString()}"
}

Include one visa entry for EACH listed nationality. If no medications were provided, return an empty "medications" array but still fill "bring_from_home" with destination-relevant suggestions.`,
      },
    ],
  })

  const text = response.content.find(c => c.type === 'text')?.text || '{}'
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  const parsed = JSON.parse(jsonMatch?.[0] || '{}')

  const medications = Array.isArray(parsed.medications)
    ? parsed.medications.map((m: Record<string, unknown>) => ({
        name: String(m.name || ''),
        who: m.who ? String(m.who) : null,
        status: ALLOWED_MED_STATUS.includes(m.status as (typeof ALLOWED_MED_STATUS)[number])
          ? (m.status as EntryRequirements['medications'][number]['status'])
          : 'unknown',
        guidance: String(m.guidance || ''),
        documents_needed: Array.isArray(m.documents_needed) ? m.documents_needed.map(String) : [],
      }))
    : []

  return {
    destination: input.trip.destination,
    country: parsed.country || input.trip.destination,
    summary: parsed.summary || null,
    visas: Array.isArray(parsed.visas) ? parsed.visas : [],
    documents: Array.isArray(parsed.documents) ? parsed.documents : [],
    vaccines: Array.isArray(parsed.vaccines) ? parsed.vaccines : [],
    medications,
    bring_from_home: Array.isArray(parsed.bring_from_home) ? parsed.bring_from_home.map(String) : [],
    disclaimer:
      parsed.disclaimer ||
      'Requirements change often — always confirm with the official embassy or government site before you travel.',
    generated_at: new Date().toISOString(),
  }
}
