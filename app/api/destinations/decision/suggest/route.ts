import { NextRequest, NextResponse } from 'next/server'
import { adminOrAnon, requireUser } from '@/lib/destination-decision/supabase-server'
import { extractCountryFromDestinationName } from '@/lib/destination-country-rules'

export async function POST(request: NextRequest) {
  try {
    const { decisionId, name, note } = await request.json()
    if (!decisionId || !name?.trim()) {
      return NextResponse.json({ error: 'decisionId and name required' }, { status: 400 })
    }

    const supabase = adminOrAnon(request)
    const user = await requireUser(supabase)

    const { data: decision } = await supabase
      .from('destination_decisions')
      .select('*')
      .eq('id', decisionId)
      .single()

    if (!decision || decision.status !== 'suggestions_open') {
      return NextResponse.json({ error: 'Suggestions are not open' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('user_id', user.id)
      .single()

    const { data: traveler } = await supabase
      .from('travelers')
      .select('id')
      .eq('trip_id', decision.trip_id)
      .eq('email', profile?.email || '')
      .maybeSingle()

    const { data: existingSuggestion } = await supabase
      .from('destination_options')
      .select('id')
      .eq('decision_id', decisionId)
      .eq('source', 'member_suggestion')
      .eq('source_traveler_id', traveler?.id || '')
      .limit(1)

    if (existingSuggestion?.length) {
      return NextResponse.json({ error: 'You already added a suggestion.' }, { status: 400 })
    }

    const country = extractCountryFromDestinationName(name.trim())
    const tiers = ['budget', 'mid', 'luxury'] as const
    const baseOrder = 1000

    const rows = tiers.map((tier, i) => ({
      decision_id: decisionId,
      trip_id: decision.trip_id,
      name: name.trim(),
      country,
      tier,
      source: 'member_suggestion',
      source_traveler_id: traveler?.id || null,
      card_snapshot: { name: name.trim(), note: note || '', memberSuggestion: true },
      group_summary: { tradeoff: note || 'Member suggestion' },
      sort_order: baseOrder + i,
    }))

    const { data: inserted, error } = await supabase.from('destination_options').insert(rows).select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin
    fetch(`${siteUrl}/api/destinations/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.CRON_SECRET ? { 'x-cron-secret': process.env.CRON_SECRET } : {}),
      },
      body: JSON.stringify({ decisionId, optionIds: (inserted || []).map(o => o.id) }),
    }).catch(() => {})

    return NextResponse.json({ ok: true, optionIds: inserted?.map(o => o.id) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
