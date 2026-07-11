'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import SubpageShell from '../../../components/SubpageShell'
import SuitcaseLoader from '../../../components/SuitcaseLoader'
import BookSearchLink from '../../../components/BookSearchLink'
import { LockedGate } from '../planning-shared'
import {
  openTableSearchUrl,
  resySearchUrl,
  beliSearchUrl,
} from '@/lib/booking/search-links'

type DiningPrefs = {
  partySize: number
  dietary: string
  cuisines: string
  area: string
}

type DiningOption = Record<string, unknown>
type DiningSuggestions = { intro?: string; options?: DiningOption[] }

type LiveSlot = { dateTime: string; partySize: number; bookingUrl: string }

function formatSlotTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function aggregateDietary(travelers: any[]): string {
  const set = new Set<string>()
  for (const t of travelers) {
    const direct = (t.dietary_restrictions || '').toString().trim()
    if (direct) direct.split(/[,;]/).forEach((d: string) => d.trim() && set.add(d.trim()))
    const s2 = t.step2?.dietary
    if (Array.isArray(s2)) s2.forEach((d: string) => d && set.add(String(d).trim()))
    else if (typeof s2 === 'string' && s2.trim()) set.add(s2.trim())
  }
  return Array.from(set).join(', ')
}

export default function DiningPage() {
  const { tripId } = useParams() as { tripId: string }
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [trip, setTrip] = useState<any>(null)
  const [generating, setGenerating] = useState(false)
  const [data, setData] = useState<DiningSuggestions | null>(null)
  const [prefs, setPrefs] = useState<DiningPrefs>({ partySize: 2, dietary: '', cuisines: '', area: '' })
  const [showPrefs, setShowPrefs] = useState(false)
  const [liveSlots, setLiveSlots] = useState<Record<string, { opentable: LiveSlot[]; resy: LiveSlot[] }>>({})

  const fetchLiveSlots = useCallback(
    async (suggestions: DiningSuggestions, nextPrefs: DiningPrefs, tripObj: any) => {
      const names = (suggestions.options || [])
        .map(o => String(o.name || '').trim())
        .filter(Boolean)
      const destination: string | undefined = tripObj?.destination
      const date: string | undefined = tripObj?.locked_date_start || tripObj?.start_date
      if (names.length === 0 || !destination || !date) return
      try {
        const res = await fetch('/api/dining/availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            destination,
            date,
            partySize: nextPrefs.partySize,
            restaurants: names.map(name => ({ name })),
          }),
        })
        if (!res.ok) return
        const json = (await res.json()) as {
          configured?: { opentable?: boolean; resy?: boolean }
          results?: { name: string; opentable?: LiveSlot[]; resy?: LiveSlot[] }[]
        }
        const configured = {
          opentable: Boolean(json.configured?.opentable),
          resy: Boolean(json.configured?.resy),
        }
        if ((configured.opentable || configured.resy) && json.results) {
          const map: Record<string, { opentable: LiveSlot[]; resy: LiveSlot[] }> = {}
          for (const r of json.results) {
            map[r.name] = { opentable: r.opentable || [], resy: r.resy || [] }
          }
          setLiveSlots(map)
        }
      } catch {
        // Silent — the search-link fallback still renders.
      }
    },
    [],
  )

  const load = useCallback(async () => {
    const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
    setTrip(tripData)

    const { data: travelerData } = await supabase.from('travelers').select('*').eq('trip_id', tripId)
    const travelers = travelerData || []

    const saved = tripData?.options?.dining as
      | { prefs?: Partial<DiningPrefs>; suggestions?: DiningSuggestions }
      | undefined

    setPrefs({
      partySize: saved?.prefs?.partySize ?? (travelers.length || 2),
      dietary: saved?.prefs?.dietary ?? aggregateDietary(travelers),
      cuisines: saved?.prefs?.cuisines ?? '',
      area: saved?.prefs?.area ?? '',
    })
    if (saved?.suggestions) {
      setData(saved.suggestions)
      void fetchLiveSlots(saved.suggestions, {
        partySize: saved?.prefs?.partySize ?? (travelers.length || 2),
        dietary: saved?.prefs?.dietary ?? '',
        cuisines: saved?.prefs?.cuisines ?? '',
        area: saved?.prefs?.area ?? '',
      }, tripData)
    } else {
      setShowPrefs(true)
    }
    setLoading(false)
  }, [tripId, fetchLiveSlots])

  useEffect(() => { load() }, [load])

  const persist = async (nextPrefs: DiningPrefs, suggestions: DiningSuggestions) => {
    const mergedOptions = {
      ...(trip?.options || {}),
      dining: { prefs: nextPrefs, suggestions, updated_at: new Date().toISOString() },
    }
    await supabase.from('trips').update({ options: mergedOptions }).eq('id', tripId)
    setTrip((t: any) => ({ ...t, options: mergedOptions }))
  }

  const generate = async () => {
    if (!trip?.destination || trip.destination === 'TBD') return
    setGenerating(true)
    try {
      const res = await fetch('/api/planning/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'dining',
          tier: trip.locked_tier,
          trip: {
            name: trip.name,
            destination: trip.destination,
            start_date: trip.locked_date_start || trip.start_date,
            end_date: trip.locked_date_end || trip.end_date,
            locked_tier: trip.locked_tier,
          },
          dining: {
            partySize: prefs.partySize,
            dietary: prefs.dietary,
            cuisines: prefs.cuisines,
            area: prefs.area,
          },
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json.suggestions)
      setShowPrefs(false)
      await persist(prefs, json.suggestions)
      void fetchLiveSlots(json.suggestions, prefs, trip)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to generate')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return <SuitcaseLoader message="Loading dining" />

  const locked = trip?.destination && trip.destination !== 'TBD'
  if (!locked) return <LockedGate tripId={tripId} router={router} />

  const destination: string = trip.destination
  const resDate: string | undefined = trip.locked_date_start || trip.start_date || undefined

  return (
    <SubpageShell
      backHref={`/trips/${tripId}/itinerary`}
      backLabel="Itinerary"
      eyebrow={trip?.name}
      title="Dining"
      subtitle={destination}
      maxWidth="max-w-3xl"
    >
      {/* Preferences */}
      <div className="avanti-box border border-border bg-card p-5 mb-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow text-muted-foreground mb-1">Reservation preferences</p>
            <p className="text-sm text-muted-foreground m-0">
              {prefs.partySize} {prefs.partySize === 1 ? 'seat' : 'seats'}
              {prefs.dietary ? ` · ${prefs.dietary}` : ''}
              {prefs.cuisines ? ` · ${prefs.cuisines}` : ''}
              {prefs.area ? ` · ${prefs.area}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowPrefs(s => !s)}
            className="avanti-btn avanti-btn-ghost shrink-0 text-xs"
          >
            {showPrefs ? 'Hide' : 'Edit'}
          </button>
        </div>

        {showPrefs && (
          <div className="mt-5 border-t border-border pt-5 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="eyebrow text-muted-foreground block mb-2">Party size</span>
              <input
                type="number"
                min={1}
                value={prefs.partySize}
                onChange={e => setPrefs(p => ({ ...p, partySize: Math.max(1, Number(e.target.value) || 1) }))}
                className="avanti-input"
              />
            </label>
            <label className="block">
              <span className="eyebrow text-muted-foreground block mb-2">Focus area / near (optional)</span>
              <input
                type="text"
                value={prefs.area}
                onChange={e => setPrefs(p => ({ ...p, area: e.target.value }))}
                placeholder="e.g. near the hotel, old town"
                className="avanti-input"
              />
            </label>
            <label className="block">
              <span className="eyebrow text-muted-foreground block mb-2">Dietary needs</span>
              <input
                type="text"
                value={prefs.dietary}
                onChange={e => setPrefs(p => ({ ...p, dietary: e.target.value }))}
                placeholder="e.g. 2 vegetarian, 1 gluten-free"
                className="avanti-input"
              />
            </label>
            <label className="block">
              <span className="eyebrow text-muted-foreground block mb-2">Cuisines / vibe (optional)</span>
              <input
                type="text"
                value={prefs.cuisines}
                onChange={e => setPrefs(p => ({ ...p, cuisines: e.target.value }))}
                placeholder="e.g. seafood, natural wine, lively"
                className="avanti-input"
              />
            </label>
          </div>
        )}
      </div>

      {!data ? (
        <div className="avanti-box border border-border bg-card px-6 py-12 text-center">
          <p className="font-serif text-xl mb-2">Where should the group eat?</p>
          <p className="text-sm text-muted-foreground mb-6">
            Restaurant picks for your group and tier — then reserve on OpenTable or Resy in one tap.
          </p>
          <button type="button" disabled={generating} onClick={generate} className="avanti-btn avanti-btn-primary">
            {generating ? 'Curating…' : 'Suggest restaurants →'}
          </button>
        </div>
      ) : (
        <>
          {data.intro && <p className="text-sm italic text-muted-foreground mb-6">{data.intro}</p>}
          <div className="space-y-3">
            {(data.options || []).map((opt, i) => {
              const name = String(opt.name || 'Restaurant')
              const otSlots = liveSlots[name]?.opentable || []
              const resySlots = liveSlots[name]?.resy || []
              return (
                <div key={i} className="avanti-box border border-border bg-card p-5">
                  <div className="flex justify-between gap-2 mb-1">
                    <p className="font-serif text-lg m-0">{name}</p>
                    {!!opt.price_level && (
                      <p className="text-sm text-muted-foreground shrink-0">{String(opt.price_level)}</p>
                    )}
                  </div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                    {[opt.cuisine, opt.area].filter(Boolean).map(String).join(' · ')}
                  </p>
                  {!!opt.why && <p className="text-sm text-muted-foreground m-0 mb-1">{String(opt.why)}</p>}
                  {!!opt.best_for && (
                    <p className="text-xs text-muted-foreground m-0 mb-1">Best for: {String(opt.best_for)}</p>
                  )}
                  {!!opt.reservation_tip && (
                    <p className="text-xs text-muted-foreground m-0 italic">{String(opt.reservation_tip)}</p>
                  )}
                  {otSlots.length > 0 && (
                    <div className="pt-3 mt-3 border-t border-border/60">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                        OpenTable · available for {prefs.partySize} · tap to book
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {otSlots.map((slot, si) => (
                          <a
                            key={si}
                            href={slot.bookingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="avanti-btn avanti-btn-primary text-xs"
                          >
                            {formatSlotTime(slot.dateTime)}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {resySlots.length > 0 && (
                    <div className="pt-3 mt-3 border-t border-border/60">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                        Resy · available for {prefs.partySize} · tap to book
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {resySlots.map((slot, si) => (
                          <a
                            key={si}
                            href={slot.bookingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="avanti-btn avanti-btn-primary text-xs"
                          >
                            {formatSlotTime(slot.dateTime)}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-3 mt-3 border-t border-border/60">
                    <BookSearchLink
                      href={openTableSearchUrl({ name, destination, date: resDate, partySize: prefs.partySize })}
                      label={otSlots.length > 0 ? 'More times on OpenTable →' : 'Reserve on OpenTable →'}
                      variant={otSlots.length > 0 ? 'ghost' : 'primary'}
                    />
                    <BookSearchLink
                      href={resySearchUrl({ name, destination })}
                      label={resySlots.length > 0 ? 'More times on Resy' : 'Find on Resy'}
                    />
                    <BookSearchLink
                      href={beliSearchUrl({ name, destination })}
                      label="Check Beli"
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <button type="button" disabled={generating} onClick={generate} className="mt-6 w-full avanti-btn avanti-btn-ghost">
            {generating ? 'Refreshing…' : '↻ Refresh suggestions'}
          </button>
        </>
      )}

      <div className="mt-8 avanti-box border border-border bg-forest-mist/40 p-5 text-center">
        <p className="font-serif text-lg mb-2">After you book</p>
        <p className="text-sm text-muted-foreground mb-4">
          Forward the OpenTable/Resy confirmation email or upload it — it merges into the group itinerary.
        </p>
        <button type="button" onClick={() => router.push(`/trips/${tripId}/bookings`)} className="avanti-btn avanti-btn-primary">
          Trip vault →
        </button>
      </div>
    </SubpageShell>
  )
}
