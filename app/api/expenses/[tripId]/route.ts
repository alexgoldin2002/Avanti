import { NextRequest, NextResponse } from 'next/server'

import { supabaseFromRequest, requireUser } from '@/lib/destination-decision/supabase-server'
import { inputToRow, rowToExpense, type ExpenseInput } from '@/lib/expenses/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const supabase = supabaseFromRequest(request)
    await requireUser(supabase)

    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('trip_id', tripId)
      .order('expense_date', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) throw error
    return NextResponse.json({ expenses: (data || []).map(rowToExpense) })
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
    const list = (body.expenses || [body]) as ExpenseInput[]

    if (!list.length || !list[0]?.description) {
      return NextResponse.json({ error: 'expenses required' }, { status: 400 })
    }

    const rows = list.map(exp => inputToRow(tripId, exp, user.id))
    const { data, error } = await supabase.from('expenses').insert(rows).select('*')
    if (error) throw error

    return NextResponse.json({ expenses: (data || []).map(rowToExpense) })
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
    const { id, settled } = await request.json()

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { data, error } = await supabase
      .from('expenses')
      .update({ settled: !!settled })
      .eq('id', id)
      .eq('trip_id', tripId)
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json({ expense: rowToExpense(data) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params
    const supabase = supabaseFromRequest(request)
    await requireUser(supabase)
    const { id } = await request.json()

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { error } = await supabase.from('expenses').delete().eq('id', id).eq('trip_id', tripId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}
