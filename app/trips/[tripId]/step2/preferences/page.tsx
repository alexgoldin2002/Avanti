'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import SuitcaseLoader from '../../../../components/SuitcaseLoader'
import Step2WorkspaceShell from '@/components/step2/Step2WorkspaceShell'
import { TRIP_ACTIVITY_OPTIONS } from '@/lib/preview-trip-storage'
import { parseDepartureCitiesFromStep2, departureCitiesToStoredString } from '@/lib/departure-cities'
import { findTravelerForUser, patchTravelerStep2 } from '@/lib/traveler-lookup'
import { loadGoogleMapsScript, whenGooglePlacesReady } from '@/lib/google-maps-loader'

const VIBE_OPTIONS = ['Luxury', 'Budget-conscious', 'Party', 'Romantic', 'Family-friendly', 'Cultural immersion', 'Off the beaten path', 'Touristy & easy', 'Relaxed & slow', 'Action-packed', 'Other']
const ACCOMMODATION_OPTIONS = ['Hotel', 'Airbnb / villa', 'Resort', 'Boutique / guesthouse', 'No preference']
const BUDGET_OPTIONS = ['Under $1,000', '$1,000–2,000', '$2,000–4,000', '$4,000–7,000', '$7,000+', 'Other']

export default function KnownPreferencesPage() {
  const { tripId } = useParams() as { tripId: string }
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trip, setTrip] = useState<{ name?: string; destination?: string } | null>(null)
  const [travelerId, setTravelerId] = useState<string | null>(null)

  const [departureCities, setDepartureCities] = useState<string[]>([])
  const [departureCityInput, setDepartureCityInput] = useState('')
  const [activities, setActivities] = useState<string[]>([])
  const [vibe, setVibe] = useState<string[]>([])
  const [vibeOther, setVibeOther] = useState('')
  const [accommodation, setAccommodation] = useState('')
  const [budget, setBudget] = useState('')
  const [budgetOther, setBudgetOther] = useState('')
  const [notes, setNotes] = useState('')

  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }
  const sectionLabel = { fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'var(--muted-foreground)', marginBottom: '10px', display: 'block' }
  const inputStyle = { width: '100%', borderBottom: '1px solid #d4d4c8', background: 'transparent', padding: '8px 0', fontSize: '15px', color: 'var(--foreground)', outline: 'none', ...s }
  const chipStyle = (selected: boolean) => ({
    padding: '8px 16px', fontSize: '13px', cursor: 'pointer',
    border: `1px solid ${selected ? 'var(--forest-deep)' : '#d4d4c8'}`,
    background: selected ? '#e8f5ee' : '#fff',
    color: selected ? 'var(--forest-deep)' : '#6a6a6a',
    borderRadius: '24px', transition: 'all 0.15s', ...s,
  })
  const toggleMulti = (list: string[], value: string, setter: (v: string[]) => void) =>
    setter(list.includes(value) ? list.filter(v => v !== value) : [...list, value])

  useEffect(() => {
    void (async () => {
      const { data: tripData } = await supabase
        .from('trips')
        .select('name, destination, destination_planning_path')
        .eq('id', tripId)
        .single()

      // This page is only for known-destination trips; everyone else uses the normal Step 2 flow.
      if (!tripData || tripData.destination_planning_path !== 'known') {
        router.replace(`/trips/${tripId}/step2`)
        return
      }
      setTrip(tripData)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/'); return }
      const traveler = await findTravelerForUser(supabase, tripId, user.id)
      if (traveler) {
        setTravelerId(traveler.id)
        const s2 = (traveler.step2 as Record<string, unknown>) || {}
        setDepartureCities(parseDepartureCitiesFromStep2(s2))
        if (Array.isArray(s2.activities)) setActivities(s2.activities as string[])
        if (Array.isArray(s2.vibe)) setVibe(s2.vibe as string[])
        if (typeof s2.vibeOther === 'string') setVibeOther(s2.vibeOther)
        if (typeof s2.accommodation === 'string') setAccommodation(s2.accommodation)
        if (typeof s2.budget === 'string') {
          if (BUDGET_OPTIONS.includes(s2.budget)) setBudget(s2.budget)
          else if (s2.budget) { setBudget('Other'); setBudgetOther(s2.budget) }
        }
        if (typeof s2.q3 === 'string') setNotes(s2.q3)
      }
      setLoading(false)
    })()
  }, [tripId, router])

  // Load Google Places once, then attach the departure-city autocomplete.
  useEffect(() => {
    loadGoogleMapsScript()
  }, [])

  useEffect(() => {
    if (loading) return
    const tryInit = () => {
      const input = document.getElementById('departure-city-input') as HTMLInputElement | null
      if (!input || !(window as any).google?.maps?.places) return
      const autocomplete = new (window as any).google.maps.places.Autocomplete(input, {
        types: ['(cities)'],
        fields: ['formatted_address', 'name', 'place_id'],
      })
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        if (!place?.place_id) return
        const name = place.formatted_address || place.name || ''
        if (!name) return
        setDepartureCities(prev => (prev.includes(name) ? prev : [...prev, name]))
        setDepartureCityInput('')
      })
    }
    whenGooglePlacesReady().then(() => tryInit())
  }, [loading])

  const valid =
    departureCities.length > 0 &&
    activities.length > 0 &&
    vibe.length > 0 &&
    !(vibe.includes('Other') && !vibeOther.trim()) &&
    !!accommodation &&
    !!budget &&
    !(budget === 'Other' && !budgetOther.trim())

  const handleSave = async () => {
    if (!valid || saving) return
    setSaving(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/'); return }
      const tid = travelerId || (await findTravelerForUser(supabase, tripId, user.id))?.id
      if (!tid) throw new Error('We could not find your traveler record for this trip.')

      const { error: saveErr } = await patchTravelerStep2(supabase, tid, {
        departureCities,
        departureCity: departureCitiesToStoredString(departureCities),
        activities,
        vibe,
        vibeOther,
        accommodation,
        budget: budget === 'Other' ? budgetOther : budget,
        budgetOther,
        q3: notes,
        preferencesComplete: true,
      })
      if (saveErr) throw new Error(saveErr.message)

      router.push(`/trips/${tripId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setSaving(false)
    }
  }

  if (loading) return <SuitcaseLoader message="Loading" />

  const divider = <div style={{ borderTop: '0.5px solid #e4e4d8' }} />

  return (
    <Step2WorkspaceShell
      tripId={tripId}
      backHref={`/trips/${tripId}`}
      eyebrow="Step 2 — your preferences"
      tripName={trip?.name}
      subtitle={trip?.destination ? `Heading to ${trip.destination} — tell us how you like to travel` : 'Tell us how you like to travel'}
      maxWidth="max-w-lg"
    >
      <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', margin: '0 0 24px', lineHeight: 1.6, ...s }}>
        Your destination is set, so we&apos;ll skip the &ldquo;where to&rdquo; questions. These preferences help Avanti tailor
        flights, hotels, and activities for your trip.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <span style={sectionLabel}>Where are you flying from?</span>
          <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: '0 0 10px', lineHeight: 1.5, ...s }}>
            Start typing a city and pick from the Google suggestions — each departure city is verified before it&apos;s added.
          </p>
          {departureCities.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
              {departureCities.map((city, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#e8f5ee', border: '1px solid #2d6a4f', borderRadius: '20px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--forest-deep)', ...s }}>{city}</span>
                  <button onClick={() => setDepartureCities(departureCities.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2d6a4f', fontSize: '14px', lineHeight: 1, padding: '0 0 0 2px' }} aria-label={`Remove ${city}`}>×</button>
                </div>
              ))}
            </div>
          )}
          <input
            id="departure-city-input"
            type="text"
            autoComplete="off"
            value={departureCityInput}
            onChange={e => setDepartureCityInput(e.target.value)}
            placeholder="Type a city..."
            style={inputStyle}
          />
        </div>
        {divider}

        <div>
          <span style={sectionLabel}>What kind of activities?</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {TRIP_ACTIVITY_OPTIONS.map(opt => (
              <button key={opt} onClick={() => toggleMulti(activities, opt, setActivities)} style={chipStyle(activities.includes(opt))}>{opt}</button>
            ))}
          </div>
        </div>
        {divider}

        <div>
          <span style={sectionLabel}>What&apos;s the vibe?</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            {VIBE_OPTIONS.map(opt => (
              <button key={opt} onClick={() => toggleMulti(vibe, opt, setVibe)} style={chipStyle(vibe.includes(opt))}>{opt}</button>
            ))}
          </div>
          {vibe.includes('Other') && (
            <input style={{ ...inputStyle, marginTop: '8px' }} value={vibeOther} onChange={e => setVibeOther(e.target.value)} placeholder="Describe the vibe..." />
          )}
        </div>
        {divider}

        <div>
          <span style={sectionLabel}>Hotel or Airbnb?</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {ACCOMMODATION_OPTIONS.map(opt => (
              <button key={opt} onClick={() => setAccommodation(opt)} style={chipStyle(accommodation === opt)}>{opt}</button>
            ))}
          </div>
        </div>
        {divider}

        <div>
          <span style={sectionLabel}>Trip budget per person?</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            {BUDGET_OPTIONS.map(opt => (
              <button key={opt} onClick={() => setBudget(opt)} style={chipStyle(budget === opt)}>{opt}</button>
            ))}
          </div>
          {budget === 'Other' && (
            <input style={{ ...inputStyle, marginTop: '8px' }} value={budgetOther} onChange={e => setBudgetOther(e.target.value)} placeholder="Describe your budget..." />
          )}
        </div>
        {divider}

        <div>
          <span style={sectionLabel}>Anything else? (optional)</span>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Deal breakers, accessibility needs, an allergy in the group, must-dos..."
            rows={3}
            style={{ ...inputStyle, borderBottom: '1px solid #d4d4c8', resize: 'vertical' }}
          />
        </div>
      </div>

      {error && (
        <p style={{ fontSize: '13px', color: '#a32d2d', textAlign: 'center', margin: '20px 0 0' }}>{error}</p>
      )}

      <button
        type="button"
        disabled={!valid || saving}
        onClick={handleSave}
        style={{
          width: '100%', marginTop: '28px', padding: '16px', border: 'none',
          background: 'var(--forest-deep)', color: '#ffffff',
          fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase',
          cursor: valid && !saving ? 'pointer' : 'not-allowed', opacity: valid && !saving ? 1 : 0.5, ...s,
        }}
      >
        {saving ? 'Saving…' : 'Save & continue to Step 3 →'}
      </button>
    </Step2WorkspaceShell>
  )
}
