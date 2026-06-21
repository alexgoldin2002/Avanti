import { NextRequest, NextResponse } from 'next/server'
import { adminOrAnon, requireUser } from '@/lib/destination-decision/supabase-server'
import { getMyTripTraveler, travelerCanVote } from '@/lib/account-companions'

export async function POST(request: NextRequest) {
  try {
    const { optionId, desireScore, approved, toggles, privateMax } = await request.json()
    if (!optionId) return NextResponse.json({ error: 'optionId required' }, { status: 400 })

    const supabase = adminOrAnon(request)
    const user = await requireUser(supabase)

    const { data: option } = await supabase
      .from('destination_options')
      .select('decision_id')
      .eq('id', optionId)
      .single()

    if (!option) return NextResponse.json({ error: 'Option not found' }, { status: 404 })

    const { data: decisionRow } = await supabase
      .from('destination_decisions')
      .select('status, trip_id')
      .eq('id', option.decision_id)
      .single()

    if (!decisionRow) return NextResponse.json({ error: 'Decision not found' }, { status: 404 })

    const traveler = await getMyTripTraveler(supabase, decisionRow.trip_id, user.id)
    if (traveler && !travelerCanVote(traveler)) {
      return NextResponse.json(
        { error: 'Your account is set to view-only — someone else manages your votes on this trip.' },
        { status: 403 }
      )
    }

    const votable = ['meta_vote', 'voting'].includes(decisionRow.status || '')
    if (!votable) {
      return NextResponse.json({ error: 'Voting is not open' }, { status: 400 })
    }

    await supabase.from('destination_option_votes').upsert(
      {
        option_id: optionId,
        user_id: user.id,
        desire_score: desireScore ?? null,
        approved: approved ?? null,
        toggles: toggles || {},
        private_max: privateMax ?? false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'option_id,user_id' }
    )

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
