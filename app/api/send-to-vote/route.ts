import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { tripId, options, voteType, deadlineDays } = await request.json()
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const deadline = new Date()
    deadline.setDate(deadline.getDate() + (deadlineDays || 2))

    const { data, error } = await supabase.from('group_votes').insert({
      trip_id: tripId,
      vote_type: voteType || 'Destination',
      options,
      deadline: deadline.toISOString(),
      status: 'open',
    }).select().single()

    if (error) return NextResponse.json({ error: error.message })
    return NextResponse.json({ vote: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message })
  }
}
