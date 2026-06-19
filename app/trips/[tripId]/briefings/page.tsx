'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import SubpageShell from '../../../components/SubpageShell'
import SuitcaseLoader from '../../../components/SuitcaseLoader'
import { generateBriefingClient } from '@/lib/trip-companion/client-api'
import type { DayBriefings } from '@/lib/trip-companion/types'

export default function TripBriefingsPage() {
  const { tripId } = useParams() as { tripId: string }
  const [loading, setLoading] = useState(true)
  const [trip, setTrip] = useState<any>(null)
  const [briefings, setBriefings] = useState<Record<string, DayBriefings>>({})
  const [selectedDate, setSelectedDate] = useState('')
  const [generating, setGenerating] = useState(false)

  const load = useCallback(async () => {
    const { supabase } = await import('@/lib/supabase')
    const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
    setTrip(tripData)
    const cached = tripData?.options?.companion?.briefings || {}
    setBriefings(cached)

    const start = tripData?.locked_date_start || tripData?.start_date
    if (start) setSelectedDate(start)
    setLoading(false)
  }, [tripId])

  useEffect(() => { load().catch(console.error) }, [load])

  const tripDays = (): string[] => {
    const start = trip?.locked_date_start || trip?.start_date
    const end = trip?.locked_date_end || trip?.end_date
    if (!start || !end) return []
    const days: string[] = []
    const d = new Date(`${start}T12:00:00`)
    const endD = new Date(`${end}T12:00:00`)
    while (d <= endD) {
      days.push(d.toISOString().slice(0, 10))
      d.setDate(d.getDate() + 1)
    }
    return days
  }

  const generate = async () => {
    if (!selectedDate) return
    setGenerating(true)
    try {
      const data = await generateBriefingClient(tripId, selectedDate, 'both')
      setBriefings(prev => ({ ...prev, [selectedDate]: data }))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed')
    } finally {
      setGenerating(false)
    }
  }

  const day = briefings[selectedDate]

  if (loading) return <SuitcaseLoader message="Loading briefings" />

  const days = tripDays()

  return (
    <SubpageShell
      backHref={`/trips/${tripId}`}
      backLabel="Trip"
      eyebrow={trip?.name}
      title="Daily briefings"
      subtitle="Evening preview · Morning schedule"
      maxWidth="max-w-2xl"
    >
      <p className="text-sm text-muted-foreground mb-4">
        Night-before texts preview tomorrow and what to pack. Morning texts break down leave times and when you&apos;ll be back at the hotel. Enable SMS in your profile for automatic delivery.
      </p>

      {days.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
          {days.map(d => (
            <button
              key={d}
              type="button"
              onClick={() => setSelectedDate(d)}
              className={`shrink-0 px-3 py-2 text-xs border ${
                selectedDate === d ? 'border-forest-deep bg-forest-pale' : 'border-border text-muted-foreground'
              }`}
            >
              {new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </button>
          ))}
        </div>
      )}

      {!day ? (
        <div className="avanti-box border border-border bg-card px-6 py-10 text-center">
          <p className="font-serif text-lg mb-2">No briefing for this day</p>
          <button type="button" disabled={generating || !selectedDate} onClick={generate} className="avanti-btn avanti-btn-primary">
            {generating ? 'Generating…' : 'Generate briefing →'}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {day.evening && (
            <section className="avanti-box border border-border bg-card overflow-hidden">
              <div className="px-5 py-3 bg-forest-mist border-b border-border">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground m-0">🌙 Night before</p>
                <p className="font-serif text-lg m-0 mt-1">{day.evening.preview_title}</p>
              </div>
              <div className="px-5 py-4 space-y-3">
                <p className="text-sm m-0">{day.evening.tomorrow_summary}</p>
                <p className="text-sm m-0"><strong>Wake up:</strong> {day.evening.wake_up_time}</p>
                {day.evening.pack_list?.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Pack tonight</p>
                    <ul className="text-sm list-disc pl-5 m-0">{day.evening.pack_list.map((p, i) => <li key={i}>{p}</li>)}</ul>
                  </div>
                )}
                {day.evening.prep_notes?.length > 0 && (
                  <ul className="text-xs text-muted-foreground list-disc pl-5 m-0">{day.evening.prep_notes.map((p, i) => <li key={i}>{p}</li>)}</ul>
                )}
              </div>
            </section>
          )}

          {day.morning && (
            <section className="avanti-box border border-forest-deep/20 bg-card overflow-hidden">
              <div className="px-5 py-3 bg-forest-pale border-b border-border">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground m-0">☀️ Morning of</p>
                <p className="font-serif text-lg m-0 mt-1">{day.morning.greeting}</p>
              </div>
              <div className="px-5 py-4">
                <p className="text-sm mb-4 m-0">{day.morning.day_overview}</p>
                <div className="divide-y divide-border/60">
                  {day.morning.schedule?.map((s, i) => (
                    <div key={i} className="py-3 flex gap-3">
                      <span className="text-xs text-muted-foreground min-w-[52px]">{s.time}</span>
                      <div>
                        <p className="text-sm m-0">{s.activity}</p>
                        {(s.leave_by || s.return_by) && (
                          <p className="text-xs text-muted-foreground m-0 mt-0.5">
                            {s.leave_by && `Leave by ${s.leave_by}`}
                            {s.leave_by && s.return_by && ' · '}
                            {s.return_by && `Back by ${s.return_by}`}
                          </p>
                        )}
                        {s.tip && <p className="text-xs italic text-muted-foreground m-0 mt-0.5">{s.tip}</p>}
                      </div>
                    </div>
                  ))}
                </div>
                {day.morning.hotel_return_time && (
                  <p className="text-xs text-muted-foreground mt-4 m-0">Back at hotel ~{day.morning.hotel_return_time}</p>
                )}
              </div>
            </section>
          )}

          <button type="button" disabled={generating} onClick={generate} className="avanti-btn avanti-btn-ghost w-full">
            {generating ? 'Regenerating…' : '↻ Regenerate briefing'}
          </button>
        </div>
      )}
    </SubpageShell>
  )
}
