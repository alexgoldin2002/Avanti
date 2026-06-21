import { NextRequest, NextResponse } from 'next/server'
import { supabaseFromRequest, requireOrganizer } from '@/lib/destination-decision/supabase-server'
import { tryCreateAdminClient } from '@/lib/supabase-admin'
import { DEFAULT_VOTING_HOURS } from '@/lib/destination-decision/types'
import { submissionWindowToMinutes } from '@/lib/submission-window'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const body = await request.json()
    const userClient = supabaseFromRequest(request)
    await requireOrganizer(userClient, tripId)
    const supabase = tryCreateAdminClient() ?? userClient

    const submissionMinutes = submissionWindowToMinutes({
      days: body.days,
      hours: body.hours,
      minutes: body.minutes,
    })

    const { data: existing } = await supabase
      .from('destination_decisions')
      .select('id, status')
      .eq('trip_id', tripId)
      .maybeSingle()

    if (existing && existing.status !== 'draft' && existing.status !== 'cancelled') {
      return NextResponse.json({
        ok: true,
        decisionId: existing.id,
        status: existing.status,
        alreadyStarted: true,
      })
    }

    const now = new Date()
    const submissionDeadline = new Date(now.getTime() + submissionMinutes * 60 * 1000)

    const { data: decision, error: decError } = await supabase
      .from('destination_decisions')
      .upsert(
        {
          trip_id: tripId,
          status: 'draft',
          submission_deadline: submissionDeadline.toISOString(),
          budget_strictness: 'soft',
          settings: {
            submission_minutes: submissionMinutes,
            voting_hours: DEFAULT_VOTING_HOURS,
            phase: 'brainstorm',
          },
          updated_at: now.toISOString(),
        },
        { onConflict: 'trip_id' }
      )
      .select()
      .single()

    if (decError || !decision) {
      return NextResponse.json({ error: decError?.message || 'Failed to start Step 2' }, { status: 500 })
    }

    await supabase
      .from('trips')
      .update({
        invites_closed: true,
        destination_decision_id: decision.id,
        submission_window_minutes: submissionMinutes,
      })
      .eq('id', tripId)

    return NextResponse.json({
      ok: true,
      decisionId: decision.id,
      submissionDeadline: decision.submission_deadline,
      submissionMinutes,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : msg === 'Organizer only' ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
