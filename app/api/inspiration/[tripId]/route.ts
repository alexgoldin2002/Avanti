import { NextRequest, NextResponse } from 'next/server'

import { supabaseFromRequest, requireUser } from '@/lib/destination-decision/supabase-server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const supabase = supabaseFromRequest(request)
    await requireUser(supabase)

    const { data, error } = await supabase
      .from('trip_inspirations')
      .select('*')
      .eq('trip_id', tripId)
      .neq('status', 'dismissed')
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ inspirations: data || [] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const supabase = supabaseFromRequest(request)
    const user = await requireUser(supabase)
    const body = await request.json()
    const { parsed, source_type, source_url, screenshot_path } = body

    if (!parsed?.place_name) {
      return NextResponse.json({ error: 'parsed place required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('trip_inspirations')
      .insert({
        trip_id: tripId,
        created_by_user_id: user.id,
        source_type: source_type || (source_url ? 'url' : 'paste'),
        source_url: source_url || null,
        source_platform: parsed.source_platform || null,
        screenshot_path: screenshot_path || null,
        place_name: parsed.place_name,
        place_category: parsed.place_category || null,
        place_address: parsed.place_address || null,
        place_city: parsed.place_city || null,
        place_description: parsed.place_description || null,
        parsed_json: parsed,
        suggested_day_date: parsed.suggested_day_date || null,
        suggested_time: parsed.suggested_time || null,
        suggestion_reason: parsed.suggestion_reason || null,
        status: 'saved',
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ inspiration: data })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const supabase = supabaseFromRequest(request)
    await requireUser(supabase)
    const { id, status } = await request.json()

    const { data, error } = await supabase
      .from('trip_inspirations')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('trip_id', tripId)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ inspiration: data })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}
