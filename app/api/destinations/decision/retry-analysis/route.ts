import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { runDestinationAnalysis } from '@/lib/destination-decision/run-analysis'
import { adminOrAnon, requireOrganizer } from '@/lib/destination-decision/supabase-server'
import { tryCreateAdminClient } from '@/lib/supabase-admin'

export const maxDuration = 300

/** Organizer: kick off (or resume) destination cost analysis. */
export async function POST(request: NextRequest) {
  try {
    const { decisionId } = await request.json()
    if (!decisionId) {
      return NextResponse.json({ error: 'decisionId required' }, { status: 400 })
    }

    const supabase = adminOrAnon(request)

    const { data: decision } = await supabase
      .from('destination_decisions')
      .select('id, trip_id, status')
      .eq('id', decisionId)
      .single()

    if (!decision) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await requireOrganizer(supabase, decision.trip_id)

    if (decision.status !== 'analyzing' && decision.status !== 'suggestions_open') {
      return NextResponse.json({ error: 'Analysis can only run during submission or analyzing.' }, { status: 400 })
    }

    const now = new Date().toISOString()
    await supabase.from('destination_decisions').update({
      status: 'analyzing',
      analysis_started_at: now,
      updated_at: now,
    }).eq('id', decisionId)

    const admin = tryCreateAdminClient() ?? supabase

    after(async () => {
      try {
        await runDestinationAnalysis(admin, decisionId)
      } catch (err) {
        console.error('retry-analysis failed:', err)
      }
    })

    return NextResponse.json({ ok: true, status: 'analyzing' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : msg === 'Organizer only' ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
