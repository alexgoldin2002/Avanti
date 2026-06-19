import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { tickDestinationDecision } from '@/lib/destination-decision/tick-decision'

export const maxDuration = 60

/** Vercel cron: advance all open destination decisions. */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const { data: decisions } = await supabase
      .from('destination_decisions')
      .select('id, trip_id, status')
      .not('status', 'in', '("locked","cancelled","draft")')

    const results: { id: string; status: string | null }[] = []
    for (const d of decisions || []) {
      const status = await tickDestinationDecision(supabase, d.id)
      results.push({ id: d.id, status })
    }

    return NextResponse.json({ ticked: results.length, results })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
