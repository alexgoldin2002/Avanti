import { NextRequest, NextResponse } from 'next/server'
export const maxDuration = 300

import { runDestinationAnalysis } from '@/lib/destination-decision/run-analysis'
import { adminOrAnon } from '@/lib/destination-decision/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const { decisionId, optionIds } = await request.json()
    if (!decisionId) {
      return NextResponse.json({ error: 'decisionId required' }, { status: 400 })
    }

    const supabase = adminOrAnon(request)
    const result = await runDestinationAnalysis(supabase, decisionId, optionIds)

    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
