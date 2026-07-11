'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import SuitcaseLoader from '../../../../components/SuitcaseLoader'
import Step2WorkspaceShell from '@/components/step2/Step2WorkspaceShell'
import DateRangeFields, { isValidDateRange } from '../../../../components/DateRangeFields'
import {
  isDestinationPlanningPath,
  PLANNING_PATH_OPTIONS,
  type DestinationPlanningPath,
} from '@/lib/step2/planning-path'
import { loadGoogleMapsScript, whenGooglePlacesReady } from '@/lib/google-maps-loader'

const INVALID_PLACE_MSG =
  'That isn\'t a verified place — pick a city from the Google dropdown, not free text or a sentence.'

const DATE_MODE_OPTIONS = ['Fixed dates', 'Flexible — I have a range'] as const
const FLEX_LENGTH_OPTIONS = ['3–4 nights', '5–7 nights', '8–10 nights', '11–14 nights', '2+ weeks'] as const

type DateMode = typeof DATE_MODE_OPTIONS[number] | ''

function PathConfirmModal({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  loading = false,
}: {
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}) {
  const modalStyle = { fontFamily: 'var(--font-cormorant), Georgia, serif' }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '24px' }}>
      <div style={{ background: 'var(--cream)', padding: '28px', width: '100%', maxWidth: '420px', textAlign: 'center', ...modalStyle, boxShadow: 'var(--shadow-box)' }}>
        <p style={{ fontSize: '18px', fontWeight: 300, color: 'var(--foreground)', margin: '0 0 12px' }}>{title}</p>
        <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', margin: '0 0 24px', lineHeight: 1.7 }}>{body}</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{ flex: 1, border: '1px solid var(--border)', padding: '12px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', background: 'transparent', cursor: 'pointer', ...modalStyle }}
          >
            Go back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{ flex: 1, border: '1px solid var(--forest-deep)', padding: '12px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#fff', background: 'var(--forest-deep)', cursor: 'pointer', ...modalStyle, opacity: loading ? 0.5 : 1 }}
          >
            {loading ? 'Saving…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function SubmitUnlockStep3Label() {
  return <>Submit &amp; unlock Step 3 →</>
}

export default function Step2PathPage() {
  const { tripId } = useParams() as { tripId: string }
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [trip, setTrip] = useState<{ name?: string; destination_planning_path?: string | null } | null>(null)
  const [isOrganizer, setIsOrganizer] = useState(false)
  const [selected, setSelected] = useState<DestinationPlanningPath | null>(null)
  const [knownSearch, setKnownSearch] = useState('')
  const [knownPlaces, setKnownPlaces] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [placeInputError, setPlaceInputError] = useState<string | null>(null)
  const [dates, setDates] = useState<DateMode>('')
  const [fixedDates, setFixedDates] = useState({ start: '', end: '' })
  const [flexLength, setFlexLength] = useState('')
  const [dateError, setDateError] = useState<string | null>(null)
  const [showPathPicker, setShowPathPicker] = useState(true)
  const [showKnownCommitConfirm, setShowKnownCommitConfirm] = useState(false)

  const selectedOption = PLANNING_PATH_OPTIONS.find(o => o.id === selected)

  const openPathForm = (path: DestinationPlanningPath) => {
    setSelected(path)
    setShowPathPicker(false)
    setError(null)
    setDateError(null)
    setPlaceInputError(null)
  }

  const backToPathPicker = () => {
    setShowPathPicker(true)
    setSelected(null)
    setError(null)
    setDateError(null)
    setPlaceInputError(null)
  }

  const addKnownPlace = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setKnownPlaces(prev => (prev.includes(trimmed) ? prev : [...prev, trimmed]))
    setKnownSearch('')
    setPlaceInputError(null)
    const input = document.getElementById('known-destination-input') as HTMLInputElement | null
    if (input) input.value = ''
  }

  const validateKnownInputField = () => {
    const input = document.getElementById('known-destination-input') as HTMLInputElement | null
    const value = (input?.value ?? knownSearch).trim()
    if (value) {
      setPlaceInputError(INVALID_PLACE_MSG)
    } else {
      setPlaceInputError(null)
    }
  }

  useEffect(() => {
    loadGoogleMapsScript()
  }, [])

  useEffect(() => {
    if (selected !== 'known') return
    const tryInit = () => {
      const input = document.getElementById('known-destination-input') as HTMLInputElement | null
      if (!input) return
      const g = (window as Window & {
        google?: {
          maps?: {
            places?: {
              Autocomplete: new (
                el: HTMLInputElement,
                opts: object,
              ) => { addListener: (ev: string, fn: () => void) => void; getPlace: () => {
                place_id?: string
                formatted_address?: string
                name?: string
              } }
            }
          }
        }
      }).google
      if (!g?.maps?.places) return
      const autocomplete = new g.maps.places.Autocomplete(input, {
        types: ['(cities)'],
        fields: ['formatted_address', 'name', 'place_id'],
      })
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        if (!place?.place_id) {
          window.setTimeout(() => {
            const value = input.value.trim()
            if (value) setPlaceInputError(INVALID_PLACE_MSG)
            else setPlaceInputError(null)
          }, 0)
          return
        }
        setPlaceInputError(null)
        const name = place.formatted_address || place.name || ''
        if (name) addKnownPlace(name)
      })
    }
    whenGooglePlacesReady().then(() => tryInit())
  }, [selected])

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
  const smallChipStyle = (active: boolean) => ({
    padding: '8px 16px',
    fontSize: '13px',
    cursor: 'pointer',
    border: `1px solid ${active ? 'var(--forest-deep)' : '#d4d4c8'}`,
    background: active ? '#e8f5ee' : '#fff',
    color: active ? 'var(--forest-deep)' : '#6a6a6a',
    borderRadius: '24px',
    transition: 'all 0.15s',
    ...s,
  })
  const dateLabelStyle = {
    fontSize: '10px',
    letterSpacing: '0.18em',
    textTransform: 'uppercase' as const,
    color: 'var(--muted-foreground)',
    display: 'block',
    marginBottom: '8px',
  }
  const dateInputStyle = {
    width: '100%',
    borderBottom: '1px solid #d4d4c8',
    background: 'transparent',
    padding: '8px 0',
    fontSize: '14px',
    color: 'var(--foreground)',
    outline: 'none',
    fontFamily: 'var(--font-cormorant), Georgia, serif',
    boxSizing: 'border-box' as const,
  }

  useEffect(() => {
    void (async () => {
      const { data: tripData } = await supabase
        .from('trips')
        .select('name, destination_planning_path, organizer_id')
        .eq('id', tripId)
        .single()
      if (tripData?.destination_planning_path && isDestinationPlanningPath(tripData.destination_planning_path)) {
        if (tripData.destination_planning_path === 'known') {
          router.replace(`/trips/${tripId}/step2/preferences`)
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

  // Members can't pick the path — once the host chooses one, auto-route them to it.
  useEffect(() => {
    if (loading || isOrganizer || trip?.destination_planning_path) return
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('trips')
        .select('destination_planning_path')
        .eq('id', tripId)
        .single()
      const path = data?.destination_planning_path
      if (path && isDestinationPlanningPath(path)) {
        clearInterval(interval)
        router.replace(path === 'known' ? `/trips/${tripId}/step2/preferences` : `/trips/${tripId}/step2`)
      }
    }, 4000)
    return () => clearInterval(interval)
  }, [loading, isOrganizer, trip, tripId, router])

  const validateKnownSubmit = (): boolean => {
    if (knownSearch.trim()) {
      setPlaceInputError(INVALID_PLACE_MSG)
      return false
    }
    if (knownPlaces.length === 0) {
      setError('Select at least one destination from the Google suggestions')
      return false
    }
    if (!dates) {
      setDateError('Choose fixed dates or a flexible range')
      return false
    }
    if (!isValidDateRange(fixedDates.start, fixedDates.end)) {
      setDateError('Enter valid dates — your trip can\'t start in the past and return must be on or after departure')
      return false
    }
    if (dates === 'Flexible — I have a range' && !flexLength) {
      setDateError('Select a preferred trip length')
      return false
    }
    return true
  }

  const requestSubmit = () => {
    if (!selected || busy) return
    if (selected === 'known') {
      if (!validateKnownSubmit()) return
      setShowKnownCommitConfirm(true)
      return
    }
    void handleSubmit()
  }

  const handleSubmit = async () => {
    if (!selected || busy) return
    if (selected === 'known' && !validateKnownSubmit()) return

    setBusy(true)
    setError(null)
    setDateError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`

      const knownDestinations =
        selected === 'known' ? knownPlaces : undefined

      const res = await fetch(`/api/trips/${tripId}/planning-path`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          path: selected,
          knownDestinations,
          ...(selected === 'known'
            ? {
                dates,
                fixedDates,
                flexLength: dates === 'Flexible — I have a range' ? flexLength : undefined,
              }
            : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')

      setShowKnownCommitConfirm(false)
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
      <Step2WorkspaceShell tripId={tripId} backHref={`/trips/${tripId}/invite`} maxWidth="max-w-md">
        <div className="text-center py-12">
          <p className="font-serif text-lg mb-3">Waiting for the host</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The trip organizer needs to choose how your group will pick a destination before Step 2 opens.
          </p>
        </div>
      </Step2WorkspaceShell>
    )
  }

  return (
    <>
    <Step2WorkspaceShell
      tripId={tripId}
      backHref={`/trips/${tripId}/invite`}
      eyebrow="Step 2 — before you begin"
      tripName={trip?.name}
      subtitle={
        showPathPicker
          ? 'What stage best describes your group right now?'
          : selectedOption?.title
      }
      maxWidth="max-w-lg"
    >
        {showPathPicker ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
            {PLANNING_PATH_OPTIONS.map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => openPathForm(opt.id)}
                style={chipStyle(false)}
              >
                <span style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', display: 'block', marginBottom: '4px' }}>
                  Step {opt.stepLabel}
                </span>
                <span style={{ display: 'block', fontSize: '16px', color: 'var(--foreground)', marginBottom: '4px' }}>{opt.title}</span>
                <span style={{ display: 'block', fontSize: '13px', color: 'var(--muted-foreground)', lineHeight: 1.5 }}>{opt.description}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={backToPathPicker}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'none',
                border: 'none',
                padding: 0,
                marginBottom: '20px',
                cursor: 'pointer',
                fontSize: '10px',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: 'var(--muted-foreground)',
                ...s,
              }}
            >
              ← All options
            </button>

            {selectedOption && selected !== 'known' && (
              <div style={{ marginBottom: '24px', padding: '20px', border: '1px solid #d4d4c8', background: '#ffffff' }}>
                <span style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', display: 'block', marginBottom: '4px' }}>
                  Step {selectedOption.stepLabel}
                </span>
                <span style={{ display: 'block', fontSize: '16px', color: 'var(--foreground)', marginBottom: '4px' }}>{selectedOption.title}</span>
                <span style={{ display: 'block', fontSize: '13px', color: 'var(--muted-foreground)', lineHeight: 1.5 }}>{selectedOption.description}</span>
              </div>
            )}
          </>
        )}

        {!showPathPicker && selected === 'known' && (
          <div style={{ marginBottom: '24px', padding: '20px', border: '1px solid #d4d4c8', background: '#ffffff' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 8px' }}>
              Where are you going?
            </p>
            <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: '0 0 12px', lineHeight: 1.5, ...s }}>
              Start typing a city and pick from the Google suggestions — only verified places can be added.
            </p>
            {knownPlaces.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                {knownPlaces.map((place, i) => (
                  <div key={place} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#e8f5ee', border: '1px solid #2d6a4f', borderRadius: '20px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--forest-deep)' }}>{place}</span>
                    <button type="button" onClick={() => setKnownPlaces(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2d6a4f', fontSize: '14px', lineHeight: 1, padding: '0 0 0 2px' }} aria-label={`Remove ${place}`}>×</button>
                  </div>
                ))}
              </div>
            )}
            <input
              id="known-destination-input"
              type="text"
              autoComplete="off"
              value={knownSearch}
              onChange={e => {
                const value = e.target.value
                setKnownSearch(value)
                if (!value.trim()) setPlaceInputError(null)
                else if (placeInputError) setPlaceInputError(null)
                if (error) setError(null)
              }}
              onBlur={() => {
                window.setTimeout(validateKnownInputField, 250)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  validateKnownInputField()
                }
              }}
              placeholder="e.g. Lisbon, Portugal"
              aria-invalid={Boolean(placeInputError)}
              aria-describedby={placeInputError ? 'known-place-error' : undefined}
              style={{
                width: '100%',
                borderBottom: `1px solid ${placeInputError ? '#c0392b' : '#d4d4c8'}`,
                background: 'transparent',
                padding: '8px 0',
                fontSize: '15px',
                outline: 'none',
                ...s,
              }}
            />
            {placeInputError && (
              <p
                id="known-place-error"
                role="alert"
                style={{
                  fontSize: '12px',
                  color: '#c0392b',
                  margin: '8px 0 0',
                  lineHeight: 1.5,
                  padding: '10px 12px',
                  background: '#fdf0ef',
                  border: '1px solid #e8b4b0',
                  ...s,
                }}
              >
                {placeInputError}
              </p>
            )}
          </div>
        )}

        {!showPathPicker && selected === 'known' && knownPlaces.length > 0 && (
          <div style={{ marginBottom: '24px', padding: '20px', border: '1px solid #d4d4c8', background: '#ffffff' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 8px' }}>
              What are your dates?
            </p>
            <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: '0 0 12px', lineHeight: 1.5, ...s }}>
              Pick a range — it can be wide, but we need start and end dates.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {DATE_MODE_OPTIONS.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    setDates(opt)
                    setDateError(null)
                  }}
                  style={smallChipStyle(dates === opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
            {dates === 'Fixed dates' && (
              <DateRangeFields
                start={fixedDates.start}
                end={fixedDates.end}
                onChange={next => {
                  setFixedDates(next)
                  setDateError(null)
                }}
                startLabel="Departure"
                endLabel="Return"
                inputStyle={dateInputStyle}
                labelStyle={dateLabelStyle}
              />
            )}
            {dates === 'Flexible — I have a range' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <DateRangeFields
                  start={fixedDates.start}
                  end={fixedDates.end}
                  onChange={next => {
                    setFixedDates(next)
                    setDateError(null)
                  }}
                  startLabel="Earliest departure"
                  endLabel="Latest return"
                  inputStyle={dateInputStyle}
                  labelStyle={dateLabelStyle}
                />
                <div>
                  <label style={dateLabelStyle}>Preferred trip length</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {FLEX_LENGTH_OPTIONS.map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          setFlexLength(opt)
                          setDateError(null)
                        }}
                        style={smallChipStyle(flexLength === opt)}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {dateError && (
              <p
                role="alert"
                style={{
                  fontSize: '12px',
                  color: '#c0392b',
                  margin: '12px 0 0',
                  lineHeight: 1.5,
                  padding: '10px 12px',
                  background: '#fdf0ef',
                  border: '1px solid #e8b4b0',
                  ...s,
                }}
              >
                {dateError}
              </p>
            )}
          </div>
        )}

        {error && (
          <p style={{ fontSize: '13px', color: '#a32d2d', textAlign: 'center', marginBottom: '16px' }}>{error}</p>
        )}

        {!showPathPicker && (
        <button
          type="button"
          disabled={!selected || busy}
          onClick={requestSubmit}
          style={{
            width: '100%',
            padding: '16px',
            border: 'none',
            background: 'var(--forest-deep)',
            color: '#ffffff',
            fontSize: '10px',
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            cursor: selected && !busy ? 'pointer' : 'not-allowed',
            opacity: selected && !busy ? 1 : 0.5,
            ...s,
          }}
        >
          {busy ? 'Saving…' : selected === 'known' ? <SubmitUnlockStep3Label /> : 'Begin Step 2 →'}
        </button>
        )}

        {showKnownCommitConfirm && (
          <PathConfirmModal
            title="Lock in this destination?"
            body={`You are now committing to ${knownPlaces.join(' · ')}. If you continue, the destination will be locked in. Next you'll fill in your travel preferences (departure city, vibe, budget…) before Step 3 unlocks.`}
            confirmLabel="Lock destination"
            loading={busy}
            onCancel={() => { if (!busy) setShowKnownCommitConfirm(false) }}
            onConfirm={() => void handleSubmit()}
          />
        )}
    </Step2WorkspaceShell>
    </>
  )
}
