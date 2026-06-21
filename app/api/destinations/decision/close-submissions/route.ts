import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { runDestinationAnalysis } from '@/lib/destination-decision/run-analysis'
import { adminOrAnon, requireOrganizer } from '@/lib/destination-decision/supabase-server'
import { tryCreateAdminClient } from '@/lib/supabase-admin'

export const maxDuration = 300

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

    const { data: options } = await supabase
      .from('destination_options')
      .select('id')
      .eq('decision_id', decisionId)

    const optionIds = (options || []).map(o => o.id)
    const admin = tryCreateAdminClient() ?? supabase

    after(async () => {
      try {
        await runDestinationAnalysis(admin, decisionId, optionIds)
      } catch (err) {
        console.error('close-submissions analysis failed:', err)
      }
    })

    return NextResponse.json({ ok: true, status: 'analyzing', optionCount: optionIds.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : msg === 'Organizer only' ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
