import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key)
}

/** Look up an existing Avanti profile by email so a manager can link instead of re-typing passport etc. */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user }, error: authError } = await anon.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { email } = await request.json()
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'email required' }, { status: 400 })
    }

    const normalized = email.trim().toLowerCase()
    if (normalized === user.email?.toLowerCase()) {
      return NextResponse.json({ error: 'Use your own profile for yourself — add others here.' }, { status: 400 })
    }

    const admin = adminClient()
    const { data: profile } = await admin
      .from('user_profiles')
      .select('user_id, full_name, date_of_birth, passport_number, tsa_known_traveler, email')
      .ilike('email', normalized)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ found: false })
    }

    return NextResponse.json({
      found: true,
      linkedUserId: profile.user_id,
      full_name: profile.full_name,
      date_of_birth: profile.date_of_birth,
      passport_number: profile.passport_number,
      tsa_known_traveler: profile.tsa_known_traveler,
      hasPassport: !!profile.passport_number,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
