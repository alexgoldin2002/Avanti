import { NextRequest, NextResponse } from 'next/server'
import { tryCreateAdminClient } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  try {
    const { tripId, options, voteType } = await request.json()

    const supabase = tryCreateAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { data, error } = await supabase.from('group_votes').insert({
      trip_id: tripId,
      vote_type: voteType || 'Destination',
      options,
      status: 'open',
      current_round: 1,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message })
    return NextResponse.json({ vote: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message })
  }
}
