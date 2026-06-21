import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

async function getExchangeRate(fromCurrency: string, date: string): Promise<{ rate: number, source: string }> {
  try {
    const res = await fetch(`https://api.frankfurter.app/${date}?from=${fromCurrency}&to=USD`)
    const data = await res.json()
    if (data.rates?.USD) {
      return { rate: data.rates.USD, source: `1 ${fromCurrency} = ${data.rates.USD} USD (rate on ${date})` }
    }
  } catch (e) {}
  // fallback to today
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${fromCurrency}&to=USD`)
    const data = await res.json()
    if (data.rates?.USD) {
      return { rate: data.rates.USD, source: `1 ${fromCurrency} = ${data.rates.USD} USD (today's rate, receipt date unavailable)` }
    }
  } catch (e) {}
  return { rate: 1, source: 'Could not fetch exchange rate, prices may be approximate' }
}

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, currency } = await request.json()
    if (!imageBase64) return NextResponse.json({ error: 'No image provided' })

    const mediaType = imageBase64.startsWith('data:image/png') ? 'image/png' :
      imageBase64.startsWith('data:image/webp') ? 'image/webp' :
      imageBase64.startsWith('data:image/gif') ? 'image/gif' : 'image/jpeg'
    const base64Data = imageBase64.split(',')[1]
    if (!base64Data) return NextResponse.json({ error: 'Invalid image data' })

    // PASS 1: Extract date and currency only
    const pass1 = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
          { type: 'text', text: `Look at this receipt. Extract ONLY:
1. The transaction date (format: YYYY-MM-DD)
2. The currency symbol or code used
Return ONLY valid JSON, nothing else:
{"date":"YYYY-MM-DD","currency":"USD"}
If you cannot find the date, return today: ${new Date().toISOString().split('T')[0]}
If you cannot find currency, use: "${currency || 'USD'}"
Common currencies: $ = USD, € = EUR, £ = GBP, ¥ = JPY, ₩ = KRW, ฿ = THB, ₹ = INR, ₪ = ILS` }
        ]
      }]
    })

    let receiptDate = new Date().toISOString().split('T')[0]
    let receiptCurrency = (currency || 'USD').toUpperCase()
    try {
      const t = pass1.content[0]
      if (t.type === 'text') {
        const m = t.text.match(/\{[\s\S]*?\}/)
        if (m) {
          const p = JSON.parse(m[0])
          if (p.date && p.date.match(/^\d{4}-\d{2}-\d{2}$/)) receiptDate = p.date
          if (p.currency) receiptCurrency = p.currency.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || receiptCurrency
        }
      }
    } catch(e) {}

    // Fetch real exchange rate for that exact date
    let exchangeRate = 1
    let rateNote = ''
    if (receiptCurrency !== 'USD') {
      const { rate, source } = await getExchangeRate(receiptCurrency, receiptDate)
      exchangeRate = rate
      rateNote = source
    }

    // PASS 2: Full receipt extraction with real exchange rate baked in
    const pass2 = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
          { type: 'text', text: `You are scanning a restaurant or store receipt for a group expense splitting app.

RECEIPT DETAILS:
- Date: ${receiptDate}
- Original currency: ${receiptCurrency}
${receiptCurrency !== 'USD'
  ? `- Exchange rate: ${rateNote}
- CONVERT ALL PRICES TO USD by multiplying by ${exchangeRate}
- Example: if item costs 10.00 ${receiptCurrency}, the USD price is ${(10 * exchangeRate).toFixed(2)}`
  : '- Currency is already USD, no conversion needed'}

YOUR JOB:
1. Find EVERY food and drink line item on the receipt
2. Translate ALL item names to English (even if just partially foreign)
3. Convert ALL prices to USD using the exact rate above
4. Find the tax amount — calculate what % of the subtotal it represents
5. Find the tip/gratuity if shown — calculate what % it represents
6. Detect cover charges (coperto, couvert, bread fee, cover, posto, service per person) — mark these as isCoverCharge: true

RETURN ONLY THIS JSON — no explanation, no markdown, no extra text:
{
  "items": [
    {
      "name": "English name of item",
      "originalName": "Name as it appears on receipt",
      "price": 0.00,
      "originalPrice": 0.00,
      "isCoverCharge": false
    }
  ],
  "tax_percent": 0.0,
  "tip_percent": 0.0,
  "subtotal_original": 0.00,
  "subtotal_usd": 0.00,
  "total_usd": 0.00,
  "currency": "${receiptCurrency}",
  "exchange_rate": ${exchangeRate},
  "date": "${receiptDate}",
  "language_detected": "English",
  "notes": "Brief note about translation or conversion, e.g. Translated from Italian. Converted from EUR at 1.09."
}

CRITICAL RULES:
- price field must be in USD after conversion
- originalPrice field is the price as shown on the receipt in original currency
- DO NOT include the subtotal row, total row, tax row, or tip row as items
- DO NOT include payment method lines
- isCoverCharge: true ONLY for per-person sitting/cover fees, not for shared appetizers
- If you see the same item ordered multiple times (e.g. "2x Pasta"), list as TWO separate items
- If an item has no readable price, estimate based on similar items on the receipt
- Translate everything: 餃子 = Dumplings, Insalata = Salad, Poulet = Chicken, etc.
- tax_percent should be 0 if no tax shown (some countries include tax in prices)
- tip_percent should be 0 if no tip shown` }
        ]
      }]
    })

    const content = pass2.content[0]
    if (content.type !== 'text') return NextResponse.json({ error: 'No response from AI' })

    // Extract JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('No JSON found in response:', content.text)
      return NextResponse.json({ error: 'Could not read receipt', raw: content.text })
    }

    const parsed = JSON.parse(jsonMatch[0])

    // Validate items array exists
    if (!parsed.items || !Array.isArray(parsed.items)) {
      return NextResponse.json({ error: 'No items found on receipt' })
    }

    // Clean up items — ensure price is always a number
    parsed.items = parsed.items.map((item: any) => ({
      name: item.name || 'Unknown item',
      originalName: item.originalName || item.name || '',
      price: typeof item.price === 'number' ? parseFloat(item.price.toFixed(2)) : 0,
      originalPrice: item.originalPrice || item.price || 0,
      isCoverCharge: item.isCoverCharge === true,
    }))

    return NextResponse.json(parsed)
  } catch (e: any) {
    console.error('Scan receipt error:', e)
    return NextResponse.json({ error: e.message || 'Something went wrong' })
  }
}
