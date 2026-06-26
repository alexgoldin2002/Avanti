'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import SuitcaseLoader from '../../../../components/SuitcaseLoader'
import { BackLink } from '../../../../components/SubpageShell'
import {
  isDestinationPlanningPath,
  PLANNING_PATH_OPTIONS,
  type DestinationPlanningPath,
} from '@/lib/step2/planning-path'

export default function Step2PathPage() {
  const { tripId } = useParams() as { tripId: string }
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [trip, setTrip] = useState<{ name?: string; destination_planning_path?: string | null } | null>(null)
  const [isOrganizer, setIsOrganizer] = useState(false)
  const [selected, setSelected] = useState<DestinationPlanningPath | null>(null)
  const [knownInput, setKnownInput] = useState('')
  const [knownPlaces, setKnownPlaces] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }
  const chipStyle = (active: boolean) => ({
    padding: '14px 18px',
    fontSize: '14px',
    cursor: 'pointer',
    border: `1px solid ${active ? 'var(--forest-deep)' : '#d4d4c8'}`,
    background: active ? '#e8f5ee' : '#fff',
    color: active ? 'var(--forest-deep)' : '#6a6a6a',
    borderRadius: '0',
    transition: 'all 0.15s',
    textAlign: 'left' as const,
    width: '100%',
    ...s,
  })

  useEffect(() => {
    void (async () => {
      const { data: tripData } = await supabase
        .from('trips')
        .select('name, destination_planning_path, organizer_id')
        .eq('id', tripId)
        .single()
      if (tripData?.destination_planning_path && isDestinationPlanningPath(tripData.destination_planning_path)) {
        if (tripData.destination_planning_path === 'known') {
          router.replace(`/trips/${tripId}`)
          return
        }
        router.replace(`/trips/${tripId}/step2`)
        return
      }
      setTrip(tripData)
      const { data: { user } } = await supabase.auth.getUser()
      if (user && tripData) setIsOrganizer(tripData.organizer_id === user.id)
      setLoading(false)
    })()
  }, [tripId, router])

  const addKnownPlace = () => {
    const val = knownInput.trim()
    if (!val) return
    setKnownPlaces(prev => [...prev, val])
    setKnownInput('')
  }

  const handleSubmit = async () => {
    if (!selected || busy) return
    if (selected === 'known' && knownPlaces.length === 0 && !knownInput.trim()) {
      setError('Enter at least one destination')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`

      const knownDestinations =
        selected === 'known'
          ? [...knownPlaces, ...(knownInput.trim() ? [knownInput.trim()] : [])]
          : undefined

      const res = await fetch(`/api/trips/${tripId}/planning-path`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ path: selected, knownDestinations }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')

      router.push(data.redirectTo || `/trips/${tripId}/step2`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <SuitcaseLoader message="Loading" />

  if (!isOrganizer) {
    return (
      <main style={{ minHeight: '100vh', paddingBottom: '140px', ...s }}>
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
          <BackLink href={`/trips/${tripId}/invite`} wrapperClassName="mb-8 flex justify-end" />
          <p style={{ fontSize: '18px', marginBottom: '12px' }}>Waiting for the host</p>
          <p style={{ fontSize: '14px', color: 'var(--muted-foreground)', lineHeight: 1.6 }}>
            The trip organizer needs to choose how your group will pick a destination before Step 2 opens.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', paddingBottom: '140px', ...s }}>
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '48px 24px' }}>
        <BackLink href={`/trips/${tripId}/invite`} wrapperClassName="mb-8 flex justify-end" />

        <p style={{ fontSize: '10px', letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 8px', textAlign: 'center' }}>
          Step 2 — before you begin
        </p>
        <h1 style={{ fontSize: '26px', fontWeight: 300, textAlign: 'center', margin: '0 0 8px', ...s }}>
          {trip?.name}
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--muted-foreground)', textAlign: 'center', lineHeight: 1.6, margin: '0 0 32px' }}>
          What stage best describes your group right now?
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
          {PLANNING_PATH_OPTIONS.map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSelected(opt.id)}
              style={chipStyle(selected === opt.id)}
            >
              <span style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', display: 'block', marginBottom: '4px' }}>
                Step {opt.stepLabel}
              </span>
              <span style={{ display: 'block', fontSize: '16px', color: 'var(--foreground)', marginBottom: '4px' }}>{opt.title}</span>
              <span style={{ display: 'block', fontSize: '13px', color: 'var(--muted-foreground)', lineHeight: 1.5 }}>{opt.description}</span>
            </button>
          ))}
        </div>

        {selected === 'known' && (
          <div style={{ marginBottom: '24px', padding: '20px', border: '1px solid #d4d4c8', background: '#fafaf8' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 12px' }}>
              Where are you going?
            </p>
            {knownPlaces.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                {knownPlaces.map((place, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#e8f5ee', border: '1px solid #2d6a4f' }}>
                    <span style={{ fontSize: '13px', color: 'var(--forest-deep)' }}>{place}</span>
                    <button type="button" onClick={() => setKnownPlaces(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2d6a4f' }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                value={knownInput}
                onChange={e => setKnownInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKnownPlace() } }}
                placeholder="e.g. Lisbon, Portugal"
                style={{ flex: 1, borderBottom: '1px solid #d4d4c8', background: 'transparent', padding: '8px 0', fontSize: '15px', outline: 'none', ...s }}
              />
              {knownInput.trim() && (
                <button type="button" onClick={addKnownPlace} style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2d6a4f', background: 'none', border: 'none', cursor: 'pointer', ...s }}>
                  Add
                </button>
              )}
            </div>
          </div>
        )}

        {error && (
          <p style={{ fontSize: '13px', color: '#a32d2d', textAlign: 'center', marginBottom: '16px' }}>{error}</p>
        )}

        <button
          type="button"
          disabled={!selected || busy}
          onClick={() => void handleSubmit()}
          style={{
            width: '100%',
            padding: '16px',
            border: 'none',
            background: 'var(--forest-deep)',
            color: '#fafaf8',
            fontSize: '10px',
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            cursor: selected && !busy ? 'pointer' : 'not-allowed',
            opacity: selected && !busy ? 1 : 0.5,
            ...s,
          }}
        >
          {busy ? 'Saving…' : 'Submit & unlock Step 2 →'}
        </button>
      </div>
    </main>
  )
}
