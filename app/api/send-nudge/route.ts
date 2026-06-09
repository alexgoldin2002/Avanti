import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { tripId, travelerId, travelerEmail, travelerName, tripName, senderName } = await request.json()

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: recentNudge } = await supabase
      .from('nudges')
      .select('id')
      .eq('trip_id', tripId)
      .eq('recipient_traveler_id', travelerId)
      .gte('sent_at', oneDayAgo)
      .maybeSingle()

    if (recentNudge) {
      return NextResponse.json({ error: 'Already nudged in the last 24 hours', rateLimited: true })
    }

    await supabase.from('nudges').insert({
      trip_id: tripId,
      recipient_traveler_id: travelerId,
    })

    if (travelerEmail) {
      const mailtoLink = `mailto:${travelerEmail}?subject=${encodeURIComponent(`Reminder: Join ${tripName} on Avanti`)}&body=${encodeURIComponent(`Hey ${travelerName}! ${senderName} is waiting for you to join ${tripName} on Avanti. Click here to join: ${process.env.NEXT_PUBLIC_SITE_URL || 'https://avanti.app'}`)}`
      return NextResponse.json({ success: true, mailtoLink })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message })
  }
}
