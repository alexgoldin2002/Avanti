import { NextResponse } from 'next/server'
import { getAffiliateStatus } from '@/lib/booking/affiliate'

/** Which affiliate programs are configured (no auth — status only, no secrets). */
export async function GET() {
  return NextResponse.json({ affiliate: getAffiliateStatus() })
}
