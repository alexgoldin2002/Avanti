import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { tripId, options, voteType } = await request.json()
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

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
