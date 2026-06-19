import { NextRequest, NextResponse } from 'next/server'
export const maxDuration = 120

import { createAdminClient } from '@/lib/supabase-admin'
import { buildCompanionContext } from '@/lib/trip-companion/client-api'
import {
  generateDayBriefings,
  formatEveningSms,
  formatMorningSms,
} from '@/lib/trip-companion/generate-briefing'
import { sendSms } from '@/lib/sms/send-sms'
import type { TripBooking } from '@/lib/bookings/types'
import type { DayBriefings, TripCompanionOptions } from '@/lib/trip-companion/types'

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return request.headers.get('authorization') === `Bearer ${secret}`
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

function yesterdayUtc(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const today = todayUtc()
  const yesterday = yesterdayUtc()
  let sentEvening = 0
  let sentMorning = 0

  const { data: trips } = await admin
    .from('trips')
    .select('id, name, destination, start_date, end_date, locked_date_start, locked_date_end, options')
    .not('destination', 'is', null)
    .neq('destination', 'TBD')

  for (const trip of trips || []) {
    const start = trip.locked_date_start || trip.start_date
    const end = trip.locked_date_end || trip.end_date
    if (!start || !end) continue
    if (today < start || today > end) continue

    const { data: travelers } = await admin
      .from('travelers')
      .select('id, user_id, phone, name, email')
      .eq('trip_id', trip.id)

    const { data: bookings } = await admin.from('trip_bookings').select('*').eq('trip_id', trip.id)
    const ctx = buildCompanionContext({
      trip,
      bookings: (bookings || []) as TripBooking[],
      travelerNationalities: ['United States'],
    })

    const companion = (trip.options as { companion?: TripCompanionOptions })?.companion
    const hour = new Date().getUTCHours()

    // Evening briefings ~20:00 UTC window (adjust when timezone support added)
    if (hour >= 19 && hour <= 21) {
      const briefings = await generateDayBriefings(ctx, today, 'evening')
      const sms = formatEveningSms(briefings.evening, trip.name)
      if (sms) {
        for (const t of travelers || []) {
          if (!t.phone) continue
          await sendSms({
            to: t.phone,
            body: sms,
            messageType: 'evening_briefing',
            userId: t.user_id,
            tripId: trip.id,
          })
          sentEvening++
        }
        const merged = {
          ...(trip.options || {}),
          companion: {
            ...(companion || {}),
            briefings: { ...(companion?.briefings || {}), [today]: { ...(companion?.briefings?.[today] || {}), evening: briefings.evening } },
          },
        }
        await admin.from('trips').update({ options: merged }).eq('id', trip.id)
      }
    }

    // Morning briefings ~7:00 UTC window
    if (hour >= 6 && hour <= 8) {
      const cached = companion?.briefings?.[yesterday]?.morning
      let morning = cached
      if (!morning) {
        const briefings = await generateDayBriefings(ctx, yesterday, 'morning')
        morning = briefings.morning
      }
      const sms = formatMorningSms(morning, trip.name)
      if (sms) {
        for (const t of travelers || []) {
          if (!t.phone) continue
          await sendSms({
            to: t.phone,
            body: sms,
            messageType: 'morning_briefing',
            userId: t.user_id,
            tripId: trip.id,
          })
          sentMorning++
        }
      }
    }
  }

  return NextResponse.json({ ok: true, sentEvening, sentMorning, date: today })
}
