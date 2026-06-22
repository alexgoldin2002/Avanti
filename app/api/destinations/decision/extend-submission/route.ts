import { NextRequest, NextResponse } from 'next/server'
import { requireOrganizer, supabaseFromRequest } from '@/lib/destination-decision/supabase-server'
import { tryCreateAdminClient } from '@/lib/supabase-admin'
import { submissionWindowToMinutes } from '@/lib/submission-window'
import type { DestinationDecisionStatus } from '@/lib/destination-decision/types'

const EXTENDABLE: DestinationDecisionStatus[] = ['draft', 'suggestions_open', 'analyzing']

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tripId, days = 0, hours = 24, minutes = 0 } = body as {
      tripId?: string
      days?: number
      hours?: number
      minutes?: number
    }

    if (!tripId) {
      return NextResponse.json({ error: 'tripId required' }, { status: 400 })
    }

    const userClient = supabaseFromRequest(request)
    await requireOrganizer(userClient, tripId)
    const supabase = tryCreateAdminClient() ?? userClient

    const { data: decision } = await supabase
      .from('destination_decisions')
      .select('*')
      .eq('trip_id', tripId)
      .single()

    if (!decision) {
      return NextResponse.json({ error: 'Step 2 has not been started yet.' }, { status: 404 })
    }

    const status = decision.status as DestinationDecisionStatus
    if (!EXTENDABLE.includes(status)) {
      return NextResponse.json(
        { error: 'Submission window cannot be extended after voting has started.' },
        { status: 400 }
      )
    }

    const addMs = submissionWindowToMinutes({ days, hours, minutes }) * 60 * 1000
    const now = new Date()
    const currentEnd = decision.submission_deadline
      ? new Date(decision.submission_deadline)
      : now
    const base = currentEnd.getTime() > now.getTime() ? currentEnd : now
    const newDeadline = new Date(base.getTime() + addMs)

    const updates: Record<string, unknown> = {
      submission_deadline: newDeadline.toISOString(),
      updated_at: now.toISOString(),
    }

    let newStatus = status
    if (status === 'analyzing') {
      updates.status = 'suggestions_open'
      updates.analysis_started_at = null
      newStatus = 'suggestions_open'
    }

    const { error } = await supabase
      .from('destination_decisions')
      .update(updates)
      .eq('id', decision.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      submissionDeadline: newDeadline.toISOString(),
      status: newStatus,
      reopened: status === 'analyzing',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : msg === 'Organizer only' ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
