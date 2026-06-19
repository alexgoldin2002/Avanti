import { NextRequest, NextResponse } from 'next/server'
import { adminOrAnon, requireOrganizer } from '@/lib/destination-decision/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const { decisionId } = await request.json()
    const supabase = adminOrAnon(request)

    const { data: decision } = await supabase
      .from('destination_decisions')
      .select('*')
      .eq('id', decisionId)
      .single()

    if (!decision) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await requireOrganizer(supabase, decision.trip_id)

    const now = new Date()
    await supabase.from('destination_decisions').update({
      status: 'analyzing',
      submission_deadline: now.toISOString(),
      analysis_started_at: now.toISOString(),
      updated_at: now.toISOString(),
    }).eq('id', decisionId)

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin
    const { data: options } = await supabase
      .from('destination_options')
      .select('id')
      .eq('decision_id', decisionId)

    fetch(`${siteUrl}/api/destinations/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.CRON_SECRET ? { 'x-cron-secret': process.env.CRON_SECRET } : {}),
      },
      body: JSON.stringify({ decisionId, optionIds: (options || []).map(o => o.id) }),
    }).catch(() => {})

    return NextResponse.json({ ok: true, status: 'analyzing' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : msg === 'Organizer only' ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
